import "server-only";
import { db } from "@/lib/db";
import type { Product } from "@/generated/prisma/client";
import {
  availabilityByDate,
  slotsForDate,
  type FixedStart,
  type Interval,
  type Slot,
  type SlotRules,
} from "@/lib/domain/availability";
import { addLocalDays, localDateMinuteToUtc, toLocalDate } from "@/lib/time";
import type { AppSettings } from "./settings";

const STEP_MINUTES = 30;

export function productDurationMinutes(product: Pick<Product, "kind" | "durationHours" | "sessionMinutes">) {
  if (product.kind === "PACKAGE") return product.sessionMinutes ?? 90;
  return (product.durationHours ?? 24) * 60;
}

export function parseAllowedStarts(value: unknown): FixedStart[] | null {
  if (!Array.isArray(value)) return null;
  const starts = value.filter(
    (v): v is FixedStart =>
      typeof v === "object" &&
      v !== null &&
      typeof (v as FixedStart).weekday === "number" &&
      typeof (v as FixedStart).minute === "number",
  );
  return starts.length > 0 ? starts : null;
}

export function rulesFor(
  product: Pick<Product, "kind" | "durationHours" | "sessionMinutes" | "allowedStarts">,
  settings: AppSettings,
  now: Date,
): SlotRules {
  return {
    durationMinutes: productDurationMinutes(product),
    allowedStarts: parseAllowedStarts(product.allowedStarts),
    stepMinutes: STEP_MINUTES,
    windowStartMinute: settings.deliveryStartMinute,
    windowEndMinute: settings.deliveryEndMinute,
    bufferMinutes: settings.bufferMinutes,
    minLeadHours: settings.minLeadTimeHours,
    maxAdvanceDays: settings.maxAdvanceDays,
    season: {
      startMonth: settings.seasonStartMonth,
      endMonth: settings.seasonEndMonth,
      allowOffSeason: settings.allowOffSeason,
    },
    now,
  };
}

/** Busy blocks per machine overlapping [from, to). Expired holds are ignored. */
export async function loadBusy(
  machineIds: string[],
  from: Date,
  to: Date,
  now: Date,
  excludeBookingId?: string,
): Promise<Map<string, Interval[]>> {
  const rows = await db.machineOccupancy.findMany({
    where: {
      machineId: { in: machineIds },
      active: true,
      blockStart: { lt: to },
      blockEnd: { gt: from },
      OR: [{ holdExpiresAt: null }, { holdExpiresAt: { gt: now } }],
      ...(excludeBookingId ? { NOT: { bookingId: excludeBookingId } } : {}),
    },
    select: { machineId: true, blockStart: true, blockEnd: true },
  });
  const map = new Map<string, Interval[]>(machineIds.map((id) => [id, []]));
  for (const r of rows) map.get(r.machineId)?.push({ start: r.blockStart, end: r.blockEnd });
  return map;
}

/** Machines a customer can book right now. */
export async function bookableMachineIds(): Promise<string[]> {
  const machines = await db.machine.findMany({
    where: { bookable: true, status: { in: ["AVAILABLE", "RENTED"] } },
    select: { id: true },
  });
  return machines.map((m) => m.id);
}

function searchWindow(fromDate: string, days: number, rules: SlotRules) {
  const from = localDateMinuteToUtc(fromDate, 0);
  // Long rentals starting at the end of the window reach far beyond it.
  const to = new Date(
    localDateMinuteToUtc(addLocalDays(fromDate, days + 1), 0).getTime() +
      (rules.durationMinutes + rules.bufferMinutes) * 60_000,
  );
  return { from, to };
}

export async function monthAvailability(input: {
  product: Product;
  machineIds: string[];
  fromDate: string;
  days: number;
  settings: AppSettings;
  now: Date;
}): Promise<Record<string, number>> {
  const rules = rulesFor(input.product, input.settings, input.now);
  const { from, to } = searchWindow(input.fromDate, input.days, rules);
  const busy = await loadBusy(input.machineIds, from, to, input.now);
  return availabilityByDate(input.fromDate, input.days, rules, busy);
}

export async function daySlots(input: {
  product: Product;
  machineIds: string[];
  date: string;
  settings: AppSettings;
  now: Date;
  excludeBookingId?: string;
}): Promise<Slot[]> {
  const rules = rulesFor(input.product, input.settings, input.now);
  const { from, to } = searchWindow(input.date, 1, rules);
  const busy = await loadBusy(input.machineIds, from, to, input.now, input.excludeBookingId);
  return slotsForDate(input.date, rules, busy);
}

/** The soonest bookable start for a product on any machine (hero "next available"). */
export async function nextAvailableSlot(input: {
  product: Product;
  settings: AppSettings;
  now: Date;
  searchDays?: number;
}): Promise<Slot | null> {
  const machineIds = await bookableMachineIds();
  if (machineIds.length === 0) return null;
  const today = toLocalDate(input.now);
  const days = input.searchDays ?? 21;
  const byDate = await monthAvailability({
    product: input.product,
    machineIds,
    fromDate: today,
    days,
    settings: input.settings,
    now: input.now,
  });
  const first = Object.keys(byDate)
    .sort()
    .find((d) => byDate[d] > 0);
  if (!first) return null;
  const slots = await daySlots({
    product: input.product,
    machineIds,
    date: first,
    settings: input.settings,
    now: input.now,
  });
  return slots[0] ?? null;
}
