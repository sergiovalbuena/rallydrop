import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { setStripeClient } from "@/lib/stripe";
import { createBooking, expireAllStaleHolds, type CreateBookingInput } from "@/lib/services/bookings";
import { cancelBooking, chargeSessionOnFile, startRentalPayment } from "@/lib/services/payments";
import { declareRainDay, takeRainCredit } from "@/lib/services/rain";
import { sessionsUsage } from "@/lib/services/subscriptions";
import { constructStripeEvent, processStripeEvent } from "@/lib/services/webhooks";
import { localDateMinuteToUtc } from "@/lib/time";
import { createFakeStripe } from "../helpers/fake-stripe";
import { acceptTerms, hasTestDb, resetDb, seedCatalog } from "../helpers/fixtures";

const now = localDateMinuteToUtc("2027-05-01", 480); // 08:00 on the start day
const MIN = 60_000;

describe.skipIf(!hasTestDb)("rain policy & customer credits", () => {
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
      startsAt: localDateMinuteToUtc("2027-05-01", 720), // today 12:00
      customer: { name: "Robin", email: "robin@example.com" },
      fulfillment: "PICKUP",
      channel: "ONLINE",
      skipSlotRules: true,
      now,
      ...overrides,
    };
  }

  async function bookAndPay(overrides: Partial<CreateBookingInput> = {}) {
    const booking = await createBooking(input(overrides));
    await startRentalPayment(booking.id);
    await acceptTerms(booking.id);
    const payment = await db.payment.findFirstOrThrow({ where: { bookingId: booking.id } });
    const pi = fake.succeed(payment.stripePaymentIntentId!);
    const e = fake.event("payment_intent.succeeded", pi);
    await processStripeEvent(constructStripeEvent(e.payload, e.header));
    return db.booking.findUniqueOrThrow({ where: { id: booking.id } });
  }

  async function giveCredit(cents: number) {
    const customer = await db.customer.upsert({
      where: { email: "robin@example.com" },
      update: {},
      create: { name: "Robin", email: "robin@example.com" },
    });
    return db.customerCredit.create({
      data: {
        customerId: customer.id,
        reason: "RAIN",
        amountCents: cents,
        remainingCents: cents,
        expiresAt: new Date(now.getTime() + 90 * 86_400_000),
        createdBy: "test",
      },
    });
  }

  it("turns a rained-out booking into a 100% credit on the start day", async () => {
    const booking = await bookAndPay();
    expect(booking.status).toBe("CONFIRMED");

    const credit = await takeRainCredit(booking.id, "customer", { now });
    expect(credit?.amountCents).toBe(4500);
    expect(credit?.expiresAt.toISOString()).toBe(new Date("2027-11-01T15:00:00.000Z").toISOString());

    const after = await db.booking.findUniqueOrThrow({ where: { id: booking.id }, include: { deposit: true } });
    expect(after.status).toBe("CANCELLED");
    expect(after.cancelReason).toBe("rain_credit");
    expect(after.deposit?.status).toBe("RELEASED");
    // No cash goes back: the money becomes credit.
    expect(fake.calls.some((c) => c.method === "refunds.create")).toBe(false);
    expect(await db.notificationLog.count({ where: { template: "rain_credit" } })).toBe(1);
    // The machine is free again.
    const again = await createBooking(input({ customer: { name: "Other", email: "o@example.com" } }));
    expect(again.status).toBe("PENDING_PAYMENT");
  });

  it("only allows it before the start time, unless the owner declared a rain day", async () => {
    const booking = await bookAndPay();
    const late = new Date(localDateMinuteToUtc("2027-05-01", 720).getTime() + 30 * MIN);
    await expect(takeRainCredit(booking.id, "customer", { now: late })).rejects.toThrow(/start day/);

    const r = await declareRainDay({ date: "2027-05-01", actor: "admin:test" });
    expect(r.notified).toBe(1);
    expect(await db.notificationLog.count({ where: { template: "rain_day" } })).toBe(1);
    await expect(takeRainCredit(booking.id, "customer", { now: late })).resolves.toMatchObject({ amountCents: 4500 });
  });

  it("applies credit at the next checkout, keeping the $1 card minimum", async () => {
    await giveCredit(10_000);
    const booking = await createBooking(input());
    expect(booking.creditCents).toBe(4400);
    expect(booking.totalCents).toBe(100);
    const { amountCents } = await startRentalPayment(booking.id);
    expect(amountCents).toBe(100);
    const credit = await db.customerCredit.findFirstOrThrow();
    expect(credit.remainingCents).toBe(5600);
  });

  it("gives the credit back when the checkout is abandoned", async () => {
    const credit = await giveCredit(2000);
    await createBooking(input());
    expect((await db.customerCredit.findUniqueOrThrow({ where: { id: credit.id } })).remainingCents).toBe(0);
    await expireAllStaleHolds(new Date(now.getTime() + 11 * MIN));
    expect((await db.customerCredit.findUniqueOrThrow({ where: { id: credit.id } })).remainingCents).toBe(2000);
  });

  it("gives credit back by the refund policy when a paid booking is cancelled", async () => {
    const credit = await giveCredit(2000);
    // More than 48 h ahead → full refund → all the credit comes back.
    const early = await bookAndPay({ startsAt: localDateMinuteToUtc("2027-05-10", 600) });
    expect(early.totalCents).toBe(2500);
    await cancelBooking(early.id, { actor: "customer", refund: "policy", now });
    expect((await db.customerCredit.findUniqueOrThrow({ where: { id: credit.id } })).remainingCents).toBe(2000);

    // Inside 48 h → 50% back, in cash and in credit.
    const soon = await bookAndPay({ startsAt: localDateMinuteToUtc("2027-05-02", 600) });
    await cancelBooking(soon.id, { actor: "customer", refund: "policy", now });
    expect((await db.customerCredit.findUniqueOrThrow({ where: { id: credit.id } })).remainingCents).toBe(1000);
  });

  it("turns credit already used into credit again when that booking is rained out", async () => {
    const credit = await giveCredit(2000);
    const booking = await bookAndPay();
    const rain = await takeRainCredit(booking.id, "customer", { now });
    // The old credit is restored and the cash part becomes a new credit.
    expect((await db.customerCredit.findUniqueOrThrow({ where: { id: credit.id } })).remainingCents).toBe(2000);
    expect(rain?.amountCents).toBe(2500);
  });

  describe("package sessions", () => {
    async function subscribe() {
      const pkg = await db.product.create({
        data: {
          slug: "package-basic",
          kind: "PACKAGE",
          name: "Basic package",
          priceCents: 4900,
          sessionsPerMonth: 4,
          sessionMinutes: 90,
        },
      });
      const customer = await db.customer.create({ data: { name: "Robin", email: "robin@example.com" } });
      const periodStart = localDateMinuteToUtc("2027-04-20", 0);
      const periodEnd = localDateMinuteToUtc("2027-05-20", 0);
      const sub = await db.subscription.create({
        data: {
          customerId: customer.id,
          productId: pkg.id,
          status: "ACTIVE",
          stripeSubscriptionId: "sub_1",
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          createdAt: localDateMinuteToUtc("2027-02-01", 0),
        },
      });
      fake.addSubscription({ id: "sub_1", productId: pkg.id, customerId: customer.id, periodStart, periodEnd });
      return { pkg, sub };
    }

    it("are self-serve and free, or pay the zone's delivery to the package card", async () => {
      const { pkg, sub } = await subscribe();
      const free = await createBooking(input({ productId: pkg.id, subscriptionId: sub.id }));
      expect(free).toMatchObject({ status: "CONFIRMED", totalCents: 0, fulfillment: "PICKUP" });

      const delivered = await createBooking(
        input({
          productId: pkg.id,
          subscriptionId: sub.id,
          startsAt: localDateMinuteToUtc("2027-05-03", 600),
          fulfillment: "DELIVERY_COURT",
          dropoff: true,
          collection: true,
          courtId: catalog.court.id,
        }),
      );
      expect(delivered).toMatchObject({ status: "PENDING_PAYMENT", totalCents: 2500 });
      await acceptTerms(delivered.id);
      expect(await chargeSessionOnFile(delivered.id, "sub_1")).toEqual({ ok: true });
      const after = await db.booking.findUniqueOrThrow({ where: { id: delivered.id }, include: { payments: true } });
      expect(after.status).toBe("CONFIRMED");
      expect(after.payments[0]).toMatchObject({ status: "SUCCEEDED", amountCents: 2500 });
      const charge = fake.calls.find((c) => c.method === "paymentIntents.create")!.args[0] as Record<string, unknown>;
      expect(charge).toMatchObject({ amount: 2500, payment_method: "pm_sub_card" });
    });

    it("releases the session when the package card is declined", async () => {
      fake = createFakeStripe({ declineOffSession: true });
      setStripeClient(fake.client);
      const { pkg, sub } = await subscribe();
      const booking = await createBooking(
        input({
          productId: pkg.id,
          subscriptionId: sub.id,
          fulfillment: "DELIVERY_COURT",
          dropoff: true,
          collection: true,
          courtId: catalog.court.id,
        }),
      );
      await acceptTerms(booking.id);
      const r = await chargeSessionOnFile(booking.id, "sub_1");
      expect(r.ok).toBe(false);
      expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("CANCELLED");
    });

    it("doesn't roll unused sessions over unless the owner turns it on", async () => {
      const { pkg, sub } = await subscribe();
      // One session used last period, one this period.
      await createBooking(
        input({ productId: pkg.id, subscriptionId: sub.id, startsAt: localDateMinuteToUtc("2027-04-10", 600) }),
      );
      await createBooking(input({ productId: pkg.id, subscriptionId: sub.id }));
      expect(await sessionsUsage(sub.id)).toMatchObject({ total: 4, used: 1, carried: 0, left: 3 });

      await db.settings.update({ where: { id: "default" }, data: { packageRollover: true } });
      expect(await sessionsUsage(sub.id)).toMatchObject({ total: 4, used: 1, carried: 3, left: 6 });
    });
  });
});
