"use client";

import { useActionState, useEffect, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { addMaintenanceAction, saveMachineAction, type FormState } from "@/app/admin/(panel)/machines/actions";
import type { PublicMachine } from "@/lib/services/catalog";

function useToast(state: FormState) {
  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.message) toast.success(state.message);
  }, [state]);
}

export function MachineForm({ machine }: { machine: PublicMachine | null }) {
  const [state, action, pending] = useActionState(saveMachineAction, { ok: false });
  useToast(state);
  const m = machine;
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      {m && <input type="hidden" name="id" value={m.id} />}
      <F label="Name" htmlFor="name">
        <Input id="name" name="name" defaultValue={m?.name} required />
      </F>
      <F label="Slug (URL)" htmlFor="slug">
        <Input id="slug" name="slug" defaultValue={m?.slug} pattern="[a-z0-9-]+" required />
      </F>
      <F label="Model" htmlFor="model">
        <Input id="model" name="model" defaultValue={m?.model} required />
      </F>
      <F label="Status" htmlFor="status">
        <NativeSelect id="status" name="status" defaultValue={m?.status ?? "AVAILABLE"}>
          <option value="AVAILABLE">Available</option>
          <option value="RENTED">Rented</option>
          <option value="MAINTENANCE">Maintenance (not bookable)</option>
          <option value="RETIRED">Retired (hidden)</option>
        </NativeSelect>
      </F>
      <F label="Description" htmlFor="description" className="sm:col-span-2">
        <Textarea id="description" name="description" defaultValue={m?.description ?? ""} />
      </F>
      <F label="Weight (kg)" htmlFor="weightKg">
        <Input id="weightKg" name="weightKg" inputMode="decimal" defaultValue={m?.weightKg ?? ""} />
      </F>
      <F label="Max speed (km/h)" htmlFor="maxSpeedKmh">
        <Input id="maxSpeedKmh" name="maxSpeedKmh" inputMode="numeric" defaultValue={m?.maxSpeedKmh ?? ""} />
      </F>
      <F label="Ball capacity" htmlFor="ballCapacity">
        <Input id="ballCapacity" name="ballCapacity" inputMode="numeric" defaultValue={m?.ballCapacity ?? ""} />
      </F>
      <F label="Battery (hours)" htmlFor="batteryHours">
        <Input id="batteryHours" name="batteryHours" inputMode="decimal" defaultValue={m?.batteryHours ?? ""} />
      </F>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Sports</legend>
        {(["TENNIS", "PICKLEBALL"] as const).map((s) => (
          <label key={s} className="mr-4 inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="sports"
              value={s}
              defaultChecked={m?.sports.includes(s) ?? s === "TENNIS"}
              className="size-4 accent-primary"
            />
            {s.toLowerCase()}
          </label>
        ))}
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Levels</legend>
        {(["BEGINNER", "INTERMEDIATE", "ADVANCED", "PRO"] as const).map((l) => (
          <label key={l} className="mr-4 inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="levels"
              value={l}
              defaultChecked={m?.levels.includes(l)}
              className="size-4 accent-primary"
            />
            {l.toLowerCase()}
          </label>
        ))}
      </fieldset>
      <F label="Extra specs (one “Label: value” per line)" htmlFor="specs" className="sm:col-span-2">
        <Textarea id="specs" name="specs" defaultValue={m?.specs.map((s) => `${s.label}: ${s.value}`).join("\n")} />
      </F>
      <F label="Card hold, up to 6 days (CAD)" htmlFor="deposit">
        <Input
          id="deposit"
          name="deposit"
          inputMode="decimal"
          defaultValue={((m?.depositCents ?? 40000) / 100).toFixed(2)}
        />
      </F>
      <F label="Saved-card deposit, week & month (CAD)" htmlFor="depositLong">
        <Input
          id="depositLong"
          name="depositLong"
          inputMode="decimal"
          defaultValue={((m?.depositLongCents ?? 60000) / 100).toFixed(2)}
        />
      </F>
      <F label="Purchase cost (CAD, for payback)" htmlFor="purchaseCost">
        <Input
          id="purchaseCost"
          name="purchaseCost"
          inputMode="decimal"
          defaultValue={m?.purchaseCostCents != null ? (m.purchaseCostCents / 100).toFixed(2) : ""}
        />
      </F>
      <F label="Calendar colour" htmlFor="calendarColor">
        <Input
          id="calendarColor"
          name="calendarColor"
          type="color"
          defaultValue={m?.calendarColor ?? "#2563eb"}
          className="h-11 p-1"
        />
      </F>
      <F label="Photo" htmlFor="image">
        <Input id="image" name="image" type="file" accept="image/*" />
      </F>
      <F label="…or image URL" htmlFor="imageUrl">
        <Input id="imageUrl" name="imageUrl" type="url" defaultValue={m?.imageUrl ?? ""} />
      </F>
      <F label="Sort order" htmlFor="sortOrder">
        <Input id="sortOrder" name="sortOrder" type="number" defaultValue={m?.sortOrder ?? 0} />
      </F>
      <label className="flex items-center gap-2 self-end pb-3 text-sm">
        <input type="checkbox" name="bookable" defaultChecked={m?.bookable ?? true} className="size-4 accent-primary" />
        Bookable online (off = “Coming soon”)
      </label>
      <label className="flex items-center gap-2 self-end pb-3 text-sm">
        <input type="checkbox" name="isPublic" defaultChecked={m?.isPublic ?? true} className="size-4 accent-primary" />
        Public (off = hidden everywhere on the site)
      </label>
      <label className="flex items-center gap-2 self-end pb-3 text-sm">
        <input type="checkbox" name="aiCoach" defaultChecked={m?.aiCoach ?? false} className="size-4 accent-primary" />
        Includes the AI coach (shown on the site)
      </label>
      <Button type="submit" disabled={pending} className="sm:col-span-2">
        Save machine
      </Button>
    </form>
  );
}

export function MaintenanceForm({ machineId, today }: { machineId: string; today: string }) {
  const [state, action, pending] = useActionState(addMaintenanceAction, { ok: false });
  useToast(state);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[140px_1fr]">
      <input type="hidden" name="machineId" value={machineId} />
      <F label="Date" htmlFor="m-date">
        <Input id="m-date" name="date" type="date" defaultValue={today} required />
      </F>
      <F label="Summary" htmlFor="m-summary">
        <Input id="m-summary" name="summary" placeholder="Replaced feed wheel" required />
      </F>
      <F label="Cost (CAD)" htmlFor="m-cost">
        <Input id="m-cost" name="cost" inputMode="decimal" />
      </F>
      <F label="Notes" htmlFor="m-notes">
        <Input id="m-notes" name="notes" />
      </F>
      <Button type="submit" variant="outline" disabled={pending} className="sm:col-span-2">
        Log maintenance
      </Button>
    </form>
  );
}

function F({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
