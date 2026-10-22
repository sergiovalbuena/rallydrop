"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { DateTimePicker } from "@/components/booking/date-time-picker";
import type { CatalogCourt, Slot } from "@/components/booking/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { bookSessionAction } from "@/app/(site)/account/actions";
import {
  EMPTY_CONSENT,
  TermsConsent,
  consentBoxes,
  type ConsentDocs,
  type ConsentValue,
} from "@/components/legal/terms-consent";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";

type CourtWithFee = CatalogCourt & { feeCents: number };

export function SessionBooker({
  productId,
  courts,
  consentDocs,
  plusTax = false,
}: {
  productId: string;
  /** Taxes are charged on top of the delivery fee. */
  plusTax?: boolean;
  /** Courts we deliver to, with the round-trip fee for a session there. */
  courts: CourtWithFee[];
  /** Set when the member must (re)accept the live Terms & Waiver. */
  consentDocs: ConsentDocs | null;
}) {
  const router = useRouter();
  const [consent, setConsent] = useState<ConsentValue>(EMPTY_CONSENT);
  const consentOk = !consentDocs || (consent.terms_waiver && consent.age_19);
  const [when, setWhen] = useState<{ date: string | null; slot: Slot | null }>({ date: null, slot: null });
  const [delivery, setDelivery] = useState(false);
  const [courtId, setCourtId] = useState(courts[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const fee = courts.find((c) => c.id === courtId)?.feeCents ?? 0;
  const tax = plusTax ? " + tax" : "";

  const options = [
    { value: false, title: "Self-serve downtown", body: "Collect and return it at our downtown spot.", price: "Free" },
    {
      value: true,
      title: "Deliver to my court",
      body: "We drop it off and collect it at the court. Charged to your package card.",
      price: courts.length ? `+${formatCents(fee)}${tax}` : "Not available",
    },
  ];

  return (
    <div className="space-y-6">
      <fieldset className="grid max-w-2xl gap-3 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-medium">How do you want the machine?</legend>
        {options.map((o) => (
          <label
            key={String(o.value)}
            className={cn(
              "flex cursor-pointer flex-col gap-1 rounded-2xl border bg-card p-4 has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50",
              delivery === o.value && "border-primary bg-primary/5",
              o.value && courts.length === 0 && "pointer-events-none opacity-50",
            )}
          >
            <span className="flex items-center justify-between gap-2 font-semibold">
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="fulfillment"
                  className="accent-primary"
                  checked={delivery === o.value}
                  disabled={o.value && courts.length === 0}
                  onChange={() => setDelivery(o.value)}
                />
                {o.title}
              </span>
              <span className="font-display text-lg">{o.price}</span>
            </span>
            <span className="text-sm text-muted-foreground">{o.body}</span>
          </label>
        ))}
      </fieldset>
      {delivery && (
        <div className="max-w-sm space-y-2">
          <Label htmlFor="court">Court</Label>
          <NativeSelect id="court" value={courtId} onChange={(e) => setCourtId(e.target.value)}>
            {courts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {formatCents(c.feeCents)}
              </option>
            ))}
          </NativeSelect>
        </div>
      )}
      <DateTimePicker productId={productId} machineId={null} value={when} onChange={setWhen} />
      {consentDocs && <TermsConsent docs={consentDocs} value={consent} onChange={setConsent} />}
      <Button
        size="lg"
        disabled={!when.slot || (delivery && !courtId) || busy || !consentOk}
        onClick={async () => {
          if (!when.slot) return;
          setBusy(true);
          const r = await bookSessionAction({
            startsAt: when.slot.start,
            delivery,
            courtId: delivery ? courtId : null,
            consent: consentDocs
              ? { termsId: consentDocs.terms.id, waiverId: consentDocs.waiver.id, boxes: consentBoxes(consent) }
              : null,
          });
          setBusy(false);
          if (r.ok) {
            toast.success(`Session booked · ${r.message}`);
            router.push("/account");
          } else toast.error(r.error);
        }}
      >
        {delivery ? `Book and pay ${formatCents(fee)}${tax} delivery` : "Book this session"}
      </Button>
    </div>
  );
}
