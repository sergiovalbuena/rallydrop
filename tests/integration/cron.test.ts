import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { setStripeClient } from "@/lib/stripe";
import { createBooking } from "@/lib/services/bookings";
import { runDeposits, runExpireHolds, runReminders } from "@/lib/services/cron";
import { handleRentalSucceeded, startRentalPayment } from "@/lib/services/payments";
import { localDateMinuteToUtc } from "@/lib/time";
import { createFakeStripe } from "../helpers/fake-stripe";
import { acceptTerms, hasTestDb, resetDb, seedCatalog } from "../helpers/fixtures";

const now = localDateMinuteToUtc("2027-04-28", 600);

describe.skipIf(!hasTestDb)("cron jobs", () => {
  let catalog: Awaited<ReturnType<typeof seedCatalog>>;
  let fake: ReturnType<typeof createFakeStripe>;
  beforeEach(async () => {
    await resetDb();
    catalog = await seedCatalog();
    fake = createFakeStripe();
    setStripeClient(fake.client);
  });
  afterEach(() => setStripeClient(null));

  const base = () => ({
    productId: catalog.day.id,
    machineId: catalog.aura.id,
    customer: { name: "Cam", email: "cam@example.com" },
    extraBalls: false,
    fulfillment: "PICKUP" as const,
    now,
  });

  it("expires unpaid holds and cancels their PaymentIntents", async () => {
    const b = await createBooking({ ...base(), startsAt: localDateMinuteToUtc("2027-05-03", 600), channel: "ONLINE" });
    await startRentalPayment(b.id);
    const r = await runExpireHolds(new Date(now.getTime() + 11 * 60_000));
    expect(r.bookings).toBe(1);
    expect((await db.booking.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("EXPIRED");
    expect(fake.calls.some((c) => c.method === "paymentIntents.cancel")).toBe(true);
  });

  it("sends the reminder the morning before, exactly once", async () => {
    // Booking Fri Apr 30 18:00; "now" is Wed Apr 28 10:00.
    const b = await createBooking({ ...base(), startsAt: localDateMinuteToUtc("2027-04-30", 1080), channel: "ADMIN" });
    expect((await runReminders(now)).reminders).toBe(0); // day after tomorrow
    const thursdayMorning = localDateMinuteToUtc("2027-04-29", 420);
    expect((await runReminders(thursdayMorning)).reminders).toBe(1);
    expect((await runReminders(thursdayMorning)).reminders).toBe(0);
    expect((await db.booking.findUniqueOrThrow({ where: { id: b.id } })).reminderSentAt).not.toBeNull();
    expect(await db.notificationLog.count({ where: { template: "reminder_24h" } })).toBe(1);
  });

  it("places the deposit hold 24 h before the start (hourly job) and emails the customer", async () => {
    const startsAt = localDateMinuteToUtc("2027-05-20", 600); // Thu 10:00
    const b = await createBooking({ ...base(), startsAt, channel: "ONLINE" });
    await startRentalPayment(b.id);
    await acceptTerms(b.id);
    const payment = await db.payment.findFirstOrThrow({ where: { bookingId: b.id } });
    const pi = fake.succeed(payment.stripePaymentIntentId!);
    await handleRentalSucceeded(pi as unknown as Parameters<typeof handleRentalSucceeded>[0], { offSession: true });
    const pending = await db.deposit.findUniqueOrThrow({ where: { bookingId: b.id } });
    expect(pending.status).toBe("PENDING");
    expect(pending.authScheduledFor?.toISOString()).toBe(localDateMinuteToUtc("2027-05-19", 600).toISOString());

    // Hourly runs: nothing the morning before, the hold goes on at Wed ~10:00.
    expect((await runDeposits(localDateMinuteToUtc("2027-05-19", 420))).placed).toBe(0);
    expect((await runDeposits(localDateMinuteToUtc("2027-05-19", 545))).placed).toBe(1);
    const held = await db.deposit.findUniqueOrThrow({ where: { bookingId: b.id } });
    expect(held.status).toBe("HELD");
    // No capture_before from Stripe here → the shortest card window (4 d 18 h).
    expect(held.authExpiresAt!.getTime() - held.heldAt!.getTime()).toBeGreaterThan(4 * 86_400_000);
    expect(await db.notificationLog.count({ where: { template: "deposit_held" } })).toBe(1);
  });
});
