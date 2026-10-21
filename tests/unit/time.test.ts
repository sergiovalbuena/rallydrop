import { describe, expect, it } from "vitest";
import {
  formatLocal,
  localDateMinuteToUtc,
  localWeekday,
  toLocalDate,
  toLocalMinute,
  tzOffsetMinutes,
} from "@/lib/time";

describe("Victoria local time", () => {
  it("uses PDT in summer", () => {
    expect(localDateMinuteToUtc("2026-07-01", 600).toISOString()).toBe("2026-07-01T17:00:00.000Z");
  });

  it("uses PST in winter before the 2026 change", () => {
    expect(localDateMinuteToUtc("2026-01-15", 600).toISOString()).toBe("2026-01-15T18:00:00.000Z");
  });

  it("stays on UTC-7 permanently from Nov 1 2026 (BC permanent daylight time)", () => {
    expect(tzOffsetMinutes(new Date("2026-11-01T09:00:00Z"))).toBe(-420);
    expect(localDateMinuteToUtc("2026-11-07", 600).toISOString()).toBe("2026-11-07T17:00:00.000Z");
    expect(localDateMinuteToUtc("2027-01-15", 600).toISOString()).toBe("2027-01-15T17:00:00.000Z");
  });

  it("round-trips dates and minutes", () => {
    const d = localDateMinuteToUtc("2027-05-01", 1260);
    expect(toLocalDate(d)).toBe("2027-05-01");
    expect(toLocalMinute(d)).toBe(1260);
    expect(formatLocal(d, "EEE h:mm a")).toBe("Sat 9:00 PM");
  });

  it("knows weekdays of local dates", () => {
    expect(localWeekday("2027-05-01")).toBe(6);
    expect(localWeekday("2027-05-02")).toBe(0);
  });

  it("handles the spring-forward gap of 2026", () => {
    // 02:30 doesn't exist on Mar 8 2026; we land on a valid instant nearby.
    const d = localDateMinuteToUtc("2026-03-08", 150);
    expect(["2026-03-08T09:30:00.000Z", "2026-03-08T10:30:00.000Z"]).toContain(d.toISOString());
  });
});
