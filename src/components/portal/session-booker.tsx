"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { DateTimePicker } from "@/components/booking/date-time-picker";
import type { CatalogCourt, Slot } from "@/components/booking/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { bookSessionAction, sessionDeliveryQuoteAction } from "@/app/(site)/account/actions";
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
type Delivery = "none" | "court" | "address";

/**
 * Books a package session or a Spring Pass weekend. Self-serve downtown is
 * free; delivery to the door or next to a court costs the zone's round trip,
 * charged to the card on file.
 */
export function SessionBooker({
  source,
  productId,
  courts,
  consentDocs,
  plusTax = false,
}: {
  source: "package" | "pass";
  productId: string;
  /** Courts we deliver to, with the round-trip fee there. */
  courts: CourtWithFee[];
  /** Set when the customer must (re)accept the live Terms & Waiver. */
  consentDocs: ConsentDocs | null;
  /** Taxes are charged on top of the delivery fee. */
  plusTax?: boolean;
}) {
  const router = useRouter();
  const [consent, setConsent] = useState<ConsentValue>(EMPTY_CONSENT);
  const consentOk = !consentDocs || (consent.terms_waiver && consent.age_19);
  const [when, setWhen] = useState<{ date: string | null; slot: Slot | null }>({ date: null, slot: null });
  const [delivery, setDelivery] = useState<Delivery>("none");
  const [courtId, setCourtId] = useState(courts[0]?.id ?? "");
  const [address, setAddress] = useState("");
  const [addressQuote, setAddressQuote] = useState<{ feeCents: number } | { error: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const tax = plusTax ? " + tax" : "";

  const fee =
    delivery === "court"
      ? (courts.find((c) => c.id === courtId)?.feeCents ?? 0)
      : delivery === "address" && addressQuote && "feeCents" in addressQuote
        ? addressQuote.feeCents
        : 0;
  const deliveryReady =
    delivery === "none" ||
    (delivery === "court" && !!courtId) ||
    (delivery === "address" && !!addressQuote && "feeCents" in addressQuote);

  const options: { value: Delivery; title: string; body: string; price: string; disabled?: boolean }[] = [
    { value: "none", title: "Self-serve downtown", body: "Collect and return it at our downtown spot.", price: "Free" },
    {
      value: "address",
      title: "To my door",
      body: "Home or club. We drop it off and collect it there.",
      price: "Zone fee",
    },
    {
      value: "court",
      title: "Next to a court",
      body: "In the parking lot or at the curb by the court — never on the court.",
      price: courts.length ? `from ${formatCents(Math.min(...courts.map((c) => c.feeCents)))}` : "Not available",
      disabled: courts.length === 0,
    },
  ];

  return (
    <div className="space-y-6">
      <fieldset className="grid max-w-3xl gap-3 sm:grid-cols-3">
        <legend className="mb-2 text-sm font-medium">How do you want the machine?</legend>
        {options.map((o) => (
          <label
            key={o.value}
            className={cn(
              "flex cursor-pointer flex-col gap-1 rounded-2xl border bg-card p-4 has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50",
              delivery === o.value && "border-primary bg-primary/5",
              o.disabled && "pointer-events-none opacity-50",
            )}
          >
            <span className="flex items-center justify-between gap-2 font-semibold">
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="fulfillment"
                  className="accent-primary"
                  checked={delivery === o.value}
                  disabled={o.disabled}
                  onChange={() => setDelivery(o.value)}
                />
                {o.title}
              </span>
              <span className="text-sm">{o.price}</span>
            </span>
            <span className="text-sm text-muted-foreground">{o.body}</span>
          </label>
        ))}
      </fieldset>
      {delivery === "court" && (
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
      {delivery === "address" && (
        <div className="max-w-xl space-y-2">
          <Label htmlFor="session-address">Address (with postal code)</Label>
          <div className="flex gap-2">
            <Input
              id="session-address"
              value={address}
              autoComplete="street-address"
              onChange={(e) => {
                setAddress(e.target.value);
                setAddressQuote(null);
              }}
              placeholder="1234 Fort St, Victoria V8R 1J2"
            />
            <Button
              type="button"
              variant="outline"
              disabled={address.trim().length < 6}
              onClick={async () => {
                const r = await sessionDeliveryQuoteAction(address);
                setAddressQuote(r.ok ? { feeCents: r.feeCents } : { error: r.error });
              }}
            >
              Check price
            </Button>
          </div>
          {addressQuote && (
            <p className={"error" in addressQuote ? "text-sm text-destructive" : "text-sm text-success"} role="status">
              {"error" in addressQuote ? addressQuote.error : `Round trip: ${formatCents(addressQuote.feeCents)}${tax}`}
            </p>
          )}
        </div>
      )}
      <DateTimePicker productId={productId} machineId={null} value={when} onChange={setWhen} />
      {consentDocs && <TermsConsent docs={consentDocs} value={consent} onChange={setConsent} />}
      <Button
        size="lg"
        disabled={!when.slot || !deliveryReady || busy || !consentOk}
        onClick={async () => {
          if (!when.slot) return;
          setBusy(true);
          const r = await bookSessionAction({
            source,
            startsAt: when.slot.start,
            delivery,
            courtId: delivery === "court" ? courtId : null,
            address: delivery === "address" ? address : null,
            consent: consentDocs
              ? { termsId: consentDocs.terms.id, waiverId: consentDocs.waiver.id, boxes: consentBoxes(consent) }
              : null,
          });
          setBusy(false);
          if (r.ok) {
            toast.success(`${source === "pass" ? "Weekend" : "Session"} booked · ${r.message}`);
            router.push("/account");
          } else toast.error(r.error);
        }}
      >
        {delivery !== "none" && fee > 0
          ? `Book and pay ${formatCents(fee)}${tax} delivery`
          : source === "pass"
            ? "Book this weekend"
            : "Book this session"}
      </Button>
    </div>
  );
}
