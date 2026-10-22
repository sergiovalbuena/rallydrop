import { distanceKm, extractFsa, type LatLng } from "./geo";

/*
 * Paid drop-off & collection.
 *
 * Model: zone-based flat fees per trip (the pattern most rental and
 * delivery businesses use). Each trip is optional — we bring it at the
 * start, we come back for it at the end, or both — and the round trip is
 * cheaper than two single trips. Zones are rings around the hub measured
 * in straight-line km, so a price is always known before checkout and
 * never surprises anyone after. Self-serve (collect & return at the hub)
 * stays free.
 */

export type DeliveryZone = { maxKm: number; tripCents: number; roundTripCents: number };
export type DeliveryLegs = { dropoff: boolean; collection: boolean };

export const DEFAULT_DELIVERY_ZONES: DeliveryZone[] = [
  { maxKm: 5, tripCents: 1500, roundTripCents: 2500 },
  { maxKm: 12, tripCents: 2500, roundTripCents: 4000 },
  { maxKm: 20, tripCents: 3500, roundTripCents: 6000 },
];

/** Reads the zone table stored as JSON in Settings (ascending maxKm, invalid rows dropped). */
export function parseDeliveryZones(value: unknown): DeliveryZone[] {
  if (!Array.isArray(value)) return DEFAULT_DELIVERY_ZONES;
  const zones = value
    .filter(
      (z): z is DeliveryZone =>
        !!z &&
        typeof z === "object" &&
        typeof (z as DeliveryZone).maxKm === "number" &&
        typeof (z as DeliveryZone).tripCents === "number" &&
        typeof (z as DeliveryZone).roundTripCents === "number" &&
        (z as DeliveryZone).maxKm > 0,
    )
    .sort((a, b) => a.maxKm - b.maxKm);
  return zones.length > 0 ? zones : DEFAULT_DELIVERY_ZONES;
}

export type DeliveryResolution =
  | { status: "none" }
  | { status: "ok"; zone: number; distanceKm: number | null; feeCents: number }
  | { status: "unknown" }
  | { status: "out_of_area"; distanceKm: number };

export function legsCount(legs: DeliveryLegs): number {
  return Number(legs.dropoff) + Number(legs.collection);
}

/** Price of the chosen trips in a zone. */
export function tripFee(legs: DeliveryLegs, zone: DeliveryZone): number {
  const n = legsCount(legs);
  if (n === 2) return zone.roundTripCents;
  return n === 1 ? zone.tripCents : 0;
}

/**
 * Works out the zone and fee for a delivery point. Prefers exact
 * coordinates; if the address couldn't be located, a downtown postal code
 * (FSA) still places it in zone 1. Otherwise the zone is unknown and the
 * customer is asked to check the address or pick a court.
 */
export function resolveDelivery(input: {
  legs: DeliveryLegs;
  point: LatLng | null;
  address?: string | null;
  hub: LatLng;
  zones: DeliveryZone[];
  zone1Fsas: readonly string[];
}): DeliveryResolution {
  if (legsCount(input.legs) === 0) return { status: "none" };
  let km: number | null = null;
  let index: number;
  if (input.point) {
    km = Math.round(distanceKm(input.point, input.hub) * 10) / 10;
    index = input.zones.findIndex((z) => km! <= z.maxKm);
    if (index === -1) return { status: "out_of_area", distanceKm: km };
  } else {
    const fsa = input.address ? extractFsa(input.address) : null;
    if (!fsa || !input.zone1Fsas.includes(fsa)) return { status: "unknown" };
    index = 0;
  }
  return { status: "ok", zone: index + 1, distanceKm: km, feeCents: tripFee(input.legs, input.zones[index]) };
}

/** "Drop-off & collection", "Drop-off", "Collection". */
export function legsLabel(legs: DeliveryLegs): string {
  if (legs.dropoff && legs.collection) return "Drop-off & collection";
  return legs.dropoff ? "Drop-off" : "Collection";
}
