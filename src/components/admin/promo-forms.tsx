"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { createPromoAction, togglePromoAction } from "@/app/admin/(panel)/promo-codes/actions";

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

const KINDS = [
  { value: "DAY", label: "Day" },
  { value: "WEEKEND", label: "Weekend" },
  { value: "WEEK", label: "Week" },
  { value: "MONTH", label: "Month" },
];

export function CreatePromoForm() {
  const [pending, start] = useTransition();
  const [kind, setKind] = useState("PERCENT");

  // Submitted by hand (not `action=`) so a validation error keeps what was typed.
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    start(async () => {
      const r = await createPromoAction({ ok: false }, data);
      if (r.error) return void toast.error(r.error);
      toast.success(r.message);
      form.reset();
    });
  }

  return (
    <form onSubmit={submit} onReset={() => setKind("PERCENT")} className="grid gap-3 md:grid-cols-6">
      <F label="Code" className="md:col-span-2">
        <Input name="code" required placeholder="FIRSTSERVE" className="font-mono uppercase" autoComplete="off" />
      </F>
      <F label="Type">
        <NativeSelect name="kind" defaultValue="PERCENT" onChange={(e) => setKind(e.target.value)}>
          <option value="PERCENT">% off</option>
          <option value="FIXED">$ off</option>
        </NativeSelect>
      </F>
      <F label={kind === "PERCENT" ? "Percent off" : "Amount off (CAD)"}>
        <Input name="value" required inputMode="decimal" placeholder={kind === "PERCENT" ? "15" : "10.00"} />
      </F>
      <F label="Max uses (optional)" className="md:col-span-2">
        <Input name="maxRedemptions" type="number" min={1} placeholder="Unlimited" />
      </F>
      <F label="Starts (optional)" className="md:col-span-2">
        <Input name="startsOn" type="date" />
      </F>
      <F label="Ends, inclusive (optional)" className="md:col-span-2">
        <Input name="endsOn" type="date" />
      </F>
      <F label="Internal note" className="md:col-span-2">
        <Input name="description" placeholder="e.g. Spring flyer" />
      </F>
      <fieldset className="md:col-span-5">
        <legend className="text-sm font-medium">Applies to (none checked = all rentals)</legend>
        <div className="mt-2 flex flex-wrap gap-4">
          {KINDS.map((k) => (
            <label key={k.value} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="productKinds" value={k.value} className="size-4 accent-primary" />
              {k.label}
            </label>
          ))}
        </div>
      </fieldset>
      <Button type="submit" disabled={pending} className="self-end">
        Create code
      </Button>
    </form>
  );
}

export function TogglePromoButton({ id, active }: { id: string; active: boolean }) {
  const [pending, start] = useTransition();
  return (
    <Button variant="outline" size="sm" disabled={pending} onClick={() => start(() => togglePromoAction(id, !active))}>
      {active ? "Deactivate" : "Activate"}
    </Button>
  );
}
