import { connection } from "next/server";
import { Download } from "lucide-react";
import { Empty, PageHeader, Panel, StatCard } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatLocal } from "@/lib/time";
import { waitlistSummary } from "@/lib/services/waitlist";

/** Internal admin: always rendered per request, no instant-navigation shell. */
export const instant = false;

export default async function WaitlistPage() {
  await connection();
  const { machines, general, total, lastWeek } = await waitlistSummary();
  return (
    <>
      <PageHeader
        title="Waitlist"
        description="People who asked to hear about new machines (from /machines) or about a specific “Coming soon” machine — your demand signal before buying."
        actions={
          <Button asChild variant="outline">
            <a href="/api/admin/export/waitlist">
              <Download /> Export CSV
            </a>
          </Button>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total sign-ups" value={total} />
        <StatCard label="Last 7 days" value={lastWeek} />
      </div>
      {machines.length === 0 && general.length === 0 ? (
        <Empty>No sign-ups yet. They appear here as soon as someone leaves their email on /machines.</Empty>
      ) : (
        <div className="space-y-6">
          {general.length > 0 && (
            <Panel title="New machines" actions={<Badge variant="accent">{general.length} interested</Badge>}>
              <ul className="divide-y text-sm">
                {general.map((w) => (
                  <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="font-medium">{w.email}</span>
                    <span className="text-muted-foreground">
                      {formatLocal(w.createdAt, "MMM d, yyyy")}
                      {w.source && ` · from ${w.source}`}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          {machines.map((m) => (
            <Panel
              key={m.id}
              title={m.name}
              actions={
                <span className="flex items-center gap-2">
                  {m.bookable && <Badge variant="success">Now bookable</Badge>}
                  <Badge variant="accent">{m.waitlist.length} interested</Badge>
                </span>
              }
            >
              <ul className="divide-y text-sm">
                {m.waitlist.map((w) => (
                  <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="font-medium">{w.email}</span>
                    <span className="text-muted-foreground">
                      {formatLocal(w.createdAt, "MMM d, yyyy")}
                      {w.source && ` · from ${w.source}`}
                      {w.notifiedAt && " · notified"}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
