import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { setStripeClient } from "@/lib/stripe";
import { createBooking, type CreateBookingInput } from "@/lib/services/bookings";
import {
  cancelBooking,
  captureDeposit,
  finalizeRentalPayment,
  placeDueDepositHolds,
  setBookingStatus,
  startRentalPayment,
} from "@/lib/services/payments";
import { constructStripeEvent, processStripeEvent } from "@/lib/services/webhooks";
import { completeConfirmation } from "@/lib/services/payments";
import { currentLegal, recordAcceptance } from "@/lib/services/legal";
import { sha256 } from "@/lib/domain/legal";
import { localDateMinuteToUtc } from "@/lib/time";
import { createFakeStripe } from "../helpers/fake-stripe";
import { hasTestDb, resetDb, seedCatalog } from "../helpers/fixtures";

const now = localDateMinuteToUtc("2027-04-28", 600); // Wed 10:00
const MIN = 60_000;

describe.skipIf(!hasTestDb)("Stripe payments & webhooks", () => {
  let catalog: Awaited<ReturnType<typeof seedCatalog>>;
  let fake: ReturnType<typeof createFakeStripe>;

  beforeEach(async () => {
    await resetDb();
    catalog = await seedCatalog();
    fake = createFakeStripe();
    setStripeClient(fake.client);
  });
  afterEach(() => setStripeClient(null));

  function input(overrides: Partial<CreateBookingInput> = {}): CreateBookingInput {
    return {
      productId: catalog.day.id,
      machineId: catalog.aura.id,
      startsAt: localDateMinuteToUtc("2027-04-29", 480), // tomorrow 08:00 → deposit held right away
      customer: { name: "Sam", email: "sam@example.com" },
      extraBalls: false,
      fulfillment: "PICKUP",
      channel: "ONLINE",
      now,
      ...overrides,
    };
  }

  /** What the checkout does right before charging: record the clickwrap acceptance. */
  async function accept(bookingId: string) {
    const live = await currentLegal();
    return recordAcceptance({
      bookingId,
      name: "Sam",
      contact: "sam@example.com",
      termsId: live.terms.id,
      waiverId: live.waiver.id,
      boxes: ["terms_waiver", "age_19"],
      method: "checkout",
      ip: "203.0.113.7",
      userAgent: "vitest",
    });
  }

  async function bookAndPay(overrides: Partial<CreateBookingInput> = {}, opts: { accept?: boolean } = {}) {
    const booking = await createBooking(input(overrides));
    await startRentalPayment(booking.id);
    if (opts.accept !== false) await accept(booking.id);
    const payment = await db.payment.findFirstOrThrow({ where: { bookingId: booking.id } });
    const pi = fake.succeed(payment.stripePaymentIntentId!);
    return { booking, pi };
  }

  async function deliver(type: string, object: unknown, id?: string) {
    const e = fake.event(type, object, id);
    const event = constructStripeEvent(e.payload, e.header);
    return processStripeEvent(event);
  }

  it("rejects events with a bad signature", () => {
    const e = fake.event("payment_intent.succeeded", {});
    // Tampered body with the original signature must be rejected.
    expect(() => constructStripeEvent(e.payload.replace('"type"', '"typ3"'), e.header)).toThrow();
    expect(() => constructStripeEvent(e.payload, null)).toThrow();
  });

  it("creates the rental PaymentIntent with the booking total and saves the card", async () => {
    const booking = await createBooking(input({ extraBalls: true }));
    const { amountCents } = await startRentalPayment(booking.id);
    expect(amountCents).toBe(booking.totalCents);
    const create = fake.calls.find((c) => c.method === "paymentIntents.create")!.args[0] as Record<string, unknown>;
    expect(create).toMatchObject({ currency: "cad", setup_future_usage: "off_session", metadata: { kind: "rental" } });
  });

  it("confirms the booking and places a manual-capture deposit hold on payment", async () => {
    const { booking, pi } = await bookAndPay();
    expect(await deliver("payment_intent.succeeded", pi)).toBe("processed");

    const after = await db.booking.findUniqueOrThrow({
      where: { id: booking.id },
      include: { deposit: true, payments: true },
    });
    expect(after.status).toBe("CONFIRMED");
    expect(after.payments[0].status).toBe("SUCCEEDED");
    expect(after.payments[0].receiptUrl).toContain("receipts");
    expect(after.deposit?.status).toBe("HELD");
    expect(after.deposit?.stripePaymentMethodId).toBe("pm_card_visa");

    const hold = fake.calls.filter((c) => c.method === "paymentIntents.create")[1].args[0] as Record<string, unknown>;
    expect(hold).toMatchObject({ amount: 40000, capture_method: "manual", confirm: true, off_session: true });
    expect(await db.notificationLog.count({ where: { template: "booking_confirmed" } })).toBe(1);
  });

  it("ignores duplicate deliveries of the same event", async () => {
    const { pi } = await bookAndPay();
    expect(await deliver("payment_intent.succeeded", pi, "evt_same")).toBe("processed");
    expect(await deliver("payment_intent.succeeded", pi, "evt_same")).toBe("duplicate");
    expect(fake.calls.filter((c) => c.method === "paymentIntents.create")).toHaveLength(2);
  });

  it("is idempotent when the browser and the webhook both finalize", async () => {
    const { booking, pi } = await bookAndPay();
    const result = await finalizeRentalPayment(booking.id);
    expect(result.status).toBe("confirmed");
    await deliver("payment_intent.succeeded", pi);
    expect(fake.calls.filter((c) => c.method === "paymentIntents.create")).toHaveLength(2);
    expect(await db.notificationLog.count({ where: { template: "booking_confirmed" } })).toBe(1);
  });

  it("refunds a late payment when the slot was taken by someone else", async () => {
    const { booking, pi } = await bookAndPay();
    // Hold expires; another customer books the same slot.
    await createBooking(
      input({ customer: { name: "Other", email: "o@example.com" }, now: new Date(now.getTime() + 11 * MIN) }),
    );
    await deliver("payment_intent.succeeded", pi);
    const after = await db.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(after.status).toBe("CANCELLED");
    expect(after.cancelReason).toBe("slot_lost");
    expect(fake.calls.some((c) => c.method === "refunds.create")).toBe(true);
  });

  it("only saves the card for week rentals", async () => {
    const { booking, pi } = await bookAndPay({ productId: catalog.week.id });
    await deliver("payment_intent.succeeded", pi);
    const deposit = await db.deposit.findUniqueOrThrow({ where: { bookingId: booking.id } });
    expect(deposit.strategy).toBe("SAVED_CARD");
    expect(deposit.status).toBe("CARD_SAVED");
    expect(fake.calls.filter((c) => c.method === "paymentIntents.create")).toHaveLength(1);
  });

  it("schedules the hold for far-off rentals and places it 24 h before", async () => {
    const startsAt = localDateMinuteToUtc("2027-05-20", 600);
    const { booking, pi } = await bookAndPay({ startsAt });
    await deliver("payment_intent.succeeded", pi);
    let deposit = await db.deposit.findUniqueOrThrow({ where: { bookingId: booking.id } });
    expect(deposit.status).toBe("PENDING");
    expect(deposit.authScheduledFor?.toISOString()).toBe(new Date(startsAt.getTime() - 24 * 60 * MIN).toISOString());

    expect(await placeDueDepositHolds(new Date(startsAt.getTime() - 25 * 60 * MIN))).toHaveLength(0);
    const placed = await placeDueDepositHolds(new Date(startsAt.getTime() - 23 * 60 * MIN));
    expect(placed).toEqual([{ bookingId: booking.id, status: "held" }]);
    deposit = await db.deposit.findUniqueOrThrow({ where: { bookingId: booking.id } });
    expect(deposit.status).toBe("HELD");
  });

  it("flags a failed off-session hold for follow-up", async () => {
    const startsAt = localDateMinuteToUtc("2027-05-20", 600);
    const { booking, pi } = await bookAndPay({ startsAt });
    await deliver("payment_intent.succeeded", pi);
    setStripeClient(createFakeStripe({ declineOffSession: true }).client);
    const placed = await placeDueDepositHolds(new Date(startsAt.getTime() - 23 * 60 * MIN));
    expect(placed[0].status).toBe("failed");
    expect((await db.deposit.findUniqueOrThrow({ where: { bookingId: booking.id } })).status).toBe("FAILED");
  });

  it("releases the deposit automatically when marked Returned – OK", async () => {
    const { booking, pi } = await bookAndPay();
    await deliver("payment_intent.succeeded", pi);
    await setBookingStatus(booking.id, "CHECKED_OUT", "admin:test");
    expect((await db.machine.findUniqueOrThrow({ where: { id: catalog.aura.id } })).status).toBe("RENTED");
    await setBookingStatus(booking.id, "RETURNED_OK", "admin:test");

    const deposit = await db.deposit.findUniqueOrThrow({ where: { bookingId: booking.id } });
    expect(deposit.status).toBe("RELEASED");
    expect(
      fake.calls.some((c) => c.method === "paymentIntents.cancel" && c.args[0] === deposit.stripePaymentIntentId),
    ).toBe(true);
    expect((await db.machine.findUniqueOrThrow({ where: { id: catalog.aura.id } })).status).toBe("AVAILABLE");
  });

  it("captures part of the deposit for damage, with a required note", async () => {
    const { booking, pi } = await bookAndPay();
    await deliver("payment_intent.succeeded", pi);
    await setBookingStatus(booking.id, "RETURNED_DAMAGED", "admin:test");
    await expect(captureDeposit(booking.id, 5000, " ", "admin:test")).rejects.toThrow(/note/i);
    await captureDeposit(booking.id, 5000, "Cracked ball hopper", "admin:test");

    const deposit = await db.deposit.findUniqueOrThrow({ where: { bookingId: booking.id } });
    expect(deposit).toMatchObject({
      status: "PARTIALLY_CAPTURED",
      capturedCents: 5000,
      captureNote: "Cracked ball hopper",
    });
    const capture = fake.calls.find((c) => c.method === "paymentIntents.capture")!;
    expect(capture.args[1]).toEqual({ amount_to_capture: 5000 });
  });

  it("charges a saved card off-session for damage on long rentals", async () => {
    const { booking, pi } = await bookAndPay({ productId: catalog.week.id });
    await deliver("payment_intent.succeeded", pi);
    await captureDeposit(booking.id, 60000, "Machine lost", "admin:test");
    const charge = fake.calls.filter((c) => c.method === "paymentIntents.create").at(-1)!.args[0] as Record<
      string,
      unknown
    >;
    expect(charge).toMatchObject({ amount: 60000, off_session: true, confirm: true, payment_method: "pm_card_visa" });
    expect((await db.deposit.findUniqueOrThrow({ where: { bookingId: booking.id } })).status).toBe("CAPTURED");
  });

  it("refunds 50% when the customer cancels inside 48 h and frees the machine", async () => {
    const { booking, pi } = await bookAndPay();
    await deliver("payment_intent.succeeded", pi);
    const { refundedCents } = await cancelBooking(booking.id, { actor: "customer", refund: "policy", now });
    expect(refundedCents).toBe(Math.round(booking.totalCents / 2));
    expect(await db.machineOccupancy.count({ where: { bookingId: booking.id, active: true } })).toBe(0);
    expect((await db.deposit.findUniqueOrThrow({ where: { bookingId: booking.id } })).status).toBe("RELEASED");
  });

  it("mirrors refunds made in the Stripe dashboard", async () => {
    const { pi } = await bookAndPay();
    await deliver("payment_intent.succeeded", pi);
    await deliver("charge.refunded", {
      id: "ch_x",
      object: "charge",
      payment_intent: pi.id,
      amount_refunded: pi.amount,
    });
    expect((await db.payment.findFirstOrThrow({ where: { stripePaymentIntentId: pi.id } })).status).toBe("REFUNDED");
  });

  it("never confirms a paid booking without the Terms & Waiver acceptance", async () => {
    const { booking, pi } = await bookAndPay({}, { accept: false });
    expect(await deliver("payment_intent.succeeded", pi)).toBe("processed");
    let after = await db.booking.findUniqueOrThrow({ where: { id: booking.id }, include: { occupancy: true } });
    expect(after.status).toBe("PENDING_PAYMENT");
    // The slot is kept (no expiry) while we wait for the customer.
    expect(after.occupancy?.holdExpiresAt).toBeNull();
    expect(await db.bookingEvent.count({ where: { bookingId: booking.id, type: "awaiting_terms" } })).toBe(1);

    // Customer accepts through the link → confirmed.
    await accept(booking.id);
    await completeConfirmation(booking.id, pi.id, pi.amount, { offSession: true });
    after = await db.booking.findUniqueOrThrow({ where: { id: booking.id }, include: { occupancy: true } });
    expect(after.status).toBe("CONFIRMED");
  });

  it("records which exact documents were accepted, with their hashes", async () => {
    const booking = await createBooking(input());
    const a = await accept(booking.id);
    const live = await currentLegal();
    expect(a).toMatchObject({
      bookingId: booking.id,
      termsVersion: live.terms.version,
      waiverVersion: live.waiver.version,
      termsSha256: sha256(live.terms.body),
      waiverSha256: sha256(live.waiver.body),
      ip: "203.0.113.7",
      checkboxes: ["terms_waiver", "age_19"],
    });
    expect(a.acceptedAtLocal).toMatch(/America\/Vancouver/);
  });

  it("refuses acceptance with a box missing or an outdated document", async () => {
    const booking = await createBooking(input());
    const live = await currentLegal();
    const base = { bookingId: booking.id, name: "Sam", contact: "s", method: "checkout" as const };
    await expect(
      recordAcceptance({ ...base, termsId: live.terms.id, waiverId: live.waiver.id, boxes: ["terms_waiver"] }),
    ).rejects.toThrow(/both boxes/);
    await expect(
      recordAcceptance({ ...base, termsId: "old", waiverId: live.waiver.id, boxes: ["terms_waiver", "age_19"] }),
    ).rejects.toThrow(/updated/);
  });

  it("holds 400 for short rentals and saves the card for 600 on long ones", async () => {
    const day = await createBooking(input());
    const week = await createBooking(
      input({ productId: catalog.week.id, startsAt: localDateMinuteToUtc("2027-05-10", 600) }),
    );
    const deposits = await db.deposit.findMany({ where: { bookingId: { in: [day.id, week.id] } } });
    expect(deposits.find((d) => d.bookingId === day.id)).toMatchObject({ strategy: "AUTH_HOLD", amountCents: 40000 });
    expect(deposits.find((d) => d.bookingId === week.id)).toMatchObject({ strategy: "SAVED_CARD", amountCents: 60000 });
  });

  it("caps damage charges at 100 with RallyDrop Care unless an exclusion is recorded", async () => {
    const { booking, pi } = await bookAndPay({ care: true });
    expect(booking.care).toBe(true);
    expect(booking.careCents).toBe(800);
    await deliver("payment_intent.succeeded", pi);
    await expect(captureDeposit(booking.id, 15000, "Cracked housing", "admin")).rejects.toThrow(/RallyDrop Care/);
    await captureDeposit(booking.id, 10000, "Cracked housing", "admin");
    const d = await db.deposit.findUniqueOrThrow({ where: { bookingId: booking.id } });
    expect(d.capturedCents).toBe(10000);
  });

  it("allows charging above the Care cap with an exclusion", async () => {
    const { booking, pi } = await bookAndPay({ care: true });
    await deliver("payment_intent.succeeded", pi);
    await captureDeposit(booking.id, 30000, "Left out in the rain overnight", "admin", "RAIN");
    const d = await db.deposit.findUniqueOrThrow({ where: { bookingId: booking.id } });
    expect(d).toMatchObject({ capturedCents: 30000, careExclusion: "RAIN" });
  });
});
