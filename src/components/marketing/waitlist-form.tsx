"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { BellRing, CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { joinWaitlistAction, type WaitlistState } from "@/app/(site)/_actions/waitlist";

/** "Notify me" email capture for a machine that isn't bookable yet. */
export function WaitlistForm({
  machineId,
  machineName,
  source,
}: {
  machineId: string;
  machineName: string;
  source: string;
}) {
  const t = useTranslations("waitlist");
  const [state, action, pending] = useActionState<WaitlistState, FormData>(joinWaitlistAction, { status: "idle" });
  const id = `waitlist-${machineId}`;

  if (state.status === "done") {
    return (
      <p className="flex items-center gap-2 text-sm font-medium text-success" role="status">
        <CircleCheck className="size-5 shrink-0" aria-hidden />
        {state.message === "already" ? t("already", { name: machineName }) : t("done", { name: machineName })}
      </p>
    );
  }

  return (
    <form action={action} className="space-y-2" noValidate>
      <input type="hidden" name="machineId" value={machineId} />
      <input type="hidden" name="source" value={source} />
      {/* honeypot */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <label htmlFor={id} className="sr-only">
        {t("label", { name: machineName })}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id={id}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          placeholder={t("placeholder")}
          aria-invalid={state.status === "error"}
          aria-describedby={`${id}-help`}
          className="sm:max-w-xs"
        />
        <Button type="submit" disabled={pending}>
          <BellRing /> {pending ? t("sending") : t("cta")}
        </Button>
      </div>
      <p
        id={`${id}-help`}
        className={state.status === "error" ? "text-sm text-destructive" : "text-xs text-muted-foreground"}
      >
        {state.status === "error" ? state.message : t("consent")}
      </p>
    </form>
  );
}
