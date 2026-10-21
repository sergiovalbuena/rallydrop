import { addDays } from "date-fns";
import { formatInTimeZone, getTimezoneOffset } from "date-fns-tz";
import { brand } from "@/config/brand";

/*
 * Local time for the business (America/Vancouver).
 *
 * British Columbia moves to permanent UTC-7 ("permanent daylight time") on
 * 2026-11-01 at 02:00 local (IANA tzdata 2026e). Many JavaScript runtimes ship
 * older time-zone data and would still fall back to UTC-8, putting every
 * booking an hour off. So the offset is computed here: runtime data before the
 * switch, a fixed -07:00 after it. When every runtime has the new data this
 * override is a no-op and can be removed.
 */
export const TZ = brand.timeZone;
const PERMANENT_OFFSET_FROM = Date.UTC(2026, 10, 1, 9, 0, 0); // 2026-11-01 02:00 PDT
const PERMANENT_OFFSET_MINUTES = -7 * 60;
const MINUTE = 60_000;

/** UTC offset (minutes, e.g. -420) in Victoria at a given instant. */
export function tzOffsetMinutes(utc: Date): number {
  if (utc.getTime() >= PERMANENT_OFFSET_FROM) return PERMANENT_OFFSET_MINUTES;
  return getTimezoneOffset(TZ, utc) / MINUTE;
}

/** A Date whose UTC fields read as Victoria wall-clock time. Internal only. */
function shifted(utc: Date): Date {
  return new Date(utc.getTime() + tzOffsetMinutes(utc) * MINUTE);
}

/** "2027-05-01" + 600 (10:00) in Victoria time → UTC Date. */
export function localDateMinuteToUtc(date: string, minute: number): Date {
  const [y, m, d] = date.split("-").map(Number);
  const wall = Date.UTC(y, m - 1, d, 0, minute);
  // Two passes settle the offset around DST transitions.
  let guess = wall - tzOffsetMinutes(new Date(wall)) * MINUTE;
  guess = wall - tzOffsetMinutes(new Date(guess)) * MINUTE;
  return new Date(guess);
}

/** UTC Date → "2027-05-01" in Victoria time. */
export function toLocalDate(d: Date): string {
  return shifted(d).toISOString().slice(0, 10);
}

/** Minutes from local midnight in Victoria for a UTC Date. */
export function toLocalMinute(d: Date): number {
  const s = shifted(d);
  return s.getUTCHours() * 60 + s.getUTCMinutes();
}

/** Day of week in Victoria (0 = Sunday) for a local date string. */
export function localWeekday(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Month (1-12) of a local date string. */
export function localMonth(date: string): number {
  return Number(date.slice(5, 7));
}

export function addLocalDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return addDays(new Date(Date.UTC(y, m - 1, d)), days)
    .toISOString()
    .slice(0, 10);
}

/** Formats an instant as Victoria wall-clock time (date-fns pattern, no zone tokens). */
export function formatLocal(d: Date, pattern: string): string {
  return formatInTimeZone(shifted(d), "UTC", pattern);
}

/** Formats a local date string ("2027-05-01") with a date-fns pattern. */
export function formatLocalDate(date: string, pattern: string): string {
  return formatInTimeZone(new Date(`${date}T12:00:00Z`), "UTC", pattern);
}

/** "Sat, May 1 · 9:00 AM" */
export function formatSlot(d: Date): string {
  return formatLocal(d, "EEE, MMM d · h:mm a");
}

/** "Sat, May 1, 9:00 AM → Mon, May 3, 9:00 AM" */
export function formatRange(start: Date, end: Date): string {
  return `${formatSlot(start)} → ${formatSlot(end)}`;
}

/** "h:mm a" for a local minute-of-day. */
export function minuteToLabel(minute: number): string {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function hoursBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / 3_600_000;
}

/** Today's date in Victoria. */
export function todayLocal(now: Date): string {
  return toLocalDate(now);
}

/** "YYYYMMDDTHHMMSSZ" for calendar files. */
export function toIcsUtc(d: Date): string {
  return d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}
