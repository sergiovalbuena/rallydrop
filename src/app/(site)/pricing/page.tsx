import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { PricingGrid, PricingGridSkeleton } from "@/components/marketing/pricing-grid";
import { PageHero, Section } from "@/components/marketing/section";
import { listActiveAddOns, listActiveProducts, listPublicMachines } from "@/lib/services/catalog";

export const metadata: Metadata = { title: "Pricing" };

export default async function PricingPage() {
  const t = await getTranslations("pricing");
  return (
    <>
      <PageHero title={t("title")} subtitle={t("subtitle")} />
      <Section>
        <Suspense fallback={<PricingGridSkeleton />}>
          <Pricing />
        </Suspense>
      </Section>
    </>
  );
}

async function Pricing() {
  await connection();
  const [products, addOns, machines] = await Promise.all([listActiveProducts(), listActiveAddOns(), listPublicMachines()]);
  const deposit = machines.find((m) => m.bookable)?.depositCents ?? 30000;
  return <PricingGrid products={products} addOns={addOns} depositCents={deposit} />;
}
