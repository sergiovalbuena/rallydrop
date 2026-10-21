"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { assertAdmin } from "@/lib/admin/guard";
import { notifyRescheduled } from "@/lib/notify/booking-notifications";
import { createBooking, rescheduleBooking } from "@/lib/services/bookings";
import { BookingError, isOverlapError } from "@/lib/services/errors";
import { geocodeAddress } from "@/lib/services/geocode";
import { addLocalDays, localDateMinuteToUtc, toLocalMinute } from "@/lib/time";

export type CalResult = { ok: true; message?: string } | { ok: false; error: string };

function fail(e: unknown): CalResult {
  if (e instanceof BookingError) return { ok: false, error: e.message };
  console.error(e);
  return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
}

const dateRe = /^\d{4}-\d{2}-\d{2}$/;

/** Drag & drop: move a booking to another day, keeping its time of day. */
export async function moveToDateAction(bookingId: string, date: string, machineId?: string): Promise<CalResult> {
  try {
    const user = await assertAdmin();
    if (!dateRe.test(date)) return { ok: false, error: "Invalid date." };
    const booking = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });
    const startsAt = localDateMinuteToUtc(date, toLocalMinute(booking.startsAt));
    await rescheduleBooking({ bookingId, startsAt, machineId, actor: `admin:${user.id}`, skipSlotRules: true });
    await notifyRescheduled(bookingId);
    revalidatePath("/admin/calendar");
    return { ok: true, message: "Booking moved and customer notified." };
  } catch (e) {
    return fail(e);
  }
}

const manual = z.object({
  productId: z.string().min(1),
  machineId: z.string().min(1),
  date: z.string().regex(dateRe),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  name: z.string().trim().min(2),
  email: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  fulfillment: z.enum(["PICKUP", "DELIVERY_COURT", "DELIVERY_ADDRESS"]),
  courtId: z.string().optional(),
  address: z.string().trim().optional(),
  balls: z.boolean(),
  notes: z.string().trim().optional(),
});

/** Phone booking: confirmed immediately; payment collected separately. */
export async function createManualBookingAction(input: z.input<typeof manual>): Promise<CalResult & { bookingId?: string }> {
  try {
    await assertAdmin();
    const d = manual.parse(input);
    const [h, m] = d.time.split(":").map(Number);
    const point = d.fulfillment === "DELIVERY_ADDRESS" && d.address ? await geocodeAddress(d.address) : null;
    const booking = await createBooking({
      productId: d.productId,
      machineId: d.machineId,
      startsAt: localDateMinuteToUtc(d.date, h * 60 + m),
      customer: { name: d.name, email: d.email || null, phone: d.phone || null },
      balls: d.balls,
      fulfillment: d.fulfillment,
      courtId: d.fulfillment === "DELIVERY_COURT" ? d.courtId : null,
      deliveryAddress: d.fulfillment === "DELIVERY_ADDRESS" ? d.address : null,
      deliveryPoint: point,
      customerNotes: d.notes || null,
      channel: "ADMIN",
      termsAccepted: false,
      skipSlotRules: true,
    });
    revalidatePath("/admin/calendar");
    return { ok: true, message: `Booking ${booking.code} created.`, bookingId: booking.id };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "Please fill in all required fields." };
    return fail(e);
  }
}

const blackout = z.object({
  from: z.string().regex(dateRe),
  to: z.string().regex(dateRe),
  machineId: z.string().optional(),
  reason: z.enum(["WEATHER", "MAINTENANCE", "HOLIDAY", "OTHER"]),
  note: z.string().trim().max(200).optional(),
});

/** Blocks whole days (rain, maintenance, holidays) for one or all machines. */
export async function createBlackoutAction(input: z.input<typeof blackout>): Promise<CalResult> {
  try {
    await assertAdmin();
    const d = blackout.parse(input);
    if (d.to < d.from) return { ok: false, error: "End date is before start date." };
    const startsAt = localDateMinuteToUtc(d.from, 0);
    const endsAt = localDateMinuteToUtc(addLocalDays(d.to, 1), 0);
    const machines = d.machineId
      ? [d.machineId]
      : (await db.machine.findMany({ where: { status: { not: "RETIRED" } }, select: { id: true } })).map((m) => m.id);

    const conflicts = await db.machineOccupancy.findMany({
      where: {
        machineId: { in: machines },
        active: true,
        blockStart: { lt: endsAt },
        blockEnd: { gt: startsAt },
        source: "BOOKING",
        OR: [{ holdExpiresAt: null }, { holdExpiresAt: { gt: new Date() } }],
      },
      include: { booking: { select: { code: true } } },
    });
    if (conflicts.length > 0) {
      return {
        ok: false,
        error: `These bookings overlap the blocked days — move or cancel them first: ${conflicts.map((c) => c.booking?.code).join(", ")}`,
      };
    }

    await db.$transaction(async (tx) => {
      const b = await tx.blackout.create({
        data: { startsAt, endsAt, reason: d.reason, note: d.note || null, machineId: d.machineId || null },
      });
      await tx.machineOccupancy.createMany({
        data: machines.map((machineId) => ({ machineId, source: "BLACKOUT" as const, blockStart: startsAt, blockEnd: endsAt, blackoutId: b.id })),
      });
    });
    revalidatePath("/admin/calendar");
    return { ok: true, message: "Days blocked." };
  } catch (e) {
    if (isOverlapError(e)) return { ok: false, error: "Those days overlap an existing booking or group session." };
    return fail(e);
  }
}

export async function deleteBlackoutAction(id: string): Promise<CalResult> {
  try {
    await assertAdmin();
    await db.blackout.delete({ where: { id } });
    revalidatePath("/admin/calendar");
    return { ok: true, message: "Block removed." };
  } catch (e) {
    return fail(e);
  }
}
