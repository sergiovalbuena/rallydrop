"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { consentComplete } from "@/lib/domain/legal";
import { recordAcceptance } from "@/lib/services/legal";
import { clientIp } from "@/lib/request";
import { consentSchema, contactSchema, fieldErrors } from "@/lib/validation/booking";
import { BookingError } from "@/lib/services/errors";
import { startSubscription } from "@/lib/services/subscriptions";
import { startSpringPassPurchase } from "@/lib/services/spring-pass";

const input = z.object({
  targetId: z.string().min(1),
  contact: contactSchema,
  consent: consentSchema,
});

export type StartPaymentResult =
  | { ok: true; clientSecret: string; amountCents: number }
  | { ok: false; error: string; fields?: Record<string, string> };

async function run(
  raw: unknown,
  start: (d: z.output<typeof input>) => Promise<{ clientSecret: string; amountCents: number }>,
): Promise<StartPaymentResult> {
  const parsed = input.safeParse(raw);
  if (!parsed.success)
    return { ok: false, error: "Please check the highlighted fields.", fields: fieldErrors(parsed.error) };
  if (!consentComplete(parsed.data.consent.boxes)) return { ok: false, error: "Tick both boxes to continue." };
  try {
    return { ok: true, ...(await start(parsed.data)) };
  } catch (e) {
    if (e instanceof BookingError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Something went wrong starting your payment. Please try again." };
  }
}

/** Monthly session package (Stripe subscription). targetId = product id. */
export async function startPackageAction(raw: unknown): Promise<StartPaymentResult> {
  return run(raw, async (d) => {
    const r = await startSubscription({ productId: d.targetId, customer: d.contact });
    // Members accept once here; their package sessions carry it over.
    const h = await headers();
    await recordAcceptance({
      customerId: r.customerId,
      name: r.customerName,
      contact: d.contact.email ?? d.contact.phone ?? "",
      termsId: d.consent.termsId,
      waiverId: d.consent.waiverId,
      boxes: d.consent.boxes,
      method: "package",
      ip: clientIp(h),
      userAgent: h.get("user-agent"),
    });
    return { clientSecret: r.clientSecret, amountCents: r.amountCents };
  });
}

/** Spring Pass (one-time payment; the card is saved for the weekends' deposits). */
export async function startSpringPassAction(raw: unknown): Promise<StartPaymentResult> {
  return run(raw, async (d) => {
    const r = await startSpringPassPurchase({ customer: d.contact });
    const h = await headers();
    await recordAcceptance({
      customerId: r.customerId,
      name: r.customerName,
      contact: d.contact.email ?? d.contact.phone ?? "",
      termsId: d.consent.termsId,
      waiverId: d.consent.waiverId,
      boxes: d.consent.boxes,
      method: "spring_pass",
      ip: clientIp(h),
      userAgent: h.get("user-agent"),
    });
    return { clientSecret: r.clientSecret, amountCents: r.amountCents };
  });
}
