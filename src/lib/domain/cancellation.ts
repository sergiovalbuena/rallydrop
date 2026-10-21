import { applyBps } from "@/lib/money";

export type CancellationPolicy = {
  /** Full refund when cancelling at least this many hours before start. */
  fullRefundHours: number;
  /** Share refunded inside that window, in basis points (5000 = 50%). */
  lateRefundBps: number;
};

export type RefundDecision = {
  refundCents: number;
  /** "full" | "partial" | "none" — used for copy in the UI and emails. */
  tier: "full" | "partial" | "none";
  hoursBeforeStart: number;
};

export function refundFor(
  paidCents: number,
  startsAt: Date,
  now: Date,
  policy: CancellationPolicy,
): RefundDecision {
  const hoursBeforeStart = (startsAt.getTime() - now.getTime()) / 3_600_000;
  if (hoursBeforeStart <= 0) return { refundCents: 0, tier: "none", hoursBeforeStart };
  if (hoursBeforeStart >= policy.fullRefundHours) {
    return { refundCents: paidCents, tier: "full", hoursBeforeStart };
  }
  const refundCents = applyBps(paidCents, policy.lateRefundBps);
  return { refundCents, tier: refundCents > 0 ? "partial" : "none", hoursBeforeStart };
}

/** Customers can only self-serve before the rental starts. */
export function canCustomerCancel(status: string, startsAt: Date, now: Date): boolean {
  return (status === "CONFIRMED" || status === "PENDING_PAYMENT") && startsAt > now;
}
