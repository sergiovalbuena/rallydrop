import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { PageHero, Section } from "@/components/marketing/section";
import { Skeleton } from "@/components/ui/skeleton";

export async function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  const t = await getTranslations("legal");
  return (
    <>
      <PageHero title={title} subtitle={t("updated", { date: updated })} />
      <Section className="max-w-3xl">
        {/* Draft notices live in the admin only — never on the public page. */}
        <div className="legal-prose">{children}</div>
      </Section>
    </>
  );
}

export function LegalSkeleton({ title }: { title: string }) {
  return (
    <>
      <PageHero title={title} />
      <Section className="max-w-3xl">
        <Skeleton className="h-96 rounded-2xl" />
      </Section>
    </>
  );
}
