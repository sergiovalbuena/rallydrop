import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { setStripeClient } from "@/lib/stripe";
import { createBooking, type CreateBookingInput } from "@/lib/services/bookings";
import { listPublicMachines } from "@/lib/services/catalog";
import { finishDepositCardUpdate } from "@/lib/services/deposit-card";
import { handleRentalSucceeded, setBookingStatus, startRentalPayment } from "@/lib/services/payments";
import { runDeposits } from "@/lib/services/cron";
import { pricingContext } from "@/lib/services/pricing-context";
import {
  customerSpringPass,
  handleSpringPassSucceeded,
  springPassOffer,
  startSpringPassPurchase,
} from "@/lib/services/spring-pass";
import { localDateMinuteToUtc } from "@/lib/time";
import { createFakeStripe } from "../helpers/fake-stripe";
import { acceptTerms, hasTestDb, resetDb, seedCatalog } from "../helpers/fixtures";

const now = localDateMinuteToUtc("2027-03-01", 600);

describe.skipIf(!hasTestDb)("v2.1 rules", () => {
  let catalog: Awaited<ReturnType<typeof seedCatalog>>;
  let fake: ReturnType<typeof createFakeStripe>;
  const stripeOptions = { declineOffSession: false };

  beforeEach(async () => {
    await resetDb();
    catalog = await seedCatalog();
    stripeOptions.declineOffSession = false;
    fake = createFakeStripe(stripeOptions);
    setStripeClient(fake.client);
  });
  afterEach(() => setStripeClient(null));

  function input(overrides: Partial<CreateBookingInput> = {}): CreateBookingInput {
    return {
      productId: catalog.day.id,
      machineId: catalog.aura.id,
      startsAt: localDateMinuteToUtc("2027-03-10", 600),
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
    await handleRentalSucceeded(pi as unknown as Parameters<typeof handleRentalSucceeded>[0], { offSession: false });
    return booking;
  }

  const piCreates = () =>
    fake.calls.filter((c) => c.method === "paymentIntents.create").map((c) => c.args[0] as Record<string, unknown>);

  describe("deposit timing", () => {
    it("charges the rental and saves the card at booking; the hold waits until 24 h before", async () => {
      const b = await bookAndPay();
      expect(piCreates()).toHaveLength(1); // the rental only
      expect(piCreates()[0]).toMatchObject({ setup_future_usage: "off_session" });
      const d = await db.deposit.findUniqueOrThrow({ where: { bookingId: b.id } });
      expect(d).toMatchObject({ strategy: "AUTH_HOLD", status: "PENDING", amountCents: 40000 });
      expect(d.authScheduledFor?.toISOString()).toBe(localDateMinuteToUtc("2027-03-09", 600).toISOString());
    });

    it("places the hold in the checkout when the rental starts within 24 h", async () => {
      const b = await bookAndPay({ startsAt: localDateMinuteToUtc("2027-03-01", 1200) });
      expect(piCreates()[1]).toMatchObject({ amount: 40000, capture_method: "manual" });
      expect((await db.deposit.findUniqueOrThrow({ where: { bookingId: b.id } })).status).toBe("HELD");
    });

    it("never places a hold for week and month rentals ($600 saved card)", async () => {
      const b = await bookAndPay({ productId: catalog.week.id, startsAt: localDateMinuteToUtc("2027-03-01", 1200) });
      await runDeposits(localDateMinuteToUtc("2027-03-01", 1100));
      expect(piCreates().filter((p) => p.capture_method === "manual")).toHaveLength(0);
      expect(await db.deposit.findUniqueOrThrow({ where: { bookingId: b.id } })).toMatchObject({
        strategy: "SAVED_CARD",
        status: "CARD_SAVED",
        amountCents: 60000,
      });
    });

    it("a failed hold leaves the booking in “Deposit pending” until the customer updates the card", async () => {
      const b = await bookAndPay();
      stripeOptions.declineOffSession = true;
      const run = await runDeposits(localDateMinuteToUtc("2027-03-09", 545));
      expect(run).toMatchObject({ placed: 1, failed: 1 });
      expect((await db.deposit.findUniqueOrThrow({ where: { bookingId: b.id } })).status).toBe("FAILED");
      expect(await db.notificationLog.count({ where: { template: "deposit_failed" } })).toBe(1);

      // The machine can't go out.
      await expect(setBookingStatus(b.id, "CHECKED_OUT", "admin:test")).rejects.toThrow(/Deposit pending/);

      // The customer saves a new card from the emailed link → the hold is placed again.
      const si = (await fake.client.setupIntents.create({ metadata: { bookingId: b.id } })) as { id: string };
      expect(await finishDepositCardUpdate(b.id, si.id)).toEqual({ status: "held" });
      const d = await db.deposit.findUniqueOrThrow({ where: { bookingId: b.id } });
      expect(d).toMatchObject({ status: "HELD", stripePaymentMethodId: "pm_new_card" });
      await expect(setBookingStatus(b.id, "CHECKED_OUT", "admin:test")).resolves.toBeUndefined();
    });
  });

  describe("pickleball", () => {
    it("removes pickleball from the machines when it's switched off", async () => {
      await db.machine.update({
        where: { id: catalog.aura.id },
        data: {
          sports: ["TENNIS", "PICKLEBALL"],
          specs: [
            { label: "Capacity", value: "120 tennis balls · 100 pickleballs" },
            { label: "Pickleball", value: "Plays pickleball too" },
          ],
        },
      });
      const on = (await listPublicMachines()).find((m) => m.id === catalog.aura.id)!;
      expect(on.sports).toContain("PICKLEBALL");

      await db.settings.update({ where: { id: "default" }, data: { pickleballEnabled: false } });
      const off = (await listPublicMachines()).find((m) => m.id === catalog.aura.id)!;
      expect(off.sports).toEqual(["TENNIS"]);
      expect(off.specs).toEqual([{ label: "Capacity", value: "120 tennis balls" }]);
      expect(JSON.stringify(off).toLowerCase()).not.toContain("pickleball");
    });
  });

  describe("Spring Pass", () => {
    it("isn't on sale (or on the pricing page) while switched off", async () => {
      expect(await springPassOffer(now)).toBeNull();
      expect((await pricingContext(await listPublicMachines(), now)).springPass).toBeNull();
      await expect(startSpringPassPurchase({ customer: { name: "R", email: "r@example.com" }, now })).rejects.toThrow(
        /isn't on sale/,
      );
    });

    it("sells up to the limit, then covers the weekends it includes", async () => {
      await db.settings.update({ where: { id: "default" }, data: { springPassEnabled: true, springPassLimit: 1 } });
      expect(await springPassOffer(now)).toMatchObject({
        priceCents: 19900,
        weekends: 3,
        left: 1,
        window: { from: "2027-04-01", to: "2027-06-30" },
      });

      const r = await startSpringPassPurchase({ customer: { name: "Robin", email: "robin@example.com" }, now });
      expect(r.amountCents).toBe(19900);
      expect(piCreates()[0]).toMatchObject({ amount: 19900, setup_future_usage: "off_session" });
      await expect(startSpringPassPurchase({ customer: { name: "Sam", email: "s@example.com" }, now })).rejects.toThrow(
        /sold/,
      );

      const payment = await db.payment.findFirstOrThrow({ where: { kind: "SPRING_PASS" } });
      await handleSpringPassSucceeded(
        fake.succeed(payment.stripePaymentIntentId!) as unknown as Parameters<typeof handleSpringPassSucceeded>[0],
      );
      const pass = await customerSpringPass(r.customerId);
      expect(pass).toMatchObject({ left: 3, validFrom: "2027-04-01", validTo: "2027-06-30" });

      const weekend = await createBooking(
        input({
          productId: catalog.weekend.id,
          startsAt: localDateMinuteToUtc("2027-04-17", 540),
          springPassId: pass!.pass.id,
        }),
      );
      expect(weekend).toMatchObject({ status: "CONFIRMED", totalCents: 0 });
      expect((await customerSpringPass(r.customerId))?.left).toBe(2);
    });
  });
});
