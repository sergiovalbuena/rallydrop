import "server-only";
import { db } from "@/lib/db";
import type { Prisma, ProductKind, PromoCode } from "@/generated/prisma/client";

export function normalizePromoCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

/** Bookings that "used" a code: anything that went ahead (not expired/abandoned). */
export async function promoRedemptions(
  promoCodeId: string,
  excludeBookingId?: string,
  client: Prisma.TransactionClient = db,
) {
  return client.booking.count({
    where: {
      promoCodeId,
      status: { notIn: ["EXPIRED"] },
      OR: [{ cancelReason: null }, { cancelReason: { notIn: ["abandoned", "payment_init_failed"] } }],
      ...(excludeBookingId ? { NOT: { id: excludeBookingId } } : {}),
    },
  });
}

export type PromoCheck = { ok: true; promo: PromoCode } | { ok: false; error: string };

/** Validates a code for a product right now. Messages are customer-facing. */
export async function findValidPromo(rawCode: string, productKind: ProductKind, now = new Date()): Promise<PromoCheck> {
  const code = normalizePromoCode(rawCode);
  if (!code) return { ok: false, error: "Enter a promo code." };
  const promo = await db.promoCode.findUnique({ where: { code } });
  if (!promo || !promo.active) return { ok: false, error: "That code isn't valid." };
  if (promo.startsAt && promo.startsAt > now) return { ok: false, error: "That code isn't active yet." };
  if (promo.endsAt && promo.endsAt <= now) return { ok: false, error: "That code has expired." };
  if (promo.productKinds.length > 0 && !promo.productKinds.includes(productKind)) {
    return { ok: false, error: "That code doesn't apply to this rental." };
  }
  if (promo.maxRedemptions !== null && (await promoRedemptions(promo.id)) >= promo.maxRedemptions) {
    return { ok: false, error: "That code has been fully redeemed." };
  }
  return { ok: true, promo };
}

export function toPromoInput(p: PromoCode) {
  return { code: p.code, kind: p.kind, percentBps: p.percentBps, amountCents: p.amountCents };
}
