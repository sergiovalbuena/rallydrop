import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { TriangleAlert } from "lucide-react";
import { PageHero, Section } from "@/components/marketing/section";
import { Alert, AlertTitle } from "@/components/ui/alert";

export async function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  const t = await getTranslations("legal");
  return (
    <>
      <PageHero title={title} subtitle={t("updated", { date: updated })} />
      <Section className="max-w-3xl">
        <Alert variant="warning" className="mb-8">
          <TriangleAlert />
          <AlertTitle>{t("reviewBanner")}</AlertTitle>
        </Alert>
        <div className="space-y-4 leading-relaxed text-foreground/90 [&_a]:text-primary [&_a]:underline [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-extrabold [&_h2]:uppercase [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6">
          {children}
        </div>
      </Section>
    </>
  );
}
