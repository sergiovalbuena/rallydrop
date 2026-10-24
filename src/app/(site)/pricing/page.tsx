import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PricingGrid } from "@/components/marketing/pricing-grid";
import { publicCatalog, publicPricing } from "@/lib/services/public-data";
import { DeliveryService } from "@/components/marketing/delivery-service";
import { AiCoachLine } from "@/components/marketing/machine-guides";
import { PoliciesBlock } from "@/components/marketing/policies";
import { PageHero, Section, SectionHeading } from "@/components/marketing/section";

export const metadata: Metadata = {
  title: "Pricing — ball machine rental in Victoria, BC",
  description:
    "Rent an AI tennis ball machine in Victoria, BC by the day, weekend, week or month. Balls and the AI coach included; pick it up downtown or get it delivered.",
};

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
        <Pricing />
      </Section>
      <Section className="pt-0" id="policies">
        <PoliciesBlock />
      </Section>
      <div className="bg-muted/40">
        <Section id="delivery">
          <SectionHeading
            eyebrow={th("deliveryEyebrow")}
            title={th("deliveryTitle")}
            subtitle={th("deliverySubtitle")}
          />
          <Delivery />
        </Section>
      </div>
    </>
  );
}

// Cached data → rendered into the HTML (no JavaScript needed to see prices).
async function Delivery() {
  const { deliveryZones } = await publicCatalog();
  return <DeliveryService zones={deliveryZones} />;
}

async function Pricing() {
  const [{ products, addOns }, ctx] = await Promise.all([publicCatalog(), publicPricing()]);
  return <PricingGrid products={products} addOns={addOns} ctx={ctx} />;
}
