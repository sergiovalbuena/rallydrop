import { describe, expect, it } from "vitest";
import { quote, withTaxes } from "@/lib/domain/pricing";
import { applyBps } from "@/lib/money";

const base = {
  product: { name: "Day rental", priceCents: 4500 },
  balls: { selected: false, name: "Ball bucket", priceCents: 1000 },
  delivery: { selected: false, name: "Delivery & pickup", priceCents: 1500, inFreeZone: null },
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

  it("adds balls and paid delivery outside the free zone", () => {
    const q = quote({
      ...base,
      balls: { ...base.balls, selected: true },
      delivery: { ...base.delivery, selected: true, inFreeZone: false },
    });
    expect(q.lines.map((l) => [l.key, l.cents])).toEqual([
      ["product", 4500],
      ["balls", 1000],
      ["delivery", 1500],
    ]);
    expect(q.subtotalCents).toBe(7000);
    expect(q.totalCents).toBe(7000 + 350 + 490);
  });

  it("makes delivery free inside the zone", () => {
    const q = quote({ ...base, delivery: { ...base.delivery, selected: true, inFreeZone: true } });
    const delivery = q.lines.find((l) => l.key === "delivery");
    expect(delivery?.cents).toBe(0);
    expect(delivery?.note).toMatch(/free/i);
    expect(q.subtotalCents).toBe(4500);
  });

  it("charges delivery when the zone is unknown", () => {
    const q = quote({ ...base, delivery: { ...base.delivery, selected: true, inFreeZone: null } });
    expect(q.lines.find((l) => l.key === "delivery")?.cents).toBe(1500);
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
