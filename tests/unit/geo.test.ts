import { describe, expect, it } from "vitest";
import { distanceKm, extractFsa, isInFreeZone } from "@/lib/domain/geo";

const downtown = { lat: 48.4284, lng: -123.3656 };
const zone = { center: downtown, radiusKm: 5, freeFsas: ["V8W", "V8V"] };

describe("delivery zone", () => {
  it("measures distances", () => {
    // Downtown Victoria → Oak Bay village ≈ 3.5 km
    expect(distanceKm(downtown, { lat: 48.4265, lng: -123.3172 })).toBeCloseTo(3.6, 0);
  });

  it("uses coordinates when available", () => {
    expect(isInFreeZone({ ...zone, point: { lat: 48.4125, lng: -123.364 } })).toBe(true);
    // Langford is ~13 km away
    expect(isInFreeZone({ ...zone, point: { lat: 48.4496, lng: -123.5045 } })).toBe(false);
  });

  it("falls back to the postal code area", () => {
    expect(isInFreeZone({ ...zone, point: null, address: "123 Fort St, Victoria BC V8W 1H2" })).toBe(true);
    expect(isInFreeZone({ ...zone, point: null, address: "Langford V9B 3K5" })).toBe(false);
    expect(isInFreeZone({ ...zone, point: null, address: "no postal code" })).toBeNull();
  });

  it("extracts FSAs with or without a space", () => {
    expect(extractFsa("v8w1h2")).toBe("V8W");
    expect(extractFsa("Victoria, V8V 4A1")).toBe("V8V");
  });
});
