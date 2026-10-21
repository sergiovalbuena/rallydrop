import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { MachineCardsSkeleton, MachineFeature } from "@/components/marketing/machine-cards";
import { PageHero, Section } from "@/components/marketing/section";
import { listPublicMachines } from "@/lib/services/catalog";

export const metadata: Metadata = { title: "Machines" };

export default async function MachinesPage() {
  const t = await getTranslations("machines");
  return (
    <>
      <PageHero title={t("title")} subtitle={t("subtitle")} />
      <Section>
        <Suspense fallback={<MachineCardsSkeleton />}>
          <Machines />
        </Suspense>
      </Section>
    </>
  );
}

async function Machines() {
  await connection();
  return <MachineFeature machines={await listPublicMachines()} detailed />;
}
