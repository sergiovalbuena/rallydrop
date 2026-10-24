"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { CircleCheck, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { sendContactAction, type ContactState } from "@/app/(site)/_actions/contact";

/** Name, email or phone, message — emailed to the owner. Works without JavaScript too. */
export function ContactForm() {
  const t = useTranslations("contact");
  const [state, action, pending] = useActionState<ContactState, FormData>(sendContactAction, { status: "idle" });

  if (state.status === "done") {
    return (
      <p className="flex items-center gap-2 rounded-2xl border bg-card p-6 font-medium text-success" role="status">
        <CircleCheck className="size-5 shrink-0" aria-hidden /> {t("sent")}
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4 rounded-2xl border bg-card p-6">
      <h2 className="font-display text-2xl font-extrabold uppercase">{t("formTitle")}</h2>
      {/* honeypot */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="contact-name">{t("name")}</Label>
          <Input
            id="contact-name"
            name="name"
            autoComplete="name"
            required
            maxLength={80}
            defaultValue={state.values?.name}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact-reach">{t("reach")}</Label>
          <Input
            id="contact-reach"
            name="contact"
            autoComplete="email"
            required
            maxLength={120}
            defaultValue={state.values?.contact}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="contact-message">{t("message")}</Label>
        <Textarea
          id="contact-message"
          name="message"
          rows={5}
          required
          maxLength={4000}
          defaultValue={state.values?.message}
        />
      </div>
      {state.status === "error" && (
        <p className="text-sm text-destructive" role="alert">
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        <Send /> {pending ? t("sending") : t("send")}
      </Button>
    </form>
  );
}
