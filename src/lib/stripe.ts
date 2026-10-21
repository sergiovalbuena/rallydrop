import "server-only";
import Stripe from "stripe";

let client: Stripe | null = null;

/** Lazily created Stripe client (TEST keys during development). */
export function stripe(): Stripe {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set. Add your Stripe test key to .env.");
  if (process.env.NODE_ENV !== "production" && key.startsWith("sk_live_")) {
    throw new Error("Refusing to use a live Stripe key outside production.");
  }
  client = new Stripe(key, { appInfo: { name: "RallyDrop" } });
  return client;
}

/** For tests: inject a fake client. */
export function setStripeClient(fake: Stripe | null) {
  client = fake;
}

export type { Stripe };
