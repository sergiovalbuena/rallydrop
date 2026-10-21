import "server-only";
import { db } from "@/lib/db";
import { canCustomerCancel, refundFor } from "@/lib/domain/cancellation";
import { getSettings } from "./settings";
import { sessionsUsage } from "./subscriptions";

const UPCOMING = ["PENDING_PAYMENT", "CONFIRMED", "CHECKED_OUT"] as const;

export async function customerBookings(customerId: string, now: Date) {
  const [bookings, settings] = await Promise.all([
    db.booking.findMany({
      where: {
        customerId,
        // Unpaid holds and abandoned checkouts aren't real bookings for the customer.
        status: { notIn: ["EXPIRED", "PENDING_PAYMENT"] },
        OR: [{ cancelReason: null }, { cancelReason: { notIn: ["abandoned", "payment_init_failed"] } }],
      },
      orderBy: { startsAt: "desc" },
      include: {
        machine: { select: { name: true } },
        product: { select: { name: true, kind: true } },
        court: { select: { name: true } },
        deposit: { select: { status: true, amountCents: true, capturedCents: true, captureNote: true } },
        payments: { select: { kind: true, receiptUrl: true, status: true, amountCents: true, refundedCents: true } },
      },
    }),
    getSettings(),
  ]);
  return bookings.map((b) => {
    const paid = b.payments
      .filter((p) => p.kind === "RENTAL" && (p.status === "SUCCEEDED" || p.status === "PARTIALLY_REFUNDED"))
      .reduce((s, p) => s + p.amountCents - p.refundedCents, 0);
    const refund = refundFor(paid, b.startsAt, now, {
      fullRefundHours: settings.cancelFullRefundHours,
      lateRefundBps: settings.cancelLateRefundBps,
    });
    return {
      ...b,
      upcoming: (UPCOMING as readonly string[]).includes(b.status) && b.endsAt > now,
      canCancel: canCustomerCancel(b.status, b.startsAt, now),
      canReschedule: b.status === "CONFIRMED" && b.startsAt > now,
      refundIfCancelled: refund,
      receipts: b.payments.filter((p) => p.receiptUrl).map((p) => p.receiptUrl!),
    };
  });
}

export async function customerPackage(customerId: string) {
  const sub = await db.subscription.findFirst({
    where: { customerId, status: { in: ["ACTIVE", "PAST_DUE"] } },
    include: { product: true },
    orderBy: { createdAt: "desc" },
  });
  if (!sub) return null;
  return { subscription: sub, usage: await sessionsUsage(sub.id) };
}
