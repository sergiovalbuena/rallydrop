import {
  addLocalDays,
  localDateMinuteToUtc,
  localMonth,
  localWeekday,
  toLocalDate,
  toLocalMinute,
} from "@/lib/time";

/*
 * Availability engine (pure). The database is the final authority — the
 * exclusion constraint on MachineOccupancy rejects any overlap at insert time —
 * but this computes what the calendar shows so customers only see real slots.
 *
 * Model: every busy period is stored as a block. A booking's block is
 * [startsAt, endsAt + buffer). A new booking is possible when its own block
 * doesn't overlap any existing block (half-open intervals).
 */

export type Interval = { start: Date; end: Date };

export type FixedStart = { weekday: number; minute: number };

export type SlotRules = {
  durationMinutes: number;
  /** Fixed start options (e.g. weekend). When empty, any step in the window. */
  allowedStarts?: FixedStart[] | null;
  stepMinutes: number;
  /** Delivery/pickup hours (local minutes from midnight, inclusive). */
  windowStartMinute: number;
  windowEndMinute: number;
  bufferMinutes: number;
  minLeadHours: number;
  maxAdvanceDays: number;
  season: { startMonth: number; endMonth: number; allowOffSeason: boolean };
  now: Date;
};

export type Slot = { start: Date; end: Date; machineIds: string[] };

const MINUTE = 60_000;

export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

/** The block a booking occupies, including the buffer after it. */
export function bookingBlock(start: Date, end: Date, bufferMinutes: number): Interval {
  return { start, end: new Date(end.getTime() + bufferMinutes * MINUTE) };
}

export function isInSeason(month: number, season: SlotRules["season"]): boolean {
  if (season.startMonth <= season.endMonth) {
    return month >= season.startMonth && month <= season.endMonth;
  }
  // Season wrapping the new year (e.g. Nov–Feb).
  return month >= season.startMonth || month <= season.endMonth;
}

function withinWindow(minute: number, rules: SlotRules): boolean {
  return minute >= rules.windowStartMinute && minute <= rules.windowEndMinute;
}

/** All start times the rules allow on a local date, before checking machines. */
export function candidateStarts(date: string, rules: SlotRules): Date[] {
  if (!rules.season.allowOffSeason && !isInSeason(localMonth(date), rules.season)) return [];

  const earliest = new Date(rules.now.getTime() + rules.minLeadHours * 60 * MINUTE);
  const latest = new Date(rules.now.getTime() + rules.maxAdvanceDays * 24 * 60 * MINUTE);

  let minutes: number[];
  if (rules.allowedStarts && rules.allowedStarts.length > 0) {
    const weekday = localWeekday(date);
    minutes = rules.allowedStarts.filter((s) => s.weekday === weekday).map((s) => s.minute);
  } else {
    minutes = [];
    for (let m = rules.windowStartMinute; m <= rules.windowEndMinute; m += rules.stepMinutes) {
      minutes.push(m);
    }
  }

  return minutes
    .map((m) => localDateMinuteToUtc(date, m))
    .filter((start) => {
      if (start < earliest || start > latest) return false;
      // Fixed starts (weekend) are allowed outside normal hours by definition.
      if (rules.allowedStarts && rules.allowedStarts.length > 0) return true;
      const end = new Date(start.getTime() + rules.durationMinutes * MINUTE);
      // The pickup at the end must also fall inside delivery hours.
      return withinWindow(toLocalMinute(end), rules);
    });
}

export function isMachineFree(busy: Interval[], start: Date, end: Date, bufferMinutes: number) {
  const block = bookingBlock(start, end, bufferMinutes);
  return !busy.some((b) => overlaps(block, b));
}

/** Slots on one date with the machines free for each. */
export function slotsForDate(
  date: string,
  rules: SlotRules,
  busyByMachine: Map<string, Interval[]>,
): Slot[] {
  const slots: Slot[] = [];
  for (const start of candidateStarts(date, rules)) {
    const end = new Date(start.getTime() + rules.durationMinutes * MINUTE);
    const machineIds = [...busyByMachine.entries()]
      .filter(([, busy]) => isMachineFree(busy, start, end, rules.bufferMinutes))
      .map(([id]) => id);
    if (machineIds.length > 0) slots.push({ start, end, machineIds });
  }
  return slots;
}

/** Map of local date → number of available slots, for the month calendar. */
export function availabilityByDate(
  fromDate: string,
  days: number,
  rules: SlotRules,
  busyByMachine: Map<string, Interval[]>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (let i = 0; i < days; i++) {
    const date = addLocalDays(fromDate, i);
    out[date] = slotsForDate(date, rules, busyByMachine).length;
  }
  return out;
}

export function todayLocal(now: Date): string {
  return toLocalDate(now);
}
