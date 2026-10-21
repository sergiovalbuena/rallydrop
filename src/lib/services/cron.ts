import "server-only";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { alertAdmin, notifyReminder } from "@/lib/notify/booking-notifications";
import { formatLocal } from "@/lib/time";
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

/** Sends the 24 h reminder once per booking (window: 20–26 h before start). */
export async function runReminders(now = new Date()) {
  const due = await db.booking.findMany({
    where: {
      status: "CONFIRMED",
      reminderSentAt: null,
      startsAt: { gt: new Date(now.getTime() + 20 * 3_600_000), lte: new Date(now.getTime() + 26 * 3_600_000) },
    },
    select: { id: true },
  });
  for (const b of due) {
    await notifyReminder(b.id);
    await db.booking.update({ where: { id: b.id }, data: { reminderSentAt: now } });
  }
  return { reminders: due.length };
}

/** Places deferred deposit holds and warns the owner about expiring ones. */
export async function runDeposits(now = new Date()) {
  const placed = await placeDueDepositHolds(now);
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
