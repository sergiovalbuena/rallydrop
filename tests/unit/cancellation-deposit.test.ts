import { describe, expect, it } from "vitest";
import { canCustomerCancel, refundFor } from "@/lib/domain/cancellation";
import { planDeposit, validateCapture } from "@/lib/domain/deposit";

const policy = { fullRefundHours: 48, lateRefundBps: 5000 };
const H = 3_600_000;
const now = new Date("2027-05-01T17:00:00Z");

describe("cancellation policy", () => {
  it("refunds in full 48 h or more before the start", () => {
    expect(refundFor(5040, new Date(now.getTime() + 48 * H), now, policy)).toMatchObject({
      refundCents: 5040,
      tier: "full",
    });
  });

  it("refunds 50% inside 48 h", () => {
    expect(refundFor(5040, new Date(now.getTime() + 47 * H), now, policy)).toMatchObject({
      refundCents: 2520,
      tier: "partial",
    });
  });

  it("refunds nothing once started", () => {
    expect(refundFor(5040, new Date(now.getTime() - H), now, policy).tier).toBe("none");
  });

  it("only lets customers cancel confirmed future bookings", () => {
    const future = new Date(now.getTime() + H);
    expect(canCustomerCancel("CONFIRMED", future, now)).toBe(true);
    expect(canCustomerCancel("CHECKED_OUT", future, now)).toBe(false);
    expect(canCustomerCancel("CONFIRMED", new Date(now.getTime() - H), now)).toBe(false);
  });
});

describe("deposit plan", () => {
  const rules = { authMaxDays: 6, leadHours: 24, now };

  it("holds the card right away for a 25 h rental starting tomorrow", () => {
    const startsAt = new Date(now.getTime() + 20 * H);
    const plan = planDeposit({ ...rules, startsAt, endsAt: new Date(startsAt.getTime() + 25 * H) });
    expect(plan).toEqual({ strategy: "AUTH_HOLD", placeNow: true, authScheduledFor: null });
  });

  it("schedules the hold 24 h before a rental booked weeks ahead", () => {
    const startsAt = new Date(now.getTime() + 21 * 24 * H);
    const plan = planDeposit({ ...rules, startsAt, endsAt: new Date(startsAt.getTime() + 48 * H) });
    expect(plan.strategy).toBe("AUTH_HOLD");
    expect(plan.placeNow).toBe(false);
    expect(plan.authScheduledFor?.toISOString()).toBe(new Date(startsAt.getTime() - 24 * H).toISOString());
  });

  it("saves the card for week and month rentals", () => {
    const startsAt = new Date(now.getTime() + 2 * H);
    expect(planDeposit({ ...rules, startsAt, endsAt: new Date(startsAt.getTime() + 168 * H) }).strategy).toBe(
      "SAVED_CARD",
    );
    expect(planDeposit({ ...rules, startsAt, endsAt: new Date(startsAt.getTime() + 720 * H) }).strategy).toBe(
      "SAVED_CARD",
    );
  });

  it("treats exactly 6 days as a short rental", () => {
    const startsAt = new Date(now.getTime() + 2 * H);
    expect(planDeposit({ ...rules, startsAt, endsAt: new Date(startsAt.getTime() + 144 * H) }).strategy).toBe(
      "AUTH_HOLD",
    );
  });
});

describe("deposit capture validation", () => {
  const base = { depositCents: 30000, alreadyCapturedCents: 0, note: "Cracked hopper" };

  it("requires a note", () => {
    expect(validateCapture({ ...base, amountCents: 5000, note: "  " }).ok).toBe(false);
  });

  it("allows partial and full captures, never more than the deposit", () => {
    expect(validateCapture({ ...base, amountCents: 5000 }).ok).toBe(true);
    expect(validateCapture({ ...base, amountCents: 30000 }).ok).toBe(true);
    expect(validateCapture({ ...base, amountCents: 30001 }).ok).toBe(false);
    expect(validateCapture({ ...base, amountCents: 20000, alreadyCapturedCents: 15000 }).ok).toBe(false);
  });
});
