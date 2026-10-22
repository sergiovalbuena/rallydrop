import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CustomerForm, GiveCreditForm } from "@/components/admin/customer-form";
import { getSettings } from "@/lib/services/settings";
import { Empty, PageHeader, Panel, StatusBadge } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { formatLocal } from "@/lib/time";

/** Internal admin: always rendered per request, no instant-navigation shell. */
export const instant = false;

export default async function CustomerPage({ params }: PageProps<"/admin/customers/[id]">) {
  await connection();
  const { id } = await params;
  const c = await db.customer.findUnique({
    where: { id },
    include: {
      bookings: {
        where: { status: { not: "EXPIRED" } },
        orderBy: { startsAt: "desc" },
        include: { machine: true, product: true },
      },
      subscriptions: { include: { product: true }, orderBy: { createdAt: "desc" } },
      enrollments: { include: { groupSession: true }, orderBy: { createdAt: "desc" } },
      credits: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!c) notFound();
  const settings = await getSettings();
  const spent = c.bookings
    .filter((b) => !["CANCELLED", "PENDING_PAYMENT"].includes(b.status))
    .reduce((s, b) => s + b.totalCents, 0);
  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href="/admin/customers">
          <ArrowLeft /> Customers
        </Link>
      </Button>
      <PageHeader title={c.name} description={[c.email, c.phone].filter(Boolean).join(" · ")} />
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Panel title={`Bookings · ${formatCents(spent)} lifetime`}>
          {c.bookings.length === 0 ? (
            <Empty>No bookings.</Empty>
          ) : (
            <ul className="divide-y text-sm">
              {c.bookings.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-2 py-2.5">
                  <Link href={`/admin/bookings/${b.id}`} className="hover:underline">
                    <span className="font-mono font-semibold">{b.code}</span> · {formatLocal(b.startsAt, "MMM d, yyyy")}{" "}
                    · {b.product.name} · {b.machine.name}
                  </Link>
                  <StatusBadge status={b.status} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <div className="space-y-6">
          <Panel title="Internal">
            <CustomerForm id={c.id} notes={c.internalNotes ?? ""} trusted={c.trusted} blocked={c.blocked} />
          </Panel>
          <Panel title="Credits">
            {c.credits.length > 0 && (
              <ul className="mb-4 space-y-1.5 text-sm">
                {c.credits.map((cr) => (
                  <li key={cr.id}>
                    {cr.reason === "RAIN" ? "Rain" : "Goodwill"} · {formatCents(cr.remainingCents)} of{" "}
                    {formatCents(cr.amountCents)} left · expires {formatLocal(cr.expiresAt, "MMM d, yyyy")}
                    {cr.note ? ` · ${cr.note}` : ""}
                  </li>
                ))}
              </ul>
            )}
            <GiveCreditForm id={c.id} defaultMonths={settings.rainCreditMonths} />
          </Panel>
          <Panel title="Packages & groups">
            <ul className="space-y-2 text-sm">
              {c.subscriptions.map((s) => (
                <li key={s.id}>
                  {s.product.name} · {s.status.toLowerCase()} · until {formatLocal(s.currentPeriodEnd, "MMM d")}
                </li>
              ))}
              {c.enrollments.map((e) => (
                <li key={e.id}>
                  Group: {e.groupSession.title} · {formatLocal(e.groupSession.startsAt, "MMM d")} ·{" "}
                  {e.status.toLowerCase()}
                </li>
              ))}
              {c.subscriptions.length + c.enrollments.length === 0 && <li className="text-muted-foreground">None.</li>}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
