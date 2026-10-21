import "server-only";
import { db } from "@/lib/db";
import { stripe, type Stripe } from "@/lib/stripe";
import { brand } from "@/config/brand";
import { refundFor } from "@/lib/domain/cancellation";
import { validateCapture } from "@/lib/domain/deposit";
import type { BookingStatus } from "@/generated/prisma/client";
import {
  notifyBookingConfirmed,
  notifyCancelled,
  notifyDepositCharged,
  notifyDepositFailed,
  notifyDepositReleased,
  notifySlotLost,
} from "@/lib/notify/booking-notifications";
import { confirmBooking, releaseOccupancy } from "./bookings";
import { BookingError } from "./errors";
import { getSettings } from "./settings";

/*
 * Payment flows (all amounts in CAD cents, card data never touches our DB):
 *
 * 1. Rental: a PaymentIntent for the booking total, confirmed by the Payment
 *    Element. `setup_future_usage: off_session` saves the card on the Stripe
 *    customer so the deposit can use it without asking twice.
 * 2. Deposit (separate PaymentIntent):
 *    - AUTH_HOLD now:   capture_method=manual right after the rental payment.
 *    - AUTH_HOLD later: same, placed off-session by cron 24 h before start.
 *    - SAVED_CARD:      nothing is charged; admin may charge later for damage.
 * 3. Webhooks are the source of truth; the client-side "finalize" call runs
 *    the same idempotent handlers so the customer sees the result instantly.
 */

const DEPOSIT_AUTH_VALID_DAYS = 7;

type PiKind = "rental" | "deposit" | "deposit_charge" | "group";

function metadata(kind: PiKind, extra: Record<string, string>): Stripe.MetadataParam {
  return { kind, ...extra };
}

function piId(pi: string | { id: string } | null | undefined): string | null {
  if (!pi) return null;
  return typeof pi === "string" ? pi : pi.id;
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export async function ensureStripeCustomer(customerId: string): Promise<string> {
  const customer = await db.customer.findUniqueOrThrow({ where: { id: customerId } });
  if (customer.stripeCustomerId) return customer.stripeCustomerId;
  const created = await stripe().customers.create(
    {
      name: customer.name,
      email: customer.email ?? undefined,
      phone: customer.phone ?? undefined,
      metadata: { customerId: customer.id },
    },
    { idempotencyKey: `customer:${customer.id}` },
  );
  await db.customer.update({ where: { id: customer.id }, data: { stripeCustomerId: created.id } });
  return created.id;
}

// ---------------------------------------------------------------------------
// Rental payment
// ---------------------------------------------------------------------------

/** Creates (or reuses) the PaymentIntent for a held booking. */
export async function startRentalPayment(bookingId: string): Promise<{ clientSecret: string; amountCents: number }> {
  const booking = await db.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { payments: { where: { kind: "RENTAL" } }, product: true, machine: true },
  });
  if (booking.status !== "PENDING_PAYMENT") throw new BookingError("INVALID_STATE", "This booking is no longer awaiting payment.");

  const existing = booking.payments.find((p) => p.stripePaymentIntentId && p.status === "PENDING");
  if (existing?.stripePaymentIntentId) {
    const pi = await stripe().paymentIntents.retrieve(existing.stripePaymentIntentId);
    if (pi.client_secret && pi.status !== "canceled") return { clientSecret: pi.client_secret, amountCents: pi.amount };
  }

  const customerId = await ensureStripeCustomer(booking.customerId);
  const pi = await stripe().paymentIntents.create(
    {
      amount: booking.totalCents,
      currency: brand.currency,
      customer: customerId,
      allowed_payment_method_types: ["card"],
      setup_future_usage: "off_session",
      description: `${brand.name} ${booking.product.name} · ${booking.machine.name} · ${booking.code}`,
      statement_descriptor_suffix: booking.code.replace(/[^A-Z0-9]/g, "").slice(0, 10),
      metadata: metadata("rental", { bookingId: booking.id, code: booking.code }),
    },
    { idempotencyKey: `rental:${booking.id}` },
  );
  await db.payment.create({
    data: {
      kind: "RENTAL",
      status: "PENDING",
      amountCents: booking.totalCents,
      bookingId: booking.id,
      stripePaymentIntentId: pi.id,
    },
  });
  return { clientSecret: pi.client_secret!, amountCents: pi.amount };
}

