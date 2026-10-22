"use client";

import { track } from "@vercel/analytics";

/*
 * Key funnel events (Vercel Analytics custom events). No personal data:
 * product kind, delivery choice and amounts in dollars only.
 */
type Events = {
  booking_started: { product: string };
  terms_accepted: { product: string };
  payment_completed: { product: string; amount: number; delivery: boolean };
};

export function trackEvent<E extends keyof Events>(name: E, props: Events[E]) {
  try {
    track(name, props);
  } catch {
    // Analytics must never break the checkout.
  }
}
