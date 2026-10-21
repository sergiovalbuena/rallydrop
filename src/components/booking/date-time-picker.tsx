"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, CalendarX2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Slot } from "./types";

/* Calendar math on plain "YYYY-MM-DD" strings (UTC-based, no time zones). */
function parse(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}
function addDays(date: string, n: number) {
  const d = parse(date);
  d.setUTCDate(d.getUTCDate() + n);
  return fmt(d);
}
function monthStart(date: string) {
  return `${date.slice(0, 7)}-01`;
}
function addMonths(month: string, n: number) {
  const d = parse(month);
  d.setUTCMonth(d.getUTCMonth() + n);
  return fmt(d);
}
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function DateTimePicker({
  productId,
  machineId,
  excludeBookingId,
  value,
  onChange,
}: {
  productId: string;
  machineId: string | null;
  excludeBookingId?: string;
  value: { date: string | null; slot: Slot | null };
  onChange: (v: { date: string | null; slot: Slot | null }) => void;
}) {
  const t = useTranslations("book");
  const [month, setMonth] = useState<string | null>(value.date ? monthStart(value.date) : null);
  const [today, setToday] = useState<string | null>(null);
  const [dates, setDates] = useState<Record<string, number> | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => {
    const p = new URLSearchParams({ product: productId });
    if (machineId) p.set("machine", machineId);
    if (excludeBookingId) p.set("exclude", excludeBookingId);
    return p;
  }, [productId, machineId, excludeBookingId]);

  // The visible grid: from the Sunday before the 1st, 6 weeks.
  const gridStart = useMemo(() => {
    if (!month) return null;
    return addDays(month, -parse(month).getUTCDay());
  }, [month]);

  useEffect(() => {
    let cancelled = false;
    const p = new URLSearchParams(query);
    if (gridStart) p.set("from", gridStart);
    p.set("days", "42");
    fetch(`/api/availability?${p}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: { from: string; today: string; dates: Record<string, number> }) => {
        if (cancelled) return;
        setToday(data.today);
        setError(null);
        if (!gridStart) {
          // First load: jump to the current month.
          setMonth(monthStart(data.today));
          return;
        }
        setDates(data.dates);
      })
      .catch(() => !cancelled && setError("Couldn't load availability. Please refresh."));
    return () => {
      cancelled = true;
    };
  }, [query, gridStart]);

  useEffect(() => {
    if (!value.date) return;
    let cancelled = false;
    const p = new URLSearchParams(query);
    p.set("date", value.date);
    fetch(`/api/availability?${p}`)
      .then((r) => r.json())
      .then((data: { slots: Slot[] }) => !cancelled && setSlots(data.slots))
      .catch(() => !cancelled && setSlots([]));
    return () => {
      cancelled = true;
    };
  }, [query, value.date]);

  const cells = gridStart ? Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)) : [];
  const monthLabel = month
    ? new Intl.DateTimeFormat("en-CA", { month: "long", year: "numeric", timeZone: "UTC" }).format(parse(month))
    : "";
  const hasAny = dates ? Object.values(dates).some((n) => n > 0) : true;
  const canGoBack = !!month && !!today && month > monthStart(today);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-2xl font-bold uppercase">{monthLabel || t("chooseDate")}</h3>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              aria-label="Previous month"
              disabled={!canGoBack}
              onClick={() => {
                setDates(null);
                setMonth((m) => (m ? addMonths(m, -1) : m));
              }}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Next month"
              disabled={!month}
              onClick={() => {
                setDates(null);
                setMonth((m) => (m ? addMonths(m, 1) : m));
              }}
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
        {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
        <div role="grid" aria-label={t("chooseDate")} className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map((d) => (
            <div key={d} role="columnheader" className="pb-1 text-xs font-semibold text-muted-foreground uppercase">
              {d}
            </div>
          ))}
          {!dates
            ? Array.from({ length: 42 }, (_, i) => <Skeleton key={i} className="aspect-square rounded-lg" />)
            : cells.map((date) => {
                const inMonth = month !== null && date.slice(0, 7) === month.slice(0, 7);
                const count = dates[date] ?? 0;
                const available = count > 0;
                const selected = value.date === date;
                return (
                  <button
                    key={date}
                    type="button"
                    role="gridcell"
                    disabled={!available}
                    aria-selected={selected}
                    aria-label={`${date}${available ? "" : " (unavailable)"}`}
                    onClick={() => {
                      setSlots(null);
                      onChange({ date, slot: null });
                    }}
                    className={cn(
                      "relative flex aspect-square cursor-pointer flex-col items-center justify-center rounded-lg text-sm font-semibold transition-all",
                      !inMonth && "opacity-40",
                      available ? "hover:bg-primary/10" : "cursor-not-allowed text-muted-foreground/50 line-through",
                      selected && "bg-primary text-primary-foreground hover:bg-primary",
                      date === today && !selected && "ring-1 ring-primary/40",
                    )}
                  >
                    {Number(date.slice(8))}
                    {available && !selected && <span className="absolute bottom-1.5 size-1 rounded-full bg-accent-foreground/40 dark:bg-accent" aria-hidden />}
                  </button>
                );
              })}
        </div>
        {dates && !hasAny && (
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarX2 className="size-4" /> {t("noDates")}
          </p>
        )}
      </div>

      <div>
        <h3 className="mb-3 font-display text-2xl font-bold uppercase">{t("chooseTime")}</h3>
        {!value.date ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{t("chooseDate")}</p>
        ) : slots === null ? (
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : slots.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{t("noSlots")}</p>
        ) : (
          <div role="radiogroup" aria-label={t("chooseTime")} className="grid max-h-96 grid-cols-2 gap-2 overflow-y-auto pr-1">
            {slots.map((s) => {
              const selected = value.slot?.start === s.start;
              return (
                <button
                  key={s.start}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onChange({ date: value.date, slot: s })}
                  className={cn(
                    "cursor-pointer rounded-xl border p-3 text-left transition-all hover:border-primary",
                    selected && "border-primary bg-primary text-primary-foreground",
                  )}
                >
                  <span className="block font-display text-xl font-bold">{s.startLabel}</span>
                  <span className={cn("block text-xs", selected ? "text-primary-foreground/80" : "text-muted-foreground")}>
                    {t("returnAt", { when: s.endLabel })}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
