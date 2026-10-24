import { describe, expect, it } from "vitest";
import { lateFee } from "@/lib/domain/deposit";

const endsAt = new Date("2027-03-10T18:00:00Z");
const base = { endsAt, graceMinutes: 30, hourlyCents: 1500, dayCents: 5000, unreturnedHours: 24 };
const after = (minutes: number) => new Date(endsAt.getTime() + minutes * 60_000);

describe("late returns", () => {
  it("is free inside the 30-minute grace period", () => {
    expect(lateFee({ ...base, returnedAt: after(30) })).toEqual({ cents: 0, hoursLate: 0, unreturned: false });
  });
  it("charges $15 for each started hour after that", () => {
    expect(lateFee({ ...base, returnedAt: after(31) })).toMatchObject({ cents: 1500, hoursLate: 1 });
    expect(lateFee({ ...base, returnedAt: after(121) })).toMatchObject({ cents: 4500, hoursLate: 3 });
  });
  it("is capped at one day's price", () => {
    expect(lateFee({ ...base, returnedAt: after(10 * 60) }).cents).toBe(5000);
  });
  it("counts it as not returned after 24 h", () => {
    expect(lateFee({ ...base, returnedAt: after(23 * 60) }).unreturned).toBe(false);
    expect(lateFee({ ...base, returnedAt: after(24 * 60) }).unreturned).toBe(true);
  });
});
