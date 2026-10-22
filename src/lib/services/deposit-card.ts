import "server-only";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { BookingError } from "./errors";
import { ensureStripeCustomer, markDepositHeld, placeDepositHold, type HoldResult } from "./payments";

/*
 * "Deposit pending": the hold failed (declined, expired card, needs 3-D
 * Secure). The customer follows the emailed link, saves a new card and we
 * place the hold again right away.
 */

async function openDeposit(bookingId: string) {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: { deposit: true, product: true, machine: true },
  });
  if (!booking?.deposit) throw new BookingError("NOT_FOUND", "Booking not found.");
  if (!["CONFIRMED", "CHECKED_OUT"].includes(booking.status)) {
    throw new BookingError("INVALID_STATE", "This booking doesn't need a card update anymore.");
  }
  return booking;
}

/** Whether the link still has something to do (for the page). */
export async function depositCardStatus(bookingId: string) {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: { deposit: true, product: true, machine: true },
  });
  if (!booking?.deposit) return null;
  const done = ["HELD", "CARD_SAVED", "RELEASED", "WAIVED", "CAPTURED", "PARTIALLY_CAPTURED"].includes(
    booking.deposit.status,
  );
  return { booking, done };
}

/** SetupIntent the page confirms with the Payment Element. */
export async function startDepositCardUpdate(bookingId: string): Promise<{ clientSecret: string }> {
  const booking = await openDeposit(bookingId);
  const customer = await ensureStripeCustomer(booking.customerId);
  const si = await stripe().setupIntents.create({
    customer,
    allowed_payment_method_types: ["card"],
    usage: "off_session",
    metadata: { kind: "deposit_card", bookingId: booking.id },
  });
  return { clientSecret: si.client_secret! };
}

/**
 * The new card is saved: use it for the deposit and place the hold now if
 * it's due (it may need 3-D Secure — the page then finishes it).
 */
export async function finishDepositCardUpdate(bookingId: string, setupIntentId: string): Promise<HoldResult> {
  const booking = await openDeposit(bookingId);
  const si = await stripe().setupIntents.retrieve(setupIntentId);
  if (si.metadata?.bookingId !== booking.id || si.status !== "succeeded") {
    throw new BookingError("PAYMENT_FAILED", "The card wasn't saved. Please try again.");
  }
  const paymentMethod = typeof si.payment_method === "string" ? si.payment_method : si.payment_method?.id;
  if (!paymentMethod) throw new BookingError("PAYMENT_FAILED", "The card wasn't saved. Please try again.");
  const deposit = booking.deposit!;
  await db.deposit.update({
    where: { id: deposit.id },
    data: {
      stripePaymentMethodId: paymentMethod,
      status:
        deposit.strategy === "SAVED_CARD" ? "CARD_SAVED" : deposit.status === "FAILED" ? "PENDING" : deposit.status,
    },
  });
  await db.bookingEvent.create({ data: { bookingId, type: "deposit_card_updated", actor: "customer" } });
  // A failed hold was already due; otherwise only place it once it's due.
  const due =
    deposit.strategy === "AUTH_HOLD" &&
    (deposit.status === "FAILED" || !deposit.authScheduledFor || deposit.authScheduledFor <= new Date());
  if (!due) return { status: "skipped" };
  return placeDepositHold(bookingId, { offSession: false });
}

/** After 3-D Secure on the page: record the hold if it's now in place. */
export async function confirmDepositHold(bookingId: string): Promise<boolean> {
  const deposit = await db.deposit.findUnique({ where: { bookingId } });
  if (!deposit?.stripePaymentIntentId) return false;
  const pi = await stripe().paymentIntents.retrieve(deposit.stripePaymentIntentId);
  if (pi.status !== "requires_capture") return false;
  await markDepositHeld(pi);
  return true;
}
