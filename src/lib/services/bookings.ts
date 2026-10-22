import "server-only";
import { db } from "@/lib/db";
import type { BookingChannel, BookingStatus, FulfillmentMethod, Prisma, SkillLevel } from "@/generated/prisma/client";
import { generateBookingCode } from "@/lib/domain/booking-code";
import { planDeposit } from "@/lib/domain/deposit";
import type { LatLng } from "@/lib/domain/geo";
import { legsLabel, resolveDelivery, type DeliveryResolution } from "@/lib/domain/delivery";
import { carePrice, chargedTaxes, depositAmount } from "@/lib/domain/rental";
import { isHighSeason, seasonalPrice } from "@/lib/domain/season";
import { MIN_ONLINE_CHARGE_CENTS, quote, type Quote } from "@/lib/domain/pricing";
import { creditToApply } from "@/lib/domain/credit";
import { candidateStarts } from "@/lib/domain/availability";
import { brand } from "@/config/brand";
import { addLocalDays, localDateMinuteToUtc, toLocalDate } from "@/lib/time";
import { productDurationMinutes, rulesFor } from "./availability";
import { upsertCustomer } from "./customers";
import { BookingError, isOverlapError, isUniqueViolation } from "./errors";
import { findValidPromo, promoRedemptions, toPromoInput } from "./promo";
import { reclaimCredits, restoreCredits, spendCredits } from "./credits";
import { getSettings } from "./settings";

export type CreateBookingInput = {
  productId: string;
  machineId: string;
  startsAt: Date;
  customer: { name: string; email?: string | null; phone?: string | null; skillLevel?: SkillLevel | null };
  /** Optional extra bucket (balls are always included). */
  extraBalls?: boolean;
  /** RallyDrop Care damage protection. */
  care?: boolean;
  fulfillment: FulfillmentMethod;
  /** Paid trips we make (ignored for self-serve PICKUP). */
  dropoff?: boolean;
  collection?: boolean;
  courtId?: string | null;
  deliveryAddress?: string | null;
  /** Geocoded delivery address, when available. */
  deliveryPoint?: LatLng | null;
  customerNotes?: string | null;
  channel: BookingChannel;
  /** Package session: product price (and court delivery) covered by the subscription. */
  subscriptionId?: string | null;
  now?: Date;
  /** Admin bookings may skip the public slot rules (still no double booking). */
  skipSlotRules?: boolean;
  promoCode?: string | null;
};

