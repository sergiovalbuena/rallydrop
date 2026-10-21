import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createBooking, priceBooking, type CreateBookingInput } from "@/lib/services/bookings";
import { BookingError } from "@/lib/services/errors";
import { localDateMinuteToUtc } from "@/lib/time";
import { hasTestDb, resetDb, seedCatalog } from "../helpers/fixtures";

// Wed Apr 28 2027 10:00 Victoria
const now = localDateMinuteToUtc("2027-04-28", 600);

describe.skipIf(!hasTestDb)("promo codes (Postgres)", () => {
  let catalog: Awaited<ReturnType<typeof seedCatalog>>;

  beforeEach(async () => {
    await resetDb();
    catalog = await seedCatalog();
  });

  function input(overrides: Partial<CreateBookingInput> = {}): CreateBookingInput {
    return {
      productId: catalog.day.id,
      machineId: catalog.aura.id,
      startsAt: localDateMinuteToUtc("2027-05-03", 600),
      customer: { name: "Alex", email: `alex${Math.random()}@example.com` },
      balls: true,
      fulfillment: "DELIVERY_COURT",
      courtId: catalog.court.id,
      channel: "ONLINE",
      termsAccepted: true,
      now,
      ...overrides,
    };
  }

  async function expectPromoError(promise: Promise<unknown>, message: RegExp) {
    const error = await promise.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BookingError);
    expect((error as BookingError).code).toBe("INVALID_PROMO");
    expect((error as BookingError).message).toMatch(message);
  }

  it("applies a valid code (case-insensitive) and records it on the booking", async () => {
    const promo = await db.promoCode.create({ data: { code: "SPRING15", kind: "PERCENT", percentBps: 1500 } });
    const booking = await createBooking(input({ promoCode: " spring15 " }));
    // 55.00 − 15% = 46.75 → +12% tax
    expect(booking.discountCents).toBe(825);
    expect(booking.subtotalCents).toBe(4675);
    expect(booking.totalCents).toBe(4675 + 234 + 327);
    expect(booking.promoCodeId).toBe(promo.id);
    // Add-on rows stay at their own price (the promo line isn't an add-on).
    expect(booking.addOns.map((a) => a.priceCents).sort()).toEqual([0, 1000]);
  });

  it("rejects unknown, inactive, expired, not-yet-active and wrong-product codes", async () => {
    await db.promoCode.createMany({
      data: [
        { code: "OFF", kind: "FIXED", amountCents: 500, active: false },
        { code: "OLD", kind: "FIXED", amountCents: 500, endsAt: new Date(now.getTime() - 1) },
        { code: "SOON", kind: "FIXED", amountCents: 500, startsAt: new Date(now.getTime() + 60_000) },
        { code: "WEEKONLY", kind: "FIXED", amountCents: 500, productKinds: ["WEEK"] },
      ],
    });
    await expectPromoError(createBooking(input({ promoCode: "NOPE" })), /isn't valid/);
    await expectPromoError(createBooking(input({ promoCode: "OFF" })), /isn't valid/);
    await expectPromoError(createBooking(input({ promoCode: "OLD" })), /expired/);
    await expectPromoError(createBooking(input({ promoCode: "SOON" })), /isn't active yet/);
    await expectPromoError(createBooking(input({ promoCode: "WEEKONLY" })), /doesn't apply/);
    expect(await db.booking.count()).toBe(0);
  });

  it("returns the error on the live quote without throwing", async () => {
    const r = await priceBooking({
      productId: catalog.day.id,
      machineId: catalog.aura.id,
      balls: false,
      fulfillment: "PICKUP",
      promoCode: "NOPE",
      now,
    });
    expect(r.promoError).toMatch(/isn't valid/);
    expect(r.quote.discountCents).toBe(0);
  });

  it("enforces max redemptions, even under concurrency", async () => {
    await db.promoCode.create({ data: { code: "ONCE", kind: "FIXED", amountCents: 1000, maxRedemptions: 1 } });
    const days = ["2027-05-03", "2027-05-06", "2027-05-09", "2027-05-12"];
    const results = await Promise.allSettled(
      days.map((d) => createBooking(input({ promoCode: "ONCE", startsAt: localDateMinuteToUtc(d, 600) }))),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    for (const r of results) {
      if (r.status === "rejected") expect((r.reason as BookingError).code).toBe("INVALID_PROMO");
    }
    await expectPromoError(
      createBooking(input({ promoCode: "ONCE", startsAt: localDateMinuteToUtc("2027-05-15", 600) })),
      /fully redeemed/,
    );
  });

  it("frees the redemption when the hold is abandoned", async () => {
    await db.promoCode.create({ data: { code: "ONCE", kind: "FIXED", amountCents: 1000, maxRedemptions: 1 } });
    const first = await createBooking(input({ promoCode: "ONCE" }));
    await db.booking.update({ where: { id: first.id }, data: { status: "EXPIRED" } });
    await db.machineOccupancy.update({ where: { bookingId: first.id }, data: { active: false } });
    const second = await createBooking(input({ promoCode: "ONCE" }));
    expect(second.discountCents).toBe(1000);
  });
});
