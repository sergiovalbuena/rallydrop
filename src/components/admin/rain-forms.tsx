"use client";

import { useActionState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { declareRainDayAction, removeRainDayAction, type RainState } from "@/app/admin/(panel)/rain/actions";

export function RainDayForm({ today }: { today: string }) {
  const [state, action, pending] = useActionState<RainState, FormData>(declareRainDayAction, { ok: false });
  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.message) toast.success(state.message);
  }, [state]);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[12rem_1fr_auto] sm:items-end">
      <div className="space-y-1.5">
        <Label htmlFor="rain-date">Date</Label>
        <Input id="rain-date" name="date" type="date" defaultValue={today} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="rain-note">Note (internal, optional)</Label>
        <Input id="rain-note" name="note" placeholder="Heavy rain all day" />
      </div>
      <Button type="submit" disabled={pending}>
        Declare rain day
      </Button>
    </form>
  );
}

export function RemoveRainDay({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await removeRainDayAction(id);
          toast.success("Rain day removed.");
        })
      }
    >
      Remove
    </Button>
  );
}
