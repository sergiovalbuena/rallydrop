/*
 * Owner metrics. Pure so they can be unit tested.
 */

type Range = { start: Date; end: Date };

/** Hours of the ranges that fall inside [from, to), overlaps counted once. */
export function coveredHours(ranges: Range[], from: Date, to: Date): number {
  const clipped = ranges
    .map((r) => ({ s: Math.max(r.start.getTime(), from.getTime()), e: Math.min(r.end.getTime(), to.getTime()) }))
    .filter((r) => r.e > r.s)
    .sort((a, b) => a.s - b.s);
  let total = 0;
  let curS = -1;
  let curE = -1;
  for (const r of clipped) {
    if (r.s > curE) {
      total += curE - curS;
      curS = r.s;
      curE = r.e;
    } else curE = Math.max(curE, r.e);
  }
  total += curE - curS;
  return total / 3_600_000;
}

/**
 * Occupancy = days rented ÷ days the machine could be rented in the period
 * (blocked days — maintenance, holidays — don't count as available).
 */
export function occupancy(input: { rentals: Range[]; blocked: Range[]; from: Date; to: Date }) {
  const periodHours = (input.to.getTime() - input.from.getTime()) / 3_600_000;
  const rentedHours = coveredHours(input.rentals, input.from, input.to);
  const blockedHours = coveredHours(input.blocked, input.from, input.to);
  const availableHours = Math.max(0, periodHours - blockedHours);
  return {
    rentedDays: Math.round((rentedHours / 24) * 10) / 10,
    availableDays: Math.round((availableHours / 24) * 10) / 10,
    percent: availableHours > 0 ? Math.min(100, Math.round((rentedHours / availableHours) * 100)) : 0,
  };
}

/** Share of the purchase cost earned back so far ("payback"). */
export function payback(revenueCents: number, purchaseCostCents: number | null) {
  if (!purchaseCostCents || purchaseCostCents <= 0) return null;
  return {
    percent: Math.round((revenueCents / purchaseCostCents) * 100),
    remainingCents: Math.max(0, purchaseCostCents - revenueCents),
  };
}
