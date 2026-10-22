"use client";

import { Analytics as VercelAnalytics, type BeforeSendEvent } from "@vercel/analytics/next";

/** Signed one-off links carry a token in the path: never send it. */
const PRIVATE = [
  /^\/accept\/[^/]+/,
  /^\/deposit\/[^/]+/,
  /^\/account\/(rain|reschedule)\/[^/]+/,
  /^\/book\/confirmation\/[^/]+/,
];

function redact(event: BeforeSendEvent): BeforeSendEvent | null {
  const url = new URL(event.url);
  // The owner's own admin visits aren't traffic.
  if (url.pathname.startsWith("/admin")) return null;
  for (const re of PRIVATE) {
    const m = url.pathname.match(re);
    if (m) url.pathname = m[0].replace(/[^/]+$/, "[id]");
  }
  // Query strings can hold codes and emails; keep only the product choice.
  const product = url.searchParams.get("product");
  url.search = product ? `?product=${encodeURIComponent(product)}` : "";
  return { ...event, url: url.toString() };
}

export function Analytics() {
  return <VercelAnalytics beforeSend={redact} />;
}
