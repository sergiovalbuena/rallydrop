"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import { MapPin } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LocationMap, type LatLng } from "@/components/maps/map";
import {
  geocodeAction,
  saveCourtAction,
  saveSettingsAction,
  saveSiteTextsAction,
  type SettingsState,
} from "@/app/admin/(panel)/settings/actions";

function useToast(state: SettingsState) {
  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.message) toast.success(state.message);
  }, [state]);
}

function F({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block space-y-1.5 ${className}`}>
      <Label asChild>
        <span>{label}</span>
      </Label>
      {children}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

type S = {
  gstPercent: number;
  pstPercent: number;
  bufferMinutes: number;
  holdMinutes: number;
  minLeadTimeHours: number;
  maxAdvanceDays: number;
  depositAuthMaxDays: number;
  depositAuthLeadHours: number;
  cancelFullRefundHours: number;
  cancelLatePercent: number;
  deliveryStart: string;
  deliveryEnd: string;
  deliveryHubLat: number;
  deliveryHubLng: number;
  /** One row per zone, dollars. */
  zones: { maxKm: number; trip: string; roundTrip: string }[];
  seasonStart: string;
  seasonEnd: string;
  allowOffSeason: boolean;
  highSeasonMonthCap: string;
  smsEnabled: boolean;
  contactEmail: string;
  contactPhone: string;
  siteDomain: string;
  hubAddress: string;
  instagramUrl: string;
  chargeGst: boolean;
  chargePst: boolean;
  gstNumber: string;
  pstNumber: string;
  insuranceProvider: string;
  insurancePolicyNumber: string;
  insuranceCoverage: string;
  businessLicenceNumber: string;
  businessLicenceMunicipality: string;
  careEnabled: boolean;
  careShort: string;
  careWeek: string;
  careMonth: string;
  careCap: string;
};

export function SettingsForm({ s }: { s: S }) {
  const [state, action, pending] = useActionState(saveSettingsAction, { ok: false });
  useToast(state);
  return (
    <form action={action} className="space-y-8">
      <fieldset className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <legend className="mb-1 font-semibold">Taxes</legend>
        <p className="text-sm text-muted-foreground sm:col-span-2 lg:col-span-4">
          Off until you&apos;re registered: a tax is only charged when it&apos;s switched on <em>and</em> its
          registration number is saved. Confirm with your accountant when you must register.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="chargeGst" defaultChecked={s.chargeGst} className="size-4 accent-primary" />
          Charge GST
        </label>
        <F label="GST %">
          <Input name="gstPercent" type="number" step="0.01" defaultValue={s.gstPercent} />
        </F>
        <F label="GST number" className="sm:col-span-2">
          <Input name="gstNumber" defaultValue={s.gstNumber} placeholder="123456789 RT0001" />
        </F>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="chargePst" defaultChecked={s.chargePst} className="size-4 accent-primary" />
          Charge PST
        </label>
        <F label="PST %">
          <Input name="pstPercent" type="number" step="0.01" defaultValue={s.pstPercent} />
        </F>
        <F label="PST number" className="sm:col-span-2">
          <Input name="pstNumber" defaultValue={s.pstNumber} placeholder="PST-1234-5678" />
        </F>
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <legend className="mb-1 font-semibold">RallyDrop Care (damage protection)</legend>
        <label className="flex items-center gap-2 text-sm sm:col-span-2 lg:col-span-4">
          <input type="checkbox" name="careEnabled" defaultChecked={s.careEnabled} className="size-4 accent-primary" />
          Offer RallyDrop Care at checkout
        </label>
        <F label="Day & weekend (CAD)">
          <Input name="careShort" inputMode="decimal" defaultValue={s.careShort} />
        </F>
        <F label="Week (CAD)">
          <Input name="careWeek" inputMode="decimal" defaultValue={s.careWeek} />
        </F>
        <F label="Month (CAD)">
          <Input name="careMonth" inputMode="decimal" defaultValue={s.careMonth} />
        </F>
        <F label="Most a Care customer pays (CAD)" hint="For accidental damage">
          <Input name="careCap" inputMode="decimal" defaultValue={s.careCap} />
        </F>
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <legend className="mb-3 font-semibold">Booking rules</legend>
        <F label="Buffer between rentals (min)" hint="Charging + cleaning">
          <Input name="bufferMinutes" type="number" defaultValue={s.bufferMinutes} />
        </F>
        <F label="Payment hold (min)">
          <Input name="holdMinutes" type="number" defaultValue={s.holdMinutes} />
        </F>
        <F label="Minimum notice (hours)">
          <Input name="minLeadTimeHours" type="number" defaultValue={s.minLeadTimeHours} />
        </F>
        <F label="Book up to (days ahead)">
          <Input name="maxAdvanceDays" type="number" defaultValue={s.maxAdvanceDays} />
        </F>
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <legend className="mb-3 font-semibold">Deposit & cancellation</legend>
        <F label="Card hold for rentals up to (days)" hint="Longer rentals: card saved instead (max 6).">
          <Input name="depositAuthMaxDays" type="number" min={1} max={6} defaultValue={s.depositAuthMaxDays} />
        </F>
        <F label="Place hold … hours before start">
          <Input name="depositAuthLeadHours" type="number" defaultValue={s.depositAuthLeadHours} />
        </F>
        <F label="Full refund if cancelled ≥ (hours)">
          <Input name="cancelFullRefundHours" type="number" defaultValue={s.cancelFullRefundHours} />
        </F>
        <F label="Late cancellation refund %">
          <Input name="cancelLatePercent" type="number" step="1" defaultValue={s.cancelLatePercent} />
        </F>
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <legend className="mb-3 font-semibold">Delivery</legend>
        <F label="Delivery hours from">
          <Input name="deliveryStart" type="time" defaultValue={s.deliveryStart} />
        </F>
        <F label="Delivery hours to">
          <Input name="deliveryEnd" type="time" defaultValue={s.deliveryEnd} />
        </F>
        <div className="grid grid-cols-2 gap-2 sm:col-span-2">
          <F label="Hub lat" hint="Trips are measured from here">
            <Input name="deliveryHubLat" type="number" step="0.000001" defaultValue={s.deliveryHubLat} />
          </F>
          <F label="Hub lng">
            <Input name="deliveryHubLng" type="number" step="0.000001" defaultValue={s.deliveryHubLng} />
          </F>
        </div>
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="mb-1 font-semibold">Drop-off & collection prices (CAD, before tax)</legend>
        <p className="text-sm text-muted-foreground">
          Priced per trip by straight-line distance from the hub. A round trip (drop-off + collection) should cost less
          than two single trips. Leave a zone&apos;s distance empty to remove it; beyond the last zone customers can
          only choose self-serve online.
        </p>
        {[0, 1, 2, 3].map((i) => {
          const z = s.zones[i];
          return (
            <div key={i} className="grid grid-cols-[auto_1fr_1fr_1fr] items-end gap-3">
              <span className="pb-2.5 font-display text-lg font-bold">Zone {i + 1}</span>
              <F label="Up to (km)">
                <Input name={`zone${i}Km`} type="number" step="0.5" min={0} defaultValue={z?.maxKm} />
              </F>
              <F label="One trip">
                <Input name={`zone${i}Trip`} inputMode="decimal" defaultValue={z?.trip} />
              </F>
              <F label="Round trip">
                <Input name={`zone${i}Round`} inputMode="decimal" defaultValue={z?.roundTrip} />
              </F>
            </div>
          );
        })}
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <legend className="mb-3 font-semibold">Seasons</legend>
        <F label="High season starts (MM-DD)" hint="High-season prices from this date">
          <Input name="seasonStart" defaultValue={s.seasonStart} placeholder="04-01" pattern="\d{2}-\d{2}" />
        </F>
        <F label="High season ends (MM-DD)" hint="Inclusive; off-season prices after">
          <Input name="seasonEnd" defaultValue={s.seasonEnd} placeholder="09-30" pattern="\d{2}-\d{2}" />
        </F>
        <F label="Month rentals per month in high season" hint="Blank = no limit, 0 = not offered">
          <Input name="highSeasonMonthCap" type="number" min={0} defaultValue={s.highSeasonMonthCap} />
        </F>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            name="allowOffSeason"
            defaultChecked={s.allowOffSeason}
            className="size-4 accent-primary"
          />
          Accept bookings outside the season (use “Block days” for rainy days)
        </label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="smsEnabled" defaultChecked={s.smsEnabled} className="size-4 accent-primary" />
          Send SMS (requires Twilio keys)
        </label>
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <legend className="mb-1 font-semibold">Business details (shown on the site)</legend>
        <p className="text-sm text-muted-foreground sm:col-span-2 lg:col-span-4">
          Leave a field empty to hide it everywhere on the site.
        </p>
        <F label="Contact email">
          <Input name="contactEmail" type="email" defaultValue={s.contactEmail} />
        </F>
        <F label="Contact phone">
          <Input name="contactPhone" defaultValue={s.contactPhone} />
        </F>
        <F label="Domain">
          <Input name="siteDomain" defaultValue={s.siteDomain} placeholder="rallydrop.ca" />
        </F>
        <F label="Instagram URL">
          <Input name="instagramUrl" type="url" defaultValue={s.instagramUrl} />
        </F>
        <F label="Pick-up point address" className="sm:col-span-2 lg:col-span-4">
          <Input name="hubAddress" defaultValue={s.hubAddress} placeholder="Shown to self-serve customers" />
        </F>
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <legend className="mb-1 font-semibold">Insurance & licence</legend>
        <p className="text-sm text-muted-foreground sm:col-span-2 lg:col-span-4">
          With an insurance provider saved, the footer and the terms say “RallyDrop carries commercial general liability
          insurance”. The licence number is shown in the footer.
        </p>
        <F label="Insurance provider">
          <Input name="insuranceProvider" defaultValue={s.insuranceProvider} />
        </F>
        <F label="Policy number">
          <Input name="insurancePolicyNumber" defaultValue={s.insurancePolicyNumber} />
        </F>
        <F label="Coverage (CAD)">
          <Input
            name="insuranceCoverage"
            inputMode="decimal"
            defaultValue={s.insuranceCoverage}
            placeholder="2000000"
          />
        </F>
        <div />
        <F label="Business licence #">
          <Input name="businessLicenceNumber" defaultValue={s.businessLicenceNumber} />
        </F>
        <F label="Licence municipality">
          <Input
            name="businessLicenceMunicipality"
            defaultValue={s.businessLicenceMunicipality}
            placeholder="City of Victoria"
          />
        </F>
      </fieldset>
      <Button type="submit" disabled={pending}>
        Save settings
      </Button>
    </form>
  );
}

type Court = { id: string; name: string; address: string; lat: number; lng: number; active: boolean };

export function CourtRow({ court, center }: { court: Court | null; center: LatLng }) {
  const [state, action, pending] = useActionState(saveCourtAction, { ok: false });
  useToast(state);
  const [address, setAddress] = useState(court?.address ?? "");
  const [point, setPoint] = useState<LatLng | null>(court ? { lat: court.lat, lng: court.lng } : null);
  const [showMap, setShowMap] = useState(!court);
  const [finding, setFinding] = useState(false);

  async function find() {
    setFinding(true);
    const r = await geocodeAction(address);
    setFinding(false);
    if (r.ok) {
      setPoint({ lat: r.lat, lng: r.lng });
      setShowMap(true);
    } else toast.error(r.error);
  }

  return (
    <form action={action} className="space-y-3 rounded-lg border p-3">
      <input type="hidden" name="id" value={court?.id ?? ""} />
      <input type="hidden" name="lat" value={point?.lat ?? ""} />
      <input type="hidden" name="lng" value={point?.lng ?? ""} />
      <div className="grid items-end gap-2 md:grid-cols-[1.2fr_1.8fr_auto_auto_auto]">
        <F label={court ? "Court" : "New court"}>
          <Input name="name" defaultValue={court?.name} required />
        </F>
        <F label="Address">
          <Input name="address" value={address} onChange={(e) => setAddress(e.target.value)} required />
        </F>
        <Button type="button" variant="outline" onClick={find} disabled={finding}>
          <MapPin /> {finding ? "Finding…" : "Find on map"}
        </Button>
        <label className="flex items-center gap-2 pb-3 text-sm">
          <input
            type="checkbox"
            name="active"
            defaultChecked={court?.active ?? true}
            className="size-4 accent-primary"
          />{" "}
          Active
        </label>
        <Button type="submit" disabled={pending}>
          {court ? "Save" : "Add"}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>
          {point
            ? `Pin: ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`
            : "No pin yet — it will be located from the address when you save."}
        </span>
        <button type="button" className="text-primary underline" onClick={() => setShowMap((v) => !v)}>
          {showMap ? "Hide map" : "Show map"}
        </button>
      </div>
      {showMap && (
        <LocationMap
          label={`Map to place ${court?.name ?? "the new court"}`}
          center={point ?? center}
          zoom={point ? 15 : 12}
          picker={{ point, onChange: setPoint }}
          className="h-72"
        />
      )}
      {showMap && (
        <p className="text-xs text-muted-foreground">Click on the map or drag the pin to the exact court entrance.</p>
      )}
    </form>
  );
}

export function ZonePreview({
  center,
  radiiKm,
  courts,
}: {
  center: LatLng;
  radiiKm: number[];
  courts: (LatLng & { label: string })[];
}) {
  return (
    <LocationMap
      label="Delivery zones and courts"
      center={center}
      zoom={11}
      zones={{ center, radiiKm }}
      markers={[{ ...center, label: "Delivery hub", color: "#2457E6" }, ...courts]}
      className="h-80"
    />
  );
}

export function SiteTextsForm({
  fields,
}: {
  fields: { key: string; label: string; multiline: boolean; defaultValue: string; value: string | null }[];
}) {
  const [state, action, pending] = useActionState(saveSiteTextsAction, { ok: false });
  useToast(state);
  return (
    <form action={action} className="space-y-5">
      {fields.map((f) => (
        <div key={f.key} className="space-y-1.5">
          <Label htmlFor={f.key}>{f.label}</Label>
          {f.multiline ? (
            <Textarea id={f.key} name={f.key} defaultValue={f.value ?? f.defaultValue} />
          ) : (
            <Input id={f.key} name={f.key} defaultValue={f.value ?? f.defaultValue} />
          )}
          {f.value !== null && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" name={`${f.key}__reset`} className="size-3.5" /> Reset to default
            </label>
          )}
        </div>
      ))}
      <Button type="submit" disabled={pending}>
        Save texts
      </Button>
    </form>
  );
}
