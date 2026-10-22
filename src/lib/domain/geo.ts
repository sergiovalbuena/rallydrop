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
