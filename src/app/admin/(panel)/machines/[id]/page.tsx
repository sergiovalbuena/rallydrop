import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { MachineForm, MaintenanceForm } from "@/components/admin/machine-forms";
import { Empty, PageHeader, Panel, StatusBadge } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { toPublicMachine } from "@/lib/services/catalog";
import { machineEarnings } from "@/lib/admin/queries";
import { payback } from "@/lib/domain/occupancy";
import { formatLocal, toLocalDate } from "@/lib/time";

/** Internal admin: always rendered per request, no instant-navigation shell. */
export const instant = false;

export default async function MachinePage({ params }: PageProps<"/admin/machines/[id]">) {
  await connection();
  const { id } = await params;
  const isNew = id === "new";
  const machine = isNew ? null : await db.machine.findUnique({ where: { id } });
  if (!isNew && !machine) notFound();
  const [logs, bookings, earnings] = machine
    ? await Promise.all([
        db.maintenanceLog.findMany({ where: { machineId: machine.id }, orderBy: { performedAt: "desc" } }),
        db.booking.findMany({
          where: { machineId: machine.id, status: { notIn: ["EXPIRED"] } },
          orderBy: { startsAt: "desc" },
          take: 25,
          include: { customer: true },
        }),
        machineEarnings(machine.id),
      ])
    : [[], [], null];
  const pb = machine && earnings ? payback(earnings.rentalCents, machine.purchaseCostCents) : null;

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href="/admin/machines">
          <ArrowLeft /> Machines
        </Link>
      </Button>
      <PageHeader title={machine?.name ?? "New machine"} />
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Panel title="Details & specs">
          <MachineForm machine={machine ? toPublicMachine(machine) : null} />
        </Panel>
        {machine && (
          <div className="space-y-6">
            {earnings && (
              <Panel title="Payback">
                {pb ? (
                  <>
                    <p className="font-display text-4xl font-extrabold">{pb.percent}%</p>
                    <p className="text-sm text-muted-foreground">
                      of the {formatCents(machine.purchaseCostCents!)} purchase cost earned back
                      {pb.remainingCents > 0 ? ` · ${formatCents(pb.remainingCents)} to go` : " · paid off"}
                    </p>
                    <div
                      className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted"
                      role="progressbar"
                      aria-valuenow={Math.min(100, pb.percent)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label="Payback"
                    >
                      <div
                        className="h-full rounded-full bg-success"
                        style={{ width: `${Math.min(100, pb.percent)}%` }}
                      />
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Add the purchase cost in the details to see payback.</p>
                )}
                <dl className="mt-4 space-y-1.5 border-t pt-3 text-sm">
                  <div className="flex justify-between">
                    <dt>Rental revenue (net of refunds)</dt>
                    <dd className="font-semibold tabular-nums">{formatCents(earnings.rentalCents)}</dd>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <dt>Damage charges</dt>
                    <dd className="tabular-nums">{formatCents(earnings.damageCents)}</dd>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <dt>Maintenance spent</dt>
                    <dd className="tabular-nums">{formatCents(earnings.maintenanceCents)}</dd>
                  </div>
                </dl>
              </Panel>
            )}
            <Panel title="Maintenance">
              <MaintenanceForm machineId={machine.id} today={toLocalDate(new Date())} />
              <ul className="mt-5 divide-y text-sm">
                {logs.length === 0 && <Empty>No maintenance logged yet.</Empty>}
                {logs.map((l) => (
                  <li key={l.id} className="py-2">
                    <p className="font-semibold">
                      {formatLocal(l.performedAt, "MMM d, yyyy")} · {l.summary}
                      {l.costCents !== null && (
                        <span className="font-normal text-muted-foreground"> · {formatCents(l.costCents)}</span>
                      )}
                    </p>
                    {l.notes && <p className="text-muted-foreground">{l.notes}</p>}
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel title="Usage history">
              {bookings.length === 0 ? (
                <Empty>No rentals yet.</Empty>
              ) : (
                <ul className="divide-y text-sm">
                  {bookings.map((b) => (
                    <li key={b.id} className="flex items-center justify-between gap-2 py-2">
                      <Link href={`/admin/bookings/${b.id}`} className="hover:underline">
                        {formatLocal(b.startsAt, "MMM d")} · {b.customer.name}
                      </Link>
                      <StatusBadge status={b.status} />
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        )}
      </div>
    </>
  );
}
