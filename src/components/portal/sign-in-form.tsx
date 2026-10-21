"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { KeyRound, Mail } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
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
    <div className="mx-auto grid max-w-4xl overflow-hidden rounded-3xl border bg-card shadow-sm md:grid-cols-[1fr_1.1fr]">
      <div className="court-lines floodlight grain hidden flex-col justify-between bg-court p-8 text-white md:flex">
        <LogoMark className="size-14" />
        <div>
          <p className="font-display text-5xl leading-[0.9] font-black uppercase">
            {t("asideTitleA")}
            <br />
            <span className="text-optic">{t("asideTitleB")}</span>
          </p>
          <p className="mt-4 text-sm text-white/75">{t("asideBody")}</p>
        </div>
      </div>
      <div className="p-6 sm:p-10">
        <h1 className="font-display text-4xl font-black uppercase sm:text-5xl">{t("signInTitle")}</h1>
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
        <p className="mt-6 text-xs text-muted-foreground">{t("noBooking")}</p>
      </div>
    </div>
  );
}