export type FinalizeResult =
  | { status: "confirmed"; code: string; depositClientSecret?: string }
  | { status: "processing"; code: string }
  | { status: "failed"; code: string; message: string }
  | { status: "slot_lost"; code: string };

/**
 * Called by the browser right after the Payment Element succeeds (and by the
 * confirmation page). Runs the same idempotent logic as the webhook.
 */
export async function finalizeRentalPayment(bookingId: string): Promise<FinalizeResult> {
  const payment = await db.payment.findFirst({
    where: { bookingId, kind: "RENTAL", stripePaymentIntentId: { not: null } },
    orderBy: { createdAt: "desc" },
    include: { booking: true },
  });
  if (!payment?.booking) throw new BookingError("NOT_FOUND", "Booking not found.");
  const code = payment.booking.code;
  const pi = await stripe().paymentIntents.retrieve(payment.stripePaymentIntentId!);

  if (pi.status === "processing") return { status: "processing", code };
  if (pi.status !== "succeeded") {
    return { status: "failed", code, message: pi.last_payment_error?.message ?? "The payment didn't complete." };
  }
  const outcome = await handleRentalSucceeded(pi, { offSession: false });
  if (outcome.kind === "slot_lost") return { status: "slot_lost", code };
  return { status: "confirmed", code, depositClientSecret: outcome.depositClientSecret };
}

/** Idempotent handler for a successful rental PaymentIntent. */
export async function handleRentalSucceeded(
  pi: Stripe.PaymentIntent,
  opts: { offSession: boolean },
): Promise<{ kind: "confirmed"; depositClientSecret?: string } | { kind: "slot_lost" }> {
  const bookingId = pi.metadata.bookingId;
  const chargeId = piId(pi.latest_charge);
  const receiptUrl =
    pi.latest_charge && typeof pi.latest_charge === "object" ? pi.latest_charge.receipt_url : await receiptFor(chargeId);

  await db.payment.updateMany({
    where: { stripePaymentIntentId: pi.id, status: { in: ["PENDING", "REQUIRES_ACTION", "FAILED"] } },
    data: { status: "SUCCEEDED", stripeChargeId: chargeId, receiptUrl },
  });

  const booking = await db.booking.findUnique({ where: { id: bookingId }, include: { deposit: true } });
  if (!booking) return { kind: "confirmed" };
  if (booking.status === "CANCELLED" && booking.cancelReason === "slot_lost") return { kind: "slot_lost" };

  const confirmed = await confirmBooking(bookingId);
  if (!confirmed) {
    // Paid after the hold expired and someone else took the slot → full refund.
    await stripe().refunds.create({ payment_intent: pi.id }, { idempotencyKey: `slot_lost:${pi.id}` });
    await db.booking.update({
      where: { id: bookingId },
      data: { status: "CANCELLED", cancelReason: "slot_lost", cancelledAt: new Date() },
    });
    await db.bookingEvent.create({ data: { bookingId, type: "slot_lost_refunded", actor: "system" } });
    await notifySlotLost(bookingId, pi.amount);
    return { kind: "slot_lost" };
  }

  const paymentMethod = piId(pi.payment_method);
  let depositClientSecret: string | undefined;
  if (booking.deposit && paymentMethod) {
    if (!booking.deposit.stripePaymentMethodId) {
      await db.deposit.update({
        where: { id: booking.deposit.id },
        data: {
          stripePaymentMethodId: paymentMethod,
          status: booking.deposit.strategy === "SAVED_CARD" ? "CARD_SAVED" : booking.deposit.status,
        },
      });
    }
    if (booking.deposit.strategy === "AUTH_HOLD" && !booking.deposit.authScheduledFor && booking.deposit.status === "PENDING") {
      const hold = await placeDepositHold(bookingId, { offSession: opts.offSession });
      depositClientSecret = hold.status === "requires_action" ? hold.clientSecret : undefined;
    }
  }

  await notifyBookingConfirmed(bookingId);
  return { kind: "confirmed", depositClientSecret };
}

