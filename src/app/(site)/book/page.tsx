import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { BookingWizard } from "@/components/booking/booking-wizard";
import type { Catalog } from "@/components/booking/types";
import { Section } from "@/components/marketing/section";
import { Skeleton } from "@/components/ui/skeleton";
import { listActiveAddOns, listActiveCourts, listActiveProducts, listPublicMachines } from "@/lib/services/catalog";
import { getSettings } from "@/lib/services/settings";

export const metadata: Metadata = { title: "Book a machine" };

const RENTAL_KINDS = ["DAY", "WEEKEND", "WEEK", "MONTH"];

export default async function BookPage({ searchParams }: PageProps<"/book">) {
  const t = await getTranslations("book");
  return (
    <Section className="pt-8 sm:pt-12">
      <h1 className="mb-6 font-display text-5xl font-extrabold uppercase sm:text-6xl">{t("title")}</h1>
      <Suspense fallback={<WizardSkeleton />}>
        <Wizard searchParams={searchParams} />
      </Suspense>
    </Section>
  );
}

async function Wizard({ searchParams }: { searchParams: PageProps<"/book">["searchParams"] }) {
  const params = await searchParams;
  const [products, machines, addOns, courts, settings] = await Promise.all([
    listActiveProducts(),
    listPublicMachines(),
    listActiveAddOns(),
    listActiveCourts(),
    getSettings(),
  ]);
  const catalog: Catalog = {
    products: products
      .filter((p) => RENTAL_KINDS.includes(p.kind))
      .map((p) => ({
        id: p.id,
        slug: p.slug,
        kind: p.kind,
        name: p.name,
        description: p.description,
        priceCents: p.priceCents,
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
        calendarColor: m.calendarColor,
      })),
    addOns: addOns.map((a) => ({ kind: a.kind, name: a.name, description: a.description, priceCents: a.priceCents })),
    courts,
    holdMinutes: settings.holdMinutes,
    depositAuthMaxDays: settings.depositAuthMaxDays,
    depositAuthLeadHours: settings.depositAuthLeadHours,
  };
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  return <BookingWizard catalog={catalog} initialProduct={one(params.product)} initialMachine={one(params.machine)} />;
}

function WizardSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-10 w-1/2" />
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}
