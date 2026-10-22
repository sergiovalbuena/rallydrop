"use server";

import { headers } from "next/headers";
import { db } from "@/lib/db";
import { BookingError } from "@/lib/services/errors";
import { bookingIdFromToken, recordAcceptance } from "@/lib/services/legal";
import { completeConfirmation } from "@/lib/services/payments";
import { clientIp } from "@/lib/request";
import { consentSchema } from "@/lib/validation/booking";

/** Acceptance through the signed link (phone bookings, or paid without one). */
export async function acceptViaLinkAction(
  token: string,
  consent: { termsId: string; waiverId: string; boxes: string[] },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const bookingId = bookingIdFromToken(token);
  const parsed = consentSchema.safeParse(consent);
  if (!bookingId || !parsed.success) return { ok: false, error: "This link isn't valid." };
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: {
      customer: true,
      payments: { where: { kind: "RENTAL", status: "SUCCEEDED" }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!booking || booking.status === "CANCELLED") return { ok: false, error: "This booking is no longer active." };
  try {
    const h = await headers();
    await recordAcceptance({
      bookingId: booking.id,
      customerId: booking.customerId,
      name: booking.customer.name,
      contact: booking.customer.email ?? booking.customer.phone ?? "",
      termsId: parsed.data.termsId,
      waiverId: parsed.data.waiverId,
      boxes: parsed.data.boxes,
      method: "accept_link",
      ip: clientIp(h),
      userAgent: h.get("user-agent"),
    });
    // Paid earlier but held for acceptance → confirm it now.
    const paid = booking.payments[0];
    if (booking.status === "PENDING_PAYMENT" && paid?.stripePaymentIntentId) {
      await completeConfirmation(booking.id, paid.stripePaymentIntentId, paid.amountCents, { offSession: true });
    }
    return { ok: true };
  } catch (e) {
    if (e instanceof BookingError) return { ok: false, error: e.message };
    console.error("accept via link", e);
    return { ok: false, error: "We couldn't save your acceptance. Please try again." };
  }
}