/** Everything needed to price a booking. Used by the live summary and checkout. */
export async function priceBooking(input: {
  productId: string;
  machineId: string;
  /** Rental start: picks the season price. Defaults to today. */
  startsAt?: Date | null;
  extraBalls: boolean;
  care: boolean;
  fulfillment: FulfillmentMethod;
  dropoff?: boolean;
  collection?: boolean;
  courtId?: string | null;
  deliveryAddress?: string | null;
  deliveryPoint?: LatLng | null;
  productIncluded?: boolean;
  promoCode?: string | null;
  now?: Date;
}): Promise<{
  quote: Quote;
  delivery: DeliveryResolution;
  promoId: string | null;
  promoError: string | null;
  offSeason: boolean;
  careCents: number;
}> {
  const [settings, product, machine, addOns, court] = await Promise.all([
    getSettings(),
    db.product.findUnique({ where: { id: input.productId } }),
    db.machine.findUnique({ where: { id: input.machineId } }),
    db.addOn.findMany({ where: { active: true } }),
    // The court only matters when that's where we're going.
    input.courtId && input.fulfillment === "DELIVERY_COURT"
      ? db.court.findUnique({ where: { id: input.courtId } })
      : null,
  ]);
  if (!product || !machine) throw new BookingError("NOT_FOUND", "That product or machine no longer exists.");

  const promo = input.promoCode?.trim() ? await findValidPromo(input.promoCode, product.kind, input.now) : null;

  const extraAddOn = addOns.find((a) => a.kind === "EXTRA_BALLS");
  const self = input.fulfillment === "PICKUP";
  const legs = { dropoff: !self && !!input.dropoff, collection: !self && !!input.collection };

  const point: LatLng | null = court
    ? { lat: Number(court.lat), lng: Number(court.lng) }
    : (input.deliveryPoint ?? null);
  const delivery = resolveDelivery({
    legs,
    point,
    address: input.deliveryAddress,
    hub: { lat: settings.deliveryHubLat, lng: settings.deliveryHubLng },
    zones: settings.deliveryZones,
    zone1Fsas: brand.zone1Fsas,
  });

  const startDate = toLocalDate(input.startsAt ?? input.now ?? new Date());
  const price = seasonalPrice(product, startDate, { start: settings.seasonStart, end: settings.seasonEnd });
  const care = carePrice(product.kind, settings);
  const rentalHours = productDurationMinutes(product) / 60;

  const q = quote({
    product: {
      name: product.name,
      priceCents: price.cents,
      note:
        price.offSeason && product.offSeasonPriceCents !== null
          ? "Off-season price · balls included"
          : "Balls included",
    },
    extraBalls: {
      selected: input.extraBalls && !!extraAddOn,
      name: extraAddOn?.name ?? "Extra bucket",
      priceCents: extraAddOn?.priceCents ?? 0,
    },
    care: { selected: input.care && care !== null, priceCents: care ?? 0 },
    delivery: {
      selected: delivery.status === "ok",
      label: delivery.status === "ok" ? `${legsLabel(legs)} · Zone ${delivery.zone}` : "",
      priceCents: delivery.status === "ok" ? delivery.feeCents : 0,
    },
    taxes: chargedTaxes(settings),
    depositCents: depositAmount(machine, rentalHours, settings.depositAuthMaxDays),
    productIncluded: input.productIncluded,
    promo: promo?.ok ? toPromoInput(promo.promo) : null,
  });
  return {
    quote: q,
    delivery,
    promoId: promo?.ok && q.discountCents > 0 ? promo.promo.id : null,
    promoError: promo && !promo.ok ? promo.error : null,
    offSeason: price.offSeason,
    careCents: q.lines.find((l) => l.key === "care")?.cents ?? 0,
  };
}

/**
 * Creates a booking in PENDING_PAYMENT (online) or CONFIRMED (admin) state
 * and reserves the machine. Double booking is impossible: the occupancy row
 * is protected by a Postgres exclusion constraint, so two concurrent requests
 * for overlapping slots can't both succeed.
 */
