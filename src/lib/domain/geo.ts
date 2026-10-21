export type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance in km (haversine). */
export function distanceKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Extracts the Forward Sortation Area ("V8W") from a Canadian address. */
export function extractFsa(address: string): string | null {
  const match = address.toUpperCase().match(/\b([A-Z]\d[A-Z])\s?\d[A-Z]\d\b/);
  return match ? match[1] : null;
}

export type DeliveryZoneInput = {
  point: LatLng | null;
  address?: string | null;
  center: LatLng;
  radiusKm: number;
  freeFsas: readonly string[];
};

/**
 * Whether a delivery point is in the free zone. Prefers exact coordinates;
 * falls back to the postal-code area when the address couldn't be geocoded.
 * Returns null when neither is available (we can't tell → charge the fee).
 */
export function isInFreeZone(input: DeliveryZoneInput): boolean | null {
  if (input.point) return distanceKm(input.point, input.center) <= input.radiusKm;
  const fsa = input.address ? extractFsa(input.address) : null;
  if (fsa) return input.freeFsas.includes(fsa);
  return null;
}
