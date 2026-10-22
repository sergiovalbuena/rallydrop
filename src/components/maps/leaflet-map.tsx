"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";
import { Circle, MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import type { MapProps } from "./map";

// Brand pins as HTML (avoids Leaflet's default image icons, which break with bundlers).
function pin(color: string, big = false) {
  const size = big ? 30 : 22;
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:50%;background:#D9F23F;border:3px solid ${color};box-shadow:0 2px 6px rgb(0 0 0 / .35)"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function ClickToPick({ onPick }: { onPick?: (p: { lat: number; lng: number }) => void }) {
  useMapEvents({
    click(e) {
      onPick?.({ lat: Number(e.latlng.lat.toFixed(6)), lng: Number(e.latlng.lng.toFixed(6)) });
    },
  });
  return null;
}

/** Keeps the view on the picked point when it changes from outside (e.g. "Find address"). */
function Follow({ point }: { point?: { lat: number; lng: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (point) map.setView([point.lat, point.lng], Math.max(map.getZoom(), 15));
  }, [map, point]);
  return null;
}

export default function LeafletMap({ center, zoom = 12, markers = [], zones, picker, className, label }: MapProps) {
  return (
    <div className={className} role="region" aria-label={label}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        scrollWheelZoom={false}
        className="size-full rounded-xl"
        style={{ zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {/* Outer rings first so the inner (cheaper) zones sit on top. */}
        {zones?.radiiKm
          .map((km, i) => ({ km, i }))
          .reverse()
          .map(({ km, i }) => (
            <Circle
              key={km}
              center={[zones.center.lat, zones.center.lng]}
              radius={km * 1000}
              pathOptions={{
                color: "#2457E6",
                weight: 2,
                dashArray: i === 0 ? undefined : "6 6",
                fillColor: "#D9F23F",
                fillOpacity: i === 0 ? 0.22 : 0.08,
              }}
            />
          ))}
        {markers.map((m) => (
          <Marker
            key={`${m.lat},${m.lng},${m.label}`}
            position={[m.lat, m.lng]}
            icon={pin(m.color ?? "#0E2350")}
            title={m.label}
          >
            <Tooltip direction="top" offset={[0, -10]}>
              {m.label}
            </Tooltip>
          </Marker>
        ))}
        {picker && (
          <>
            {picker.point && (
              <Marker
                position={[picker.point.lat, picker.point.lng]}
                icon={pin("#E11D48", true)}
                title="Court location — drag to adjust"
                draggable
                eventHandlers={{
                  dragend: (e) => {
                    const ll = (e.target as L.Marker).getLatLng();
                    picker.onChange({ lat: Number(ll.lat.toFixed(6)), lng: Number(ll.lng.toFixed(6)) });
                  },
                }}
              />
            )}
            <ClickToPick onPick={picker.onChange} />
            <Follow point={picker.point} />
          </>
        )}
      </MapContainer>
    </div>
  );
}
