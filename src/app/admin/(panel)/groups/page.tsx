import { connection } from "next/server";
import { GroupCancelButton, GroupForm } from "@/components/admin/group-forms";
import { Empty, PageHeader, Panel } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { formatLocal, toLocalDate } from "@/lib/time";

/** Internal admin: always rendered per request, no instant-navigation shell. */
export const instant = false;

export default async function GroupsPage() {
  await connection();
  const now = new Date();
  const [sessions, courts, machines] = await Promise.all([
    db.groupSession.findMany({
      where: { startsAt: { gt: new Date(now.getTime() - 30 * 24 * 3_600_000) } },
      orderBy: { startsAt: "asc" },
      include: {
        court: true,
        machine: true,
        enrollments: { include: { customer: true }, where: { status: { in: ["CONFIRMED", "ATTENDED", "NO_SHOW"] } } },
      },
    }),
    db.court.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    db.machine.findMany({ where: { status: { not: "RETIRED" } }, orderBy: { sortOrder: "asc" } }),
  ]);
  return (
    <>
      <PageHeader title="Group sessions" />
      <div className="grid gap-6 xl:grid-cols-[1fr_1.3fr]">
        <Panel title="New session">
          <GroupForm
            today={toLocalDate(now)}
            courts={courts.map((c) => ({ id: c.id, name: c.name }))}
            machines={machines.map((m) => ({ id: m.id, name: m.name }))}
          />
        </Panel>
        <Panel title="Sessions">
          {sessions.length === 0 ? (
            <Empty>No sessions yet.</Empty>
          ) : (
            <ul className="space-y-4">
              {sessions.map((s) => (
                <li key={s.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">
                        {s.title}{" "}
                        <Badge variant={s.status === "SCHEDULED" ? "default" : "secondary"}>
                          {s.status.toLowerCase()}
                        </Badge>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatLocal(s.startsAt, "EEE MMM d, h:mm a")} · {s.court.name} · {s.machine.name} ·{" "}
                        {formatCents(s.priceCents)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="accent">
                        {s.enrollments.length}/{s.capacity}
                      </Badge>
                      {s.status === "SCHEDULED" && s.startsAt > now && <GroupCancelButton id={s.id} />}
                    </div>
                  </div>
                  {s.enrollments.length > 0 && (
                    <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
                      {s.enrollments.map((e) => (
                        <li key={e.id}>
                          {e.customer.name}{" "}
                          <span className="text-muted-foreground">· {e.customer.email ?? e.customer.phone}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
