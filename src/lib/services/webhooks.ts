import "server-only";
import { db } from "@/lib/db";
import { stripe, type Stripe } from "@/lib/stripe";
import { handleGroupPaymentSucceeded } from "./groups";
import { handleRentalSucceeded, markDepositHeld } from "./payments";
import { recordInvoicePaid, syncSubscription } from "./subscriptions";

/** Verifies the Stripe signature and parses the event. Throws on mismatch. */
export function constructStripeEvent(rawBody: string, signature: string | null): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set.");
  if (!signature) throw new Error("Missing Stripe-Signature header.");
  return stripe().webhooks.constructEvent(rawBody, signature, secret);
}

/**
 * Processes a Stripe event exactly once. The event id is recorded only after
 * the handler succeeds, so a failed attempt is retried by Stripe; every
 * handler is idempotent in case two deliveries race.
 */
export async function processStripeEvent(event: Stripe.Event): Promise<"processed" | "duplicate" | "ignored"> {
  if (await db.stripeEvent.findUnique({ where: { id: event.id } })) return "duplicate";
  const handled = await dispatch(event);
  await db.stripeEvent.upsert({ where: { id: event.id }, update: {}, create: { id: event.id, type: event.type } });
  return handled ? "processed" : "ignored";
}

async function dispatch(event: Stripe.Event): Promise<boolean> {
  switch (event.type) {
    case "payment_intent.succeeded": {
      const pi = event.data.object;
      if (pi.metadata.kind === "rental") await handleRentalSucceeded(pi, { offSession: true });
      else if (pi.metadata.kind === "group") await handleGroupPaymentSucceeded(pi);
      else if (pi.metadata.kind === "deposit") {
        // A captured deposit authorization — capture bookkeeping happens in captureDeposit().
        await db.payment.updateMany({ where: { stripePaymentIntentId: pi.id }, data: { status: "SUCCEEDED" } });
      } else return false;
      return true;
    }
    case "payment_intent.amount_capturable_updated": {
      const pi = event.data.object;
      if (pi.metadata.kind !== "deposit") return false;
      await markDepositHeld(pi);
      return true;
    }
    case "payment_intent.payment_failed": {
      const pi = event.data.object;
      await db.payment.updateMany({
        where: { stripePaymentIntentId: pi.id, status: { in: ["PENDING", "REQUIRES_ACTION"] } },
        data: { status: "FAILED" },
      });
      if (pi.metadata.kind === "deposit") {
        await db.deposit.updateMany({
          where: { stripePaymentIntentId: pi.id, status: "PENDING" },
          data: { status: "FAILED" },
        });
      }
      return true;
    }
    case "payment_intent.canceled": {
      const pi = event.data.object;
      if (pi.metadata.kind === "deposit") {
        // Released by us, or the authorization expired on Stripe's side.
        await db.deposit.updateMany({
          where: { stripePaymentIntentId: pi.id, status: "HELD" },
          data: { status: "RELEASED", releasedAt: new Date(), releasedById: "stripe" },
        });
      } else {
        await db.payment.updateMany({
          where: { stripePaymentIntentId: pi.id, status: { in: ["PENDING", "REQUIRES_ACTION"] } },
          data: { status: "CANCELLED" },
        });
      }
      return true;
    }
    case "charge.refunded": {
      const charge = event.data.object;
      const paymentIntentId =
        typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
      if (!paymentIntentId) return false;
      const payment = await db.payment.findUnique({ where: { stripePaymentIntentId: paymentIntentId } });
      if (!payment) return false;
      // Refunds made in the Stripe dashboard are mirrored here too.
      const refunded = Math.max(payment.refundedCents, charge.amount_refunded);
      await db.payment.update({
        where: { id: payment.id },
        data: {
          refundedCents: refunded,
          status: refunded >= payment.amountCents ? "REFUNDED" : refunded > 0 ? "PARTIALLY_REFUNDED" : payment.status,
        },
      });
      return true;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await syncSubscription(event.data.object);
      return true;
    case "invoice.paid":
      await recordInvoicePaid(event.data.object);
      return true;
    default:
      return false;
  }
}
