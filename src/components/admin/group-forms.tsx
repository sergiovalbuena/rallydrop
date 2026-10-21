"use client";

import { useActionState, useEffect, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { cancelGroupAction, createGroupAction } from "@/app/admin/(panel)/groups/actions";
import { useAdminAction } from "./use-action";

type Opt = { id: string; name: string };

export function GroupForm({ today, courts, machines }: { today: string; courts: Opt[]; machines: Opt[] }) {
  const [state, action, pending] = useActionState(createGroupAction, { ok: false });
  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.message) toast.success(state.message);
  }, [state]);
  const field = (label: string, el: ReactNode, className = "") => (
    <div className={`space-y-1.5 ${className}`}>
      <Label>{label}</Label>
      {el}
    </div>
  );
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      {field("Title", <Input name="title" defaultValue="Groundstroke rally clinic" required />, "sm:col-span-2")}
      {field("Description", <Input name="description" placeholder="Machine-fed drills with a coach" />, "sm:col-span-2")}
      {field("Date", <Input type="date" name="date" defaultValue={today} required />)}
      {field("Start time", <Input type="time" name="time" defaultValue="18:00" required />)}
      {field("Length (min)", <Input type="number" name="minutes" defaultValue={60} min={30} max={240} />)}
      {field("Capacity", <Input type="number" name="capacity" defaultValue={6} min={1} max={20} />)}
      {field("Price per person (CAD)", <Input name="price" defaultValue="20.00" inputMode="decimal" />)}
      {field(
        "Level",
        <NativeSelect name="level" defaultValue="">
          <option value="">All levels</option>
          <option value="BEGINNER">Beginner</option>
          <option value="INTERMEDIATE">Intermediate</option>
          <option value="ADVANCED">Advanced</option>
          <option value="PRO">Pro</option>
        </NativeSelect>,
      )}
      {field(
        "Court",
        <NativeSelect name="courtId">
          {courts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </NativeSelect>,
      )}
      {field(
        "Machine",
        <NativeSelect name="machineId">
          {machines.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </NativeSelect>,
      )}
      <Button type="submit" disabled={pending} className="sm:col-span-2">
        Create session
      </Button>
    </form>
  );
}

export function GroupCancelButton({ id }: { id: string }) {
  const { run, pending } = useAdminAction();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        window.confirm("Cancel this session and refund all players?") &&
        run(async () => {
          const r = await cancelGroupAction(id);
          return r.ok ? { ok: true, message: r.message } : { ok: false, error: r.error ?? "Failed" };
        })
      }
    >
      Cancel
    </Button>
  );
}
