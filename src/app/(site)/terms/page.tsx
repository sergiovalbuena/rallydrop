import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { LegalText } from "@/components/legal/legal-text";
import { currentLegal } from "@/lib/services/legal";
import { getSiteInfo } from "@/lib/services/site-info";
import { LegalPage, LegalSkeleton } from "../_components/legal-page";

export const metadata: Metadata = { title: "Rental terms" };

export default async function TermsPage() {
  const t = await getTranslations("legal");
  return (
    <Suspense fallback={<LegalSkeleton title={t("termsTitle")} />}>
      <Terms />
    </Suspense>
  );
}

async function Terms() {
  await connection();
  const [{ terms }, site] = await Promise.all([currentLegal(), getSiteInfo()]);
  return (
    <LegalPage title={terms.title} updated={terms.version}>
      <LegalText body={terms.body} />
      {site.insured && <p className="font-medium">RallyDrop carries commercial general liability insurance.</p>}
    </LegalPage>
  );
}
