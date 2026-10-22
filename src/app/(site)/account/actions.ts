"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { notifyBookingConfirmed, notifyRescheduled } from "@/lib/notify/booking-notifications";
import { createBooking } from "@/lib/services/bookings";
import { rescheduleBooking } from "@/lib/services/bookings";
import { BookingError } from "@/lib/services/errors";
import { attachSubscriptionCardToDeposit, cancelBooking, chargeSessionOnFile } from "@/lib/services/payments";
import { takeRainCredit } from "@/lib/services/rain";
import { customerPackage } from "@/lib/services/portal";
import { getPortalCustomer, requestLoginCode, signOutPortal, verifyLoginCode } from "@/lib/services/portal-auth";
import { billingPortalUrl, setCancelAtPeriodEnd } from "@/lib/services/subscriptions";
import { headers } from "next/headers";
import { consentComplete } from "@/lib/domain/legal";
import { carryOverAcceptance, customerAcceptedLive, recordAcceptance } from "@/lib/services/legal";
import { consentSchema } from "@/lib/validation/booking";
import { clientIp } from "@/lib/request";
import { siteUrl } from "@/lib/site-url";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

export async function requestCodeAction(contact: string): Promise<ActionResult> {
  if (contact.trim().length < 5) return { ok: false, error: "Enter your email or phone number." };
  await requestLoginCode(contact);
  return { ok: true };
}

export async function verifyCodeAction(contact: string, code: string): Promise<ActionResult> {
  const ok = await verifyLoginCode(contact, code);
  if (!ok) return { ok: false, error: "That code is wrong or expired. Request a new one." };
  revalidatePath("/account");
  return { ok: true };
}

export async function signOutAction() {
  await signOutPortal();
  redirect("/account");
}

async function ownBooking(bookingId: string) {
  const customer = await getPortalCustomer();
  if (!customer) throw new BookingError("NOT_FOUND", "Please sign in again.");
  const booking = await db.booking.findFirst({ where: { id: bookingId, customerId: customer.id } });
  if (!booking) throw new BookingError("NOT_FOUND", "Booking not found.");
  return { customer, booking };
}

function fail(e: unknown): ActionResult {
  if (e instanceof BookingError) return { ok: false, error: e.message };
  console.error(e);
  return { ok: false, error: "Something went wrong. Please try again or contact us." };
}

export async function cancelBookingAction(bookingId: string): Promise<ActionResult> {
  try {
    const { booking } = await ownBooking(bookingId);
    if (booking.startsAt <= new Date() || !["CONFIRMED", "PENDING_PAYMENT"].includes(booking.status)) {
      return { ok: false, error: "This booking can't be cancelled online. Please contact us." };
    }
    await cancelBooking(bookingId, { actor: "customer", refund: "policy", reason: "customer" });
    revalidatePath("/account");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function rescheduleAction(bookingId: string, startsAt: string): Promise<ActionResult> {
  try {
    await ownBooking(bookingId);
    const when = z.iso.datetime().parse(startsAt);
    await rescheduleBooking({ bookingId, startsAt: new Date(when), actor: "customer" });
    await notifyRescheduled(bookingId);
    revalidatePath("/account");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function billingPortalAction(): Promise<void> {
  const customer = await getPortalCustomer();
  if (!customer) redirect("/account");
  redirect(await billingPortalUrl(customer.id, siteUrl("/account")));
}

export async function bookSessionAction(input: {
  startsAt: string;
  /** Self-serve downtown (free) or delivery to a court (paid per session). */
  delivery: boolean;
  courtId?: string | null;
  /** Required only when the customer hasn't accepted the live Terms & Waiver. */
  consent?: { termsId: string; waiverId: string; boxes: string[] } | null;
}): Promise<ActionResult & { needsConsent?: boolean }> {
  try {
    const customer = await getPortalCustomer();
    if (!customer) return { ok: false, error: "Please sign in again." };
    const pkg = await customerPackage(customer.id);
    if (!pkg || pkg.subscription.status !== "ACTIVE") return { ok: false, error: "You don't have an active package." };
    if (pkg.usage.left <= 0) return { ok: false, error: "You've used all your sessions this month." };
    const startsAt = new Date(z.iso.datetime().parse(input.startsAt));
    if (startsAt >= pkg.subscription.currentPeriodEnd) {
      return { ok: false, error: "Pick a date before your package renews." };
    }
    if (input.delivery && !input.courtId) return { ok: false, error: "Choose the court we should bring it to." };
    // Members accept once; a new version of the terms must be accepted again.
    const alreadyAccepted = await customerAcceptedLive(customer.id);
    if (!alreadyAccepted) {
      const consent = consentSchema.safeParse(input.consent);
      if (!consent.success || !consentComplete(consent.data.boxes)) {
        return { ok: false, needsConsent: true, error: "Please accept the updated terms (tick both boxes)." };
      }
    }
    const machineIds = await db.machine.findMany({
      where: { bookable: true, isPublic: true, status: { in: ["AVAILABLE", "RENTED"] } },
      select: { id: true },
    });
    let lastError: unknown = null;
    for (const m of machineIds) {
      try {
        const booking = await createBooking({
          productId: pkg.subscription.productId,
          machineId: m.id,
          startsAt,
          customer: { name: customer.name, email: customer.email, phone: customer.phone },
          // Sessions are self-serve downtown; delivery is the zone's round trip.
          ...(input.delivery
            ? { fulfillment: "DELIVERY_COURT" as const, dropoff: true, collection: true, courtId: input.courtId }
            : { fulfillment: "PICKUP" as const }),
          channel: "ONLINE",
          subscriptionId: pkg.subscription.id,
        });
        if (alreadyAccepted) {
          await carryOverAcceptance(customer.id, booking.id);
        } else {
          const h = await headers();
          await recordAcceptance({
            bookingId: booking.id,
            customerId: customer.id,
            name: customer.name,
            contact: customer.email ?? customer.phone ?? "",
            termsId: input.consent!.termsId,
            waiverId: input.consent!.waiverId,
            boxes: input.consent!.boxes,
            method: "checkout",
            ip: clientIp(h),
            userAgent: h.get("user-agent"),
          });
        }
        if (booking.status === "PENDING_PAYMENT") {
          // Delivery fee → charged to the package card, which also confirms it.
          const charged = await chargeSessionOnFile(booking.id, pkg.subscription.stripeSubscriptionId);
          if (!charged.ok) return { ok: false, error: charged.error };
        } else {
          await attachSubscriptionCardToDeposit(booking.id, pkg.subscription.stripeSubscriptionId).catch((e) =>
            console.error("deposit for session", e),
          );
          await notifyBookingConfirmed(booking.id);
        }
        revalidatePath("/account");
        return { ok: true, message: booking.code };
      } catch (e) {
        lastError = e;
        if (!(e instanceof BookingError) || e.code !== "SLOT_TAKEN") break;
      }
    }
    return fail(lastError);
  } catch (e) {
    return fail(e);
  }
}

/** Cancel the package at the end of the paid month, or keep it after all. */
export async function cancelPackageAction(cancel: boolean): Promise<ActionResult> {
  try {
    const customer = await getPortalCustomer();
    if (!customer) return { ok: false, error: "Please sign in again." };
    await setCancelAtPeriodEnd(customer.id, cancel);
    revalidatePath("/account");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Rained out: cancel and turn what was paid into a credit. */
export async function rainCreditAction(bookingId: string): Promise<ActionResult> {
  try {
    await ownBooking(bookingId);
    await takeRainCredit(bookingId, "customer");
    revalidatePath("/account");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
