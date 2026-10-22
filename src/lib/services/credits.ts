import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { creditExpiry, creditRestore, planCreditSpend, rainEligible } from "@/lib/domain/credit";
import { addLocalDays, localDateMinuteToUtc, toLocalDate } from "@/lib/time";
import { BookingError } from "./errors";
import { getSettings } from "./settings";

/*
 * Customer credits: issued when a rental is rained out, spent automatically
 * at the customer's next checkout, given back if that booking is cancelled.
 */

type Tx = Prisma.TransactionClient;

async function lockCustomerCredits(tx: Tx, customerId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`credits:${customerId}`}))`;
}

/** Live credits (not expired, something left), soonest expiry first. */
export async function availableCredits(customerId: string, now = new Date(), tx: Tx = db) {
  return tx.customerCredit.findMany({
    where: { customerId, remainingCents: { gt: 0 }, expiresAt: { gt: now } },
    orderBy: { expiresAt: "asc" },
  });
}

export async function creditBalance(customerId: string, now = new Date()): Promise<number> {
  const credits = await availableCredits(customerId, now);
  return credits.reduce((s, c) => s + c.remainingCents, 0);
}

/**
 * Spends up to `maxCents` of the customer's credit on a booking (inside the
 * booking transaction). Returns what was actually spent.
 */
export async function spendCredits(
  tx: Tx,
  customerId: string,
  bookingId: string,
  maxCents: (availableCents: number) => number,
  now: Date,
): Promise<number> {
  await lockCustomerCredits(tx, customerId);
  const credits = await availableCredits(customerId, now, tx);
  const available = credits.reduce((s, c) => s + c.remainingCents, 0);
  const plan = planCreditSpend(credits, maxCents(available), now);
  for (const p of plan) {
    await tx.customerCredit.update({ where: { id: p.creditId }, data: { remainingCents: { decrement: p.cents } } });
    await tx.creditUse.create({ data: { creditId: p.creditId, bookingId, amountCents: p.cents } });
  }
  return plan.reduce((s, p) => s + p.cents, 0);
}

/**
 * Gives back credit a booking used: all of it for an abandoned or rained-out
 * booking, otherwise the same share as the cash refund.
 */
export async function restoreCredits(tx: Tx, bookingIds: string[], bps: number): Promise<number> {
  if (bookingIds.length === 0) return 0;
  const uses = await tx.creditUse.findMany({ where: { bookingId: { in: bookingIds } } });
  let total = 0;
  for (const use of uses) {
    const cents = creditRestore(use.amountCents, use.restoredCents, bps);
    if (cents <= 0) continue;
    await tx.creditUse.update({ where: { id: use.id }, data: { restoredCents: { increment: cents } } });
    await tx.customerCredit.update({ where: { id: use.creditId }, data: { remainingCents: { increment: cents } } });
    total += cents;
  }
  return total;
}

/**
 * A hold expired (credit given back) but the payment still arrived and the
 * booking is confirmed after all: take the credit again, as far as it's left.
 */
export async function reclaimCredits(tx: Tx, bookingId: string): Promise<number> {
  const uses = await tx.creditUse.findMany({
    where: { bookingId, restoredCents: { gt: 0 } },
    include: { credit: true },
  });
  let total = 0;
  for (const use of uses) {
    const cents = Math.min(use.restoredCents, use.credit.remainingCents);
    if (cents <= 0) continue;
    await tx.creditUse.update({ where: { id: use.id }, data: { restoredCents: { decrement: cents } } });
    await tx.customerCredit.update({ where: { id: use.creditId }, data: { remainingCents: { decrement: cents } } });
    total += cents;
  }
  return total;
}

/** Start dates the owner declared rain days, as "YYYY-MM-DD". */
export async function rainDates(from: string, to: string): Promise<Set<string>> {
  const rows = await db.rainDay.findMany({
    where: { date: { gte: new Date(`${from}T00:00:00Z`), lte: new Date(`${to}T00:00:00Z`) } },
    select: { date: true },
  });
  return new Set(rows.map((r) => r.date.toISOString().slice(0, 10)));
}

export async function isRainEligible(booking: { status: string; startsAt: Date }, now = new Date()) {
  const startDate = toLocalDate(booking.startsAt);
  const dates = await rainDates(startDate, startDate);
  return rainEligible({ ...booking, startDate }, now, toLocalDate(now), dates);
}

/** Bookings confirmed to start on a local date (rain day notifications). */
export async function bookingsStartingOn(date: string) {
  return db.booking.findMany({
    where: {
      status: "CONFIRMED",
      startsAt: { gte: localDateMinuteToUtc(date, 0), lt: localDateMinuteToUtc(addLocalDays(date, 1), 0) },
    },
    select: { id: true },
  });
}

/**
 * Rained out → credit. Cancels the booking without a cash refund, gives back
 * any credit it used and issues a new credit for 100% of what was paid. The
 * caller cancels the booking (frees the machine, releases the deposit).
 */
export async function issueRainCredit(
  tx: Tx,
  booking: { id: string; customerId: string; paidCents: number },
  actor: string,
  now: Date,
) {
  const settings = await getSettings();
  await lockCustomerCredits(tx, booking.customerId);
  await restoreCredits(tx, [booking.id], 10_000);
  if (booking.paidCents <= 0) return null;
  return tx.customerCredit.create({
    data: {
      customerId: booking.customerId,
      reason: "RAIN",
      amountCents: booking.paidCents,
      remainingCents: booking.paidCents,
      expiresAt: creditExpiry(now, settings.rainCreditMonths),
      sourceBookingId: booking.id,
      createdBy: actor,
    },
  });
}

/** Admin goodwill credit (e.g. a machine fault). */
export async function issueGoodwillCredit(input: {
  customerId: string;
  amountCents: number;
  months: number;
  note: string;
  actor: string;
  now?: Date;
}) {
  if (input.amountCents <= 0) throw new BookingError("INVALID_STATE", "Enter an amount.");
  const now = input.now ?? new Date();
  return db.customerCredit.create({
    data: {
      customerId: input.customerId,
      reason: "GOODWILL",
      amountCents: input.amountCents,
      remainingCents: input.amountCents,
      expiresAt: creditExpiry(now, input.months),
      note: input.note.trim() || null,
      createdBy: input.actor,
    },
  });
}
