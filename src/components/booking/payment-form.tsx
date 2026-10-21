"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { Lock, Timer, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/money";
import { getStripe, stripeAppearance } from "./stripe-client";

type Finalize = (
  id: string,
) => Promise<
  | { status: "confirmed"; code: string; depositClientSecret?: string }
  | { status: "processing"; code: string }
  | { status: "failed"; code: string; message: string }
  | { status: "slot_lost"; code: string }
  | { status: "error"; message: string }
>;

export function PaymentStep(props: {
  clientSecret: string;
  amountCents: number;
  bookingId: string;
  code: string;
  holdExpiresAt: string;
  finalize: Finalize;
  onExpired: () => void;
  confirmationPath: string;
}) {
  const stripePromise = getStripe();
  if (!stripePromise) {
    return (
      <Alert variant="warning">
        <TriangleAlert />
        <AlertTitle>Stripe isn&apos;t configured</AlertTitle>
        <AlertDescription>
          Add <code>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> and <code>STRIPE_SECRET_KEY</code> (test keys) to your
          .env to take payments.
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <Elements stripe={stripePromise} options={{ clientSecret: props.clientSecret, appearance: stripeAppearance }}>
      <PayForm {...props} />
    </Elements>
  );
}

function useCountdown(until: string, onDone: () => void) {
  const [left, setLeft] = useState(() => Math.max(0, new Date(until).getTime() - Date.now()));
  useEffect(() => {
    const id = setInterval(() => {
      const ms = Math.max(0, new Date(until).getTime() - Date.now());
      setLeft(ms);
      if (ms === 0) {
        clearInterval(id);
        onDone();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [until, onDone]);
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function PayForm({
  amountCents,
  bookingId,
  code,
  holdExpiresAt,
  finalize,
  onExpired,
  confirmationPath,
}: Parameters<typeof PaymentStep>[0]) {
  const t = useTranslations("book");
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remaining = useCountdown(holdExpiresAt, onExpired);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setError(null);
    const returnUrl = `${window.location.origin}${confirmationPath}`;
    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
      redirect: "if_required",
    });
    if (confirmError) {
      setError(confirmError.message ?? "Your card couldn't be charged.");
      setBusy(false);
      return;
    }
    const result = await finalize(bookingId);
    if (result.status === "confirmed" && result.depositClientSecret) {
      // Some cards need 3-D Secure to authorize the deposit hold.
      await stripe.handleNextAction({ clientSecret: result.depositClientSecret });
    }
    if (result.status === "failed" || result.status === "error") {
      setError(result.message);
      setBusy(false);
      return;
    }
    router.push(confirmationPath);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <p className="flex items-center gap-2 rounded-lg bg-accent/30 px-3 py-2 text-sm font-medium" role="status">
        <Timer className="size-4" aria-hidden />
        {t("holdNotice", { minutes: remaining })}
      </p>
      <PaymentElement options={{ layout: "tabs" }} />
      {error && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={!stripe || busy}>
        <Lock />
        {busy ? t("processing") : t("payNow", { amount: formatCents(amountCents) })}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        {t("secure")} · {code}
      </p>
    </form>
  );
}
