import "server-only";
import { db } from "@/lib/db";
import { notifyRainCredit, notifyRainDay } from "@/lib/notify/booking-notifications";
import { addLocalDays, toLocalDate } from "@/lib/time";
import { bookingsStartingOn, isRainEligible, issueRainCredit } from "./credits";
import { BookingError } from "./errors";
import { cancelBooking } from "./payments";

/*
 * Rain policy. If it rains on the start day (the customer tells us before
 * the start time, or the owner declares a rain day) the customer can
 * reschedule for free or take a credit for 100% of what they paid.
 */

/**
 * Turns a rained-out booking into a credit. Customers must be eligible;
 * the owner can do it for any confirmed booking (`force`).
 */
export async function takeRainCredit(bookingId: string, actor: string, opts: { force?: boolean; now?: Date } = {}) {
  const now = opts.now ?? new Date();
  const booking = await db.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new BookingError("NOT_FOUND", "Booking not found.");
  if (booking.status !== "CONFIRMED") {
    throw new BookingError("INVALID_STATE", "Only confirmed bookings that haven't started can get a rain credit.");
  }
  if (!opts.force && !(await isRainEligible(booking, now))) {
    throw new BookingError(
      "INVALID_STATE",
      "Rain credits are for the start day, before your start time (or a rain day we declared). Contact us if you're stuck.",
    );
  }
  let credit: { amountCents: number; expiresAt: Date } | null = null;
  await cancelBooking(bookingId, {
    actor,
    refund: "none",
    reason: "rain_credit",
    notify: false,
    // issueRainCredit gives back any credit this booking used.
    restoreCreditBps: 0,
    within: async (tx, paidCents) => {
      credit = await issueRainCredit(tx, { id: booking.id, customerId: booking.customerId, paidCents }, actor, now);
      await tx.bookingEvent.create({
        data: { bookingId, type: "rain_credit", actor, data: { creditCents: paidCents } },
      });
    },
  });
  await notifyRainCredit(bookingId, credit);
  return credit as { amountCents: number; expiresAt: Date } | null;
}

/** Owner declares a rain day: every rental starting that day gets the offer. */
export async function declareRainDay(input: { date: string; note?: string | null; actor: string }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new BookingError("INVALID_STATE", "Pick a date.");
  const date = new Date(`${input.date}T00:00:00Z`);
  const day = await db.rainDay.upsert({
    where: { date },
    update: { note: input.note?.trim() || null },
    create: { date, note: input.note?.trim() || null, createdBy: input.actor },
  });
  const bookings = await bookingsStartingOn(input.date);
  for (const b of bookings) await notifyRainDay(b.id);
  await db.rainDay.update({ where: { id: day.id }, data: { notifiedCount: { increment: bookings.length } } });
  return { notified: bookings.length };
}

/** Declared by mistake: the rain policy goes back to the normal rule. */
export async function removeRainDay(id: string) {
  await db.rainDay.delete({ where: { id } });
}

export async function recentRainDays(now = new Date()) {
  const from = addLocalDays(toLocalDate(now), -60);
  return db.rainDay.findMany({
    where: { date: { gte: new Date(`${from}T00:00:00Z`) } },
    orderBy: { date: "desc" },
  });
}
