import "server-only";
import { db } from "@/lib/db";
import type { BookingStatus, Prisma } from "@/generated/prisma/client";
import { getSettings } from "@/lib/services/settings";
import { addLocalDays, localDateMinuteToUtc, toLocalDate } from "@/lib/time";
import { occupancy as occupancyOf } from "@/lib/domain/occupancy";

export const ACTIVE_STATUSES: BookingStatus[] = [
  "CONFIRMED",
  "CHECKED_OUT",
  "RETURNED_OK",
  "RETURNED_DAMAGED",
  "COMPLETED",
];

export function monthRange(now: Date) {
  const today = toLocalDate(now);
  const first = `${today.slice(0, 7)}-01`;
  const [y, m] = first.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return { from: localDateMinuteToUtc(first, 0), to: localDateMinuteToUtc(next, 0) };
}

export async function dashboardStats(now: Date) {
  const { from, to } = monthRange(now);
  const today = toLocalDate(now);
  const dayStart = localDateMinuteToUtc(today, 0);
  const dayEnd = localDateMinuteToUtc(addLocalDays(today, 1), 0);
  const weekEnd = localDateMinuteToUtc(addLocalDays(today, 7), 0);

  const [payments, todays, week, out, deposits, machines, monthBookings, blackouts] = await Promise.all([
    db.payment.findMany({
      where: { createdAt: { gte: from, lt: to }, status: { in: ["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED"] } },
      select: {
        amountCents: true,
        refundedCents: true,
        kind: true,
        booking: { select: { product: { select: { name: true } } } },
        subscription: { select: { product: { select: { name: true } } } },
      },
    }),
    db.booking.findMany({
      where: {
        status: { in: ACTIVE_STATUSES },
        OR: [{ startsAt: { gte: dayStart, lt: dayEnd } }, { endsAt: { gte: dayStart, lt: dayEnd } }],
      },
      include: { customer: true, machine: true, court: true },
      orderBy: { startsAt: "asc" },
    }),
    db.booking.count({ where: { status: { in: ACTIVE_STATUSES }, startsAt: { gte: dayStart, lt: weekEnd } } }),
    db.booking.findMany({
      where: { status: "CHECKED_OUT" },
      include: { customer: true, machine: true },
      orderBy: { endsAt: "asc" },
    }),
    db.deposit.findMany({
      where: {
        status: { in: ["HELD", "CARD_SAVED", "FAILED"] },
        booking: { status: { notIn: ["CANCELLED", "EXPIRED"] } },
      },
      include: { booking: { include: { customer: true } } },
      orderBy: { createdAt: "asc" },
    }),
    db.machine.findMany({ where: { status: { not: "RETIRED" } }, orderBy: { sortOrder: "asc" } }),
    db.booking.findMany({
      where: { status: { in: ACTIVE_STATUSES }, startsAt: { lt: to }, endsAt: { gt: from } },
      select: { machineId: true, startsAt: true, endsAt: true },
    }),
    db.blackout.findMany({
      where: { startsAt: { lt: to }, endsAt: { gt: from } },
      select: { machineId: true, startsAt: true, endsAt: true },
    }),
  ]);

  const revenueCents = payments.reduce((s, p) => s + p.amountCents - p.refundedCents, 0);
  // Revenue by product: rentals by what was rented, package invoices by package.
  const byProduct = new Map<string, number>();
  for (const p of payments) {
    const label =
      p.kind === "DEPOSIT_CAPTURE"
        ? "Damage & late charges"
        : p.kind === "GROUP_SESSION"
          ? "Group sessions"
          : (p.booking?.product.name ?? p.subscription?.product.name ?? "Other");
    byProduct.set(label, (byProduct.get(label) ?? 0) + p.amountCents - p.refundedCents);
  }
  const revenueByProduct = [...byProduct.entries()]
    .map(([label, cents]) => ({ label, cents }))
    .sort((a, b) => b.cents - a.cents);

  const occupancy = machines.map((m) => ({
    machine: m,
    ...occupancyOf({
      rentals: monthBookings.filter((b) => b.machineId === m.id).map((b) => ({ start: b.startsAt, end: b.endsAt })),
      blocked: blackouts
        .filter((b) => b.machineId === null || b.machineId === m.id)
        .map((b) => ({ start: b.startsAt, end: b.endsAt })),
      from,
      to,
    }),
  }));

  return { revenueCents, revenueByProduct, todays, weekCount: week, out, deposits, occupancy, dayStart, dayEnd };
}

