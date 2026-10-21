import "server-only";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { alertAdmin, notifyReminder } from "@/lib/notify/booking-notifications";
import { addLocalDays, formatLocal, localDateMinuteToUtc, toLocalDate } from "@/lib/time";
import { expireAllStaleHolds } from "./bookings";
import { placeDueDepositHolds } from "./payments";

/** Expires unpaid holds (bookings and group seats) and cancels their PaymentIntents. */
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
  const seats = await db.groupEnrollment.updateMany({
    where: { status: "PENDING_PAYMENT", holdExpiresAt: { lte: now } },
    data: { status: "CANCELLED" },
  });
  return { bookings: expired.length, seats: seats.count };
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
 * Places deferred deposit holds and warns the owner about expiring ones.
 * Runs daily, so it places every hold due within the next 24 h (i.e. the
 * morning before the rental starts).
 */
export async function runDeposits(now = new Date()) {
  const placed = await placeDueDepositHolds(now, 24);
  const expiring = await db.deposit.findMany({
    where: {
      status: "HELD",
      authExpiresAt: { lte: new Date(now.getTime() + 24 * 3_600_000) },
      booking: { status: { in: ["CHECKED_OUT", "RETURNED_DAMAGED"] } },
    },
    include: { booking: true },
  });
  for (const d of expiring) {
    await alertAdmin(
      `Deposit hold for ${d.booking.code} expires soon`,
      [
        `The card authorization expires ${d.authExpiresAt ? formatLocal(d.authExpiresAt, "EEE MMM d, h:mm a") : "soon"}.`,
        "Capture or release it before then.",
      ],
      `/admin/bookings/${d.bookingId}`,
      `deposit_expiring:${d.id}`,
    );
  }
  return {
    placed: placed.length,
    failed: placed.filter((p) => p.status === "failed").length,
    expiringWarned: expiring.length,
  };
}
