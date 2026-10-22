import "server-only";
import { carePrice, chargedTaxes } from "@/lib/domain/rental";
import { toLocalDate } from "@/lib/time";
import type { PublicMachine } from "./catalog";
import { getSettings } from "./settings";
import { springPassOffer } from "./spring-pass";

/** What the public price displays need beyond the products themselves. */
export type PricingContext = {
  season: { start: string; end: string };
  today: string;
  deposit: { short: number; long: number };
  care: { short: number; week: number; month: number; cap: number } | null;
  taxesCharged: boolean;
  packageRollover: boolean;
  /** Spring Pass on sale (null when switched off in the admin). */
  springPass: Awaited<ReturnType<typeof springPassOffer>>;
};

export async function pricingContext(machines: PublicMachine[], now = new Date()): Promise<PricingContext> {
  const s = await getSettings();
  const m = machines.find((x) => x.bookable) ?? machines[0];
  const taxes = chargedTaxes(s);
  const short = carePrice("DAY", s);
  return {
    season: { start: s.seasonStart, end: s.seasonEnd },
    today: toLocalDate(now),
    deposit: { short: m?.depositCents ?? 40000, long: m?.depositLongCents ?? 60000 },
    care:
      short === null
        ? null
        : { short, week: carePrice("WEEK", s) ?? 0, month: carePrice("MONTH", s) ?? 0, cap: s.careCapCents },
    taxesCharged: taxes.gstBps > 0 || taxes.pstBps > 0,
    packageRollover: s.packageRollover,
    springPass: await springPassOffer(now),
  };
}
