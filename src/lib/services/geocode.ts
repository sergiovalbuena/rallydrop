import "server-only";
import type { LatLng } from "@/lib/domain/geo";

/**
 * Best-effort geocoding of a delivery address with OpenStreetMap Nominatim
 * (free, no key; fair-use limit of 1 request/second). Returns null on any
 * failure — pricing then falls back to the postal code.
 */
export async function geocodeAddress(address: string): Promise<LatLng | null> {
  const query = /victoria|bc|british columbia/i.test(address) ? address : `${address}, Victoria, BC`;
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "ca");
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "RallyDrop/1.0 (ball machine rentals)", "Accept-Language": "en" },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const results = (await res.json()) as { lat: string; lon: string }[];
    if (!results[0]) return null;
    return { lat: Number(results[0].lat), lng: Number(results[0].lon) };
  } catch {
    return null;
  }
}
