"use client";

import { LocationMap, type LatLng } from "@/components/maps/map";

/** Public map: delivery zone rings + court pins (client-only Leaflet). */
export function ZoneMap({
  center,
  radiiKm,
  courts,
  label,
}: {
  center: LatLng;
  radiiKm: number[];
  courts: (LatLng & { label: string })[];
  label: string;
}) {
  return (
    <LocationMap
      label={label}
      center={center}
      zoom={11}
      zones={{ center, radiiKm }}
      markers={courts}
      className="h-80 overflow-hidden rounded-2xl border sm:h-[28rem]"
    />
  );
}
