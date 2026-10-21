"use client";

import { LocationMap, type LatLng } from "@/components/maps/map";

/** Public map: free-delivery circle + court pins (client-only Leaflet). */
export function ZoneMap({
  center,
  radiusKm,
  courts,
  label,
}: {
  center: LatLng;
  radiusKm: number;
  courts: (LatLng & { label: string })[];
  label: string;
}) {
  return (
    <LocationMap
      label={label}
      center={center}
      zoom={12}
      circle={{ center, radiusKm }}
      markers={courts}
      className="h-80 overflow-hidden rounded-2xl border sm:h-[28rem]"
    />
  );
}
