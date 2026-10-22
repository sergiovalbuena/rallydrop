/*
 * Spring Pass: N weekends for a fixed price, started inside a date window
 * (default Apr 1 – Jun 30), limited number of passes. Pure rules.
 */

export type PassSettings = {
  springPassEnabled: boolean;
  springPassLimit: number;
  springPassStart: string; // "MM-DD"
  springPassEnd: string; // "MM-DD"
};

/** The window passes sold today are for: this year's, or next year's once it's over. */
export function passWindow(s: Pick<PassSettings, "springPassStart" | "springPassEnd">, today: string) {
  const year = Number(today.slice(0, 4));
  const thisYear = { from: `${year}-${s.springPassStart}`, to: `${year}-${s.springPassEnd}` };
  return today <= thisYear.to
    ? thisYear
    : { from: `${year + 1}-${s.springPassStart}`, to: `${year + 1}-${s.springPassEnd}` };
}

/** Passes left to sell, or null when the pass isn't on sale. */
export function passesLeft(s: PassSettings, sold: number): number | null {
  if (!s.springPassEnabled) return null;
  return Math.max(0, s.springPassLimit - sold);
}

/** A pass weekend must start inside the pass window (local dates, inclusive). */
export function inPassWindow(startDate: string, pass: { validFrom: string; validTo: string }): boolean {
  return startDate >= pass.validFrom && startDate <= pass.validTo;
}
