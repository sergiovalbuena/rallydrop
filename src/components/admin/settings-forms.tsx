"use client";

import { useActionState, useEffect, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { saveCourtAction, saveSettingsAction, saveSiteTextsAction, type SettingsState } from "@/app/admin/(panel)/settings/actions";

function useToast(state: SettingsState) {
  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.message) toast.success(state.message);
  }, [state]);
}

function F({ label, hint, children, className = "" }: { label: string; hint?: string; children: ReactNode; className?: string }) {
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

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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
  freeDeliveryCenterLat: number;
  freeDeliveryCenterLng: number;
  freeDeliveryRadiusKm: number;
  seasonStartMonth: number;
  seasonEndMonth: number;
  allowOffSeason: boolean;
  smsEnabled: boolean;
  contactEmail: string;
  contactPhone: string;
};

export function SettingsForm({ s }: { s: S }) {
  const [state, action, pending] = useActionState(saveSettingsAction, { ok: false });
  useToast(state);
  return (
    <form action={action} className="space-y-8">
      <fieldset className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <legend className="mb-3 font-semibold">Taxes</legend>
        <F label="GST %" hint="Confirm rates with your accountant.">
          <Input name="gstPercent" type="number" step="0.01" defaultValue={s.gstPercent} />
        </F>
        <F label="PST %" hint="Confirm whether PST applies to rentals.">
          <Input name="pstPercent" type="number" step="0.01" defaultValue={s.pstPercent} />
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
        <F label="Free zone radius (km)">
          <Input name="freeDeliveryRadiusKm" type="number" step="0.1" defaultValue={s.freeDeliveryRadiusKm} />
        </F>
        <div className="grid grid-cols-2 gap-2">
          <F label="Centre lat">
            <Input name="freeDeliveryCenterLat" type="number" step="0.000001" defaultValue={s.freeDeliveryCenterLat} />
          </F>
          <F label="Centre lng">
            <Input name="freeDeliveryCenterLng" type="number" step="0.000001" defaultValue={s.freeDeliveryCenterLng} />
          </F>
        </div>
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <legend className="mb-3 font-semibold">Season & contact</legend>
        <F label="High season from">
          <NativeSelect name="seasonStartMonth" defaultValue={s.seasonStartMonth}>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </NativeSelect>
        </F>
        <F label="High season to">
          <NativeSelect name="seasonEndMonth" defaultValue={s.seasonEndMonth}>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </NativeSelect>
        </F>
        <F label="Contact email">
          <Input name="contactEmail" type="email" defaultValue={s.contactEmail} />
        </F>
        <F label="Contact phone">
          <Input name="contactPhone" defaultValue={s.contactPhone} />
        </F>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="allowOffSeason" defaultChecked={s.allowOffSeason} className="size-4 accent-primary" />
          Accept bookings outside the season (use “Block days” for rainy days)
        </label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="smsEnabled" defaultChecked={s.smsEnabled} className="size-4 accent-primary" />
          Send SMS (requires Twilio keys)
        </label>
      </fieldset>
      <Button type="submit" disabled={pending}>
        Save settings
      </Button>
    </form>
  );
}

export function CourtRow({ court }: { court: { id: string; name: string; address: string; lat: number; lng: number; active: boolean } | null }) {
  const [state, action, pending] = useActionState(saveCourtAction, { ok: false });
  useToast(state);
  return (
    <form action={action} className="grid items-end gap-2 rounded-lg border p-3 md:grid-cols-[1.2fr_1.5fr_110px_110px_auto_auto]">
      <input type="hidden" name="id" value={court?.id ?? ""} />
      <F label={court ? "Court" : "New court"}>
        <Input name="name" defaultValue={court?.name} required />
      </F>
      <F label="Address">
        <Input name="address" defaultValue={court?.address} required />
      </F>
      <F label="Lat">
        <Input name="lat" type="number" step="0.000001" defaultValue={court?.lat} required />
      </F>
      <F label="Lng">
        <Input name="lng" type="number" step="0.000001" defaultValue={court?.lng} required />
      </F>
      <label className="flex items-center gap-2 pb-3 text-sm">
        <input type="checkbox" name="active" defaultChecked={court?.active ?? true} className="size-4 accent-primary" /> Active
      </label>
      <Button type="submit" variant="outline" disabled={pending}>
        {court ? "Save" : "Add"}
      </Button>
    </form>
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
