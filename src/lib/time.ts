import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import { addDays } from "date-fns";
import { brand } from "@/config/brand";

export const TZ = brand.timeZone;

/** "2027-05-01" + 600 (10:00) in Victoria time → UTC Date. */
export function localDateMinuteToUtc(date: string, minute: number): Date {
  const h = String(Math.floor(minute / 60)).padStart(2, "0");
  const m = String(minute % 60).padStart(2, "0");
  return fromZonedTime(`${date}T${h}:${m}:00`, TZ);
}

/** UTC Date → "2027-05-01" in Victoria time. */
export function toLocalDate(d: Date): string {
  return formatInTimeZone(d, TZ, "yyyy-MM-dd");
}

/** Minutes from local midnight in Victoria for a UTC Date. */
export function toLocalMinute(d: Date): number {
  const z = toZonedTime(d, TZ);
  return z.getHours() * 60 + z.getMinutes();
}

/** Day of week in Victoria (0 = Sunday). */
export function localWeekday(date: string): number {
  return toZonedTime(localDateMinuteToUtc(date, 12 * 60), TZ).getDay();
}

/** Month in Victoria (1-12). */
export function localMonth(date: string): number {
  return Number(date.slice(5, 7));
}

export function addLocalDays(date: string, days: number): string {
  // Noon avoids DST edge cases when stepping whole days.
  return toLocalDate(addDays(localDateMinuteToUtc(date, 12 * 60), days));
}

export function formatLocal(d: Date, pattern: string): string {
  return formatInTimeZone(d, TZ, pattern);
}

/** "Sat, May 1 · 9:00 AM" */
export function formatSlot(d: Date): string {
  return formatInTimeZone(d, TZ, "EEE, MMM d · h:mm a");
}

/** "Sat, May 1, 9:00 AM → Mon, May 3, 9:00 AM" */
export function formatRange(start: Date, end: Date): string {
  return `${formatSlot(start)} → ${formatSlot(end)}`;
}

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