export async function createBooking(input: CreateBookingInput) {
  const now = input.now ?? new Date();

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
  if (await monthRentalsFull(product, startsAt, settings)) {
    throw new BookingError(
      "SLOT_NOT_ALLOWED",
      "Month rentals are fully booked for that month in high season. Try a week, or another month.",
    );
  }

  const {
    quote: q,
    delivery,
    promoId,
    promoError,
    offSeason,
    careCents,
  } = await priceBooking({
    productId: product.id,
    machineId: machine.id,
    startsAt,
    extraBalls: !!input.extraBalls,
    care: !!input.care,
    fulfillment: input.fulfillment,
    dropoff: input.dropoff,
    collection: input.collection,
    courtId: input.courtId,
    deliveryAddress: input.deliveryAddress,
    deliveryPoint: input.deliveryPoint,
    productIncluded: !!input.subscriptionId,
    promoCode: input.promoCode,
    now,
  });
  if (promoError) throw new BookingError("INVALID_PROMO", promoError);
  const isOnline = input.channel === "ONLINE";
  // Phone bookings can still record trips the owner prices by hand.
  if (delivery.status === "unknown" && isOnline) {
    throw new BookingError(
      "DELIVERY_UNAVAILABLE",
      "We couldn't find that address on the map. Check it (add the postal code) or choose a court.",
    );
  }
  if (delivery.status === "out_of_area" && isOnline) {
    throw new BookingError(
      "DELIVERY_UNAVAILABLE",
      `That's ${delivery.distanceKm} km from downtown — outside our delivery area. Choose self-serve or call us.`,
    );
  }
  const trips = delivery.status !== "none";
  const zone = delivery.status === "ok" ? delivery.zone : null;
  const km = delivery.status === "ok" || delivery.status === "out_of_area" ? delivery.distanceKm : null;

  const deposit = planDeposit({
    startsAt,
    endsAt,
    now,
    authMaxDays: settings.depositAuthMaxDays,
    leadHours: settings.depositAuthLeadHours,
  });

  const blockEnd = new Date(endsAt.getTime() + settings.bufferMinutes * 60_000);
  // Package sessions with nothing to pay are confirmed straight away.
  const needsPayment = isOnline && q.totalCents > 0;
  const holdExpiresAt = needsPayment ? new Date(now.getTime() + settings.holdMinutes * 60_000) : null;
  const addOns = await db.addOn.findMany({ where: { active: true } });

  const attempt = () =>
    db.$transaction(async (tx) => {
      await lockMachine(tx, machine.id);
      const customer = await upsertCustomer(tx, input.customer);
      await expireStaleHolds(tx, machine.id, startsAt, blockEnd, now);
      if (promoId) await claimPromo(tx, promoId);

      const addOnRows: Prisma.BookingAddOnCreateWithoutBookingInput[] = q.lines
        .filter((l) => l.key === "extra_balls")
        .flatMap((l) => {
          const addOn = addOns.find((a) => a.kind === "EXTRA_BALLS");
          return addOn ? [{ addOn: { connect: { id: addOn.id } }, priceCents: l.cents }] : [];
        });

      const created = await tx.booking.create({
        data: {
          code: await uniqueCode(tx),
          status: needsPayment ? "PENDING_PAYMENT" : "CONFIRMED",
          channel: input.channel,
          customer: { connect: { id: customer.id } },
          machine: { connect: { id: machine.id } },
          product: { connect: { id: product.id } },
          ...(input.subscriptionId ? { subscription: { connect: { id: input.subscriptionId } } } : {}),
          startsAt,
          endsAt,
          fulfillment: trips ? input.fulfillment : "PICKUP",
          dropoff: trips && !!input.dropoff,
          collection: trips && !!input.collection,
          deliveryZone: zone,
          deliveryKm: km,
          deliveryFeeCents: q.lines.find((l) => l.key === "delivery")?.cents ?? 0,
          ...(trips && input.fulfillment === "DELIVERY_COURT" && input.courtId
            ? { court: { connect: { id: input.courtId } } }
            : {}),
          deliveryAddress: trips && input.fulfillment === "DELIVERY_ADDRESS" ? input.deliveryAddress : null,
          deliveryLat: trips ? (input.deliveryPoint?.lat ?? null) : null,
          deliveryLng: trips ? (input.deliveryPoint?.lng ?? null) : null,
          customerNotes: input.customerNotes,
          subtotalCents: q.subtotalCents,
          discountCents: q.discountCents,
          ...(promoId ? { promoCode: { connect: { id: promoId } } } : {}),
          gstCents: q.gstCents,
          pstCents: q.pstCents,
          totalCents: q.totalCents,
          gstBps: q.gstBps,
          pstBps: q.pstBps,
          care: careCents > 0,
          careCents,
          offSeason,
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
              // Phone bookings have no card on file: the owner collects the deposit in person.
              authScheduledFor: isOnline ? deposit.authScheduledFor : null,
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

      // Customer credit (e.g. rain credit) pays for part of an online booking.
      // Card checkouts still charge the minimum so the card is saved for the
      // deposit; package sessions already have a card on file.
      if (!isOnline || q.totalCents <= 0) return created;
      const minCharge = input.subscriptionId ? 0 : MIN_ONLINE_CHARGE_CENTS;
      const creditCents = await spendCredits(
        tx,
        customer.id,
        created.id,
        (available) => creditToApply(q.totalCents, available, minCharge),
        now,
      );
      if (creditCents === 0) return created;
      const totalCents = q.totalCents - creditCents;
      const paidInFull = totalCents === 0;
      await tx.booking.update({
        where: { id: created.id },
        data: { creditCents, totalCents, ...(paidInFull ? { status: "CONFIRMED" } : {}) },
      });
      if (paidInFull) {
        await tx.machineOccupancy.update({ where: { bookingId: created.id }, data: { holdExpiresAt: null } });
      }
      return { ...created, creditCents, totalCents, status: paidInFull ? ("CONFIRMED" as const) : created.status };
    });

  try {
    try {
      return await attempt();
    } catch (error) {
      // A brand-new customer sending two requests at once: both try to create
      // the same email/phone. Retry once — the second pass finds the customer.
      if (isUniqueViolation(error)) return await attempt();
      throw error;
    }
  } catch (error) {
    if (isOverlapError(error)) {
      throw new BookingError(
        "SLOT_TAKEN",
        isOnline
          ? "Someone just booked that slot. Please choose another time."
          : "That machine is busy then (another booking, group session, blocked day or the buffer between rentals).",
      );
    }
    throw error;
  }
}

/**
 * Serializes writes per machine for the rest of the transaction. The
 * exclusion constraint already makes double booking impossible; this lock
 * stops concurrent conflicting inserts from deadlocking each other (a known
 * Postgres behaviour with exclusion constraints) so the loser gets a clean
 * "slot taken" instead of a retryable error.
 */
export async function lockMachine(tx: Prisma.TransactionClient, machineId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`machine:${machineId}`}))`;
}

/**
 * Re-checks a limited promo inside the booking transaction, serialized per
 * code, so two customers can't both take the last redemption.
 */
async function claimPromo(tx: Prisma.TransactionClient, promoId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`promo:${promoId}`}))`;
  const promo = await tx.promoCode.findUnique({ where: { id: promoId }, select: { maxRedemptions: true } });
  if (promo?.maxRedemptions == null) return;
  if ((await promoRedemptions(promoId, undefined, tx)) >= promo.maxRedemptions) {
    throw new BookingError("INVALID_PROMO", "That code has been fully redeemed.");
  }
}

