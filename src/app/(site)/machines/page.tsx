import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/json-ld";
import { machineProductLd } from "@/lib/services/structured-data";
import { getTranslations } from "next-intl/server";
import { MachineFeature } from "@/components/marketing/machine-cards";
import { AiCameraBenefits, AiCoachLine, LevelGuide } from "@/components/marketing/machine-guides";
import { PageHero, Section } from "@/components/marketing/section";
import { WaitlistForm } from "@/components/marketing/waitlist-form";
import { publicCatalog } from "@/lib/services/public-data";

export const metadata: Metadata = {
  title: "PONGBOT Aura S — AI tennis ball machine",
  description:
    "Rent the PONGBOT Aura S, an AI tennis ball machine with a built-in AI coach (Spotter camera): up to 100 km/h, 60 RPS spin, voice control. Ball machine rental in Victoria, BC.",
};

export default async function MachinesPage() {
  const t = await getTranslations("machines");
  return (
    <>
      <PageHero title={t("title")} subtitle={t("subtitle")}>
        <div className="mt-5">
          <AiCoachLine />
        </div>
      </PageHero>
      <Section>
        <Machines />
      </Section>
      <div className="bg-muted/40">
        <Section>
          <AiCameraBenefits />
        </Section>
      </div>
      <Section>
        <LevelGuide />
      </Section>
      <Section className="pt-0">
        <NewMachinesSignup />
      </Section>
    </>
  );
}

// Cached data → the machine card is in the server HTML.
async function Machines() {
  const { machines, products } = await publicCatalog();
  return (
    <>
      {machines.map((m) => (
        <JsonLd key={m.id} data={machineProductLd(m, products)} />
      ))}
      <MachineFeature machines={machines} detailed />
    </>
  );
}

async function NewMachinesSignup() {
  const t = await getTranslations("waitlist");
  return (
    <div className="flex flex-col gap-4 rounded-2xl border bg-card p-6 md:flex-row md:items-center md:justify-between">
      <div className="max-w-md">
        <h2 className="font-display text-2xl font-extrabold uppercase">{t("newTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("newBody")}</p>
      </div>
      <div className="md:w-[28rem]">
        <WaitlistForm source="machines-new" />
      </div>
    </div>
  );
}
