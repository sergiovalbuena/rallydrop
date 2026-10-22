import { connection } from "next/server";
import { LegalVersionActions, NewLegalVersionForm } from "@/components/admin/legal-forms";
import { PageHeader, Panel } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { currentLegal } from "@/lib/services/legal";
import { formatLocal, toLocalDate } from "@/lib/time";

/** Internal admin: always rendered per request, no instant-navigation shell. */
export const instant = false;

export default async function LegalAdminPage() {
  await connection();
  const live = await currentLegal(); // also seeds the starting texts on a fresh database
  const docs = await db.legalDocument.findMany({
    orderBy: [{ kind: "asc" }, { createdAt: "desc" }],
    include: { _count: { select: { termsAcceptances: true, waiverAcceptances: true } } },
  });
  const today = toLocalDate(new Date());
  return (
    <>
      <PageHeader
        title="Rental terms & waiver"
        description="Versioned texts customers accept at checkout. Old versions are kept forever — acceptances point at the exact text."
      />
      <div className="space-y-6">
        {(["TERMS", "WAIVER"] as const).map((kind) => {
          const current = kind === "TERMS" ? live.terms : live.waiver;
          const versions = docs.filter((d) => d.kind === kind);
          const liveDoc = versions.find((v) => v.id === current.id);
          return (
            <Panel key={kind} title={kind === "TERMS" ? "Rental Terms" : "Release of Liability (waiver)"}>
              {liveDoc?.draft && (
                <p className="mb-4 rounded-lg border border-warning/50 bg-warning/15 p-3 text-sm font-semibold">
                  DRAFT — must be reviewed by a BC lawyer before launch. (Only shown here, never on the public site.)
                </p>
              )}
              <ul className="mb-6 divide-y text-sm">
                {versions.map((v) => {
                  const count = kind === "TERMS" ? v._count.termsAcceptances : v._count.waiverAcceptances;
                  return (
                    <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-semibold">{v.version}</span>
                        {v.id === current.id && <Badge variant="accent">Live</Badge>}
                        {v.draft && <Badge variant="warning">Draft</Badge>}
                        {!v.publishedAt && <Badge variant="secondary">Not published</Badge>}
                        <span className="text-muted-foreground">
                          {v.publishedAt ? `published ${formatLocal(v.publishedAt, "MMM d, yyyy")}` : "saved"} · {count}{" "}
                          acceptance{count === 1 ? "" : "s"} · {v.sha256.slice(0, 10)}…
                        </span>
                      </span>
                      <LegalVersionActions id={v.id} published={!!v.publishedAt} draft={v.draft} />
                    </li>
                  );
                })}
              </ul>
              <details>
                <summary className="cursor-pointer text-sm font-semibold text-primary">Write a new version</summary>
                <div className="mt-4">
                  <NewLegalVersionForm kind={kind} title={current.title} body={current.body} suggestedVersion={today} />
                </div>
              </details>
            </Panel>
          );
        })}
      </div>
    </>
  );
}
