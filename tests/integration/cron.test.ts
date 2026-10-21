import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { setStripeClient } from "@/lib/stripe";
import { createBooking } from "@/lib/services/bookings";
import { runExpireHolds, runReminders } from "@/lib/services/cron";
import { startRentalPayment } from "@/lib/services/payments";
import { localDateMinuteToUtc } from "@/lib/time";
import { createFakeStripe } from "../helpers/fake-stripe";
import { hasTestDb, resetDb, seedCatalog } from "../helpers/fixtures";

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
    balls: false,
    fulfillment: "PICKUP" as const,
    termsAccepted: true,
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

  it("sends the 24 h reminder exactly once", async () => {
    const b = await createBooking({ ...base(), startsAt: localDateMinuteToUtc("2027-04-29", 1080), channel: "ADMIN" });
    expect((await runReminders(now)).reminders).toBe(0); // 32 h away
    const later = new Date(now.getTime() + 8 * 3_600_000); // 24 h before
    expect((await runReminders(later)).reminders).toBe(1);
    expect((await runReminders(later)).reminders).toBe(0);
    expect((await db.booking.findUniqueOrThrow({ where: { id: b.id } })).reminderSentAt).not.toBeNull();
    expect(await db.notificationLog.count({ where: { template: "reminder_24h" } })).toBe(1);
  });
});
