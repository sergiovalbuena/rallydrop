import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { LegalText } from "@/components/legal/legal-text";
import { legalVersion } from "@/lib/services/legal";
import { LegalPage, LegalSkeleton } from "../../../_components/legal-page";

export const metadata: Metadata = { title: "Legal document", robots: { index: false } };

/** The exact version a customer accepted (linked from confirmation emails). */
export default function LegalVersionPage({ params }: PageProps<"/legal/[kind]/[version]">) {
  return (
    <Suspense fallback={<LegalSkeleton title="Legal document" />}>
      <Doc params={params} />
    </Suspense>
  );
}

async function Doc({ params }: { params: PageProps<"/legal/[kind]/[version]">["params"] }) {
  await connection();
  const { kind, version } = await params;
  const k = kind === "terms" ? "TERMS" : kind === "waiver" ? "WAIVER" : null;
  if (!k) notFound();
  const doc = await legalVersion(k, decodeURIComponent(version));
  if (!doc) notFound();
  return (
    <LegalPage title={doc.title} updated={doc.version}>
      <LegalText body={doc.body} />
    </LegalPage>
  );
}
