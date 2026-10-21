import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { TermsEn, termsUpdated } from "@/content/legal/terms.en";
import { LegalPage } from "../_components/legal-page";

export const metadata: Metadata = { title: "Rental terms" };

export default async function TermsPage() {
  const t = await getTranslations("legal");
  return (
    <LegalPage title={t("termsTitle")} updated={termsUpdated}>
      <TermsEn />
    </LegalPage>
  );
}
