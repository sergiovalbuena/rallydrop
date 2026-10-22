"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { CircleCheck, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getStripe, stripeAppearance } from "@/components/booking/stripe-client";
import { confirmHoldAction, finishCardUpdateAction, startCardUpdateAction } from "./actions";

export function CardUpdate({ token, amountLabel }: { token: string; amountLabel: string }) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stripePromise = getStripe();

  useEffect(() => {
    startCardUpdateAction(token).then((r) => (r.ok ? setClientSecret(r.clientSecret) : setError(r.error)));
  }, [token]);

  if (!stripePromise) return <p className="text-muted-foreground">Card payments aren&apos;t set up yet.</p>;
  if (error) {
    return (
      <Alert variant="destructive">
        <TriangleAlert />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }
  if (!clientSecret) return <Skeleton className="h-48 rounded-2xl" />;
  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance: stripeAppearance }}>
      <CardForm token={token} amountLabel={amountLabel} />
    </Elements>
  );
}

function CardForm({ token, amountLabel }: { token: string; amountLabel: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"held" | "saved" | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setError(null);
    const { error: setupError, setupIntent } = await stripe.confirmSetup({ elements, redirect: "if_required" });
    if (setupError || !setupIntent) {
      setBusy(false);
      setError(setupError?.message ?? "The card wasn't saved.");
      return;
    }
    const r = await finishCardUpdateAction(token, setupIntent.id);
    if (!r.ok) {
      setBusy(false);
      setError(r.error);
      return;
    }
    if (r.clientSecret) {
      // The bank wants to verify the hold (3-D Secure).
      const { error: actionError } = await stripe.handleNextAction({ clientSecret: r.clientSecret });
      if (actionError) {
        setBusy(false);
        setError(actionError.message ?? "The card couldn't be verified.");
        return;
      }
      await confirmHoldAction(token);
    }
    setBusy(false);
    setDone(r.hold === "skipped" ? "saved" : "held");
  }

  if (done) {
    return (
      <p className="flex items-center gap-2 rounded-2xl bg-success/10 p-4 font-medium text-success" role="status">
        <CircleCheck className="size-5 shrink-0" aria-hidden />
        {done === "held"
          ? `Thanks! The ${amountLabel} deposit hold is in place. You're all set.`
          : "Thanks! Your new card is saved for the deposit."}
      </p>
    );
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <PaymentElement />
      {error && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={!stripe || busy}>
        {busy ? "Saving…" : `Save card and place the ${amountLabel} hold`}
      </Button>
    </form>
  );
}
