"use client";
import { loadStripe, type Stripe } from "@stripe/stripe-js";

let promise: Promise<Stripe | null> | null = null;

/** Loads Stripe.js once. Null when the publishable key isn't configured. */
export function getStripe(): Promise<Stripe | null> | null {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!key || key === "pk_test_...") return null;
  promise ??= loadStripe(key);
  return promise;
}

export const stripeAppearance = {
  theme: "stripe" as const,
  variables: {
    colorPrimary: "#2457e6",
    borderRadius: "10px",
    fontFamily: "Inter, system-ui, sans-serif",
  },
};
