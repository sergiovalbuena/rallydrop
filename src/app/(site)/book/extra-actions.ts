"use server";

import { z } from "zod";
import { contactSchema, fieldErrors } from "@/lib/validation/booking";
import { BookingError } from "@/lib/services/errors";
import { startGroupEnrollment } from "@/lib/services/groups";
import { startSubscription } from "@/lib/services/subscriptions";

const input = z.object({
  targetId: z.string().min(1),
  contact: contactSchema,
  termsAccepted: z.literal(true, { error: "Please accept the rental terms." }),
});

export type StartPaymentResult =
  | { ok: true; clientSecret: string; amountCents: number }
  | { ok: false; error: string; fields?: Record<string, string> };

async function run(raw: unknown, start: (d: z.output<typeof input>) => Promise<{ clientSecret: string; amountCents: number }>): Promise<StartPaymentResult> {
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Please check the highlighted fields.", fields: fieldErrors(parsed.error) };
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
    return { clientSecret: r.clientSecret, amountCents: r.amountCents };
  });
}

/** Group session seat. targetId = group session id. */
export async function startGroupAction(raw: unknown): Promise<StartPaymentResult> {
  return run(raw, async (d) => {
    const r = await startGroupEnrollment({ groupSessionId: d.targetId, customer: d.contact });
    return { clientSecret: r.clientSecret, amountCents: r.totalCents };
  });
}
