import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { isHighSeason, seasonalPrice } from "@/lib/domain/season";
import { toLocalDate } from "@/lib/time";
import { nextAvailableSlot } from "./availability";
import { listActiveAddOns, listActiveProducts, listCourtsWithLocation, listPublicMachines } from "./catalog";
import { databaseConfigured } from "./fallback";
import { currentLegal } from "./legal";
import { pricingContext } from "./pricing-context";
import { getSettings } from "./settings";

/*
 * Everything the public pages show, cached so it is part of the server HTML.
 *
 * Reading the database at request time (connection() inside <Suspense>)
 * streams those sections in hidden chunks that only appear once JavaScript
 * runs, so visitors without JS — and some crawlers — saw empty pages. These
 * cached reads are prerendered instead, refreshed hourly and invalidated
 * from the admin with updateTag(PUBLIC_TAG) when the owner saves something.
 */

export const PUBLIC_TAG = "public-data";

export async function publicCatalog() {
  "use cache";
  cacheTag(PUBLIC_TAG);
  cacheLife("hours");
  const [machines, products, addOns, settings] = await Promise.all([
    listPublicMachines(),
    listActiveProducts(),
    listActiveAddOns(),
    getSettings(),
  ]);
  const today = toLocalDate(new Date());
  return {
    machines,
    products,
    addOns,
    today,
    highSeason: isHighSeason(today, { start: settings.seasonStart, end: settings.seasonEnd }),
    deliveryZones: settings.deliveryZones,
    hub: { lat: settings.deliveryHubLat, lng: settings.deliveryHubLng },
  };
}

export async function publicPricing() {
  "use cache";
  cacheTag(PUBLIC_TAG);
  cacheLife("hours");
  return pricingContext(await listPublicMachines());
}

export async function publicCourts() {
  "use cache";
  cacheTag(PUBLIC_TAG);
  cacheLife("hours");
  return listCourtsWithLocation();
}

/** Settings the FAQ and policy copy quote (numbers only, no secrets). */
export async function publicPolicies() {
  "use cache";
  cacheTag(PUBLIC_TAG);
  cacheLife("hours");
  const s = await getSettings();
  return {
    rainCreditMonths: s.rainCreditMonths,
    pickleballEnabled: s.pickleballEnabled,
    cancelFullRefundHours: s.cancelFullRefundHours,
    cancelLatePercent: Math.round(s.cancelLateRefundBps / 100),
    lateGraceMinutes: s.lateGraceMinutes,
    lateHourlyCents: s.lateHourlyCents,
    lateUnreturnedHours: s.lateUnreturnedHours,
  };
}

/** Hero numbers: next free start, today's day price, cheapest trip. Refreshed every few minutes. */
export async function heroStats() {
  "use cache";
  cacheTag(PUBLIC_TAG);
  cacheLife("minutes");
  const [settings, products] = await Promise.all([getSettings(), listActiveProducts()]);
  const day = products.find((p) => p.kind === "DAY");
  const now = new Date();
  const slot =
    day && databaseConfigured() ? await nextAvailableSlot({ product: day, settings, now }).catch(() => null) : null;
  const price = day
    ? seasonalPrice(day, toLocalDate(now), { start: settings.seasonStart, end: settings.seasonEnd })
    : null;
  return {
    nextStart: slot?.start ?? null,
    dayCents: price?.cents ?? null,
    tripCents: settings.deliveryZones[0]?.tripCents ?? 1500,
  };
}

/** The live Terms / Waiver texts. Publishing a version in the admin refreshes them. */
export async function publicLegal() {
  "use cache";
  cacheTag(PUBLIC_TAG);
  cacheLife("hours");
  return currentLegal();
}
