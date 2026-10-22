import Link from "next/link";
import { connection } from "next/server";
import { RainDayForm, RemoveRainDay } from "@/components/admin/rain-forms";
import { Empty, PageHeader, Panel } from "@/components/admin/ui";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { recentRainDays } from "@/lib/services/rain";
import { getSettings } from "@/lib/services/settings";
import { formatLocal, formatLocalDate, toLocalDate } from "@/lib/time";

/** Internal admin: always rendered per request, no instant-navigation shell. */
export const instant = false;

export default async function RainPage() {
  await connection();
  const now = new Date();
  const [days, settings, credits] = await Promise.all([
    recentRainDays(now),
    getSettings(),
    db.customerCredit.findMany({
      where: { remainingCents: { gt: 0 }, expiresAt: { gt: now } },
      include: { customer: { select: { id: true, name: true } } },
      orderBy: { expiresAt: "asc" },
    }),
  ]);
  const outstanding = credits.reduce((s, c) => s + c.remainingCents, 0);
  return (
    <>
      <PageHeader
        title="Rain day"
        description={`Declaring a rain day emails (and texts, if SMS is on) every customer whose rental starts that day: they can reschedule free or take a credit for 100% of what they paid, valid ${settings.rainCreditMonths} months. Customers can also do it themselves on the start day, before their start time.`}
      />
      <div className="space-y-6">
        <Panel title="Declare a rain day">
          <RainDayForm today={toLocalDate(now)} />
        </Panel>
        <Panel title="Recent rain days">
          {days.length === 0 ? (
            <Empty>No rain days in the last 60 days.</Empty>
          ) : (
            <ul className="divide-y">
              {days.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
                  <span>
                    <span className="font-semibold">
                      {formatLocalDate(d.date.toISOString().slice(0, 10), "EEE, MMM d, yyyy")}
                    </span>{" "}
                    · {d.notifiedCount} notified{d.note ? ` · ${d.note}` : ""}
                  </span>
                  <RemoveRainDay id={d.id} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title={`Open customer credits · ${formatCents(outstanding)}`}>
          {credits.length === 0 ? (
            <Empty>No open credits.</Empty>
          ) : (
            <ul className="divide-y">
              {credits.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
                  <Link href={`/admin/customers/${c.customer.id}`} className="font-semibold hover:underline">
                    {c.customer.name}
                  </Link>
                  <span className="text-muted-foreground">
                    {c.reason === "RAIN" ? "Rain" : "Goodwill"} · {formatCents(c.remainingCents)} of{" "}
                    {formatCents(c.amountCents)} left · expires {formatLocal(c.expiresAt, "MMM d, yyyy")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
