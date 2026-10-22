import { describe, expect, it } from "vitest";
import { creditExpiry, creditRestore, creditToApply, planCreditSpend, rainEligible } from "@/lib/domain/credit";
import { coveredHours, occupancy, payback } from "@/lib/domain/occupancy";

const d = (iso: string) => new Date(iso);

describe("credits", () => {
  it("applies credit but keeps the minimum card charge", () => {
    expect(creditToApply(4500, 10_000, 100)).toBe(4400);
    expect(creditToApply(4500, 2000, 100)).toBe(2000);
    expect(creditToApply(4500, 0, 100)).toBe(0);
    // Package sessions have a card on file: credit can cover everything.
    expect(creditToApply(2500, 5000, 0)).toBe(2500);
    expect(creditToApply(50, 5000, 100)).toBe(0);
  });

  it("spends the credits that expire first and skips expired ones", () => {
    const now = d("2027-01-01T00:00:00Z");
    const plan = planCreditSpend(
      [
        { id: "late", remainingCents: 3000, expiresAt: d("2027-06-01T00:00:00Z") },
        { id: "soon", remainingCents: 1000, expiresAt: d("2027-02-01T00:00:00Z") },
        { id: "gone", remainingCents: 9000, expiresAt: d("2026-12-01T00:00:00Z") },
      ],
      2500,
      now,
    );
    expect(plan).toEqual([
      { creditId: "soon", cents: 1000 },
      { creditId: "late", cents: 1500 },
    ]);
  });

  it("gives back the same share as the cash refund, once", () => {
    expect(creditRestore(2000, 0, 10_000)).toBe(2000);
    expect(creditRestore(2000, 0, 5000)).toBe(1000);
    expect(creditRestore(2000, 1000, 10_000)).toBe(1000);
    expect(creditRestore(2000, 2000, 10_000)).toBe(0);
    expect(creditRestore(2000, 0, 0)).toBe(0);
  });

  it("expires rain credits after the configured months", () => {
    expect(creditExpiry(d("2026-11-15T18:00:00Z"), 6).toISOString()).toBe("2027-05-15T18:00:00.000Z");
  });
});

describe("rain eligibility", () => {
  const booking = { status: "CONFIRMED", startsAt: d("2027-05-01T16:00:00Z"), startDate: "2027-05-01" };
  const none = new Set<string>();

  it("is open on the start day, before the start time", () => {
    expect(rainEligible(booking, d("2027-05-01T15:00:00Z"), "2027-05-01", none)).toBe(true);
    expect(rainEligible(booking, d("2027-05-01T16:30:00Z"), "2027-05-01", none)).toBe(false);
    expect(rainEligible(booking, d("2027-04-30T15:00:00Z"), "2027-04-30", none)).toBe(false);
  });

  it("is open all day when the owner declared a rain day", () => {
    expect(rainEligible(booking, d("2027-05-01T20:00:00Z"), "2027-05-01", new Set(["2027-05-01"]))).toBe(true);
  });

  it("is never open for bookings that aren't confirmed", () => {
    expect(rainEligible({ ...booking, status: "CHECKED_OUT" }, d("2027-05-01T15:00:00Z"), "2027-05-01", none)).toBe(
      false,
    );
  });
});

describe("owner metrics", () => {
  const from = d("2027-05-01T07:00:00Z");
  const to = d("2027-05-31T07:00:00Z"); // 30 days

  it("counts overlapping and out-of-period time once", () => {
    const hours = coveredHours(
      [
        { start: d("2027-04-30T07:00:00Z"), end: d("2027-05-02T07:00:00Z") }, // 1 day inside
        { start: d("2027-05-10T07:00:00Z"), end: d("2027-05-12T07:00:00Z") },
        { start: d("2027-05-11T07:00:00Z"), end: d("2027-05-13T07:00:00Z") }, // overlaps the one above
      ],
      from,
      to,
    );
    expect(hours).toBe(24 + 72);
  });

  it("measures occupancy against the days the machine was available", () => {
    const o = occupancy({
      rentals: [{ start: d("2027-05-03T07:00:00Z"), end: d("2027-05-09T07:00:00Z") }], // 6 days
      blocked: [{ start: d("2027-05-20T07:00:00Z"), end: d("2027-05-26T07:00:00Z") }], // 6 days off
      from,
      to,
    });
    expect(o).toEqual({ rentedDays: 6, availableDays: 24, percent: 25 });
  });

  it("reports payback only when the purchase cost is known", () => {
    expect(payback(60_000, 150_000)).toEqual({ percent: 40, remainingCents: 90_000 });
    expect(payback(200_000, 150_000)).toEqual({ percent: 133, remainingCents: 0 });
    expect(payback(60_000, null)).toBeNull();
  });
});
