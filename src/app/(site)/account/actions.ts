"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { notifyBookingConfirmed, notifyRescheduled } from "@/lib/notify/booking-notifications";
import { createBooking } from "@/lib/services/bookings";
import { rescheduleBooking } from "@/lib/services/bookings";
import { BookingError } from "@/lib/services/errors";
import { attachCardToDeposit, cancelBooking, chargeSessionOnFile, subscriptionCard } from "@/lib/services/payments";
import { customerSpringPass } from "@/lib/services/spring-pass";
import { inPassWindow } from "@/lib/domain/spring-pass";
import { resolveDelivery } from "@/lib/domain/delivery";
import { geocodeAddress } from "@/lib/services/geocode";
import { getSettings } from "@/lib/services/settings";
import { brand } from "@/config/brand";
import { toLocalDate } from "@/lib/time";
import { takeRainCredit } from "@/lib/services/rain";
import { customerPackage } from "@/lib/services/portal";
import { getPortalCustomer, requestLoginCode, signOutPortal, verifyLoginCode } from "@/lib/services/portal-auth";
import { billingPortalUrl, setCancelAtPeriodEnd } from "@/lib/services/subscriptions";
import { headers } from "next/headers";
import { consentComplete } from "@/lib/domain/legal";
import { carryOverAcceptance, customerAcceptedLive, recordAcceptance } from "@/lib/services/legal";
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

const sessionInput = z.object({
  /** Package session or Spring Pass weekend. */
  source: z.enum(["package", "pass"]),
  startsAt: z.iso.datetime(),
  /** Self-serve downtown (free), or we deliver to a court or an address (zone fee). */
  delivery: z.enum(["none", "court", "address"]),
  courtId: z.string().nullish(),
  address: z.string().trim().max(200).nullish(),
  /** Required only when the customer hasn't accepted the live Terms & Waiver. */
  consent: z.object({ termsId: z.string(), waiverId: z.string(), boxes: z.array(z.string()) }).nullish(),
});

/** Round-trip fee for an address, before booking a session or pass weekend. */
export async function sessionDeliveryQuoteAction(
  address: string,
): Promise<{ ok: true; feeCents: number; zone: number } | { ok: false; error: string }> {
  const customer = await getPortalCustomer();
  if (!customer) return { ok: false, error: "Please sign in again." };
  const settings = await getSettings();
  const point = address.trim().length > 5 ? await geocodeAddress(address) : null;
  const d = resolveDelivery({
    legs: { dropoff: true, collection: true },
    point,
    address,
    hub: { lat: settings.deliveryHubLat, lng: settings.deliveryHubLng },
    zones: settings.deliveryZones,
    zone1Fsas: brand.zone1Fsas,
  });
  if (d.status === "ok") return { ok: true, feeCents: d.feeCents, zone: d.zone };
  if (d.status === "out_of_area") {
    return { ok: false, error: `That's ${d.distanceKm} km from downtown — outside our delivery area.` };
  }
  return { ok: false, error: "We couldn't find that address. Add the postal code, or pick a court." };
}

export async function bookSessionAction(
  raw: z.input<typeof sessionInput>,
): Promise<ActionResult & { needsConsent?: boolean }> {
  try {
    const customer = await getPortalCustomer();
    if (!customer) return { ok: false, error: "Please sign in again." };
    const parsed = sessionInput.safeParse(raw);
    if (!parsed.success) return { ok: false, error: "Please check the form." };
    const input = parsed.data;
    const startsAt = new Date(input.startsAt);

    // Where the slot comes from, and the card on file for deposit and delivery.
    let target: {
      productId: string;
      subscriptionId?: string;
      springPassId?: string;
      card: () => Promise<string | null>;
    };
    if (input.source === "package") {
      const pkg = await customerPackage(customer.id);
      if (!pkg || pkg.subscription.status !== "ACTIVE")
        return { ok: false, error: "You don't have an active package." };
      if (pkg.usage.left <= 0) return { ok: false, error: "You've used all your sessions this month." };
      if (startsAt >= pkg.subscription.currentPeriodEnd) {
        return { ok: false, error: "Pick a date before your package renews." };
      }
      target = {
        productId: pkg.subscription.productId,
        subscriptionId: pkg.subscription.id,
        card: () => subscriptionCard(pkg.subscription.stripeSubscriptionId),
      };
    } else {
      const pass = await customerSpringPass(customer.id);
      if (!pass) return { ok: false, error: "You don't have an active Spring Pass." };
      if (pass.left <= 0) return { ok: false, error: "You've used all the weekends on your pass." };
      if (!inPassWindow(toLocalDate(startsAt), pass)) {
        return { ok: false, error: `Pass weekends must start between ${pass.validFrom} and ${pass.validTo}.` };
      }
      const weekend = await db.product.findFirst({
        where: { kind: "WEEKEND", active: true },
        orderBy: { sortOrder: "asc" },
      });
      if (!weekend) return { ok: false, error: "Weekend rentals aren't available right now." };
      target = { productId: weekend.id, springPassId: pass.pass.id, card: async () => pass.pass.stripePaymentMethodId };
    }

    if (input.delivery === "court" && !input.courtId)
      return { ok: false, error: "Choose the court we should bring it to." };
    if (input.delivery === "address" && !input.address)
      return { ok: false, error: "Enter the address for the delivery." };
    const point = input.delivery === "address" ? await geocodeAddress(input.address!) : null;

    // Members accept once; a new version of the terms must be accepted again.
    const alreadyAccepted = await customerAcceptedLive(customer.id);
    if (!alreadyAccepted && (!input.consent || !consentComplete(input.consent.boxes))) {
      return { ok: false, needsConsent: true, error: "Please accept the updated terms (tick both boxes)." };
    }
    const machineIds = await db.machine.findMany({
      where: { bookable: true, isPublic: true, status: { in: ["AVAILABLE", "RENTED"] } },
      select: { id: true },
    });
    let lastError: unknown = null;
    for (const m of machineIds) {
      try {
        const booking = await createBooking({
          productId: target.productId,
          machineId: m.id,
          startsAt,
          customer: { name: customer.name, email: customer.email, phone: customer.phone },
          // Self-serve downtown by default; delivery is the zone's round trip.
          ...(input.delivery === "court"
            ? { fulfillment: "DELIVERY_COURT" as const, dropoff: true, collection: true, courtId: input.courtId }
            : input.delivery === "address"
              ? {
                  fulfillment: "DELIVERY_ADDRESS" as const,
                  dropoff: true,
                  collection: true,
                  deliveryAddress: input.address,
                  deliveryPoint: point,
                }
              : { fulfillment: "PICKUP" as const }),
          channel: "ONLINE",
          subscriptionId: target.subscriptionId ?? null,
          springPassId: target.springPassId ?? null,
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
        const card = await target.card();
        if (booking.status === "PENDING_PAYMENT") {
          // Delivery fee → charged to the card on file, which also confirms it.
          const charged = await chargeSessionOnFile(booking.id, card);
          if (!charged.ok) return { ok: false, error: charged.error };
        } else {
          await attachCardToDeposit(booking.id, card).catch((e: unknown) => console.error("deposit for session", e));
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
