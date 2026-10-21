import "server-only";
import { db } from "@/lib/db";
import type {
  BookingChannel,
  BookingStatus,
  FulfillmentMethod,
  Prisma,
  SkillLevel,
} from "@/generated/prisma/client";
import { generateBookingCode } from "@/lib/domain/booking-code";
import { planDeposit } from "@/lib/domain/deposit";
import { isInFreeZone, type LatLng } from "@/lib/domain/geo";
import { quote, type Quote } from "@/lib/domain/pricing";
import { candidateStarts } from "@/lib/domain/availability";
import { brand } from "@/config/brand";
import { toLocalDate } from "@/lib/time";
import { productDurationMinutes, rulesFor } from "./availability";
import { upsertCustomer } from "./customers";
import { BookingError, isOverlapError } from "./errors";
import { getSettings, type AppSettings } from "./settings";

export const TERMS_VERSION = "2026-10";

export type CreateBookingInput = {
  productId: string;
  machineId: string;
  startsAt: Date;
  customer: { name: string; email?: string | null; phone?: string | null; skillLevel?: SkillLevel | null };
  balls: boolean;
  fulfillment: FulfillmentMethod;
  courtId?: string | null;
  deliveryAddress?: string | null;
  /** Geocoded delivery address, when available. */
  deliveryPoint?: LatLng | null;
  customerNotes?: string | null;
  channel: BookingChannel;
  /** Package session: product price is covered by the subscription. */
  subscriptionId?: string | null;
  termsAccepted: boolean;
  now?: Date;
  /** Admin bookings may skip the public slot rules (still no double booking). */
  skipSlotRules?: boolean;
};

export type PriceContext = {
  settings: AppSettings;
  inFreeZone: boolean | null;
};

/** Everything needed to price a booking. Used by the live summary and checkout. */
export async function priceBooking(input: {
  productId: string;
  machineId: string;
  balls: boolean;
  fulfillment: FulfillmentMethod;
  courtId?: string | null;
  deliveryAddress?: string | null;
  deliveryPoint?: LatLng | null;
  productIncluded?: boolean;
}): Promise<{ quote: Quote; inFreeZone: boolean | null }> {
  const [settings, product, machine, addOns, court] = await Promise.all([
    getSettings(),
    db.product.findUnique({ where: { id: input.productId } }),
    db.machine.findUnique({ where: { id: input.machineId } }),
    db.addOn.findMany({ where: { active: true } }),
    input.courtId ? db.court.findUnique({ where: { id: input.courtId } }) : null,
  ]);
  if (!product || !machine) throw new BookingError("NOT_FOUND", "That product or machine no longer exists.");

  const ballsAddOn = addOns.find((a) => a.kind === "BALLS");
  const deliveryAddOn = addOns.find((a) => a.kind === "DELIVERY");
  const isDelivery = input.fulfillment !== "PICKUP";

  const point: LatLng | null = court
    ? { lat: Number(court.lat), lng: Number(court.lng) }
    : (input.deliveryPoint ?? null);
  const inFreeZone = isDelivery
    ? isInFreeZone({
        point,
        address: input.deliveryAddress,
        center: { lat: settings.freeDeliveryCenterLat, lng: settings.freeDeliveryCenterLng },
        radiusKm: settings.freeDeliveryRadiusKm,
        freeFsas: brand.freeDeliveryFsas,
      })
    : null;

  const q = quote({
    product: { name: product.name, priceCents: product.priceCents },
    balls: {
      selected: input.balls && !!ballsAddOn,
      name: ballsAddOn?.name ?? "Balls",
      priceCents: ballsAddOn?.priceCents ?? 0,
    },
    delivery: {
      selected: isDelivery && !!deliveryAddOn,
      name: deliveryAddOn?.name ?? "Delivery",
      priceCents: deliveryAddOn?.priceCents ?? 0,
      inFreeZone,
    },
    taxes: { gstBps: settings.gstBps, pstBps: settings.pstBps },
    depositCents: machine.depositCents,
    productIncluded: input.productIncluded,
  });
  return { quote: q, inFreeZone };
}

/**
 * Creates a booking in PENDING_PAYMENT (online) or CONFIRMED (admin) state
 * and reserves the machine. Double booking is impossible: the occupancy row
 * is protected by a Postgres exclusion constraint, so two concurrent requests
 * for overlapping slots can't both succeed.
 */
