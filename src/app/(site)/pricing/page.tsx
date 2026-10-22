import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { PricingGrid, PricingGridSkeleton } from "@/components/marketing/pricing-grid";
import { DeliveryService, DeliveryServiceSkeleton } from "@/components/marketing/delivery-service";
import { AiCoachLine } from "@/components/marketing/machine-guides";
import { PageHero, Section, SectionHeading } from "@/components/marketing/section";
import { getSettings } from "@/lib/services/settings";
import { pricingContext } from "@/lib/services/pricing-context";
import { listActiveAddOns, listActiveProducts, listPublicMachines } from "@/lib/services/catalog";

export const metadata: Metadata = { title: "Pricing" };

export default async function PricingPage() {
  const t = await getTranslations("pricing");
  const th = await getTranslations("home");
  return (
    <>
      <PageHero title={t("title")} subtitle={t("subtitle")}>
        <div className="mt-5">
          <AiCoachLine />
        </div>
      </PageHero>
      <Section>
        <Suspense fallback={<PricingGridSkeleton />}>
          <Pricing />
        </Suspense>
      </Section>
      <div className="bg-muted/40">
        <Section id="delivery">
          <SectionHeading
            eyebrow={th("deliveryEyebrow")}
            title={th("deliveryTitle")}
            subtitle={th("deliverySubtitle")}
          />
          <Suspense fallback={<DeliveryServiceSkeleton />}>
            <Delivery />
          </Suspense>
        </Section>
      </div>
    </>
  );
}

async function Delivery() {
  await connection();
  const settings = await getSettings();
  return <DeliveryService zones={settings.deliveryZones} />;
}

async function Pricing() {
  await connection();
  const [products, addOns, machines] = await Promise.all([
    listActiveProducts(),
    listActiveAddOns(),
    listPublicMachines(),
  ]);
  const ctx = await pricingContext(machines);
  return <PricingGrid products={products} addOns={addOns} ctx={ctx} />;
}
