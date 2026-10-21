import { describe, expect, it } from "vitest";
import {
  bookingBlock,
  candidateStarts,
  isInSeason,
  isMachineFree,
  slotsForDate,
  type SlotRules,
} from "@/lib/domain/availability";
import { localDateMinuteToUtc } from "@/lib/time";

// Wednesday Apr 28 2027, 10:00 in Victoria (PDT, UTC-7)
const now = localDateMinuteToUtc("2027-04-28", 600);

const dayRules: SlotRules = {
  durationMinutes: 25 * 60,
  stepMinutes: 30,
  windowStartMinute: 8 * 60,
  windowEndMinute: 21 * 60,
  bufferMinutes: 120,
  minLeadHours: 12,
  maxAdvanceDays: 90,
  season: { startMonth: 4, endMonth: 9, allowOffSeason: true },
  now,
};

const weekendRules: SlotRules = {
  ...dayRules,
  durationMinutes: 48 * 60,
  allowedStarts: [
    { weekday: 6, minute: 9 * 60 }, // Sat 09:00
    { weekday: 5, minute: 21 * 60 }, // Fri 21:00
  ],
};

describe("candidate starts", () => {
  it("only offers day-rental starts whose 25 h return is within delivery hours", () => {
    const starts = candidateStarts("2027-05-03", dayRules);
    // 08:00 → returns 09:00 next day … 20:00 → returns 21:00. 20:30 would return 21:30.
    expect(starts[0]).toEqual(localDateMinuteToUtc("2027-05-03", 480));
    expect(starts.at(-1)).toEqual(localDateMinuteToUtc("2027-05-03", 1200));
    expect(starts).toHaveLength(25);
  });

  it("respects the minimum lead time", () => {
    // Tomorrow before 22:00 today is < 12 h away → only from 22:00 on (none until 08:00 next day, which is fine).
    const starts = candidateStarts("2027-04-28", dayRules);
    expect(starts).toHaveLength(0);
  });

  it("offers weekend starts Friday 21:00 and Saturday 09:00 only", () => {
    expect(candidateStarts("2027-04-30", weekendRules)).toEqual([localDateMinuteToUtc("2027-04-30", 1260)]);
    expect(candidateStarts("2027-05-01", weekendRules)).toEqual([localDateMinuteToUtc("2027-05-01", 540)]);
    expect(candidateStarts("2027-05-03", weekendRules)).toEqual([]);
  });

  it("blocks off-season dates when the owner disables them", () => {
    const rules = { ...dayRules, now: localDateMinuteToUtc("2027-10-01", 600) };
    expect(candidateStarts("2027-11-10", rules).length).toBeGreaterThan(0);
    expect(candidateStarts("2027-11-10", { ...rules, season: { ...rules.season, allowOffSeason: false } })).toEqual(
      [],
    );
  });

  it("handles seasons that wrap the year", () => {
    expect(isInSeason(12, { startMonth: 11, endMonth: 2, allowOffSeason: false })).toBe(true);
    expect(isInSeason(6, { startMonth: 11, endMonth: 2, allowOffSeason: false })).toBe(false);
  });
});

describe("machine conflicts", () => {
  const start = localDateMinuteToUtc("2027-05-03", 600); // Mon 10:00
  const end = new Date(start.getTime() + 25 * 3_600_000); // Tue 11:00
  const existing = [bookingBlock(start, end, 120)]; // busy until Tue 13:00

  it("rejects overlaps and anything inside the 2 h buffer", () => {
    expect(isMachineFree(existing, localDateMinuteToUtc("2027-05-04", 660), localDateMinuteToUtc("2027-05-05", 720), 120)).toBe(false);
    expect(isMachineFree(existing, localDateMinuteToUtc("2027-05-04", 750), localDateMinuteToUtc("2027-05-05", 810), 120)).toBe(false);
  });

  it("allows the next rental exactly when the buffer ends", () => {
    expect(isMachineFree(existing, localDateMinuteToUtc("2027-05-04", 780), localDateMinuteToUtc("2027-05-05", 840), 120)).toBe(true);
  });

  it("requires the new rental's own buffer to end before the next block", () => {
    // New rental ending Mon 09:00 → its buffer runs to 11:00, overlapping the 10:00 start.
    expect(isMachineFree(existing, localDateMinuteToUtc("2027-05-02", 480), localDateMinuteToUtc("2027-05-03", 540), 120)).toBe(false);
    expect(isMachineFree(existing, localDateMinuteToUtc("2027-05-02", 420), localDateMinuteToUtc("2027-05-03", 480), 120)).toBe(true);
  });

  it("lists which machines are free per slot", () => {
    const busy = new Map([
      ["aura", existing],
      ["pace", []],
    ]);
    const slots = slotsForDate("2027-05-03", dayRules, busy);
    const tenAm = slots.find((s) => s.start.getTime() === start.getTime());
    expect(tenAm?.machineIds).toEqual(["pace"]);
    const eightAm = slots.find((s) => s.start.getTime() === localDateMinuteToUtc("2027-05-03", 480).getTime());
    expect(eightAm?.machineIds).toEqual(["pace"]);
  });
});
