"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  checkoutSchema,
  consentSchema,
  fieldErrors,
  quoteSchema,
  type CheckoutInput,
  type QuoteInput,
} from "@/lib/validation/booking";
import { createBooking, priceBooking } from "@/lib/services/bookings";
import { BookingError } from "@/lib/services/errors";
import { geocodeAddress } from "@/lib/services/geocode";
import { recordAcceptance } from "@/lib/services/legal";
import { clientIp } from "@/lib/request";
import { cancelBooking, finalizeRentalPayment, startRentalPayment, type FinalizeResult } from "@/lib/services/payments";
import type { Quote } from "@/lib/domain/pricing";
import type { DeliveryResolution } from "@/lib/domain/delivery";

export type QuoteResult =
  { ok: true; quote: Quote; delivery: DeliveryResolution; promoError: string | null } | { ok: false; error: string };

/** Live price summary (server is the source of truth for prices). */
export async function quoteAction(input: QuoteInput): Promise<QuoteResult> {
  const parsed = quoteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Incomplete selection." };
  const { productId, machineId, extras, promoCode, startsAt } = parsed.data;
  const point =
    extras.fulfillment === "DELIVERY_ADDRESS" && extras.deliveryAddress
      ? await geocodeAddress(extras.deliveryAddress)
      : null;
  try {
    const { quote, delivery, promoError } = await priceBooking({
      productId,
      machineId,
      startsAt: startsAt ? new Date(startsAt) : null,
      extraBalls: extras.extraBalls,
      care: extras.care,
      fulfillment: extras.fulfillment,
      dropoff: extras.dropoff,
      collection: extras.collection,
      courtId: extras.fulfillment === "DELIVERY_COURT" ? extras.courtId : null,
      deliveryAddress: extras.deliveryAddress,
      deliveryPoint: point,
      promoCode,
    });
    return { ok: true, quote, delivery, promoError };
  } catch (e) {
    return { ok: false, error: e instanceof BookingError ? e.message : "Couldn't calculate the price." };
  }
}

export type CheckoutResult =
  | {
      ok: true;
      bookingId: string;
      code: string;
      clientSecret: string;
      amountCents: number;
      /** Customer credit (e.g. rain credit) taken off this booking. */
      creditCents: number;
      holdExpiresAt: string;
    }
  | { ok: false; error: string; fields?: Record<string, string>; code?: string };

/** Holds the slot for 10 minutes and creates the PaymentIntent. */
export async function checkoutAction(input: CheckoutInput): Promise<CheckoutResult> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please check the highlighted fields.", fields: fieldErrors(parsed.error) };
  }
  const data = parsed.data;
  const point =
    data.extras.fulfillment === "DELIVERY_ADDRESS" && data.extras.deliveryAddress
      ? await geocodeAddress(data.extras.deliveryAddress)
      : null;

  let heldBookingId: string | null = null;
  try {
    const booking = await createBooking({
      productId: data.productId,
      machineId: data.machineId,
      startsAt: new Date(data.startsAt),
      customer: data.contact,
      extraBalls: data.extras.extraBalls,
      care: data.extras.care,
      fulfillment: data.extras.fulfillment,
      dropoff: data.extras.dropoff,
      collection: data.extras.collection,
      courtId: data.extras.fulfillment === "DELIVERY_COURT" ? data.extras.courtId : null,
      deliveryAddress: data.extras.deliveryAddress,
      deliveryPoint: point,
      customerNotes: data.notes,
      channel: "ONLINE",
      promoCode: data.promoCode,
    });
    heldBookingId = booking.id;
    const { clientSecret, amountCents } = await startRentalPayment(booking.id);
    const occupancy = await db.machineOccupancy.findUniqueOrThrow({ where: { bookingId: booking.id } });
    return {
      ok: true,
      bookingId: booking.id,
      code: booking.code,
      clientSecret,
      amountCents,
      creditCents: booking.creditCents,
      holdExpiresAt: (occupancy.holdExpiresAt ?? new Date()).toISOString(),
    };
  } catch (e) {
    // Payment couldn't start → don't leave the slot blocked by our own hold.
    if (heldBookingId) {
      await cancelBooking(heldBookingId, { actor: "system", refund: "none", reason: "payment_init_failed" }).catch(
        () => {},
      );
    }
    if (e instanceof BookingError) return { ok: false, error: e.message, code: e.code };
    console.error("checkout failed", e);
    return { ok: false, error: "Something went wrong starting your payment. Please try again." };
  }
}

export async function finalizeAction(
  bookingId: string,
): Promise<FinalizeResult | { status: "error"; message: string }> {
  const id = z.string().min(1).safeParse(bookingId);
  if (!id.success) return { status: "error", message: "Missing booking." };
  try {
    return await finalizeRentalPayment(id.data);
  } catch (e) {
    console.error("finalize failed", e);
    return { status: "error", message: "We couldn't confirm the payment yet. Check your email in a minute." };
  }
}

/**
 * Records the Terms & Waiver acceptance (clickwrap) right before the card is
 * charged. The payment button stays disabled until this succeeds, and the
 * booking is never confirmed without it (also checked in the webhook).
 */
export async function acceptTermsAction(input: {
  bookingId: string;
  termsId: string;
  waiverId: string;
  boxes: string[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = consentSchema.extend({ bookingId: z.string().min(1) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Tick both boxes to continue." };
  const booking = await db.booking.findUnique({
    where: { id: parsed.data.bookingId },
    select: { id: true, status: true, customer: { select: { id: true, name: true, email: true, phone: true } } },
  });
  if (!booking || booking.status !== "PENDING_PAYMENT") return { ok: false, error: "This booking is no longer open." };
  try {
    const h = await headers();
    await recordAcceptance({
      bookingId: booking.id,
      customerId: booking.customer.id,
      name: booking.customer.name,
      contact: booking.customer.email ?? booking.customer.phone ?? "",
      termsId: parsed.data.termsId,
      waiverId: parsed.data.waiverId,
      boxes: parsed.data.boxes,
      method: "checkout",
      ip: clientIp(h),
      userAgent: h.get("user-agent"),
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof BookingError) return { ok: false, error: e.message };
    console.error("accept terms", e);
    return { ok: false, error: "We couldn't save your acceptance. Please try again." };
  }
}

/** Frees an unpaid hold when the customer goes back to change their booking. */
export async function releaseHoldAction(bookingId: string): Promise<void> {
  const booking = await db.booking.findUnique({ where: { id: bookingId }, select: { status: true } });
  if (booking?.status !== "PENDING_PAYMENT") return;
  await cancelBooking(bookingId, { actor: "customer", refund: "none", reason: "abandoned" });
}
