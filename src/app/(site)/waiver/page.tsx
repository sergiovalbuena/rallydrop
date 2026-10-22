import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { LegalText } from "@/components/legal/legal-text";
import { currentLegal } from "@/lib/services/legal";
import { LegalPage, LegalSkeleton } from "../_components/legal-page";

export const metadata: Metadata = { title: "Release of liability" };

export default function WaiverPage() {
  return (
    <Suspense fallback={<LegalSkeleton title="Release of Liability" />}>
      <Waiver />
    </Suspense>
  );
}

async function Waiver() {
  await connection();
  const { waiver } = await currentLegal();
  return (
    <LegalPage title={waiver.title} updated={waiver.version}>
      <LegalText body={waiver.body} />
    </LegalPage>
  );
}
