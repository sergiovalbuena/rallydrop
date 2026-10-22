import { applyBps } from "@/lib/money";

/*
 * Customer credits (rain credits today). Pure helpers so the rules are unit
 * tested; the services do the database work.
 */

export type SpendableCredit = { id: string; remainingCents: number; expiresAt: Date };

/**
 * How much credit to apply to an amount due. Online checkouts still charge a
 * minimum so the card is saved for the deposit (same rule as promo codes).
 */
export function creditToApply(amountDueCents: number, availableCents: number, minChargeCents: number): number {
  if (amountDueCents <= 0 || availableCents <= 0) return 0;
  return Math.max(0, Math.min(availableCents, amountDueCents - minChargeCents));
}

/** Which credits pay for `amountCents`: the ones expiring soonest first. */
export function planCreditSpend(credits: SpendableCredit[], amountCents: number, now: Date) {
  const usable = credits
    .filter((c) => c.remainingCents > 0 && c.expiresAt > now)
    .sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime());
  const plan: { creditId: string; cents: number }[] = [];
  let left = amountCents;
  for (const c of usable) {
    if (left <= 0) break;
    const cents = Math.min(c.remainingCents, left);
    plan.push({ creditId: c.id, cents });
    left -= cents;
  }
  return plan;
}

/**
 * Credit given back when a booking that used it is cancelled: the same share
 * as the cash refund (basis points of what was used).
 */
export function creditRestore(usedCents: number, alreadyRestoredCents: number, bps: number): number {
  const target = applyBps(usedCents, Math.max(0, Math.min(10_000, bps)));
  return Math.max(0, target - alreadyRestoredCents);
}

/** Expiry of a new rain credit: `months` calendar months from `now`. */
export function creditExpiry(now: Date, months: number): Date {
  const d = new Date(now);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

/**
 * Rain policy: a confirmed rental can be rescheduled free or turned into a
 * credit if (a) it starts today and the customer tells us before the start
 * time, or (b) the owner declared its start date a rain day.
 */
export function rainEligible(
  booking: { status: string; startsAt: Date; startDate: string },
  now: Date,
  today: string,
  rainDates: ReadonlySet<string>,
): boolean {
  if (booking.status !== "CONFIRMED") return false;
  if (rainDates.has(booking.startDate)) return true;
  return booking.startDate === today && now < booking.startsAt;
}