async function receiptFor(chargeId: string | null): Promise<string | null> {
  if (!chargeId) return null;
  try {
    return (await stripe().charges.retrieve(chargeId)).receipt_url;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Deposit
// ---------------------------------------------------------------------------

export type HoldResult =
  | { status: "held" }
  | { status: "requires_action"; clientSecret: string }
  | { status: "failed"; message: string }
  | { status: "skipped" };

/** Places the manual-capture authorization for a booking's deposit. */
export async function placeDepositHold(bookingId: string, opts: { offSession: boolean }): Promise<HoldResult> {
  const booking = await db.booking.findUniqueOrThrow({ where: { id: bookingId }, include: { deposit: true, customer: true } });
  const deposit = booking.deposit;
  if (!deposit || deposit.strategy !== "AUTH_HOLD") return { status: "skipped" };
  if (deposit.status === "HELD") return { status: "held" };
  if (deposit.amountCents === 0) {
    await db.deposit.update({ where: { id: deposit.id }, data: { status: "WAIVED" } });
    return { status: "skipped" };
  }
  if (!deposit.stripePaymentMethodId || !booking.customer.stripeCustomerId) {
    return { status: "failed", message: "No saved card for the deposit." };
  }

  try {
    const pi = await stripe().paymentIntents.create(
      {
        amount: deposit.amountCents,
        currency: brand.currency,
        customer: booking.customer.stripeCustomerId,
        payment_method: deposit.stripePaymentMethodId,
        allowed_payment_method_types: ["card"],
        capture_method: "manual",
        confirm: true,
        off_session: opts.offSession,
        ...(opts.offSession ? {} : { use_stripe_sdk: true }),
        description: `${brand.name} refundable deposit · ${booking.code}`,
        metadata: metadata("deposit", { bookingId: booking.id, code: booking.code }),
      },
      { idempotencyKey: `deposit:${deposit.id}:${deposit.authScheduledFor?.toISOString() ?? "now"}` },
    );
    await db.deposit.update({ where: { id: deposit.id }, data: { stripePaymentIntentId: pi.id } });
    if (pi.status === "requires_capture") {
      await markDepositHeld(pi);
      return { status: "held" };
    }
    if (pi.status === "requires_action" && pi.client_secret) {
      return { status: "requires_action", clientSecret: pi.client_secret };
    }
    throw new Error(pi.last_payment_error?.message ?? `Unexpected status ${pi.status}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.deposit.update({ where: { id: deposit.id }, data: { status: "FAILED" } });
    await db.bookingEvent.create({ data: { bookingId, type: "deposit_failed", actor: "stripe", data: { message } } });
    await notifyDepositFailed(bookingId);
    return { status: "failed", message };
  }
}

export async function markDepositHeld(pi: Stripe.PaymentIntent) {
  const created = new Date(pi.created * 1000);
  await db.deposit.updateMany({
    where: { stripePaymentIntentId: pi.id, status: { in: ["PENDING", "FAILED"] } },
    data: {
      status: "HELD",
      heldAt: new Date(),
      authExpiresAt: new Date(created.getTime() + DEPOSIT_AUTH_VALID_DAYS * 24 * 3_600_000),
    },
  });
}

/** Releases the deposit: cancels the authorization (nothing is charged). */
export async function releaseDeposit(bookingId: string, actor: string) {
  const deposit = await db.deposit.findUnique({ where: { bookingId } });
  if (!deposit) return;
  if (["RELEASED", "CAPTURED", "PARTIALLY_CAPTURED", "WAIVED"].includes(deposit.status)) return;

  if (deposit.status === "HELD" && deposit.stripePaymentIntentId) {
    await stripe().paymentIntents.cancel(deposit.stripePaymentIntentId, {}, { idempotencyKey: `release:${deposit.id}` });
  }
  await db.deposit.update({
    where: { id: deposit.id },
    data: { status: "RELEASED", releasedAt: new Date(), releasedById: actor, authScheduledFor: null },
  });
  await db.bookingEvent.create({ data: { bookingId, type: "deposit_released", actor } });
  // Only tell the customer when something was actually held or saved.
  if (deposit.status === "HELD" || deposit.status === "CARD_SAVED") await notifyDepositReleased(bookingId);
}

/**
 * Charges all or part of the deposit for damage. A note is mandatory and is
 * emailed to the customer. Authorizations can be captured once; the
 * remainder is released automatically by Stripe.
 */
export async function captureDeposit(bookingId: string, amountCents: number, note: string, actor: string) {
  const deposit = await db.deposit.findUnique({ where: { bookingId }, include: { booking: { include: { customer: true } } } });
  if (!deposit) throw new BookingError("NOT_FOUND", "This booking has no deposit.");
  const check = validateCapture({
    amountCents,
    depositCents: deposit.amountCents,
    alreadyCapturedCents: deposit.capturedCents,
    note,
  });
  if (!check.ok) throw new BookingError("INVALID_STATE", check.error);

  let paymentIntentId: string;
  if (deposit.status === "HELD" && deposit.stripePaymentIntentId) {
    const pi = await stripe().paymentIntents.capture(
      deposit.stripePaymentIntentId,
      { amount_to_capture: amountCents },
      { idempotencyKey: `capture:${deposit.id}` },
    );
    paymentIntentId = pi.id;
  } else if (deposit.stripePaymentMethodId && deposit.booking.customer.stripeCustomerId) {
    // Saved card (long rentals) or an authorization that already expired.
    const pi = await stripe().paymentIntents.create(
      {
        amount: amountCents,
        currency: brand.currency,
        customer: deposit.booking.customer.stripeCustomerId,
        payment_method: deposit.stripePaymentMethodId,
        allowed_payment_method_types: ["card"],
        confirm: true,
        off_session: true,
        description: `${brand.name} damage charge · ${deposit.booking.code}`,
        metadata: metadata("deposit_charge", { bookingId, code: deposit.booking.code }),
      },
      { idempotencyKey: `deposit_charge:${deposit.id}:${deposit.capturedCents}` },
    );
    if (pi.status !== "succeeded") throw new BookingError("PAYMENT_FAILED", "The card was declined. Contact the customer.");
    paymentIntentId = pi.id;
  } else {
    throw new BookingError("INVALID_STATE", "There is no card or authorization to charge.");
  }

  const capturedCents = deposit.capturedCents + amountCents;
  await db.$transaction([
    db.deposit.update({
      where: { id: deposit.id },
      data: {
        capturedCents,
        captureNote: note.trim(),
        capturedAt: new Date(),
        status: capturedCents >= deposit.amountCents ? "CAPTURED" : "PARTIALLY_CAPTURED",
      },
    }),
    db.payment.upsert({
      where: { stripePaymentIntentId: paymentIntentId },
      update: { status: "SUCCEEDED", amountCents },
      create: {
        kind: "DEPOSIT_CAPTURE",
        status: "SUCCEEDED",
        amountCents,
        bookingId,
        stripePaymentIntentId: paymentIntentId,
      },
    }),
    db.bookingEvent.create({ data: { bookingId, type: "deposit_captured", actor, data: { amountCents, note } } }),
  ]);
  await notifyDepositCharged(bookingId, amountCents, note.trim());
}

/** Cron: place deferred deposit holds that are due. */
export async function placeDueDepositHolds(now = new Date()) {
  const due = await db.deposit.findMany({
    where: {
      strategy: "AUTH_HOLD",
      status: "PENDING",
      authScheduledFor: { lte: now },
      booking: { status: "CONFIRMED" },
    },
    select: { bookingId: true },
  });
  const results: { bookingId: string; status: HoldResult["status"] }[] = [];
  for (const d of due) {
    const r = await placeDepositHold(d.bookingId, { offSession: true });
    results.push({ bookingId: d.bookingId, status: r.status });
  }
  return results;
}

// ---------------------------------------------------------------------------
// Refunds & cancellation
// ---------------------------------------------------------------------------

export async function refundRental(bookingId: string, amountCents: number, reason: string, actor: string) {
  if (amountCents <= 0) return 0;
  const payment = await db.payment.findFirst({
    where: { bookingId, kind: "RENTAL", status: { in: ["SUCCEEDED", "PARTIALLY_REFUNDED"] } },
    orderBy: { createdAt: "desc" },
  });
  if (!payment?.stripePaymentIntentId) return 0;
  const refundable = payment.amountCents - payment.refundedCents;
  const amount = Math.min(amountCents, refundable);
  if (amount <= 0) return 0;

  const refund = await stripe().refunds.create(
    { payment_intent: payment.stripePaymentIntentId, amount, metadata: { bookingId, reason } },
    { idempotencyKey: `refund:${payment.id}:${payment.refundedCents}:${amount}` },
  );
  const refundedCents = payment.refundedCents + amount;
  await db.$transaction([
    db.refund.create({
      data: { paymentId: payment.id, amountCents: amount, reason, stripeRefundId: refund.id, createdById: actor },
    }),
    db.payment.update({
      where: { id: payment.id },
      data: { refundedCents, status: refundedCents >= payment.amountCents ? "REFUNDED" : "PARTIALLY_REFUNDED" },
    }),
    db.bookingEvent.create({ data: { bookingId, type: "refunded", actor, data: { amountCents: amount, reason } } }),
  ]);
  return amount;
}

/**
 * Cancels a booking: frees the machine, refunds (by policy, or a fixed amount
 * chosen by the admin) and releases any deposit.
 */
export async function cancelBooking(
  bookingId: string,
  opts: { actor: string; refund: "policy" | "full" | "none" | { cents: number }; reason?: string; now?: Date },
): Promise<{ refundedCents: number }> {
  const now = opts.now ?? new Date();
  const booking = await db.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { payments: { where: { kind: "RENTAL" } } },
  });
  if (["CANCELLED", "EXPIRED", "COMPLETED"].includes(booking.status)) {
    throw new BookingError("INVALID_STATE", "This booking is already closed.");
  }

  const paid = booking.payments
    .filter((p) => p.status === "SUCCEEDED" || p.status === "PARTIALLY_REFUNDED")
    .reduce((s, p) => s + p.amountCents - p.refundedCents, 0);

  let refundCents = 0;
  if (opts.refund === "full") refundCents = paid;
  else if (opts.refund === "policy") {
    const settings = await getSettings();
    refundCents = refundFor(paid, booking.startsAt, now, {
      fullRefundHours: settings.cancelFullRefundHours,
      lateRefundBps: settings.cancelLateRefundBps,
    }).refundCents;
  } else if (typeof opts.refund === "object") refundCents = Math.min(opts.refund.cents, paid);

  await db.$transaction(async (tx) => {
    await releaseOccupancy(tx, bookingId);
    await tx.booking.update({
      where: { id: bookingId },
      data: { status: "CANCELLED", cancelledAt: now, cancelReason: opts.reason ?? null },
    });
    await tx.bookingEvent.create({ data: { bookingId, type: "cancelled", actor: opts.actor, data: { reason: opts.reason ?? null } } });
  });

  // Unpaid hold: cancel the open PaymentIntent so it can't be paid later.
  for (const p of booking.payments.filter((p) => p.status === "PENDING" && p.stripePaymentIntentId)) {
    try {
      await stripe().paymentIntents.cancel(p.stripePaymentIntentId!);
    } catch {
      // Already succeeded/canceled — webhooks reconcile.
    }
    await db.payment.update({ where: { id: p.id }, data: { status: "CANCELLED" } });
  }

  const refundedCents = await refundRental(bookingId, refundCents, opts.reason ?? "cancellation", opts.actor);
  await releaseDeposit(bookingId, opts.actor);
  if (booking.status !== "PENDING_PAYMENT") await notifyCancelled(bookingId, refundedCents);
  return { refundedCents };
}

// ---------------------------------------------------------------------------
// Admin status changes
// ---------------------------------------------------------------------------

const RETURN_STATUSES: BookingStatus[] = ["RETURNED_OK", "RETURNED_DAMAGED", "COMPLETED", "NO_SHOW"];

/**
 * Admin status selector. "Returned – OK" releases the deposit automatically;
 * "Returned – damage" leaves it for the admin to capture with a note.
 */
export async function setBookingStatus(bookingId: string, status: BookingStatus, actor: string, now = new Date()) {
  if (status === "CANCELLED") {
    return cancelBooking(bookingId, { actor, refund: "policy", reason: "admin" });
  }
  const booking = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });
  if (booking.status === status) return;
  const settings = await getSettings();

  await db.$transaction(async (tx) => {
    await tx.booking.update({ where: { id: bookingId }, data: { status } });
    await tx.bookingEvent.create({ data: { bookingId, type: "status_changed", actor, data: { from: booking.status, to: status } } });

    if (status === "CHECKED_OUT") {
      await tx.machine.update({ where: { id: booking.machineId }, data: { status: "RENTED" } });
    }
    if (RETURN_STATUSES.includes(status)) {
      // Returned early → free the rest of the slot (keeping the buffer).
      const freeFrom = new Date(Math.max(now.getTime(), booking.startsAt.getTime()) + settings.bufferMinutes * 60_000);
      await tx.machineOccupancy.updateMany({
        where: { bookingId, blockEnd: { gt: freeFrom } },
        data: { blockEnd: freeFrom },
      });
      const stillOut = await tx.booking.count({
        where: { machineId: booking.machineId, status: "CHECKED_OUT", NOT: { id: bookingId } },
      });
      if (stillOut === 0) {
        await tx.machine.updateMany({ where: { id: booking.machineId, status: "RENTED" }, data: { status: "AVAILABLE" } });
      }
    }
  });

  if (status === "RETURNED_OK" || status === "COMPLETED") await releaseDeposit(bookingId, actor);
}
