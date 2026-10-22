/*
 * High / off season. The owner sets an inclusive window of "MM-DD" dates in
 * Vancouver time (default Apr 1 – Sep 30); a rental's price follows the
 * season of its start date. Windows may wrap the new year (e.g. 11-01 → 02-28).
 */

export type Season = { start: string; end: string };

const MMDD = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function isValidMonthDay(value: string): boolean {
  return MMDD.test(value);
}

/** `date` is a local "YYYY-MM-DD". */
export function isHighSeason(date: string, season: Season): boolean {
  const md = date.slice(5);
  if (season.start <= season.end) return md >= season.start && md <= season.end;
  return md >= season.start || md <= season.end;
}

/** Price of a product for a rental starting on `date`. */
export function seasonalPrice(
  product: { priceCents: number; offSeasonPriceCents: number | null },
  date: string,
  season: Season,
): { cents: number; offSeason: boolean } {
  if (isHighSeason(date, season)) return { cents: product.priceCents, offSeason: false };
  return { cents: product.offSeasonPriceCents ?? product.priceCents, offSeason: true };
}
