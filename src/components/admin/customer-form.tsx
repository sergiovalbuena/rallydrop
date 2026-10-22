"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { giveCreditAction, updateCustomerAction } from "@/app/admin/(panel)/customers/actions";
import { Input } from "@/components/ui/input";

export function CustomerForm({
  id,
  notes,
  trusted,
  blocked,
}: {
  id: string;
  notes: string;
  trusted: boolean;
  blocked: boolean;
}) {
  const [state, action, pending] = useActionState(updateCustomerAction, { ok: false });
  useEffect(() => {
    if (state.message) toast.success(state.message);
  }, [state]);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <div className="space-y-1.5">
        <Label htmlFor="internalNotes">Internal notes (never shown to the customer)</Label>
        <Textarea id="internalNotes" name="internalNotes" defaultValue={notes} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="trusted" defaultChecked={trusted} className="size-4 accent-primary" /> Trusted
        customer
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="blocked" defaultChecked={blocked} className="size-4 accent-primary" /> Blocked
        (can&apos;t book online)
      </label>
      <Button type="submit" disabled={pending}>
        Save
      </Button>
    </form>
  );
}

export function GiveCreditForm({ id, defaultMonths }: { id: string; defaultMonths: number }) {
  const [state, action, pending] = useActionState(giveCreditAction, { ok: false });
  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.message) toast.success(state.message);
  }, [state]);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="id" value={id} />
      <div className="space-y-1.5">
        <Label htmlFor="credit-amount">Amount (CAD)</Label>
        <Input id="credit-amount" name="amount" inputMode="decimal" placeholder="25.00" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="credit-months">Valid (months)</Label>
        <Input id="credit-months" name="months" type="number" min={1} max={24} defaultValue={defaultMonths} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="credit-note">Reason (internal)</Label>
        <Input id="credit-note" name="note" placeholder="Machine stopped mid-session" />
      </div>
      <Button type="submit" variant="outline" disabled={pending} className="sm:col-span-2">
        Give credit
      </Button>
    </form>
  );
}
