import "server-only";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { alertAdmin, notifyReminder } from "@/lib/notify/booking-notifications";
import { addLocalDays, formatLocal, localDateMinuteToUtc, toLocalDate } from "@/lib/time";
import { expireAllStaleHolds } from "./bookings";
import { placeDueDepositHolds } from "./payments";
import { holdLapsesBeforeReturn } from "@/lib/domain/deposit";

/** Expires unpaid booking holds and cancels their PaymentIntents. */
export async function runExpireHolds(now = new Date()) {
  const expired = await expireAllStaleHolds(now);
  const open = await db.payment.findMany({
    where: { bookingId: { in: expired }, status: "PENDING", stripePaymentIntentId: { not: null } },
  });
  for (const p of open) {
    try {
      await stripe().paymentIntents.cancel(p.stripePaymentIntentId!);
      await db.payment.update({ where: { id: p.id }, data: { status: "CANCELLED" } });
    } catch {
      // Already paid → the webhook confirms or refunds it.
    }
  }
  return { bookings: expired.length };
}

/**
 * Reminder for every confirmed booking starting today or tomorrow (Victoria
 * time) that hasn't had one. Run once a day in the morning → customers get it
 * the day before. Sent once per booking (reset when rescheduled).
 */
export async function runReminders(now = new Date()) {
  const dayAfterTomorrow = localDateMinuteToUtc(addLocalDays(toLocalDate(now), 2), 0);
  const due = await db.booking.findMany({
    where: { status: "CONFIRMED", reminderSentAt: null, startsAt: { gt: now, lt: dayAfterTomorrow } },
    select: { id: true },
  });
  for (const b of due) {
    await notifyReminder(b.id);
    await db.booking.update({ where: { id: b.id }, data: { reminderSentAt: now } });
  }
  return { reminders: due.length };
}

/**
 * Places deposit holds that are due (24 h before the start — the job runs
 * hourly) and warns the owner about holds that lapse before the machine is
 * back and inspected, or within the next day.
 */
export async function runDeposits(now = new Date()) {
  const placed = await placeDueDepositHolds(now, 1);
  const held = await db.deposit.findMany({
    where: {
      status: "HELD",
      booking: { status: { in: ["CONFIRMED", "CHECKED_OUT", "RETURNED_DAMAGED"] } },
    },
    include: { booking: true },
  });
  const atRisk = held.filter(
    (d) =>
      holdLapsesBeforeReturn(d.authExpiresAt, d.booking.endsAt) ||
      (d.authExpiresAt !== null && d.authExpiresAt.getTime() <= now.getTime() + 24 * 3_600_000),
  );
  for (const d of atRisk) {
    await alertAdmin(
      `Deposit hold for ${d.booking.code} expires before it's back`,
      [
        `The card authorization expires ${d.authExpiresAt ? formatLocal(d.authExpiresAt, "EEE MMM d, h:mm a") : "soon"}; the rental ends ${formatLocal(d.booking.endsAt, "EEE MMM d, h:mm a")}.`,
        "Inspect and capture or release it before then (or ask the customer for a new hold).",
      ],
      `/admin/bookings/${d.bookingId}`,
      `deposit_expiring:${d.id}`,
    );
  }
  return {
    placed: placed.length,
    failed: placed.filter((p) => p.status === "failed").length,
    expiringWarned: atRisk.length,
  };
}
