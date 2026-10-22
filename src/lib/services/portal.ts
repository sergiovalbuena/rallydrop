import "server-only";
import { db } from "@/lib/db";
import { canCustomerCancel, refundFor } from "@/lib/domain/cancellation";
import { rainEligible } from "@/lib/domain/credit";
import { addLocalDays, toLocalDate } from "@/lib/time";
import { availableCredits, rainDates } from "./credits";
import { getSettings } from "./settings";
import { sessionsUsage } from "./subscriptions";

const UPCOMING = ["PENDING_PAYMENT", "CONFIRMED", "CHECKED_OUT"] as const;

export async function customerBookings(customerId: string, now: Date) {
  const today = toLocalDate(now);
  const [bookings, settings, rainy] = await Promise.all([
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
        acceptances: {
          orderBy: { acceptedAt: "desc" },
          take: 1,
          select: { termsVersion: true, acceptedAtLocal: true },
        },
      },
    }),
    getSettings(),
    rainDates(addLocalDays(today, -7), addLocalDays(today, 400)),
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
      rainEligible: rainEligible({ ...b, startDate: toLocalDate(b.startsAt) }, now, today, rainy),
      canReschedule: b.status === "CONFIRMED" && b.startsAt > now,
      acceptance: b.acceptances[0] ?? null,
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

export async function customerCredits(customerId: string, now: Date) {
  const credits = await availableCredits(customerId, now);
  return { credits, balanceCents: credits.reduce((sum, c) => sum + c.remainingCents, 0) };
}
