import type { Metadata } from "next";
import { LegalText } from "@/components/legal/legal-text";
import { publicLegal } from "@/lib/services/public-data";
import { LegalPage } from "../_components/legal-page";

export const metadata: Metadata = { title: "Release of liability" };

/** Cached live version → the full text is in the server HTML. */
export default async function WaiverPage() {
  const { waiver } = await publicLegal();
  return (
    <LegalPage title={waiver.title} updated={waiver.version}>
      <LegalText body={waiver.body} />
    </LegalPage>
  );
}