/**
 * Month rentals block four weekends, so in high season the owner can cap how
 * many start per calendar month (Settings.highSeasonMonthCap).
 */
export async function monthRentalsFull(
  product: { kind: string },
  startsAt: Date,
  settings: { seasonStart: string; seasonEnd: string; highSeasonMonthCap: number | null },
  excludeBookingId?: string,
): Promise<boolean> {
  if (product.kind !== "MONTH" || settings.highSeasonMonthCap === null) return false;
  const date = toLocalDate(startsAt);
  if (!isHighSeason(date, { start: settings.seasonStart, end: settings.seasonEnd })) return false;
  if (settings.highSeasonMonthCap <= 0) return true;
  const monthStart = localDateMinuteToUtc(`${date.slice(0, 7)}-01`, 0);
  const nextMonth = localDateMinuteToUtc(addLocalDays(`${date.slice(0, 7)}-28`, 4).slice(0, 7) + "-01", 0);
  const taken = await db.booking.count({
    where: {
      product: { kind: "MONTH" },
      startsAt: { gte: monthStart, lt: nextMonth },
      status: { notIn: ["CANCELLED", "EXPIRED"] },
      ...(excludeBookingId ? { NOT: { id: excludeBookingId } } : {}),
    },
  });
  return taken >= settings.highSeasonMonthCap;
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
async function expireStaleHolds(tx: Prisma.TransactionClient, machineId: string, from: Date, to: Date, now: Date) {
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
  // Abandoned checkout: any credit it used goes back to the customer.
  await restoreCredits(tx, bookingIds, 10_000);
}

/** Marks all expired holds as EXPIRED (cron). Returns the affected bookings. */
export async function expireAllStaleHolds(now = new Date()) {
  const stale = await db.booking.findMany({
    where: { status: "PENDING_PAYMENT", occupancy: { holdExpiresAt: { lte: now } } },
    select: { id: true },
  });
  if (stale.length === 0) return [];
  const ids = stale.map((b) => b.id);
  await db.$transaction(async (tx) => {
    await tx.machineOccupancy.updateMany({ where: { bookingId: { in: ids } }, data: { active: false } });
    await tx.booking.updateMany({ where: { id: { in: ids }, status: "PENDING_PAYMENT" }, data: { status: "EXPIRED" } });
    await tx.bookingEvent.createMany({
      data: ids.map((bookingId) => ({ bookingId, type: "expired", actor: "system" })),
    });
    await restoreCredits(tx, ids, 10_000);
  });
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
      const occ = await tx.machineOccupancy.findUnique({ where: { bookingId }, select: { machineId: true } });
      if (occ) await lockMachine(tx, occ.machineId);
      await tx.machineOccupancy.update({
        where: { bookingId },
        data: { active: true, holdExpiresAt: null },
      });
      await tx.booking.update({ where: { id: bookingId }, data: { status: "CONFIRMED" } });
      if (booking.status === "EXPIRED") await reclaimCredits(tx, bookingId);
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
      for (const id of [...new Set([booking.machineId, machineId])].sort()) await lockMachine(tx, id);
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
