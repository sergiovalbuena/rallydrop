"use client";

import { useActionState, useEffect, type ReactNode } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveAddOnAction, saveProductAction, type SaveState } from "@/app/admin/(panel)/products/actions";

function useToast(state: SaveState) {
  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.message) toast.success(state.message);
  }, [state]);
}

function F({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`space-y-1.5 ${className}`}>
      <Label asChild>
        <span>{label}</span>
      </Label>
      {children}
    </label>
  );
}

export function ProductRow({
  product: p,
}: {
  product: {
    id: string;
    kind: string;
    name: string;
    description: string;
    price: string;
    offSeasonPrice: string;
    active: boolean;
    durationHours: number | null;
    sessionsPerMonth: number | null;
    sessionMinutes: number | null;
    allowedStarts: string;
    startsHint: string;
  };
}) {
  const [state, action, pending] = useActionState(saveProductAction, { ok: false });
  useToast(state);
  const rental = ["DAY", "WEEKEND", "WEEK", "MONTH"].includes(p.kind);
  return (
    <form action={action} className="grid gap-3 rounded-lg border p-4 md:grid-cols-6">
      <input type="hidden" name="id" value={p.id} />
      <div className="md:col-span-6">
        <Badge variant="secondary">{p.kind.replace("_", " ").toLowerCase()}</Badge>
      </div>
      <F label="Name" className="md:col-span-2">
        <Input name="name" defaultValue={p.name} />
      </F>
      <F label={rental ? "High-season price (CAD)" : "Price (CAD)"}>
        <Input name="price" defaultValue={p.price} inputMode="decimal" />
      </F>
      {rental && (
        <F label="Off-season price (CAD)">
          <Input name="offSeasonPrice" defaultValue={p.offSeasonPrice} inputMode="decimal" placeholder="Same" />
        </F>
      )}
      {rental && (
        <F label="Length (hours)">
          <Input name="durationHours" type="number" min={1} defaultValue={p.durationHours ?? undefined} />
        </F>
      )}
      {p.kind === "PACKAGE" && (
        <>
          <F label="Sessions / month">
            <Input name="sessionsPerMonth" type="number" min={1} defaultValue={p.sessionsPerMonth ?? undefined} />
          </F>
          <F label="Minutes / session">
            <Input
              name="sessionMinutes"
              type="number"
              min={30}
              step={15}
              defaultValue={p.sessionMinutes ?? undefined}
            />
          </F>
        </>
      )}
      {rental && (
        <F label="Fixed start times (optional)" className="md:col-span-2">
          <Input name="allowedStarts" defaultValue={p.allowedStarts} placeholder="Sat 09:00, Fri 21:00" />
        </F>
      )}
      <F label="Description" className="md:col-span-4">
        <Input name="description" defaultValue={p.description} />
      </F>
      <label className="flex items-center gap-2 self-end pb-3 text-sm">
        <input type="checkbox" name="active" defaultChecked={p.active} className="size-4 accent-primary" /> Active
      </label>
      <Button type="submit" variant="outline" disabled={pending} className="self-end">
        Save
      </Button>
    </form>
  );
}

export function AddOnRow({
  addOn: a,
}: {
  addOn: { id: string; kind: string; name: string; description: string; price: string; active: boolean };
}) {
  const [state, action, pending] = useActionState(saveAddOnAction, { ok: false });
  useToast(state);
  return (
    <form action={action} className="grid gap-3 rounded-lg border p-4 md:grid-cols-6">
      <input type="hidden" name="id" value={a.id} />
      <F label="Name" className="md:col-span-2">
        <Input name="name" defaultValue={a.name} />
      </F>
      <F label="Price (CAD)">
        <Input name="price" defaultValue={a.price} inputMode="decimal" />
      </F>
      <F label="Description" className="md:col-span-3">
        <Input name="description" defaultValue={a.description} />
      </F>
      <label className="flex items-center gap-2 text-sm md:col-span-5">
        <input type="checkbox" name="active" defaultChecked={a.active} className="size-4 accent-primary" /> Active
      </label>
      <Button type="submit" variant="outline" disabled={pending}>
        Save
      </Button>
    </form>
  );
}
