import { describe, expect, it } from "vitest";
import { promoDiscount, quote, withTaxes } from "@/lib/domain/pricing";
import { carePrice, chargedTaxes, depositAmount, maxDamageCharge } from "@/lib/domain/rental";
import { isHighSeason, seasonalPrice } from "@/lib/domain/season";
import { applyBps } from "@/lib/money";

const base = {
  product: { name: "Day rental", priceCents: 4500 },
  extraBalls: { selected: false, name: "Extra bucket (+50 balls)", priceCents: 800 },
  care: { selected: false, priceCents: 800 },
  delivery: { selected: false, label: "Drop-off & collection · Zone 1", priceCents: 2500 },
  taxes: { gstBps: 500, pstBps: 700 },
  depositCents: 40000,
};

describe("quote", () => {
  it("prices a bare day rental with GST + PST", () => {
    const q = quote(base);
    expect(q.subtotalCents).toBe(4500);
    expect(q.gstCents).toBe(225);
    expect(q.pstCents).toBe(315);
    expect(q.totalCents).toBe(5040);
    expect(q.depositCents).toBe(40000);
  });

  it("adds the extra bucket, RallyDrop Care and the trips", () => {
    const q = quote({
      ...base,
      extraBalls: { ...base.extraBalls, selected: true },
      care: { ...base.care, selected: true },
      delivery: { ...base.delivery, selected: true },
    });
    expect(q.lines.map((l) => [l.key, l.cents])).toEqual([
      ["product", 4500],
      ["extra_balls", 800],
      ["care", 800],
      ["delivery", 2500],
    ]);
    expect(q.subtotalCents).toBe(8600);
  });

  it("charges delivery on package sessions (the session itself is included, no Care)", () => {
    const q = quote({
      ...base,
      productIncluded: true,
      care: { ...base.care, selected: true },
      delivery: { ...base.delivery, selected: true },
    });
    expect(q.lines.find((l) => l.key === "product")?.cents).toBe(0);
    expect(q.lines.find((l) => l.key === "delivery")?.cents).toBe(base.delivery.priceCents);
    expect(q.lines.some((l) => l.key === "care")).toBe(false);
    expect(q.subtotalCents).toBe(base.delivery.priceCents);
  });

  it("is free for a self-serve package session", () => {
    const q = quote({ ...base, productIncluded: true, delivery: { ...base.delivery, selected: false } });
    expect(q.totalCents).toBe(0);
  });

  it("charges no tax when taxes are off", () => {
    const q = quote({ ...base, taxes: { gstBps: 0, pstBps: 0 } });
    expect(q.totalCents).toBe(4500);
    expect(q.gstCents + q.pstCents).toBe(0);
  });
});

describe("taxes on/off", () => {
  const s = { gstBps: 500, pstBps: 700, chargeGst: false, chargePst: false, gstNumber: null, pstNumber: null };
  it("are off by default", () => {
    expect(chargedTaxes(s)).toEqual({ gstBps: 0, pstBps: 0 });
  });
  it("need both the switch and the registration number", () => {
    expect(chargedTaxes({ ...s, chargeGst: true })).toEqual({ gstBps: 0, pstBps: 0 });
    expect(chargedTaxes({ ...s, chargeGst: true, gstNumber: "123456789RT0001" })).toEqual({ gstBps: 500, pstBps: 0 });
    expect(chargedTaxes({ ...s, chargeGst: true, gstNumber: "1", chargePst: true, pstNumber: "PST-1" })).toEqual({
      gstBps: 500,
      pstBps: 700,
    });
  });
});

describe("seasons", () => {
  const season = { start: "04-01", end: "09-30" };
  const day = { priceCents: 5000, offSeasonPriceCents: 4500 };
  const month = { priceCents: 42000, offSeasonPriceCents: 30000 };

  it("follows the start date", () => {
    expect(isHighSeason("2027-04-01", season)).toBe(true);
    expect(isHighSeason("2027-09-30", season)).toBe(true);
    expect(isHighSeason("2027-10-01", season)).toBe(false);
    expect(isHighSeason("2027-03-31", season)).toBe(false);
  });

  it("prices high and off season", () => {
    expect(seasonalPrice(day, "2027-07-10", season)).toEqual({ cents: 5000, offSeason: false });
    expect(seasonalPrice(day, "2027-11-10", season)).toEqual({ cents: 4500, offSeason: true });
    expect(seasonalPrice(month, "2027-06-01", season).cents).toBe(42000);
    expect(seasonalPrice(month, "2027-01-15", season).cents).toBe(30000);
  });

  it("uses the one price when there's no off-season price", () => {
    expect(seasonalPrice({ priceCents: 4900, offSeasonPriceCents: null }, "2027-12-01", season).cents).toBe(4900);
  });

  it("handles windows that wrap the new year", () => {
    expect(isHighSeason("2027-12-15", { start: "11-01", end: "02-28" })).toBe(true);
    expect(isHighSeason("2027-06-15", { start: "11-01", end: "02-28" })).toBe(false);
  });
});

describe("RallyDrop Care and deposits", () => {
  const care = { careEnabled: true, careShortCents: 800, careWeekCents: 1500, careMonthCents: 2500 };
  it("prices Care by rental length", () => {
    expect(carePrice("DAY", care)).toBe(800);
    expect(carePrice("WEEKEND", care)).toBe(800);
    expect(carePrice("WEEK", care)).toBe(1500);
    expect(carePrice("MONTH", care)).toBe(2500);
    expect(carePrice("PACKAGE", care)).toBeNull();
    expect(carePrice("DAY", { ...care, careEnabled: false })).toBeNull();
  });

  it("uses the 400 hold up to 6 days and the 600 saved-card deposit beyond", () => {
    const m = { depositCents: 40000, depositLongCents: 60000 };
    expect(depositAmount(m, 25, 6)).toBe(40000);
    expect(depositAmount(m, 48, 6)).toBe(40000);
    expect(depositAmount(m, 144, 6)).toBe(40000);
    expect(depositAmount(m, 168, 6)).toBe(60000);
    expect(depositAmount(m, 720, 6)).toBe(60000);
  });

  it("caps damage at 100 with Care unless an exclusion applies", () => {
    expect(maxDamageCharge({ depositCents: 40000, care: false, careCapCents: 10000, exclusion: null })).toBe(40000);
    expect(maxDamageCharge({ depositCents: 40000, care: true, careCapCents: 10000, exclusion: null })).toBe(10000);
    expect(maxDamageCharge({ depositCents: 40000, care: true, careCapCents: 10000, exclusion: "THEFT" })).toBe(40000);
    expect(maxDamageCharge({ depositCents: 5000, care: true, careCapCents: 10000, exclusion: null })).toBe(5000);
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
      extraBalls: { ...base.extraBalls, selected: true },
      promo: { code: "SPRING15", kind: "PERCENT", percentBps: 1500 },
    });
    // 53.00 − 15% = 45.05
    expect(q.discountCents).toBe(795);
    expect(q.subtotalCents).toBe(4505);
    expect(q.gstCents).toBe(applyBps(4505, 500));
    expect(q.lines.at(-1)).toMatchObject({ key: "promo", label: "Promo SPRING15", cents: -795 });
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
  });
});
