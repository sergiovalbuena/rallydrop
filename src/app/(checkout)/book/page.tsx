import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { getTranslations } from "next-intl/server";
import { PUBLIC_TAG } from "@/lib/services/public-data";
import { BookingWizard } from "@/components/booking/booking-wizard";
import type { Catalog } from "@/components/booking/types";
import { Section } from "@/components/marketing/section";
import { listActiveAddOns, listActiveCourts, listActiveProducts, listPublicMachines } from "@/lib/services/catalog";
import { getSettings } from "@/lib/services/settings";
import { carePrice } from "@/lib/domain/rental";
import { currentLegal, toConsentDocs } from "@/lib/services/legal";
import { toLocalDate } from "@/lib/time";
import { BookingUnavailable } from "@/components/booking/booking-unavailable";
import { databaseConfigured } from "@/lib/services/fallback";

export const metadata: Metadata = {
  title: "Book a ball machine",
  description:
    "Book the PONGBOT Aura S AI tennis ball machine in Victoria, BC: pick your dates, add delivery and pay securely.",
};

export default async function BookPage() {
  const t = await getTranslations("book");
  // Cached catalog → step 1 (rental and machine) is in the server HTML.
  const catalog = await bookingCatalog();
  return (
    <Section className="pt-6 sm:pt-12">
      <h1 className="mb-5 font-display text-3xl font-black uppercase sm:mb-8 sm:text-6xl">{t("title")}</h1>
      <noscript>
        <p className="mb-6 rounded-2xl border border-warning/40 bg-warning/10 p-4 font-medium">{t("noscript")}</p>
      </noscript>
      {catalog ? <BookingWizard catalog={catalog} /> : <BookingUnavailable />}
    </Section>
  );
}

const RENTAL_KINDS = ["DAY", "WEEKEND", "WEEK", "MONTH"];

/** Everything the wizard needs, cached (null until the database is set up). */
async function bookingCatalog(): Promise<Catalog | null> {
  "use cache";
  cacheTag(PUBLIC_TAG);
  cacheLife("hours");
  if (!databaseConfigured()) return null;
  const [products, machines, addOns, courts, settings, legal] = await Promise.all([
    listActiveProducts(),
    listPublicMachines(),
    listActiveAddOns(),
    listActiveCourts(),
    getSettings(),
    currentLegal(),
  ]);
  const care: Catalog["care"] = {};
  for (const kind of ["DAY", "WEEKEND", "WEEK", "MONTH"] as const) {
    const price = carePrice(kind, settings);
    if (price !== null) care[kind] = price;
  }
  return {
    products: products
      .filter((p) => RENTAL_KINDS.includes(p.kind))
      .map((p) => ({
        id: p.id,
        slug: p.slug,
        kind: p.kind,
        name: p.name,
        description: p.description,
        priceCents: p.priceCents,
        offSeasonPriceCents: p.offSeasonPriceCents,
        durationHours: p.durationHours,
      })),
    machines: machines
      .filter((m) => m.bookable && (m.status === "AVAILABLE" || m.status === "RENTED"))
      .map((m) => ({
        id: m.id,
        slug: m.slug,
        name: m.name,
        description: m.description,
        depositCents: m.depositCents,
        depositLongCents: m.depositLongCents,
        calendarColor: m.calendarColor,
      })),
    addOns: addOns.map((a) => ({ kind: a.kind, name: a.name, description: a.description, priceCents: a.priceCents })),
    courts,
    holdMinutes: settings.holdMinutes,
    depositAuthMaxDays: settings.depositAuthMaxDays,
    depositAuthLeadHours: settings.depositAuthLeadHours,
    deliveryZones: settings.deliveryZones,
    season: { start: settings.seasonStart, end: settings.seasonEnd },
    today: toLocalDate(new Date()),
    care: settings.careEnabled ? care : null,
    careCapCents: settings.careCapCents,
    legal: toConsentDocs(legal),
  };
}