export type BookingFilters = {
  q?: string;
  status?: string;
  machine?: string;
  from?: string;
  to?: string;
};

export function bookingWhere(f: BookingFilters): Prisma.BookingWhereInput {
  const where: Prisma.BookingWhereInput = { status: { not: "EXPIRED" } };
  if (f.status && f.status !== "ALL") where.status = f.status as BookingStatus;
  if (f.machine) where.machineId = f.machine;
  if (f.from || f.to) {
    where.startsAt = {
      ...(f.from ? { gte: localDateMinuteToUtc(f.from, 0) } : {}),
      ...(f.to ? { lt: localDateMinuteToUtc(addLocalDays(f.to, 1), 0) } : {}),
    };
  }
  if (f.q?.trim()) {
    const q = f.q.trim();
    where.OR = [
      { code: { contains: q, mode: "insensitive" } },
      { customer: { name: { contains: q, mode: "insensitive" } } },
      { customer: { email: { contains: q, mode: "insensitive" } } },
      { customer: { phone: { contains: q.replace(/\D/g, "") || q } } },
    ];
  }
  return where;
}

/** Things the owner should act on, shown at the top of the dashboard. */
export async function dashboardAlerts(now: Date) {
  const soon = new Date(now.getTime() + 24 * 3_600_000);
  const [settings, termsMissing, holdsExpiring] = await Promise.all([
    getSettings(),
    db.booking.findMany({
      where: {
        acceptances: { none: {} },
        endsAt: { gte: new Date(now.getTime() - 30 * 86_400_000) },
        OR: [
          { status: { in: ACTIVE_STATUSES } },
          { status: "PENDING_PAYMENT", payments: { some: { kind: "RENTAL", status: "SUCCEEDED" } } },
        ],
      },
      select: { id: true, code: true, customer: { select: { name: true } }, startsAt: true },
      orderBy: { startsAt: "asc" },
      take: 20,
    }),
    // Card holds last ~7 days: warn a day ahead when the machine isn't back yet.
    db.deposit.findMany({
      where: {
        status: "HELD",
        authExpiresAt: { lte: soon },
        booking: { status: { in: ["CONFIRMED", "CHECKED_OUT"] } },
      },
      select: { bookingId: true, authExpiresAt: true, booking: { select: { code: true } } },
    }),
  ]);
  return {
    insuranceMissing: !settings.insuranceProvider,
    termsMissing,
    holdsExpiring,
  };
}

/**
 * Lifetime money a machine has brought in (rentals net of refunds; damage
 * charges shown apart) against what it cost, for the payback panel.
 */
export async function machineEarnings(machineId: string) {
  const [payments, maintenance] = await Promise.all([
    db.payment.findMany({
      where: {
        booking: { machineId },
        kind: { in: ["RENTAL", "MANUAL", "DEPOSIT_CAPTURE"] },
        status: { in: ["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED"] },
      },
      select: { kind: true, amountCents: true, refundedCents: true },
    }),
    db.maintenanceLog.aggregate({ where: { machineId }, _sum: { costCents: true } }),
  ]);
  const net = (kinds: string[]) =>
    payments.filter((p) => kinds.includes(p.kind)).reduce((s, p) => s + p.amountCents - p.refundedCents, 0);
  return {
    rentalCents: net(["RENTAL", "MANUAL"]),
    damageCents: net(["DEPOSIT_CAPTURE"]),
    maintenanceCents: maintenance._sum.costCents ?? 0,
  };
}
