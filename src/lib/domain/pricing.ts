import { applyBps } from "@/lib/money";

/*
 * Price calculation. Pure and deterministic so it can be unit-tested and used
 * identically on the client (live summary) and the server (the amount we
 * actually charge — the server always recomputes, never trusts the client).
 *
 * NOTE FOR THE OWNER: GST 5% + PST 7% are defaults. Confirm with your
 * accountant which taxes apply to equipment rentals and services (and whether
 * you must register for PST) before going live. Rates are editable in
 * Admin → Settings.
 */

export type PriceLine = {
  key: "product" | "balls" | "delivery" | "promo";
  label: string;
  cents: number;
  /** e.g. "Free inside the downtown zone" */
  note?: string;
};

export type Quote = {
  lines: PriceLine[];
  subtotalCents: number;
  gstCents: number;
  pstCents: number;
  totalCents: number;
  gstBps: number;
  pstBps: number;
  /** Refundable security deposit — authorized/saved, not part of the total. */
  depositCents: number;
  /** Promo discount applied before taxes (positive number, 0 when none). */
  discountCents: number;
  promoCode: string | null;
};

export type PromoInput = {
  code: string;
  kind: "PERCENT" | "FIXED";
  percentBps?: number | null;
  amountCents?: number | null;
};

/**
 * Online bookings always charge at least this much (before tax), even with a
 * 100% code: the card payment is what saves the card for the deposit.
 */
export const MIN_ONLINE_CHARGE_CENTS = 100;

/** Discount for a promo on a gross amount, never pushing it below the minimum charge. */
export function promoDiscount(grossCents: number, promo: PromoInput, minChargeCents = MIN_ONLINE_CHARGE_CENTS): number {
  const raw =
    promo.kind === "PERCENT"
      ? applyBps(grossCents, Math.min(10_000, Math.max(0, promo.percentBps ?? 0)))
      : Math.max(0, promo.amountCents ?? 0);
  return Math.max(0, Math.min(raw, grossCents - minChargeCents));
}

export type QuoteInput = {
  product: { name: string; priceCents: number };
  balls: { selected: boolean; name: string; priceCents: number };
  delivery: {
    selected: boolean;
    name: string;
    priceCents: number;
    /** true = free zone, false = outside, null = unknown (fee applies) */
    inFreeZone: boolean | null;
  };
  taxes: { gstBps: number; pstBps: number };
  depositCents: number;
  /** Package sessions and other prepaid items price the product at 0. */
  productIncluded?: boolean;
  promo?: PromoInput | null;
};

export function quote(input: QuoteInput): Quote {
  const lines: PriceLine[] = [
    {
      key: "product",
      label: input.product.name,
      cents: input.productIncluded ? 0 : input.product.priceCents,
      note: input.productIncluded ? "Included in your package" : undefined,
    },
  ];

  if (input.balls.selected) {
    lines.push({ key: "balls", label: input.balls.name, cents: input.balls.priceCents });
  }

  if (input.delivery.selected) {
    const free = input.delivery.inFreeZone === true;
    lines.push({
      key: "delivery",
      label: input.delivery.name,
      cents: free ? 0 : input.delivery.priceCents,
      note: free ? "Free inside the delivery zone" : undefined,
    });
  }

  const grossCents = lines.reduce((sum, l) => sum + l.cents, 0);
  const discountCents = input.promo && !input.productIncluded ? promoDiscount(grossCents, input.promo) : 0;
  if (discountCents > 0 && input.promo) {
    lines.push({ key: "promo", label: `Promo ${input.promo.code}`, cents: -discountCents });
  }
  const subtotalCents = grossCents - discountCents;
  const gstCents = applyBps(subtotalCents, input.taxes.gstBps);
  const pstCents = applyBps(subtotalCents, input.taxes.pstBps);

  return {
    lines,
    subtotalCents,
    gstCents,
    pstCents,
    totalCents: subtotalCents + gstCents + pstCents,
    gstBps: input.taxes.gstBps,
    pstBps: input.taxes.pstBps,
    depositCents: input.depositCents,
    discountCents,
    promoCode: discountCents > 0 && input.promo ? input.promo.code : null,
  };
}

/** Taxes on a single amount (group sessions, subscriptions). */
export function withTaxes(subtotalCents: number, taxes: { gstBps: number; pstBps: number }) {
  const gstCents = applyBps(subtotalCents, taxes.gstBps);
  const pstCents = applyBps(subtotalCents, taxes.pstBps);
  return { subtotalCents, gstCents, pstCents, totalCents: subtotalCents + gstCents + pstCents };
}