export async function createBooking(input: CreateBookingInput) {
  const now = input.now ?? new Date();
  if (!input.termsAccepted && input.channel === "ONLINE") {
    throw new BookingError("INVALID_STATE", "Please accept the rental terms.");
  }

  const [settings, product, machine] = await Promise.all([
    getSettings(),
    db.product.findUnique({ where: { id: input.productId } }),
    db.machine.findUnique({ where: { id: input.machineId } }),
  ]);
  if (!product || !product.active) throw new BookingError("NOT_FOUND", "That product isn't available.");
  if (!machine || (!machine.bookable && input.channel === "ONLINE")) {
    throw new BookingError("NOT_FOUND", "That machine isn't available.");
  }
  if (machine.status === "MAINTENANCE" || machine.status === "RETIRED") {
    throw new BookingError("SLOT_NOT_ALLOWED", "That machine is out of service right now.");
  }

  const durationMs = productDurationMinutes(product) * 60_000;
  const startsAt = input.startsAt;
  const endsAt = new Date(startsAt.getTime() + durationMs);

  if (!input.skipSlotRules) {
    const allowed = candidateStarts(toLocalDate(startsAt), rulesFor(product, settings, now));
    if (!allowed.some((d) => d.getTime() === startsAt.getTime())) {
      throw new BookingError("SLOT_NOT_ALLOWED", "That start time isn't available. Please pick another.");
    }
  }

  const { quote: q } = await priceBooking({
    productId: product.id,
    machineId: machine.id,
    balls: input.balls,
    fulfillment: input.fulfillment,
    courtId: input.courtId,
    deliveryAddress: input.deliveryAddress,
    deliveryPoint: input.deliveryPoint,
    productIncluded: !!input.subscriptionId,
  });

  const deposit = planDeposit({
    startsAt,
    endsAt,
    now,
    authMaxDays: settings.depositAuthMaxDays,
    leadHours: settings.depositAuthLeadHours,
  });

  const blockEnd = new Date(endsAt.getTime() + settings.bufferMinutes * 60_000);
  const isOnline = input.channel === "ONLINE";
  const holdExpiresAt = isOnline ? new Date(now.getTime() + settings.holdMinutes * 60_000) : null;
  const addOns = await db.addOn.findMany({ where: { active: true } });

  try {
    return await db.$transaction(async (tx) => {
      const customer = await upsertCustomer(tx, input.customer);
      await expireStaleHolds(tx, machine.id, startsAt, blockEnd, now);

      const addOnRows: Prisma.BookingAddOnCreateWithoutBookingInput[] = q.lines
        .filter((l) => l.key !== "product")
        .flatMap((l) => {
          const addOn = addOns.find((a) => a.kind === (l.key === "balls" ? "BALLS" : "DELIVERY"));
          return addOn ? [{ addOn: { connect: { id: addOn.id } }, priceCents: l.cents }] : [];
        });

      return tx.booking.create({
        data: {
          code: await uniqueCode(tx),
          status: isOnline ? "PENDING_PAYMENT" : "CONFIRMED",
          channel: input.channel,
          customer: { connect: { id: customer.id } },
          machine: { connect: { id: machine.id } },
          product: { connect: { id: product.id } },
          ...(input.subscriptionId ? { subscription: { connect: { id: input.subscriptionId } } } : {}),
          startsAt,
          endsAt,
          fulfillment: input.fulfillment,
          ...(input.courtId ? { court: { connect: { id: input.courtId } } } : {}),
          deliveryAddress: input.fulfillment === "DELIVERY_ADDRESS" ? input.deliveryAddress : null,
          deliveryLat: input.deliveryPoint?.lat ?? null,
          deliveryLng: input.deliveryPoint?.lng ?? null,
          customerNotes: input.customerNotes,
          subtotalCents: q.subtotalCents,
          gstCents: q.gstCents,
          pstCents: q.pstCents,
          totalCents: q.totalCents,
          gstBps: q.gstBps,
          pstBps: q.pstBps,
          termsAcceptedAt: input.termsAccepted ? now : null,
          termsVersion: input.termsAccepted ? TERMS_VERSION : null,
          addOns: { create: addOnRows },
          occupancy: {
            create: {
              machine: { connect: { id: machine.id } },
              source: "BOOKING",
              blockStart: startsAt,
              blockEnd,
              holdExpiresAt,
            },
          },
          deposit: {
            create: {
              strategy: deposit.strategy,
              amountCents: q.depositCents,
              authScheduledFor: deposit.authScheduledFor,
            },
          },
          events: {
            create: {
              type: "created",
              actor: isOnline ? "customer" : "admin",
              data: { channel: input.channel },
            },
          },
        },
        include: { customer: true, machine: true, product: true, deposit: true, addOns: { include: { addOn: true } } },
      });
    });
  } catch (error) {
    if (isOverlapError(error)) {
      throw new BookingError("SLOT_TAKEN", "Someone just booked that slot. Please choose another time.");
    }
    throw error;
  }
}

async function uniqueCode(tx: Prisma.TransactionClient): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const code = generateBookingCode();
    if (!(await tx.booking.findUnique({ where: { code }, select: { id: true } }))) return code;
  }
  return generateBookingCode(7);
}

/**
 * Frees expired payment holds that overlap a range so a new customer can take
 * the slot. Runs inside the booking transaction, before the insert.
 */
