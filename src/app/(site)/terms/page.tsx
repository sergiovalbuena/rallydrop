import type { Metadata } from "next";
import { LegalText } from "@/components/legal/legal-text";
import { publicLegal } from "@/lib/services/public-data";
import { getSiteInfo } from "@/lib/services/site-info";
import { LegalPage } from "../_components/legal-page";

export const metadata: Metadata = { title: "Rental terms" };

/** Cached live version → the full text is in the server HTML. */
export default async function TermsPage() {
  const [{ terms }, site] = await Promise.all([publicLegal(), getSiteInfo()]);
  return (
    <LegalPage title={terms.title} updated={terms.version}>
      <LegalText body={terms.body} />
      {site.insured && <p className="font-medium">RallyDrop carries commercial general liability insurance.</p>}
    </LegalPage>
  );
}
