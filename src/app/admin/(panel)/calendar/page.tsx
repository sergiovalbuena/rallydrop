import { connection } from "next/server";
import { CalendarBoard, type CalEvent } from "@/components/admin/calendar-board";
import { PageHeader } from "@/components/admin/ui";
import { db } from "@/lib/db";
import { ACTIVE_STATUSES } from "@/lib/admin/queries";
import { listActiveCourts } from "@/lib/services/catalog";
import { logistics } from "@/lib/domain/logistics";
import { addLocalDays, formatLocal, localDateMinuteToUtc, localWeekday, toLocalDate, toLocalMinute } from "@/lib/time";

/** Internal admin: always rendered per request, no instant-navigation shell. */
export const instant = false;

type View = "month" | "week" | "day";

function rangeFor(view: View, date: string) {
  if (view === "day") return { start: date, days: 1 };
  if (view === "week") return { start: addLocalDays(date, -localWeekday(date)), days: 7 };
  const first = `${date.slice(0, 7)}-01`;
  return { start: addLocalDays(first, -localWeekday(first)), days: 42 };
}

function coveredDays(start: Date, end: Date, from: string, days: number): string[] {
  const out: string[] = [];
  const last = toLocalDate(new Date(end.getTime() - 1));
  for (let i = 0; i < days; i++) {
    const d = addLocalDays(from, i);
    if (d >= toLocalDate(start) && d <= last) out.push(d);
  }
  return out;
}

export default async function CalendarPage({ searchParams }: PageProps<"/admin/calendar">) {
  await connection();
  const sp = await searchParams;
  const pick = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : (sp[k] as string | undefined));
  const view: View = pick("view") === "week" || pick("view") === "day" ? (pick("view") as View) : "month";
  const now = new Date();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(pick("date") ?? "") ? pick("date")! : toLocalDate(now);
  const { start, days } = rangeFor(view, date);
  const from = localDateMinuteToUtc(start, 0);
  const to = localDateMinuteToUtc(addLocalDays(start, days), 0);

  const [machines, bookings, blackouts, products, courts] = await Promise.all([
    db.machine.findMany({ where: { status: { not: "RETIRED" } }, orderBy: { sortOrder: "asc" } }),
    db.booking.findMany({
      where: { status: { in: [...ACTIVE_STATUSES, "PENDING_PAYMENT"] }, startsAt: { lt: to }, endsAt: { gt: from } },
      include: {
        customer: { select: { name: true } },
        product: { select: { name: true } },
        court: { select: { name: true } },
      },
    }),
    db.blackout.findMany({ where: { startsAt: { lt: to }, endsAt: { gt: from } }, include: { machine: true } }),
    db.product.findMany({
      where: { active: true, kind: { in: ["DAY", "WEEKEND", "WEEK", "MONTH", "PACKAGE"] } },
      orderBy: { sortOrder: "asc" },
    }),
    listActiveCourts(),
  ]);
  const color = (machineId: string | null) => machines.find((m) => m.id === machineId)?.calendarColor ?? "#64748b";

  const dayMinutes = (s: Date, e: Date) => {
    if (view !== "day") return undefined;
    const dayStart = localDateMinuteToUtc(date, 0).getTime();
    const dayEnd = localDateMinuteToUtc(addLocalDays(date, 1), 0).getTime();
    return {
      startMin: s.getTime() <= dayStart ? 0 : toLocalMinute(s),
      endMin: e.getTime() >= dayEnd ? 1440 : toLocalMinute(e),
    };
  };

  const events: CalEvent[] = [
    ...bookings.map((b) => ({
      id: b.id,
      kind: "booking" as const,
      title: `${b.customer.name} · ${b.product.name}`,
      subtitle: `${b.code} · ${logistics(b).short}`,
      machineId: b.machineId,
      color: color(b.machineId),
      href: `/admin/bookings/${b.id}`,
      label: `${formatLocal(b.startsAt, "EEE h:mma")} → ${formatLocal(b.endsAt, "EEE h:mma")}`,
      startDate: toLocalDate(b.startsAt),
      days: coveredDays(b.startsAt, b.endsAt, start, days),
      pending: b.status === "PENDING_PAYMENT",
      draggable: b.status === "CONFIRMED" || b.status === "PENDING_PAYMENT",
      ...dayMinutes(b.startsAt, b.endsAt),
    })),
    ...blackouts.map((x) => ({
      id: x.id,
      kind: "blackout" as const,
      title: `Blocked · ${x.reason.toLowerCase()}`,
      subtitle: `${x.machine?.name ?? "All machines"}${x.note ? ` · ${x.note}` : ""}`,
      machineId: x.machineId,
      color: "#94a3b8",
      href: null,
      label: "All day",
      startDate: toLocalDate(x.startsAt),
      days: coveredDays(x.startsAt, x.endsAt, start, days),
      pending: false,
      draggable: false,
      ...dayMinutes(x.startsAt, x.endsAt),
    })),
  ];

  return (
    <>
      <PageHeader title="Calendar" description="Drag a booking to another day to reschedule it (time is kept)." />
      <CalendarBoard
        view={view}
        date={date}
        today={toLocalDate(now)}
        start={start}
        days={days}
        events={events}
        machines={machines.map((m) => ({ id: m.id, name: m.name, color: m.calendarColor }))}
        products={products.map((p) => ({ id: p.id, name: p.name }))}
        courts={courts}
        openNew={pick("new") === "1"}
      />
    </>
  );
}
