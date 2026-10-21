"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { Lock, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCents } from "@/lib/money";
import type { StartPaymentResult } from "@/app/(site)/book/extra-actions";
import { getStripe, stripeAppearance } from "./stripe-client";

/**
 * Contact details → Stripe Payment Element. Used for monthly packages
 * (subscription invoice) and group session seats.
 */
export function ContactPayFlow({
  targetId,
  start,
  successPath,
  cta,
}: {
  targetId: string;
  start: (input: unknown) => Promise<StartPaymentResult>;
  successPath: string;
  cta: string;
}) {
  const t = useTranslations("book");
  const [contact, setContact] = useState({ name: "", email: "", phone: "" });
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [payment, setPayment] = useState<{ clientSecret: string; amountCents: number } | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await start({ targetId, contact, termsAccepted: terms });
    setBusy(false);
    if (r.ok) {
      setPayment({ clientSecret: r.clientSecret, amountCents: r.amountCents });
      return;
    }
    setError(r.error);
    setErrors(Object.fromEntries(Object.entries(r.fields ?? {}).map(([k, v]) => [k.replace(/^contact\./, ""), v])));
  }

  if (payment) {
    const stripePromise = getStripe();
    if (!stripePromise) {
      return (
        <Alert variant="warning">
          <TriangleAlert />
          <AlertTitle>Stripe isn&apos;t configured</AlertTitle>
          <AlertDescription>Add your Stripe test keys to .env.</AlertDescription>
        </Alert>
      );
    }
    return (
      <Elements stripe={stripePromise} options={{ clientSecret: payment.clientSecret, appearance: stripeAppearance }}>
        <Pay amountCents={payment.amountCents} successPath={successPath} />
      </Elements>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {(["name", "email", "phone"] as const).map((field) => (
        <div key={field} className="space-y-2">
          <Label htmlFor={field}>{t(field)}</Label>
          <Input
            id={field}
            type={field === "email" ? "email" : field === "phone" ? "tel" : "text"}
            autoComplete={field === "phone" ? "tel" : field}
            value={contact[field]}
            aria-invalid={!!errors[field]}
            onChange={(e) => setContact((c) => ({ ...c, [field]: e.target.value }))}
          />
          {errors[field] && <p className="text-sm text-destructive">{errors[field]}</p>}
        </div>
      ))}
      <p className="text-xs text-muted-foreground">{t("contactHint")}</p>
      <label className="flex cursor-pointer items-start gap-3 text-sm">
        <Checkbox checked={terms} onCheckedChange={(v) => setTerms(v === true)} className="mt-0.5" />
        <span>
          {t("terms")}{" "}
          <Link href="/terms" target="_blank" className="text-primary underline">
            {t("termsLink")}
          </Link>
        </span>
      </label>
      {error && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? t("processing") : cta}
      </Button>
    </form>
  );
}

function Pay({ amountCents, successPath }: { amountCents: number; successPath: string }) {
  const t = useTranslations("book");
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    const { error: err } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}${successPath}` },
      redirect: "if_required",
    });
    if (err) {
      setError(err.message ?? "Your card couldn't be charged.");
      setBusy(false);
      return;
    }
    window.location.assign(successPath);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <PaymentElement options={{ layout: "tabs" }} />
      {error && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={!stripe || busy}>
        <Lock /> {busy ? t("processing") : t("payNow", { amount: formatCents(amountCents) })}
      </Button>
      <p className="text-center text-xs text-muted-foreground">{t("secure")}</p>
    </form>
  );
}
