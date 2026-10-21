"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { formatCentsShort } from "@/lib/money";
import type { Quote } from "@/lib/domain/pricing";
import { contactSchema, fieldErrors } from "@/lib/validation/booking";
import {
  checkoutAction,
  finalizeAction,
  quoteAction,
  releaseHoldAction,
  type CheckoutResult,
} from "@/app/(site)/book/actions";
import { DateTimePicker } from "./date-time-picker";
import { OptionCard } from "./option-card";
import { PaymentStep } from "./payment-form";
import { PriceSummary } from "./price-summary";
import { Stepper } from "./stepper";
import type { Catalog, Contact, Extras, Slot } from "./types";

type Step = 0 | 1 | 2 | 3 | 4 | 5;

export function BookingWizard({
  catalog,
  initialProduct,
  initialMachine,
}: {
  catalog: Catalog;
  initialProduct?: string;
  initialMachine?: string;
}) {
  const t = useTranslations("book");
  const tc = useTranslations("common");

  const startProduct = catalog.products.find((p) => p.slug === initialProduct || p.id === initialProduct);
  const startMachine =
    catalog.machines.find((m) => m.slug === initialMachine || m.id === initialMachine) ??
    (catalog.machines.length === 1 ? catalog.machines[0] : undefined);

  const [step, setStep] = useState<Step>(startProduct ? (startMachine ? 2 : 1) : 0);
  const [productId, setProductId] = useState<string | null>(startProduct?.id ?? null);
  const [machineId, setMachineId] = useState<string | null>(startMachine?.id ?? null);
  const [when, setWhen] = useState<{ date: string | null; slot: Slot | null }>({ date: null, slot: null });
  const [extras, setExtras] = useState<Extras>({
    balls: true,
    fulfillment: "DELIVERY_COURT",
    courtId: catalog.courts[0]?.id ?? null,
    deliveryAddress: "",
  });
  const [contact, setContact] = useState<Contact>({
    name: "",
    email: "",
    phone: "",
    skillLevel: "",
    notes: "",
    termsAccepted: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [quote, setQuote] = useState<Quote | null>(null);
  const [zone, setZone] = useState<boolean | null>(null);
  const [quoting, startQuoting] = useTransition();
  const [checkout, setCheckout] = useState<Extract<CheckoutResult, { ok: true }> | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const product = catalog.products.find((p) => p.id === productId) ?? null;
  const machine = catalog.machines.find((m) => m.id === machineId) ?? null;
  const steps = [t("stepProduct"), t("stepMachine"), t("stepWhen"), t("stepExtras"), t("stepDetails"), t("stepPay")];

  // Live price: recompute whenever the selection changes (debounced for typing).
  const quoteKey = JSON.stringify({ productId, machineId, extras });
  useEffect(() => {
    if (!productId || !machineId) return;
    const handle = setTimeout(() => {
      startQuoting(async () => {
        const r = await quoteAction({ productId, machineId, extras });
        if (r.ok) {
          setQuote(r.quote);
          setZone(r.inFreeZone);
        }
      });
    }, 400);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteKey]);

  // Whether the deposit hold is placed now or 24 h before start depends on
  // "now", so it's computed when the slot is picked (not during render).
  const [startsLater, setStartsLater] = useState(false);
  const depositKind: "hold" | "saved" | "scheduled" =
    product?.durationHours && product.durationHours > catalog.depositAuthMaxDays * 24
      ? "saved"
      : startsLater
        ? "scheduled"
        : "hold";
  const pickWhen = useCallback(
    (v: { date: string | null; slot: Slot | null }) => {
      setWhen(v);
      setStartsLater(
        !!v.slot && new Date(v.slot.start).getTime() - Date.now() > catalog.depositAuthLeadHours * 3_600_000,
      );
    },
    [catalog.depositAuthLeadHours],
  );

  const go = useCallback(
    async (next: Step) => {
      // Leaving the payment step releases the unpaid hold so the slot isn't blocked.
      if (step === 5 && next < 5 && checkout) {
        await releaseHoldAction(checkout.bookingId);
        setCheckout(null);
      }
      setStep(next);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [step, checkout],
  );

  function validateDetails(): boolean {
    const r = contactSchema.safeParse({
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      skillLevel: contact.skillLevel || null,
    });
    const e = r.success ? {} : fieldErrors(r.error);
    if (!contact.termsAccepted) e.terms = "Please accept the rental terms.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function startPayment() {
    if (!productId || !machineId || !when.slot) return;
    setSubmitting(true);
    const result = await checkoutAction({
      productId,
      machineId,
      startsAt: when.slot.start,
      extras,
      contact: {
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        skillLevel: contact.skillLevel || null,
      },
      notes: contact.notes,
      termsAccepted: contact.termsAccepted as true,
    });
    setSubmitting(false);
    if (result.ok) {
      setCheckout(result);
      setStep(5);
      return;
    }
    toast.error(result.error);
    if (result.code === "SLOT_TAKEN" || result.code === "SLOT_NOT_ALLOWED") {
      setWhen({ date: when.date, slot: null });
      setStep(2);
    } else if (result.fields) {
      setErrors(Object.fromEntries(Object.entries(result.fields).map(([k, v]) => [k.replace(/^contact\./, ""), v])));
      setStep(4);
    }
  }

  const onExpired = useCallback(() => {
    toast.warning(t("holdExpired"));
    setCheckout(null);
    setWhen((w) => ({ date: w.date, slot: null }));
    setStep(2);
  }, [t]);

  const canContinue =
    (step === 0 && !!productId) ||
    (step === 1 && !!machineId) ||
    (step === 2 && !!when.slot) ||
    (step === 3 &&
      (extras.fulfillment === "PICKUP" ||
        (extras.fulfillment === "DELIVERY_COURT" && !!extras.courtId) ||
        (extras.fulfillment === "DELIVERY_ADDRESS" && extras.deliveryAddress.trim().length > 5))) ||
    step === 4;

  const ballsAddOn = catalog.addOns.find((a) => a.kind === "BALLS");
  const deliveryAddOn = catalog.addOns.find((a) => a.kind === "DELIVERY");

  const header = (
    <div className="mt-3 space-y-1 text-sm">
      {product && <p className="font-semibold">{product.name}</p>}
      {machine && <p className="text-muted-foreground">{machine.name}</p>}
      {when.slot && (
        <p className="text-muted-foreground">
          {when.slot.startFull} → {when.slot.endLabel}
        </p>
      )}
    </div>
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0">
        <Stepper steps={steps} current={step} />

        <div className="mt-8 animate-in duration-300 fade-in slide-in-from-bottom-2" key={step}>
          {step === 0 && (
            <fieldset>
              <legend className="mb-4 font-display text-3xl font-extrabold uppercase">{t("chooseProduct")}</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {catalog.products.map((p) => (
                  <OptionCard
                    key={p.id}
                    name="product"
                    value={p.id}
                    selected={productId === p.id}
                    onSelect={() => {
                      setProductId(p.id);
                      setWhen({ date: null, slot: null });
                    }}
                    title={p.name}
                    aside={formatCentsShort(p.priceCents)}
                  >
                    {p.description}
                  </OptionCard>
                ))}
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                {t("packageIntro")}{" "}
                <Link href="/pricing#packages" className="text-primary underline">
                  {tc("seePricing")}
                </Link>
              </p>
            </fieldset>
          )}

          {step === 1 && (
            <fieldset>
              <legend className="mb-4 font-display text-3xl font-extrabold uppercase">{t("chooseMachine")}</legend>
              <div className="grid gap-3">
                {catalog.machines.map((m) => (
                  <OptionCard
                    key={m.id}
                    name="machine"
                    value={m.id}
                    selected={machineId === m.id}
                    onSelect={() => {
                      setMachineId(m.id);
                      setWhen({ date: null, slot: null });
                    }}
                    title={m.name}
                    aside={
                      <span className="text-sm font-semibold text-muted-foreground">
                        {tc("deposit")} {formatCentsShort(m.depositCents)}
                      </span>
                    }
                  >
                    {m.description}
                  </OptionCard>
                ))}
              </div>
            </fieldset>
          )}

          {step === 2 && productId && (
            <DateTimePicker productId={productId} machineId={machineId} value={when} onChange={pickWhen} />
          )}

          {step === 3 && (
            <div className="space-y-8">
              <h2 className="font-display text-3xl font-extrabold uppercase">{t("extrasTitle")}</h2>
              {ballsAddOn && (
                <label className="flex cursor-pointer items-start gap-4 rounded-xl border bg-card p-4 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50">
                  <Checkbox
                    checked={extras.balls}
                    onCheckedChange={(v) => setExtras((e) => ({ ...e, balls: v === true }))}
                    className="mt-0.5"
                    aria-label={t("balls")}
                  />
                  <span className="flex-1">
                    <span className="flex justify-between gap-3 font-semibold">
                      {t("balls")}{" "}
                      <span className="font-display text-xl">+{formatCentsShort(ballsAddOn.priceCents)}</span>
                    </span>
                    <span className="text-sm text-muted-foreground">{ballsAddOn.description}</span>
                  </span>
                </label>
              )}

              <fieldset className="space-y-3">
                <legend className="mb-3 text-lg font-semibold">{t("fulfillment")}</legend>
                <OptionCard
                  name="fulfillment"
                  value="DELIVERY_COURT"
                  selected={extras.fulfillment === "DELIVERY_COURT"}
                  onSelect={() => setExtras((e) => ({ ...e, fulfillment: "DELIVERY_COURT" }))}
                  title={t("deliveryCourt")}
                  aside={deliveryAddOn ? `+${formatCentsShort(deliveryAddOn.priceCents)}*` : undefined}
                >
                  {t("addressHint")}
                </OptionCard>
                {extras.fulfillment === "DELIVERY_COURT" && (
                  <div className="pl-2 sm:pl-9">
                    <Label htmlFor="court" className="mb-2 block">
                      {t("court")}
                    </Label>
                    <NativeSelect
                      id="court"
                      value={extras.courtId ?? ""}
                      onChange={(e) => setExtras((x) => ({ ...x, courtId: e.target.value }))}
                    >
                      {catalog.courts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                )}
                <OptionCard
                  name="fulfillment"
                  value="DELIVERY_ADDRESS"
                  selected={extras.fulfillment === "DELIVERY_ADDRESS"}
                  onSelect={() => setExtras((e) => ({ ...e, fulfillment: "DELIVERY_ADDRESS" }))}
                  title={t("deliveryAddress")}
                  aside={deliveryAddOn ? `+${formatCentsShort(deliveryAddOn.priceCents)}*` : undefined}
                >
                  {t("addressHint")}
                </OptionCard>
                {extras.fulfillment === "DELIVERY_ADDRESS" && (
                  <div className="space-y-2 pl-2 sm:pl-9">
                    <Label htmlFor="address">{t("address")}</Label>
                    <Input
                      id="address"
                      autoComplete="street-address"
                      placeholder="1234 Fort St, Victoria, BC V8W 1H2"
                      value={extras.deliveryAddress}
                      onChange={(e) => setExtras((x) => ({ ...x, deliveryAddress: e.target.value }))}
                    />
                  </div>
                )}
                {extras.fulfillment !== "PICKUP" && (
                  <p className="flex items-center gap-2 pl-2 text-sm sm:pl-9" role="status">
                    <MapPin className="size-4 text-primary" aria-hidden />
                    {zone === true ? t("freeZone") : zone === false ? t("paidZone") : t("unknownZone")}
                  </p>
                )}
                <OptionCard
                  name="fulfillment"
                  value="PICKUP"
                  selected={extras.fulfillment === "PICKUP"}
                  onSelect={() => setExtras((e) => ({ ...e, fulfillment: "PICKUP" }))}
                  title={t("pickup")}
                  aside={formatCentsShort(0)}
                >
                  {t("pickupHint")}
                </OptionCard>
              </fieldset>
            </div>
          )}

          {step === 4 && (
            <form
              className="space-y-5"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                if (validateDetails()) void startPayment();
              }}
              id="details-form"
            >
              <h2 className="font-display text-3xl font-extrabold uppercase">{t("stepDetails")}</h2>
              <Field id="name" label={t("name")} error={errors.name}>
                <Input
                  id="name"
                  autoComplete="name"
                  value={contact.name}
                  aria-invalid={!!errors.name}
                  onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))}
                />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field id="email" label={t("email")} error={errors.email}>
                  <Input
                    id="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={contact.email}
                    aria-invalid={!!errors.email}
                    onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
                  />
                </Field>
                <Field id="phone" label={t("phone")} error={errors.phone}>
                  <Input
                    id="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="250 555 0142"
                    value={contact.phone}
                    aria-invalid={!!errors.phone}
                    onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))}
                  />
                </Field>
              </div>
              <p className="-mt-2 text-xs text-muted-foreground">{t("contactHint")}</p>
              <Field id="level" label={t("level")}>
                <NativeSelect
                  id="level"
                  value={contact.skillLevel}
                  onChange={(e) => setContact((c) => ({ ...c, skillLevel: e.target.value as Contact["skillLevel"] }))}
                >
                  <option value="">—</option>
                  <option value="BEGINNER">Beginner</option>
                  <option value="INTERMEDIATE">Intermediate</option>
                  <option value="ADVANCED">Advanced</option>
                  <option value="PRO">Pro / competitive</option>
                </NativeSelect>
              </Field>
              <Field id="notes" label={t("notes")}>
                <Textarea
                  id="notes"
                  value={contact.notes}
                  onChange={(e) => setContact((c) => ({ ...c, notes: e.target.value }))}
                />
              </Field>
              <div className="space-y-1">
                <label className="flex cursor-pointer items-start gap-3 text-sm">
                  <Checkbox
                    checked={contact.termsAccepted}
                    onCheckedChange={(v) => setContact((c) => ({ ...c, termsAccepted: v === true }))}
                    aria-invalid={!!errors.terms}
                    aria-describedby={errors.terms ? "terms-error" : undefined}
                    className="mt-0.5"
                  />
                  <span>
                    {t("terms")}{" "}
                    <Link href="/terms" target="_blank" className="text-primary underline">
                      {t("termsLink")}
                    </Link>
                  </span>
                </label>
                {errors.terms && (
                  <p id="terms-error" className="text-sm text-destructive">
                    {errors.terms}
                  </p>
                )}
              </div>
            </form>
          )}

          {step === 5 && checkout && (
            <div className="space-y-4">
              <h2 className="font-display text-3xl font-extrabold uppercase">{t("stepPay")}</h2>
              <PaymentStep
                clientSecret={checkout.clientSecret}
                amountCents={checkout.amountCents}
                bookingId={checkout.bookingId}
                code={checkout.code}
                holdExpiresAt={checkout.holdExpiresAt}
                finalize={finalizeAction}
                onExpired={onExpired}
                confirmationPath={`/book/confirmation/${checkout.code}?b=${checkout.bookingId}`}
              />
            </div>
          )}
        </div>

        {step < 5 && (
          <div className="sticky bottom-0 z-10 -mx-4 mt-8 flex items-center justify-between gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0">
            <Button variant="ghost" onClick={() => go((step - 1) as Step)} disabled={step === 0}>
              <ArrowLeft /> {tc("back")}
            </Button>
            {step === 4 ? (
              <Button type="submit" form="details-form" size="lg" disabled={submitting}>
                {submitting ? tc("loading") : t("toPayment")} <ArrowRight />
              </Button>
            ) : (
              <Button size="lg" onClick={() => go((step + 1) as Step)} disabled={!canContinue}>
                {tc("continue")} <ArrowRight />
              </Button>
            )}
          </div>
        )}
        {step === 5 && (
          <Button variant="ghost" className="mt-4" onClick={() => go(4)}>
            <ArrowLeft /> {tc("back")}
          </Button>
        )}
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        {productId && machineId ? (
          <PriceSummary quote={quote} loading={quoting} depositKind={depositKind} header={header} />
        ) : (
          <div className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">{t("summary")}</div>
        )}
        {deliveryAddOn && <p className="mt-3 text-xs text-muted-foreground">* {deliveryAddOn.description}</p>}
      </aside>
    </div>
  );
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && (
        <p className="text-sm text-destructive" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}
