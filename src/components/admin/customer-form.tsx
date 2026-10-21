"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateCustomerAction } from "@/app/admin/(panel)/customers/actions";

export function CustomerForm({ id, notes, trusted, blocked }: { id: string; notes: string; trusted: boolean; blocked: boolean }) {
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
        <input type="checkbox" name="trusted" defaultChecked={trusted} className="size-4 accent-primary" /> Trusted customer
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="blocked" defaultChecked={blocked} className="size-4 accent-primary" /> Blocked (can&apos;t book online)
      </label>
      <Button type="submit" disabled={pending}>
        Save
      </Button>
    </form>
  );
}
