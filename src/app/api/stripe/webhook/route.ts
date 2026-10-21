import { NextResponse, type NextRequest } from "next/server";
import { constructStripeEvent, processStripeEvent } from "@/lib/services/webhooks";

/**
 * Stripe webhook endpoint. Configure it in the Stripe dashboard (or run
 * `npm run stripe:listen` locally) with at least these events:
 * payment_intent.succeeded, payment_intent.amount_capturable_updated,
 * payment_intent.payment_failed, payment_intent.canceled, charge.refunded,
 * customer.subscription.created/updated/deleted, invoice.paid
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  let event;
  try {
    event = constructStripeEvent(body, request.headers.get("stripe-signature"));
  } catch (e) {
    console.warn("stripe webhook: bad signature", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  try {
    const result = await processStripeEvent(event);
    return NextResponse.json({ received: true, result });
  } catch (e) {
    console.error(`stripe webhook: failed to process ${event.type} ${event.id}`, e);
    // 500 → Stripe retries with backoff.
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
