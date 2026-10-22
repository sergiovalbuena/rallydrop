import { describe, expect, it } from "vitest";
import { distanceKm, extractFsa } from "@/lib/domain/geo";
import {
  DEFAULT_DELIVERY_ZONES,
  parseDeliveryZones,
  resolveDelivery,
  tripFee,
  type DeliveryLegs,
} from "@/lib/domain/delivery";

const hub = { lat: 48.4284, lng: -123.3656 };
const zones = DEFAULT_DELIVERY_ZONES; // 5 km $15/$25 · 12 km $25/$40 · 20 km $35/$60
const round: DeliveryLegs = { dropoff: true, collection: true };
const dropoff: DeliveryLegs = { dropoff: true, collection: false };
const none: DeliveryLegs = { dropoff: false, collection: false };
const base = { hub, zones, zone1Fsas: ["V8W", "V8V"] };

describe("geo", () => {
  it("measures distances", () => {
    // Downtown Victoria → Oak Bay village ≈ 3.5 km
    expect(distanceKm(hub, { lat: 48.4265, lng: -123.3172 })).toBeCloseTo(3.6, 0);
  });

  it("extracts FSAs with or without a space", () => {
    expect(extractFsa("v8w1h2")).toBe("V8W");
    expect(extractFsa("Victoria, V8V 4A1")).toBe("V8V");
  });
});

describe("drop-off & collection pricing", () => {
  it("is free when we make no trips (self-serve)", () => {
    expect(resolveDelivery({ ...base, legs: none, point: null })).toEqual({ status: "none" });
  });

  it("prices one trip and the cheaper round trip per zone", () => {
    expect(tripFee(dropoff, zones[0])).toBe(1500);
    expect(tripFee({ dropoff: false, collection: true }, zones[0])).toBe(1500);
    expect(tripFee(round, zones[0])).toBe(2500);
    expect(tripFee(round, zones[0])).toBeLessThan(2 * tripFee(dropoff, zones[0]));
  });

  it("picks the zone from the distance to the hub", () => {
    // Beacon Hill Park ≈ 1.8 km
    expect(resolveDelivery({ ...base, legs: round, point: { lat: 48.4126, lng: -123.3646 } })).toMatchObject({
      status: "ok",
      zone: 1,
      feeCents: 2500,
    });
    // Langford ≈ 10.5 km → zone 2
    expect(resolveDelivery({ ...base, legs: dropoff, point: { lat: 48.4496, lng: -123.5045 } })).toMatchObject({
      status: "ok",
      zone: 2,
      feeCents: 2500,
    });
    // Sidney ≈ 24 km → outside
    expect(resolveDelivery({ ...base, legs: round, point: { lat: 48.6502, lng: -123.3987 } })).toMatchObject({
      status: "out_of_area",
    });
  });

  it("falls back to a downtown postal code, otherwise asks for the address", () => {
    expect(resolveDelivery({ ...base, legs: round, point: null, address: "123 Fort St V8W 1H2" })).toEqual({
      status: "ok",
      zone: 1,
      distanceKm: null,
      feeCents: 2500,
    });
    expect(resolveDelivery({ ...base, legs: round, point: null, address: "Langford V9B 3K5" })).toEqual({
      status: "unknown",
    });
    expect(resolveDelivery({ ...base, legs: round, point: null, address: "no postal code" })).toEqual({
      status: "unknown",
    });
  });

  it("reads the zone table defensively", () => {
    expect(parseDeliveryZones(null)).toEqual(DEFAULT_DELIVERY_ZONES);
    expect(
      parseDeliveryZones([
        { maxKm: 10, tripCents: 2000, roundTripCents: 3000 },
        { maxKm: 4, tripCents: 1000, roundTripCents: 1800 },
        { maxKm: "x" },
      ]).map((z) => z.maxKm),
    ).toEqual([4, 10]);
  });
});
