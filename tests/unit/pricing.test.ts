import { describe, expect, it } from "vitest";
import { promoDiscount, quote, withTaxes } from "@/lib/domain/pricing";
import { applyBps } from "@/lib/money";

const base = {
  product: { name: "Day rental", priceCents: 4500 },
  balls: { selected: false, name: "Ball bucket", priceCents: 1000 },
  delivery: { selected: false, label: "Drop-off & collection · Zone 1", priceCents: 2500 },
  taxes: { gstBps: 500, pstBps: 700 },
  depositCents: 30000,
};

describe("quote", () => {
  it("prices a bare day rental with GST + PST", () => {
    const q = quote(base);
    expect(q.subtotalCents).toBe(4500);
    expect(q.gstCents).toBe(225);
    expect(q.pstCents).toBe(315);
    expect(q.totalCents).toBe(5040);
    expect(q.depositCents).toBe(30000);
  });

  it("adds balls and the drop-off & collection fee", () => {
    const q = quote({
      ...base,
      balls: { ...base.balls, selected: true },
      delivery: { ...base.delivery, selected: true },
    });
    expect(q.lines.map((l) => [l.key, l.cents])).toEqual([
      ["product", 4500],
      ["balls", 1000],
      ["delivery", 2500],
    ]);
    expect(q.subtotalCents).toBe(8000);
    expect(q.totalCents).toBe(8000 + 400 + 560);
  });

  it("includes the trips in package sessions", () => {
    const q = quote({ ...base, productIncluded: true, delivery: { ...base.delivery, selected: true } });
    const delivery = q.lines.find((l) => l.key === "delivery");
    expect(delivery?.cents).toBe(0);
    expect(delivery?.note).toMatch(/included/i);
  });

  it("prices package sessions at zero but still charges add-ons", () => {
    const q = quote({ ...base, productIncluded: true, balls: { ...base.balls, selected: true } });
    expect(q.lines[0].cents).toBe(0);
    expect(q.subtotalCents).toBe(1000);
  });

  it("respects custom tax rates, including zero", () => {
    expect(quote({ ...base, taxes: { gstBps: 500, pstBps: 0 } }).totalCents).toBe(4725);
  });
});

describe("tax rounding", () => {
  it("rounds half up to the cent", () => {
    expect(applyBps(1010, 500)).toBe(51); // 50.5 → 51
    expect(applyBps(1009, 500)).toBe(50); // 50.45 → 50
    expect(withTaxes(2000, { gstBps: 500, pstBps: 700 }).totalCents).toBe(2240);
  });
});

describe("promo codes", () => {
  it("takes a percent off before tax", () => {
    const q = quote({
      ...base,
      balls: { ...base.balls, selected: true },
      promo: { code: "SPRING15", kind: "PERCENT", percentBps: 1500 },
    });
    // 55.00 − 15% = 46.75
    expect(q.discountCents).toBe(825);
    expect(q.subtotalCents).toBe(4675);
    expect(q.gstCents).toBe(applyBps(4675, 500));
    expect(q.lines.at(-1)).toMatchObject({ key: "promo", label: "Promo SPRING15", cents: -825 });
    expect(q.promoCode).toBe("SPRING15");
  });

  it("takes a fixed amount off", () => {
    const q = quote({ ...base, promo: { code: "TENOFF", kind: "FIXED", amountCents: 1000 } });
    expect(q.subtotalCents).toBe(3500);
  });

  it("never discounts below the minimum online charge", () => {
    expect(promoDiscount(4500, { code: "FREE", kind: "PERCENT", percentBps: 10_000 })).toBe(4400);
    expect(promoDiscount(4500, { code: "BIG", kind: "FIXED", amountCents: 99_999 })).toBe(4400);
    expect(promoDiscount(50, { code: "X", kind: "FIXED", amountCents: 500 })).toBe(0);
  });

  it("doesn't apply to package sessions (nothing to discount)", () => {
    const q = quote({ ...base, productIncluded: true, promo: { code: "X", kind: "PERCENT", percentBps: 5000 } });
    expect(q.discountCents).toBe(0);
    expect(q.promoCode).toBeNull();
    expect(q.lines.some((l) => l.key === "promo")).toBe(false);
  });

  it("has no promo line without a code", () => {
    const q = quote(base);
    expect(q.discountCents).toBe(0);
    expect(q.lines.some((l) => l.key === "promo")).toBe(false);
  });
});