async function expireStaleHolds(
  tx: Prisma.TransactionClient,
  machineId: string,
  from: Date,
  to: Date,
  now: Date,
) {
  const stale = await tx.machineOccupancy.findMany({
    where: {
      machineId,
      active: true,
      holdExpiresAt: { lte: now },
      blockStart: { lt: to },
      blockEnd: { gt: from },
    },
    select: { id: true, bookingId: true },
  });
  if (stale.length === 0) return;
  await tx.machineOccupancy.updateMany({
    where: { id: { in: stale.map((s) => s.id) } },
    data: { active: false },
  });
  const bookingIds = stale.flatMap((s) => (s.bookingId ? [s.bookingId] : []));
  await tx.booking.updateMany({
    where: { id: { in: bookingIds }, status: "PENDING_PAYMENT" },
    data: { status: "EXPIRED" },
  });
}

/** Marks all expired holds as EXPIRED (cron). Returns the affected bookings. */
export async function expireAllStaleHolds(now = new Date()) {
  const stale = await db.booking.findMany({
    where: { status: "PENDING_PAYMENT", occupancy: { holdExpiresAt: { lte: now } } },
    select: { id: true },
  });
  if (stale.length === 0) return [];
  const ids = stale.map((b) => b.id);
  await db.$transaction([
    db.machineOccupancy.updateMany({ where: { bookingId: { in: ids } }, data: { active: false } }),
    db.booking.updateMany({ where: { id: { in: ids }, status: "PENDING_PAYMENT" }, data: { status: "EXPIRED" } }),
    db.bookingEvent.createMany({
      data: ids.map((bookingId) => ({ bookingId, type: "expired", actor: "system" })),
    }),
  ]);
  return ids;
}

/**
 * Payment succeeded: confirm the booking and make the hold permanent. If the
 * hold had already expired and someone else took the slot, returns false so
 * the caller can refund.
 */
export async function confirmBooking(bookingId: string): Promise<boolean> {
  try {
    return await db.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id: bookingId }, select: { status: true } });
      if (!booking) return false;
      if (booking.status === "CONFIRMED") return true;
      if (booking.status !== "PENDING_PAYMENT" && booking.status !== "EXPIRED") return false;
      await tx.machineOccupancy.update({
        where: { bookingId },
        data: { active: true, holdExpiresAt: null },
      });
      await tx.booking.update({ where: { id: bookingId }, data: { status: "CONFIRMED" } });
      await tx.bookingEvent.create({ data: { bookingId, type: "confirmed", actor: "stripe" } });
      return true;
    });
  } catch (error) {
    if (isOverlapError(error)) return false;
    throw error;
  }
}

/** Moves a booking to a new start time (customer or admin). */
export async function rescheduleBooking(input: {
  bookingId: string;
  startsAt: Date;
  actor: string;
  machineId?: string;
  skipSlotRules?: boolean;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const [settings, booking] = await Promise.all([
    getSettings(),
    db.booking.findUnique({ where: { id: input.bookingId }, include: { product: true } }),
  ]);
  if (!booking) throw new BookingError("NOT_FOUND", "Booking not found.");
  if (!(["CONFIRMED", "PENDING_PAYMENT"] as BookingStatus[]).includes(booking.status)) {
    throw new BookingError("INVALID_STATE", "This booking can no longer be rescheduled.");
  }
  if (!input.skipSlotRules) {
    const allowed = candidateStarts(toLocalDate(input.startsAt), rulesFor(booking.product, settings, now));
    if (!allowed.some((d) => d.getTime() === input.startsAt.getTime())) {
      throw new BookingError("SLOT_NOT_ALLOWED", "That start time isn't available.");
    }
  }
  const duration = booking.endsAt.getTime() - booking.startsAt.getTime();
  const endsAt = new Date(input.startsAt.getTime() + duration);
  const machineId = input.machineId ?? booking.machineId;

  try {
    return await db.$transaction(async (tx) => {
      await tx.machineOccupancy.update({
        where: { bookingId: booking.id },
        data: {
          machineId,
          blockStart: input.startsAt,
          blockEnd: new Date(endsAt.getTime() + settings.bufferMinutes * 60_000),
        },
      });
      const updated = await tx.booking.update({
        where: { id: booking.id },
        data: { startsAt: input.startsAt, endsAt, machineId, reminderSentAt: null },
      });
      await tx.bookingEvent.create({
        data: {
          bookingId: booking.id,
          type: "rescheduled",
          actor: input.actor,
          data: { from: booking.startsAt.toISOString(), to: input.startsAt.toISOString(), machineId },
        },
      });
      return updated;
    });
  } catch (error) {
    if (isOverlapError(error)) {
      throw new BookingError("SLOT_TAKEN", "That time overlaps another booking.");
    }
    throw error;
  }
}

/** Frees the machine (cancel / no-show). Payment handling is separate. */
export async function releaseOccupancy(tx: Prisma.TransactionClient, bookingId: string) {
  await tx.machineOccupancy.updateMany({ where: { bookingId }, data: { active: false } });
}
