import { beforeEach, describe, expect, it } from "vitest";
import { createBooking, type CreateBookingInput } from "@/lib/services/bookings";
import { BookingError } from "@/lib/services/errors";
import { localDateMinuteToUtc } from "@/lib/time";
import { hasTestDb, resetDb, seedCatalog } from "../helpers/fixtures";

// Wed Apr 28 2027 10:00 Victoria
const now = localDateMinuteToUtc("2027-04-28", 600);

describe.skipIf(!hasTestDb)("drop-off & collection (Postgres)", () => {
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
      balls: false,
      fulfillment: "DELIVERY_COURT",
      courtId: catalog.court.id,
      channel: "ONLINE",
      termsAccepted: true,
      now,
      ...overrides,
    };
  }

  it("charges the zone 1 round trip and records both trips", async () => {
    const b = await createBooking(input({ dropoff: true, collection: true }));
    // 45 + 25 round trip (Beacon Hill ≈ 1.8 km from downtown)
    expect(b.subtotalCents).toBe(7000);
    expect(b.deliveryFeeCents).toBe(2500);
    expect(b).toMatchObject({ dropoff: true, collection: true, deliveryZone: 1, fulfillment: "DELIVERY_COURT" });
    expect(Number(b.deliveryKm)).toBeGreaterThan(1);
    expect(b.courtId).toBe(catalog.court.id);
  });

  it("charges a single trip for drop-off only", async () => {
    const b = await createBooking(input({ dropoff: true, collection: false }));
    expect(b.deliveryFeeCents).toBe(1500);
    expect(b).toMatchObject({ dropoff: true, collection: false });
  });

  it("treats no trips as free self-serve, whatever location was sent", async () => {
    const b = await createBooking(input({ dropoff: false, collection: false }));
    expect(b).toMatchObject({ fulfillment: "PICKUP", deliveryFeeCents: 0, deliveryZone: null, courtId: null });
    expect(b.subtotalCents).toBe(4500);
  });

  it("refuses online trips to addresses it can't place or that are too far", async () => {
    const unknown = await createBooking(
      input({ dropoff: true, collection: true, fulfillment: "DELIVERY_ADDRESS", deliveryAddress: "Somewhere" }),
    ).catch((e: unknown) => e);
    expect((unknown as BookingError).code).toBe("DELIVERY_UNAVAILABLE");

    const far = await createBooking(
      input({
        dropoff: true,
        collection: true,
        fulfillment: "DELIVERY_ADDRESS",
        deliveryAddress: "Sidney, BC",
        deliveryPoint: { lat: 48.6502, lng: -123.3987 },
      }),
    ).catch((e: unknown) => e);
    expect((far as BookingError).code).toBe("DELIVERY_UNAVAILABLE");
    expect((far as BookingError).message).toMatch(/outside our delivery area/);
  });

  it("lets a phone booking record trips the owner prices by hand", async () => {
    const b = await createBooking(
      input({
        channel: "ADMIN",
        termsAccepted: false,
        dropoff: true,
        collection: true,
        fulfillment: "DELIVERY_ADDRESS",
        deliveryAddress: "Farm road, Metchosin",
      }),
    );
    expect(b).toMatchObject({ dropoff: true, collection: true, deliveryZone: null, deliveryFeeCents: 0 });
  });
});
