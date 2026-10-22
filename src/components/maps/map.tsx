"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

export type LatLng = { lat: number; lng: number };

export type MapProps = {
  center: LatLng;
  zoom?: number;
  markers?: (LatLng & { label: string; color?: string })[];
  /** Delivery zones: rings around the hub (km, ascending). */
  zones?: { center: LatLng; radiiKm: number[] };
  /** Admin: click or drag to choose a point. */
  picker?: { point: LatLng | null; onChange: (p: LatLng) => void };
  className?: string;
  /** Accessible name for the map region. */
  label: string;
};

/** OpenStreetMap map (Leaflet), loaded only in the browser. */
export const LocationMap = dynamic(() => import("./leaflet-map"), {
  ssr: false,
  loading: () => <Skeleton className="size-full min-h-64 rounded-xl" />,
});
