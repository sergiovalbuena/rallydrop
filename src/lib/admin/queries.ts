import "server-only";
import { db } from "@/lib/db";
import type { BookingStatus, Prisma } from "@/generated/prisma/client";
import { addLocalDays, localDateMinuteToUtc, toLocalDate } from "@/lib/time";

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

  const [payments, todays, week, out, deposits, machines, monthBookings] = await Promise.all([
    db.payment.findMany({
      where: { createdAt: { gte: from, lt: to }, status: { in: ["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED"] } },
      select: { amountCents: true, refundedCents: true, kind: true },
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
  ]);

  const revenueCents = payments.reduce((s, p) => s + p.amountCents - p.refundedCents, 0);
  const monthHours = (to.getTime() - from.getTime()) / 3_600_000;
  const occupancy = machines.map((m) => {
    const hours = monthBookings
      .filter((b) => b.machineId === m.id)
      .reduce((s, b) => {
        const start = Math.max(b.startsAt.getTime(), from.getTime());
        const end = Math.min(b.endsAt.getTime(), to.getTime());
        return s + Math.max(0, end - start) / 3_600_000;
      }, 0);
    return { machine: m, hours, percent: Math.round((hours / monthHours) * 100) };
  });

  return { revenueCents, todays, weekCount: week, out, deposits, occupancy, dayStart, dayEnd };
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
