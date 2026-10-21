"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { KeyRound, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestCodeAction, verifyCodeAction } from "@/app/(site)/account/actions";

export function SignInForm({ linkExpired }: { linkExpired?: boolean }) {
  const t = useTranslations("portal");
  const router = useRouter();
  const [contact, setContact] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    linkExpired ? "That sign-in link has expired. Request a new code." : null,
  );

  async function send(e?: FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    const r = await requestCodeAction(contact);
    setBusy(false);
    if (r.ok) setSent(true);
    else setError(r.error);
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await verifyCodeAction(contact, code);
    setBusy(false);
    if (r.ok) router.refresh();
    else setError(r.error);
  }

  return (
    <div className="mx-auto max-w-md rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
      <h1 className="font-display text-4xl font-extrabold uppercase">{t("signInTitle")}</h1>
      <p className="mt-2 text-muted-foreground">{t("signInBody")}</p>
      {!sent ? (
        <form onSubmit={send} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="contact">{t("contactLabel")}</Label>
            <Input
              id="contact"
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              aria-invalid={!!error}
              required
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            <Mail /> {t("sendCode")}
          </Button>
        </form>
      ) : (
        <form onSubmit={verify} className="mt-6 space-y-4">
          <p className="rounded-lg bg-muted p-3 text-sm" role="status">
            {t("codeSent", { contact })} {t("useMagicLink")}
          </p>
          <div className="space-y-2">
            <Label htmlFor="code">{t("codeLabel")}</Label>
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              className="text-center font-display text-3xl tracking-[0.5em]"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              aria-invalid={!!error}
              required
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" className="w-full" disabled={busy || code.length !== 6}>
            <KeyRound /> {t("verify")}
          </Button>
          <Button type="button" variant="link" className="w-full" onClick={() => send()} disabled={busy}>
            {t("resend")}
          </Button>
        </form>
      )}
    </div>
  );
}
