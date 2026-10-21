import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PrivacyEn, privacyUpdated } from "@/content/legal/privacy.en";
import { LegalPage } from "../_components/legal-page";

export const metadata: Metadata = { title: "Privacy" };

export default async function PrivacyPage() {
  const t = await getTranslations("legal");
  return (
    <LegalPage title={t("privacyTitle")} updated={privacyUpdated}>
      <PrivacyEn />
    </LegalPage>
  );
}
