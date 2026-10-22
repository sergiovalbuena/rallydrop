"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck,
  CircleCheck,
  Lock,
  MapPin,
  ShieldCheck,
  TicketPercent,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { formatCents, formatCentsShort } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { Quote } from "@/lib/domain/pricing";
import type { DeliveryResolution } from "@/lib/domain/delivery";
import { seasonalPrice } from "@/lib/domain/season";
import { contactSchema, fieldErrors } from "@/lib/validation/booking";
import {
  acceptTermsAction,
  checkoutAction,
  finalizeAction,
  quoteAction,
  releaseHoldAction,
  type CheckoutResult,
} from "@/app/(checkout)/book/actions";
import { DateTimePicker } from "./date-time-picker";
import { OptionCard } from "./option-card";
import { PaymentStep } from "./payment-form";
import { PriceSummary } from "./price-summary";
import { Stepper } from "./stepper";
import type { Catalog, Contact, Extras, Slot } from "./types";

type Step = 0 | 1 | 2 | 3 | 4 | 5;
type Service = "ROUND" | "DROPOFF" | "COLLECTION" | "SELF";

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
    extraBalls: false,
    care: false,
    fulfillment: "DELIVERY_COURT",
    dropoff: true,
    collection: true,
    courtId: catalog.courts[0]?.id ?? null,
    deliveryAddress: "",
  });
  const [contact, setContact] = useState<Contact>({
    name: "",
    email: "",
    phone: "",
    skillLevel: "",
    notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [quote, setQuote] = useState<Quote | null>(null);
  const [delivery, setDelivery] = useState<DeliveryResolution | null>(null);
  const [quoting, startQuoting] = useTransition();
  const [checkout, setCheckout] = useState<Extract<CheckoutResult, { ok: true }> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Promo: what's typed vs. the code actually applied to the quote.
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<string | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [applyingPromo, startApplyingPromo] = useTransition();

  const product = catalog.products.find((p) => p.id === productId) ?? null;
  const machine = catalog.machines.find((m) => m.id === machineId) ?? null;
  const steps = [t("stepProduct"), t("stepMachine"), t("stepWhen"), t("stepExtras"), t("stepDetails"), t("stepPay")];

  // Live price: recompute whenever the selection changes (debounced for typing).
  const startsAt = when.slot?.start ?? null;
  const quoteKey = JSON.stringify({ productId, machineId, extras, promo, startsAt });
  useEffect(() => {
    if (!productId || !machineId) return;
    const handle = setTimeout(() => {
      startQuoting(async () => {
        const r = await quoteAction({ productId, machineId, extras, promoCode: promo, startsAt });
        if (r.ok) {
          setQuote(r.quote);
          setDelivery(r.delivery);
          // A code can stop applying when the selection changes.
          if (promo && r.promoError) {
            setPromo(null);
            setPromoError(r.promoError);
          }
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

  function applyPromo() {
    const code = promoInput.trim();
    if (!productId || !machineId) return;
    if (!code) {
      setPromoError(t("promoEmpty"));
      return;
    }
    startApplyingPromo(async () => {
      const r = await quoteAction({ productId, machineId, extras, promoCode: code, startsAt });
      if (!r.ok) {
        setPromoError(r.error);
        return;
      }
      if (r.promoError) {
        setPromoError(r.promoError);
        return;
      }
      if (!r.quote.promoCode) {
        setPromoError(t("promoNoEffect"));
        return;
      }
      setPromoError(null);
      setPromo(r.quote.promoCode);
      setPromoInput(r.quote.promoCode);
      setQuote(r.quote);
      setDelivery(r.delivery);
    });
  }

  function removePromo() {
    setPromo(null);
    setPromoInput("");
    setPromoError(null);
  }

  function validateDetails(): boolean {
    const r = contactSchema.safeParse({
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      skillLevel: contact.skillLevel || null,
    });
    const e = r.success ? {} : fieldErrors(r.error);
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
      promoCode: promo,
    });
    setSubmitting(false);
    if (result.ok) {
      setCheckout(result);
      setStep(5);
      return;
    }
    toast.error(result.error);
    if (result.code === "INVALID_PROMO") {
      setPromo(null);
      setPromoError(result.error);
    } else if (result.code === "SLOT_TAKEN" || result.code === "SLOT_NOT_ALLOWED") {
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

  const selfServe = !extras.dropoff && !extras.collection;
  const service: Service = selfServe
    ? "SELF"
    : extras.dropoff && extras.collection
      ? "ROUND"
      : extras.dropoff
        ? "DROPOFF"
        : "COLLECTION";
  const setService = (next: Service) =>
    setExtras((e) => ({
      ...e,
      dropoff: next === "ROUND" || next === "DROPOFF",
      collection: next === "ROUND" || next === "COLLECTION",
    }));
  // Prices for the customer's zone once we know it, otherwise the cheapest zone ("from").
  const knownZone = delivery?.status === "ok" ? catalog.deliveryZones[delivery.zone - 1] : undefined;
  const priceZone = knownZone ?? catalog.deliveryZones[0];
  const servicePrice = (next: Service) => {
    if (next === "SELF" || !priceZone) return t("free");
    const cents = next === "ROUND" ? priceZone.roundTripCents : priceZone.tripCents;
    return knownZone ? `+${formatCentsShort(cents)}` : t("fromPrice", { price: formatCentsShort(cents) });
  };
  const roundTripSaving = priceZone ? 2 * priceZone.tripCents - priceZone.roundTripCents : 0;

  const canContinue =
    (step === 0 && !!productId) ||
    (step === 1 && !!machineId) ||
    (step === 2 && !!when.slot) ||
    (step === 3 &&
      (selfServe ||
        (((extras.fulfillment === "DELIVERY_COURT" && !!extras.courtId) ||
          (extras.fulfillment === "DELIVERY_ADDRESS" && extras.deliveryAddress.trim().length > 5)) &&
          !quoting &&
          delivery?.status === "ok"))) ||
    step === 4;

  const extraAddOn = catalog.addOns.find((a) => a.kind === "EXTRA_BALLS");
  const carePrice = product ? (catalog.care?.[product.kind] ?? null) : null;
  // Prices follow the season of the start date (today until a date is picked).
  const priceDate = when.date ?? catalog.today;
  const priceOf = (p: (typeof catalog.products)[number]) => seasonalPrice(p, priceDate, catalog.season);
  const longRental = !!product?.durationHours && product.durationHours > catalog.depositAuthMaxDays * 24;

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
        <Stepper steps={steps} current={step} stepOfLabel={t("stepOf", { current: step + 1, total: steps.length })} />

        <div className="mt-8 animate-in duration-300 fade-in slide-in-from-bottom-2" key={step}>
          {step === 0 && (
            <fieldset>
              <legend className="mb-4 font-display text-2xl font-extrabold uppercase sm:text-3xl">
                {t("chooseProduct")}
              </legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {catalog.products.map((p) => {
                  const days = (p.durationHours ?? 24) / 24;
                  const price = priceOf(p);
                  return (
                    <OptionCard
                      key={p.id}
                      name="product"
                      value={p.id}
                      selected={productId === p.id}
                      onSelect={() => {
                        setProductId(p.id);
                        setWhen({ date: null, slot: null });
                      }}
                      title={
                        <span className="flex flex-wrap items-center gap-2">
                          {p.name}
                          {p.kind === "WEEKEND" && <Badge className="text-[10px]">{t("popular")}</Badge>}
                        </span>
                      }
                      aside={
                        <span className="block text-right">
                          <span className="tabular">{formatCentsShort(price.cents)}</span>
                          {days >= 2 && (
                            <span className="block font-sans text-xs font-semibold text-success">
                              {t("perDay", { price: formatCentsShort(Math.round(price.cents / days / 100) * 100) })}
                            </span>
                          )}
                          {price.offSeason && price.cents < p.priceCents && (
                            <span className="block font-sans text-[11px] font-medium text-muted-foreground">
                              {t("offSeasonPrice")}
                            </span>
                          )}
                        </span>
                      }
                    >
                      {p.description}
                    </OptionCard>
                  );
                })}
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
              <legend className="mb-4 font-display text-2xl font-extrabold uppercase sm:text-3xl">
                {t("chooseMachine")}
              </legend>
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
                        <span className="block text-xs font-normal">
                          {t("depositLongShort", { amount: formatCentsShort(m.depositLongCents) })}
                        </span>
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
              <h2 className="font-display text-2xl font-extrabold uppercase sm:text-3xl">{t("extrasTitle")}</h2>
              <p className="flex items-center gap-2 rounded-xl bg-success/10 px-4 py-3 text-sm font-medium text-success">
                <CircleCheck className="size-4 shrink-0" aria-hidden /> {t("ballsIncluded")}
              </p>
              {carePrice !== null && (
                <label className="flex cursor-pointer items-start gap-4 rounded-xl border bg-card p-4 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50">
                  <Checkbox
                    checked={extras.care}
                    onCheckedChange={(v) => setExtras((e) => ({ ...e, care: v === true }))}
                    className="mt-0.5"
                    aria-label={t("careTitle")}
                  />
                  <span className="flex-1">
                    <span className="flex justify-between gap-3 font-semibold">
                      <span className="flex items-center gap-2">
                        <ShieldCheck className="size-4 text-primary" aria-hidden /> {t("careTitle")}
                      </span>
                      <span className="font-display text-xl">+{formatCentsShort(carePrice)}</span>
                    </span>
                    <span className="mt-1 block text-sm text-muted-foreground">
                      {t("careBody", { cap: formatCentsShort(catalog.careCapCents) })}
                    </span>
                  </span>
                </label>
              )}
              {extraAddOn && (
                <label className="flex cursor-pointer items-start gap-4 rounded-xl border bg-card p-4 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50">
                  <Checkbox
                    checked={extras.extraBalls}
                    onCheckedChange={(v) => setExtras((e) => ({ ...e, extraBalls: v === true }))}
                    className="mt-0.5"
                    aria-label={extraAddOn.name}
                  />
                  <span className="flex-1">
                    <span className="flex justify-between gap-3 font-semibold">
                      {extraAddOn.name}
                      <span className="font-display text-xl">+{formatCentsShort(extraAddOn.priceCents)}</span>
                    </span>
                    {extraAddOn.description && (
                      <span className="text-sm text-muted-foreground">{extraAddOn.description}</span>
                    )}
                  </span>
                </label>
              )}

              <fieldset className="space-y-3">
                <legend className="mb-1 text-lg font-semibold">{t("serviceTitle")}</legend>
                <p className="mb-3 text-sm text-muted-foreground">{t("serviceIntro")}</p>
                <OptionCard
                  name="service"
                  value="ROUND"
                  selected={service === "ROUND"}
                  onSelect={() => setService("ROUND")}
                  title={
                    <span className="flex flex-wrap items-center gap-2">
                      {t("serviceRound")}
                      {roundTripSaving > 0 && (
                        <Badge variant="accent">
                          {t("serviceSave", { amount: formatCentsShort(roundTripSaving) })}
                        </Badge>
                      )}
                    </span>
                  }
                  aside={servicePrice("ROUND")}
                >
                  {t("serviceRoundHint")}
                </OptionCard>
                <OptionCard
                  name="service"
                  value="DROPOFF"
                  selected={service === "DROPOFF"}
                  onSelect={() => setService("DROPOFF")}
                  title={t("serviceDropoff")}
                  aside={servicePrice("DROPOFF")}
                >
                  {t("serviceDropoffHint")}
                </OptionCard>
                <OptionCard
                  name="service"
                  value="COLLECTION"
                  selected={service === "COLLECTION"}
                  onSelect={() => setService("COLLECTION")}
                  title={t("serviceCollection")}
                  aside={servicePrice("COLLECTION")}
                >
                  {t("serviceCollectionHint")}
                </OptionCard>
                <OptionCard
                  name="service"
                  value="SELF"
                  selected={service === "SELF"}
                  onSelect={() => setService("SELF")}
                  title={t("serviceSelf")}
                  aside={servicePrice("SELF")}
                >
                  {t("serviceSelfHint")}
                </OptionCard>
              </fieldset>

              {!selfServe && (
                <fieldset className="space-y-3">
                  <legend className="mb-3 text-lg font-semibold">
                    {service === "COLLECTION" ? t("whereCollect") : t("whereDropoff")}
                  </legend>
                  <OptionCard
                    name="location"
                    value="DELIVERY_COURT"
                    selected={extras.fulfillment === "DELIVERY_COURT"}
                    onSelect={() => setExtras((e) => ({ ...e, fulfillment: "DELIVERY_COURT" }))}
                    title={t("deliveryCourt")}
                  >
                    {t("deliveryCourtHint")}
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
                    name="location"
                    value="DELIVERY_ADDRESS"
                    selected={extras.fulfillment === "DELIVERY_ADDRESS"}
                    onSelect={() => setExtras((e) => ({ ...e, fulfillment: "DELIVERY_ADDRESS" }))}
                    title={t("deliveryAddress")}
                  >
                    {t("deliveryAddressHint")}
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
                  <ZoneStatus delivery={delivery} loading={quoting} />
                </fieldset>
              )}
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
              <h2 className="font-display text-2xl font-extrabold uppercase sm:text-3xl">{t("stepDetails")}</h2>
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
              {/* Promo code — last thing before payment. Not a nested form: Enter applies it. */}
              <div className="rounded-2xl border border-dashed bg-muted/40 p-4">
                <Label htmlFor="promo" className="flex items-center gap-2">
                  <TicketPercent className="size-4 text-primary" aria-hidden /> {t("promoLabel")}
                </Label>
                {promo && quote?.promoCode ? (
                  <div className="mt-3 flex animate-in items-center justify-between gap-3 duration-300 zoom-in-95 fade-in">
                    <p className="text-sm" role="status">
                      <Badge variant="accent" className="mr-2 font-mono tracking-wider">
                        {promo}
                      </Badge>
                      <span className="text-success">
                        {t("promoApplied", { amount: formatCents(quote.discountCents) })}
                      </span>
                    </p>
                    <Button type="button" variant="ghost" size="sm" onClick={removePromo}>
                      <X /> {t("promoRemove")}
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="mt-3 flex gap-2">
                      <Input
                        id="promo"
                        value={promoInput}
                        autoComplete="off"
                        autoCapitalize="characters"
                        spellCheck={false}
                        placeholder={t("promoPlaceholder")}
                        className="font-mono uppercase placeholder:font-sans placeholder:normal-case"
                        aria-invalid={!!promoError}
                        aria-describedby={promoError ? "promo-error" : undefined}
                        onChange={(e) => {
                          setPromoInput(e.target.value);
                          if (promoError) setPromoError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            applyPromo();
                          }
                        }}
                      />
                      <Button type="button" variant="outline" onClick={applyPromo} disabled={applyingPromo}>
                        {applyingPromo ? tc("loading") : t("promoApply")}
                      </Button>
                    </div>
                    {promoError && (
                      <p id="promo-error" className="mt-2 text-sm text-destructive" role="alert">
                        {promoError}
                      </p>
                    )}
                  </>
                )}
              </div>
            </form>
          )}

          {step === 5 && checkout && (
            <div className="space-y-4">
              <h2 className="font-display text-2xl font-extrabold uppercase sm:text-3xl">{t("stepPay")}</h2>
              <PaymentStep
                clientSecret={checkout.clientSecret}
                amountCents={checkout.amountCents}
                bookingId={checkout.bookingId}
                code={checkout.code}
                holdExpiresAt={checkout.holdExpiresAt}
                finalize={finalizeAction}
                accept={acceptTermsAction}
                consentDocs={catalog.legal}
                depositNote={
                  longRental
                    ? t("depositSavedAmount", { amount: formatCentsShort(machine?.depositLongCents ?? 0) })
                    : t("depositHoldAmount", { amount: formatCentsShort(machine?.depositCents ?? 0) })
                }
                onExpired={onExpired}
                confirmationPath={`/book/confirmation/${checkout.code}?b=${checkout.bookingId}`}
              />
            </div>
          )}
        </div>

        {step < 5 && (
          <div className="sticky bottom-0 z-10 -mx-4 mt-8 flex items-center justify-between gap-3 border-t bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:pb-0">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="sm:w-auto sm:px-4"
                onClick={() => go((step - 1) as Step)}
                disabled={step === 0}
                aria-label={tc("back")}
              >
                <ArrowLeft /> <span className="hidden sm:inline">{tc("back")}</span>
              </Button>
              {quote && (
                <p className="leading-tight lg:hidden" aria-live="polite">
                  <span className="block text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                    {t("totalShort")}
                  </span>
                  <span className="tabular font-display text-2xl font-black">{formatCents(quote.totalCents)}</span>
                </p>
              )}
            </div>
            {step === 4 ? (
              // Distinct keys: reusing the "Continue" node would let the click
              // that opened this step also submit the form.
              <Button key="submit" type="submit" form="details-form" size="lg" disabled={submitting}>
                {submitting ? tc("loading") : t("toPayment")} <ArrowRight />
              </Button>
            ) : (
              <Button key="next" size="lg" onClick={() => go((step + 1) as Step)} disabled={!canContinue}>
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

      {/* Full summary: always on desktop; on phones only at review/pay (the bar shows the total before). */}
      <aside className={cn("space-y-4 lg:sticky lg:top-24 lg:block lg:self-start", step >= 4 ? "block" : "hidden")}>
        {productId && machineId && (
          <PriceSummary
            quote={quote}
            loading={quoting}
            depositKind={depositKind}
            header={header}
            creditCents={step === 5 && checkout ? checkout.creditCents : 0}
          />
        )}
        <ul className="space-y-2 rounded-2xl border bg-card p-4 text-sm">
          {[
            { icon: CalendarCheck, text: t("trustCancel") },
            { icon: ShieldCheck, text: t("trustDeposit") },
            { icon: Lock, text: t("trustStripe") },
          ].map((item) => (
            <li key={item.text} className="flex items-center gap-2.5 text-muted-foreground">
              <item.icon className="size-4 shrink-0 text-success" aria-hidden />
              {item.text}
            </li>
          ))}
        </ul>
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

/** Zone and distance for the chosen spot, or why we can't deliver there. */
function ZoneStatus({ delivery, loading }: { delivery: DeliveryResolution | null; loading: boolean }) {
  const t = useTranslations("book");
  let text: string;
  let tone = "text-foreground";
  if (loading || !delivery || delivery.status === "none") {
    text = t("zoneChecking");
    tone = "text-muted-foreground";
  } else if (delivery.status === "ok") {
    text =
      delivery.distanceKm !== null
        ? t("zoneOk", { zone: delivery.zone, km: delivery.distanceKm })
        : t("zoneOkPostal", { zone: delivery.zone });
  } else if (delivery.status === "unknown") {
    text = t("zoneUnknown");
    tone = "text-destructive";
  } else {
    text = t("zoneOut", { km: delivery.distanceKm });
    tone = "text-destructive";
  }
  return (
    <p className={cn("flex items-center gap-2 pl-2 text-sm sm:pl-9", tone)} role="status" aria-live="polite">
      <MapPin className="size-4 shrink-0" aria-hidden />
      {text}
    </p>
  );
}
