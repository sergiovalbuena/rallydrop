"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { notifyRescheduled } from "@/lib/notify/booking-notifications";
import { createBooking } from "@/lib/services/bookings";
import { rescheduleBooking } from "@/lib/services/bookings";
import { BookingError } from "@/lib/services/errors";
import { attachSubscriptionCardToDeposit, cancelBooking } from "@/lib/services/payments";
import { customerPackage } from "@/lib/services/portal";
import { getPortalCustomer, requestLoginCode, signOutPortal, verifyLoginCode } from "@/lib/services/portal-auth";
import { billingPortalUrl } from "@/lib/services/subscriptions";
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

export async function bookSessionAction(input: { startsAt: string; courtId: string }): Promise<ActionResult> {
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
    const machineIds = await db.machine.findMany({
      where: { bookable: true, status: { in: ["AVAILABLE", "RENTED"] } },
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
          balls: false,
          fulfillment: "DELIVERY_COURT",
          courtId: input.courtId,
          channel: "ONLINE",
          subscriptionId: pkg.subscription.id,
          termsAccepted: true,
        });
        await attachSubscriptionCardToDeposit(booking.id, pkg.subscription.stripeSubscriptionId).catch((e) =>
          console.error("deposit for session", e),
        );
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
