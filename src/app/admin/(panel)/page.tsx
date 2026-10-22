import { connection } from "next/server";
import Link from "next/link";
import { Plus, TriangleAlert } from "lucide-react";
import { DepositBadge, Empty, PageHeader, Panel, StatCard, StatusBadge } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { dashboardAlerts, dashboardStats } from "@/lib/admin/queries";
import { formatCents } from "@/lib/money";
import { logistics } from "@/lib/domain/logistics";
import { formatLocal } from "@/lib/time";

/** Internal admin: always rendered per request, no instant-navigation shell. */
export const instant = false;

export default async function AdminDashboard() {
  await connection();
  const now = new Date();
  const [s, alerts] = await Promise.all([dashboardStats(now), dashboardAlerts(now)]);
  const alertCount = Number(alerts.insuranceMissing) + alerts.termsMissing.length + alerts.holdsExpiring.length;
  const held = s.deposits.filter((d) => d.status === "HELD").reduce((sum, d) => sum + d.amountCents, 0);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={formatLocal(now, "EEEE, MMMM d")}
        actions={
          <Button asChild>
            <Link href="/admin/calendar?new=1">
              <Plus /> Phone booking
            </Link>
          </Button>
        }
      />
      {alertCount > 0 && (
        <section
          aria-label="Alerts"
          className="mb-6 space-y-2 rounded-xl border border-warning/50 bg-warning/10 p-4 text-sm"
        >
          {alerts.insuranceMissing && (
            <p className="flex items-center gap-2 font-semibold">
              <TriangleAlert className="size-4 shrink-0" aria-hidden />
              No liability insurance on file.{" "}
              <Link href="/admin/settings" className="font-normal text-primary underline">
                Add it in Settings
              </Link>
            </p>
          )}
          {alerts.termsMissing.map((b) => (
            <p key={b.id} className="flex items-center gap-2">
              <TriangleAlert className="size-4 shrink-0" aria-hidden />
              <span>
                <Link href={`/admin/bookings/${b.id}`} className="font-semibold text-primary underline">
                  {b.code}
                </Link>{" "}
                · {b.customer.name} hasn&apos;t accepted the Terms &amp; Waiver (starts{" "}
                {formatLocal(b.startsAt, "MMM d")}).
              </span>
            </p>
          ))}
          {alerts.holdsExpiring.map((d) => (
            <p key={d.bookingId} className="flex items-center gap-2">
              <TriangleAlert className="size-4 shrink-0" aria-hidden />
              <span>
                <Link href={`/admin/bookings/${d.bookingId}`} className="font-semibold text-primary underline">
                  {d.booking.code}
                </Link>{" "}
                · deposit hold expires {d.authExpiresAt ? formatLocal(d.authExpiresAt, "EEE h:mm a") : "soon"} and the
                machine isn&apos;t back.
              </span>
            </p>
          ))}
        </section>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Revenue this month" value={formatCents(s.revenueCents)} hint="Net of refunds, incl. taxes" />
        <StatCard label="Today" value={s.todays.length} hint="Drop-offs and pickups" />
        <StatCard label="Next 7 days" value={s.weekCount} hint="Bookings starting" />
        <StatCard label="Deposits held" value={formatCents(held)} hint={`${s.deposits.length} open deposits`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="Today">
          {s.todays.length === 0 ? (
            <Empty>Nothing scheduled today.</Empty>
          ) : (
            <ul className="divide-y">
              {s.todays.map((b) => {
                const dropOff = b.startsAt >= s.dayStart && b.startsAt < s.dayEnd;
                return (
                  <li key={b.id} className="flex items-center justify-between gap-3 py-3">
                    <div>
                      <p className="font-semibold">
                        {formatLocal(dropOff ? b.startsAt : b.endsAt, "h:mm a")} ·{" "}
                        {dropOff
                          ? b.dropoff
                            ? "Drop-off (us)"
                            : "Customer collects (hub)"
                          : b.collection
                            ? "Collection (us)"
                            : "Customer returns (hub)"}{" "}
                        ·{" "}
                        <Link href={`/admin/bookings/${b.id}`} className="text-primary hover:underline">
                          {b.code}
                        </Link>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {b.customer.name} · {b.machine.name} · {logistics(b).place ?? "Hub"}
                      </p>
                    </div>
                    <StatusBadge status={b.status} />
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Machines out">
          {s.out.length === 0 ? (
            <Empty>All machines are home.</Empty>
          ) : (
            <ul className="divide-y">
              {s.out.map((b) => (
                <li key={b.id} className="flex justify-between gap-3 py-3">
                  <Link href={`/admin/bookings/${b.id}`} className="font-semibold hover:underline">
                    {b.machine.name} · {b.customer.name}
                  </Link>
                  <span className={b.endsAt < now ? "font-semibold text-destructive" : "text-muted-foreground"}>
                    due {formatLocal(b.endsAt, "EEE h:mm a")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Open deposits">
          {s.deposits.length === 0 ? (
            <Empty>No deposits pending.</Empty>
          ) : (
            <ul className="divide-y">
              {s.deposits.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 py-3">
                  <Link href={`/admin/bookings/${d.bookingId}`} className="hover:underline">
                    <span className="font-semibold">{d.booking.code}</span> · {d.booking.customer.name}
                  </Link>
                  <span className="flex items-center gap-2">
                    {formatCents(d.amountCents)} <DepositBadge status={d.status} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Occupancy this month">
          <ul className="space-y-4">
            {s.occupancy
              .filter((o) => o.machine.isPublic || o.rentedDays > 0)
              .map((o) => (
                <li key={o.machine.id}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-semibold">{o.machine.name}</span>
                    <span className="text-muted-foreground">
                      {o.rentedDays} of {o.availableDays} days · {o.percent}%
                    </span>
                  </div>
                  <div
                    className="h-2.5 overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-valuenow={o.percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${o.machine.name} occupancy`}
                  >
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, o.percent)}%`, background: o.machine.calendarColor }}
                    />
                  </div>
                </li>
              ))}
          </ul>
        </Panel>

        <Panel title="Revenue by product this month">
          {s.revenueByProduct.length === 0 ? (
            <Empty>No payments yet this month.</Empty>
          ) : (
            <dl className="space-y-2 text-sm">
              {s.revenueByProduct.map((r) => (
                <div key={r.label} className="flex justify-between gap-4">
                  <dt>{r.label}</dt>
                  <dd className="font-semibold tabular-nums">{formatCents(r.cents)}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-4 border-t pt-2 font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatCents(s.revenueCents)}</dd>
              </div>
            </dl>
          )}
        </Panel>
      </div>
    </>
  );
}
