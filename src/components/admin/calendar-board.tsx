"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type DragEvent, type ReactNode } from "react";
import { Ban, ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  createBlackoutAction,
  createManualBookingAction,
  deleteBlackoutAction,
  moveToDateAction,
} from "@/app/admin/(panel)/calendar/actions";
import { useAdminAction } from "./use-action";

export type CalEvent = {
  id: string;
  kind: "booking" | "group" | "blackout";
  title: string;
  subtitle: string;
  machineId: string | null;
  color: string;
  href: string | null;
  label: string;
  startDate: string;
  days: string[];
  pending: boolean;
  draggable: boolean;
  startMin?: number;
  endMin?: number;
};

type Props = {
  view: "month" | "week" | "day";
  date: string;
  today: string;
  start: string;
  days: number;
  events: CalEvent[];
  machines: { id: string; name: string; color: string }[];
  products: { id: string; name: string }[];
  courts: { id: string; name: string }[];
  openNew: boolean;
};

function addDays(date: string, n: number) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
function addMonths(date: string, n: number) {
  const [y, m] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10);
}
function label(date: string, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-CA", { ...opts, timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}

export function CalendarBoard(props: Props) {
  const { view, date, today, start, days, events, machines } = props;
  const router = useRouter();
  const { run } = useAdminAction();
  const [machineFilter, setMachineFilter] = useState<string>("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overDay, setOverDay] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(props.openNew);
  const [blockOpen, setBlockOpen] = useState(false);

  const visible = events.filter((e) => !machineFilter || e.machineId === machineFilter || e.machineId === null);
  const href = (v: string, d: string) => `/admin/calendar?view=${v}&date=${d}`;
  const prev = view === "month" ? addMonths(date, -1) : addDays(date, view === "week" ? -7 : -1);
  const next = view === "month" ? addMonths(date, 1) : addDays(date, view === "week" ? 7 : 1);
  const title =
    view === "month"
      ? label(date, { month: "long", year: "numeric" })
      : view === "week"
        ? `${label(start, { month: "short", day: "numeric" })} – ${label(addDays(start, 6), { month: "short", day: "numeric", year: "numeric" })}`
        : label(date, { weekday: "long", month: "long", day: "numeric" });

  async function onDrop(e: DragEvent, day: string) {
    e.preventDefault();
    setOverDay(null);
    const id = e.dataTransfer.getData("text/plain") || dragId;
    setDragId(null);
    const ev = events.find((x) => x.id === id);
    if (!ev || ev.startDate === day) return;
    if (
      !window.confirm(
        `Move ${ev.subtitle.split(" · ")[0]} to ${label(day, { weekday: "short", month: "short", day: "numeric" })}? The customer will be emailed.`,
      )
    )
      return;
    await run(() => moveToDateAction(ev.id, day));
  }

  const chip = (e: CalEvent, day: string, compact = false) => {
    const continuation = e.startDate !== day;
    const content = (
      <>
        <span className="block truncate font-semibold">{continuation ? `↳ ${e.title}` : e.title}</span>
        {!compact && (
          <span className="block truncate opacity-80">{continuation ? e.subtitle : `${e.label} · ${e.subtitle}`}</span>
        )}
      </>
    );
    const cls = cn(
      "block w-full rounded-md border-l-4 px-1.5 py-1 text-left text-[11px] leading-tight transition-shadow hover:shadow-md",
      e.kind === "blackout"
        ? "bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,rgb(148_163_184/0.25)_4px,rgb(148_163_184/0.25)_8px)]"
        : "bg-card",
      e.pending && "border-dashed opacity-70",
      e.draggable && !continuation && "cursor-grab active:cursor-grabbing",
    );
    const style = { borderLeftColor: e.color, boxShadow: `inset 0 0 0 1px ${e.color}33` };
    const drag =
      e.draggable && !continuation
        ? {
            draggable: true,
            onDragStart: (ev: DragEvent) => {
              ev.dataTransfer.setData("text/plain", e.id);
              setDragId(e.id);
            },
          }
        : {};
    if (e.kind === "blackout") {
      return (
        <div key={`${e.id}-${day}`} className={cn(cls, "flex items-start justify-between gap-1")} style={style}>
          <span className="min-w-0">{content}</span>
          {!continuation && (
            <button
              type="button"
              aria-label="Remove block"
              className="shrink-0 rounded p-0.5 hover:bg-muted"
              onClick={() => window.confirm("Remove this block?") && run(() => deleteBlackoutAction(e.id))}
            >
              <X className="size-3" />
            </button>
          )}
        </div>
      );
    }
    return (
      <Link
        key={`${e.id}-${day}`}
        href={e.href ?? "#"}
        className={cls}
        style={style}
        {...drag}
        title={`${e.title}\n${e.label}\n${e.subtitle}`}
      >
        {content}
      </Link>
    );
  };

  const cells = Array.from({ length: days }, (_, i) => addDays(start, i));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2">
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="icon" aria-label="Previous">
            <Link href={href(view, prev)}>
              <ChevronLeft />
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={href(view, today)}>Today</Link>
          </Button>
          <Button asChild variant="ghost" size="icon" aria-label="Next">
            <Link href={href(view, next)}>
              <ChevronRight />
            </Link>
          </Button>
        </div>
        <h2 className="px-2 font-display text-2xl font-bold uppercase">{title}</h2>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full bg-muted p-1" role="tablist" aria-label="View">
            {(["month", "week", "day"] as const).map((v) => (
              <Link
                key={v}
                role="tab"
                aria-selected={v === view}
                href={href(v, date)}
                className={cn(
                  "rounded-full px-3 py-1 text-sm font-semibold capitalize",
                  v === view && "bg-background shadow-sm",
                )}
              >
                {v}
              </Link>
            ))}
          </div>
          <NativeSelect
            value={machineFilter}
            onChange={(e) => setMachineFilter(e.target.value)}
            aria-label="Machine filter"
            className="h-9 w-44"
          >
            <option value="">All machines</option>
            {machines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </NativeSelect>
          <Button size="sm" variant="outline" onClick={() => setBlockOpen(true)}>
            <Ban /> Block days
          </Button>
          <Button size="sm" onClick={() => setNewOpen(true)}>
            <Plus /> Phone booking
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-xs">
        {machines.map((m) => (
          <span key={m.id} className="flex items-center gap-1.5">
            <span className="size-3 rounded-sm" style={{ background: m.color }} aria-hidden /> {m.name}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="size-3 rounded-sm border border-dashed border-current" aria-hidden /> awaiting payment
        </span>
      </div>

      {view !== "day" ? (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <div className="grid min-w-[720px] grid-cols-7">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="border-b px-2 py-2 text-xs font-semibold text-muted-foreground uppercase">
                {d}
              </div>
            ))}
            {cells.map((day) => {
              const inMonth = view !== "month" || day.slice(0, 7) === date.slice(0, 7);
              const dayEvents = visible.filter((e) => e.days.includes(day));
              return (
                <div
                  key={day}
                  onDragOver={(e) => {
                    if (!dragId) return;
                    e.preventDefault();
                    setOverDay(day);
                  }}
                  onDragLeave={() => setOverDay((d) => (d === day ? null : d))}
                  onDrop={(e) => onDrop(e, day)}
                  className={cn(
                    "space-y-1 border-r border-b p-1.5 transition-colors [&:nth-child(7n)]:border-r-0",
                    view === "month" ? "min-h-28" : "min-h-72",
                    !inMonth && "bg-muted/40",
                    overDay === day && "bg-primary/10",
                  )}
                >
                  <Link
                    href={href("day", day)}
                    className={cn(
                      "inline-flex size-6 items-center justify-center rounded-full text-xs font-semibold hover:bg-muted",
                      day === today && "bg-primary text-primary-foreground hover:bg-primary",
                      !inMonth && "text-muted-foreground",
                    )}
                  >
                    {Number(day.slice(8))}
                  </Link>
                  {dayEvents.slice(0, view === "month" ? 4 : 20).map((e) => chip(e, day, view === "month"))}
                  {view === "month" && dayEvents.length > 4 && (
                    <Link href={href("day", day)} className="block text-[11px] font-semibold text-primary">
                      +{dayEvents.length - 4} more
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <DayTimeline
          events={visible}
          machines={machineFilter ? machines.filter((m) => m.id === machineFilter) : machines}
          chip={(e) => chip(e, date)}
        />
      )}

      <NewBookingDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        defaultDate={date}
        {...props}
        onCreated={(id) => router.push(`/admin/bookings/${id}`)}
      />
      <BlockDialog open={blockOpen} onOpenChange={setBlockOpen} defaultDate={date} machines={machines} />
    </div>
  );
}

const DAY_FROM = 6 * 60;
const DAY_TO = 23 * 60;

function DayTimeline({
  events,
  machines,
  chip,
}: {
  events: CalEvent[];
  machines: Props["machines"];
  chip: (e: CalEvent) => ReactNode;
}) {
  const hours = Array.from({ length: (DAY_TO - DAY_FROM) / 60 + 1 }, (_, i) => DAY_FROM / 60 + i);
  const pct = (min: number) =>
    `${((Math.min(Math.max(min, DAY_FROM), DAY_TO) - DAY_FROM) / (DAY_TO - DAY_FROM)) * 100}%`;
  return (
    <div className="overflow-x-auto rounded-xl border bg-card p-4">
      <div className="min-w-[760px]">
        <div className="relative ml-32 h-6 text-[11px] text-muted-foreground">
          {hours.map((h) => (
            <span key={h} className="absolute -translate-x-1/2" style={{ left: pct(h * 60) }}>
              {h % 12 === 0 ? 12 : h % 12}
              {h < 12 ? "a" : "p"}
            </span>
          ))}
        </div>
        {machines.map((m) => {
          const rows = events.filter((e) => e.machineId === m.id || e.machineId === null);
          return (
            <div key={m.id} className="flex items-stretch border-t py-2">
              <div className="w-32 shrink-0 pr-2 text-sm font-semibold">
                <span
                  className="mr-1.5 inline-block size-2.5 rounded-full"
                  style={{ background: m.color }}
                  aria-hidden
                />
                {m.name}
              </div>
              <div className="relative h-16 flex-1 rounded-md bg-muted/40">
                {hours.map((h) => (
                  <span
                    key={h}
                    className="absolute inset-y-0 w-px bg-border"
                    style={{ left: pct(h * 60) }}
                    aria-hidden
                  />
                ))}
                {rows.map((e) => (
                  <div
                    key={e.id}
                    className="absolute inset-y-1"
                    style={{
                      left: pct(e.startMin ?? 0),
                      width: `calc(${pct(e.endMin ?? 1440)} - ${pct(e.startMin ?? 0)})`,
                    }}
                  >
                    {chip(e)}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NewBookingDialog({
  open,
  onOpenChange,
  defaultDate,
  machines,
  products,
  courts,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultDate: string;
  onCreated: (id: string) => void;
} & Pick<Props, "machines" | "products" | "courts">) {
  const { run, pending } = useAdminAction();
  const [f, setF] = useState({
    productId: products[0]?.id ?? "",
    machineId: machines[0]?.id ?? "",
    date: defaultDate,
    time: "10:00",
    name: "",
    email: "",
    phone: "",
    fulfillment: "DELIVERY_COURT" as "PICKUP" | "DELIVERY_COURT" | "DELIVERY_ADDRESS",
    trips: "ROUND" as "ROUND" | "DROPOFF" | "COLLECTION",
    courtId: courts[0]?.id ?? "",
    address: "",
    balls: true,
    notes: "",
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Phone booking</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            let createdId: string | undefined;
            const ok = await run(async () => {
              const r = await createManualBookingAction(f);
              if (r.ok) createdId = r.bookingId;
              return r;
            });
            if (ok && createdId) {
              onOpenChange(false);
              onCreated(createdId);
            }
          }}
        >
          <Field label="Product">
            <NativeSelect value={f.productId} onChange={(e) => set("productId", e.target.value)}>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Machine">
            <NativeSelect value={f.machineId} onChange={(e) => set("machineId", e.target.value)}>
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Date">
            <Input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} required />
          </Field>
          <Field label="Start time">
            <Input type="time" step={1800} value={f.time} onChange={(e) => set("time", e.target.value)} required />
          </Field>
          <Field label="Customer name" className="sm:col-span-2">
            <Input value={f.name} onChange={(e) => set("name", e.target.value)} required />
          </Field>
          <Field label="Email">
            <Input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} />
          </Field>
          <Field label="Phone">
            <Input type="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} />
          </Field>
          <Field label="Where">
            <NativeSelect
              value={f.fulfillment}
              onChange={(e) => set("fulfillment", e.target.value as typeof f.fulfillment)}
            >
              <option value="DELIVERY_COURT">Court</option>
              <option value="DELIVERY_ADDRESS">Address</option>
              <option value="PICKUP">Self-serve at the hub</option>
            </NativeSelect>
          </Field>
          {f.fulfillment !== "PICKUP" && (
            <Field label="Our trips (priced by zone)">
              <NativeSelect value={f.trips} onChange={(e) => set("trips", e.target.value as typeof f.trips)}>
                <option value="ROUND">Drop-off & collection</option>
                <option value="DROPOFF">Drop-off only</option>
                <option value="COLLECTION">Collection only</option>
              </NativeSelect>
            </Field>
          )}
          {f.fulfillment === "DELIVERY_COURT" && (
            <Field label="Court">
              <NativeSelect value={f.courtId} onChange={(e) => set("courtId", e.target.value)}>
                {courts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          )}
          {f.fulfillment === "DELIVERY_ADDRESS" && (
            <Field label="Address">
              <Input value={f.address} onChange={(e) => set("address", e.target.value)} />
            </Field>
          )}
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <Checkbox checked={f.balls} onCheckedChange={(v) => set("balls", v === true)} /> Ball bucket
          </label>
          <Field label="Notes" className="sm:col-span-2">
            <Textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} className="min-h-16" />
          </Field>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Created as confirmed. Collect payment by phone/e-transfer and record it on the booking page.
          </p>
          <Button type="submit" disabled={pending} className="sm:col-span-2">
            Create booking
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BlockDialog({
  open,
  onOpenChange,
  defaultDate,
  machines,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultDate: string;
  machines: Props["machines"];
}) {
  const { run, pending } = useAdminAction();
  const [f, setF] = useState({
    from: defaultDate,
    to: defaultDate,
    machineId: "",
    reason: "WEATHER" as "WEATHER" | "MAINTENANCE" | "HOLIDAY" | "OTHER",
    note: "",
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Block days</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await run(() => createBlackoutAction({ ...f, machineId: f.machineId || undefined })))
              onOpenChange(false);
          }}
        >
          <Field label="From">
            <Input
              type="date"
              value={f.from}
              onChange={(e) => setF((x) => ({ ...x, from: e.target.value }))}
              required
            />
          </Field>
          <Field label="To (inclusive)">
            <Input type="date" value={f.to} onChange={(e) => setF((x) => ({ ...x, to: e.target.value }))} required />
          </Field>
          <Field label="Machine">
            <NativeSelect value={f.machineId} onChange={(e) => setF((x) => ({ ...x, machineId: e.target.value }))}>
              <option value="">All machines</option>
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Reason">
            <NativeSelect
              value={f.reason}
              onChange={(e) => setF((x) => ({ ...x, reason: e.target.value as typeof x.reason }))}
            >
              <option value="WEATHER">Rain / weather</option>
              <option value="MAINTENANCE">Maintenance</option>
              <option value="HOLIDAY">Holiday</option>
              <option value="OTHER">Other</option>
            </NativeSelect>
          </Field>
          <Field label="Note" className="sm:col-span-2">
            <Input value={f.note} onChange={(e) => setF((x) => ({ ...x, note: e.target.value }))} />
          </Field>
          <Button type="submit" disabled={pending} className="sm:col-span-2">
            Block
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
