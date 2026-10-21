import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { ArrowRight, CalendarCheck, Quote, Sparkles, Truck } from "lucide-react";
import { CourtIllustration } from "@/components/brand/court-illustration";
import { FaqList } from "@/components/marketing/faq-list";
import { MachineCards, MachineCardsSkeleton } from "@/components/marketing/machine-cards";
import { PricingGrid, PricingGridSkeleton } from "@/components/marketing/pricing-grid";
import { Section, SectionHeading } from "@/components/marketing/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listActiveAddOns, listActiveProducts, listPublicMachines } from "@/lib/services/catalog";

export default async function HomePage() {
  const t = await getTranslations("home");
  const tc = await getTranslations("common");
  const th = await getTranslations("how");

  const steps = [
    { icon: CalendarCheck, title: t("step1Title"), body: t("step1Body") },
    { icon: Truck, title: t("step2Title"), body: t("step2Body") },
    { icon: Sparkles, title: t("step3Title"), body: t("step3Body") },
  ];
  const testimonials = [
    { quote: t("t1Quote"), name: t("t1Name"), meta: t("t1Meta") },
    { quote: t("t2Quote"), name: t("t2Name"), meta: t("t2Meta") },
    { quote: t("t3Quote"), name: t("t3Name"), meta: t("t3Meta") },
  ];
  const faq = [1, 2, 3, 4].map((i) => ({
    q: th(`q${i}` as "q1"),
    a: th(`a${i}` as "a1"),
  }));

  return (
    <>
      {/* Hero */}
      <div className="court-lines relative overflow-hidden bg-court text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-12 pb-16 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pt-20 lg:pb-24">
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-optic uppercase">
              {t("eyebrow")}
            </p>
            <h1 className="font-display text-6xl leading-[0.85] font-extrabold uppercase sm:text-7xl lg:text-8xl">
              {t("heroTitleA")}
              <br />
              <span className="text-optic">{t("heroTitleB")}</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-white/80">{t("heroBody")}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" variant="accent">
                <Link href="/book">
                  {tc("bookNow")} <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="inverted">
                <Link href="/pricing">{tc("seePricing")}</Link>
              </Button>
            </div>
            <dl className="mt-10 grid max-w-md grid-cols-3 gap-4 border-t border-white/15 pt-6">
              {[
                [t("heroStatA"), t("heroStatALabel")],
                [t("heroStatB"), t("heroStatBLabel")],
                [t("heroStatC"), t("heroStatCLabel")],
              ].map(([value, label]) => (
                <div key={label}>
                  <dt className="sr-only">{label}</dt>
                  <dd className="font-display text-3xl font-extrabold text-optic">{value}</dd>
                  <dd className="text-xs text-white/70">{label}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="animate-in fade-in zoom-in-95 duration-1000">
            <CourtIllustration className="mx-auto max-w-xl drop-shadow-2xl" />
          </div>
        </div>
        <div className="h-1.5 bg-accent" aria-hidden />
      </div>

      {/* How it works */}
      <Section id="how">
        <SectionHeading eyebrow="01" title={t("howTitle")} subtitle={t("howSubtitle")} />
        <ol className="grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="relative rounded-2xl border bg-card p-6 transition-all hover:-translate-y-0.5 hover:shadow-lg">
              <span className="absolute top-5 right-6 font-display text-6xl font-extrabold text-muted" aria-hidden>
                {i + 1}
              </span>
              <s.icon className="size-8 text-primary" aria-hidden />
              <h3 className="mt-4 font-display text-2xl font-extrabold uppercase">{s.title}</h3>
              <p className="mt-2 text-muted-foreground">{s.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* Machines */}
      <div className="bg-muted/40">
        <Section id="machines">
          <SectionHeading eyebrow="02" title={t("machinesTitle")} subtitle={t("machinesSubtitle")} />
          <Suspense fallback={<MachineCardsSkeleton />}>
            <HomeMachines />
          </Suspense>
        </Section>
      </div>

      {/* Pricing */}
      <Section id="pricing">
        <SectionHeading eyebrow="03" title={t("pricingTitle")} subtitle={t("pricingSubtitle")} />
        <Suspense fallback={<PricingGridSkeleton />}>
          <HomePricing />
        </Suspense>
        <div className="mt-8">
          <Button asChild variant="link" className="px-0">
            <Link href="/pricing">
              {tc("seePricing")} <ArrowRight />
            </Link>
          </Button>
        </div>
      </Section>

      {/* Testimonials */}
      <div className="court-lines bg-court text-white">
        <Section>
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <h2 className="font-display text-4xl font-extrabold uppercase sm:text-5xl">{t("testimonialsTitle")}</h2>
            <Badge variant="accent">{tc("sampleBadge")}</Badge>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {testimonials.map((r, i) => (
              <figure key={i} className="rounded-2xl border border-white/15 bg-white/5 p-6 backdrop-blur">
                <Quote className="size-6 text-optic" aria-hidden />
                <blockquote className="mt-3 text-lg">“{r.quote}”</blockquote>
                <figcaption className="mt-4 text-sm text-white/70">
                  {r.name} · {r.meta}
                </figcaption>
              </figure>
            ))}
          </div>
          <p className="mt-6 text-xs text-white/60">{t("testimonialsNote")}</p>
        </Section>
      </div>

      {/* FAQ */}
      <Section id="faq" className="max-w-3xl">
        <SectionHeading title={t("faqTitle")} align="center" />
        <FaqList items={faq} />
        <div className="mt-6 text-center">
          <Button asChild variant="link">
            <Link href="/how-it-works#faq">
              {tc("learnMore")} <ArrowRight />
            </Link>
          </Button>
        </div>
      </Section>

      {/* CTA */}
      <Section className="pt-0">
        <div className="relative overflow-hidden rounded-3xl bg-accent p-8 text-accent-foreground sm:p-12">
          <div className="max-w-xl">
            <h2 className="font-display text-5xl leading-[0.9] font-extrabold uppercase sm:text-6xl">{t("ctaTitle")}</h2>
            <p className="mt-4 text-lg">{t("ctaBody")}</p>
            <Button asChild size="lg" className="mt-6">
              <Link href="/book">
                {t("ctaButton")} <ArrowRight />
              </Link>
            </Button>
          </div>
          <svg viewBox="0 0 200 200" className="absolute -right-10 -bottom-10 size-64 opacity-30 sm:size-80" aria-hidden>
            <circle cx="100" cy="100" r="90" fill="none" stroke="currentColor" strokeWidth="6" />
            <path d="M10 80h180M100 80v110" stroke="currentColor" strokeWidth="6" fill="none" />
          </svg>
        </div>
      </Section>
    </>
  );
}

async function HomeMachines() {
  await connection();
  const machines = await listPublicMachines();
  return <MachineCards machines={machines} />;
}

async function HomePricing() {
  await connection();
  const [products, addOns, machines] = await Promise.all([listActiveProducts(), listActiveAddOns(), listPublicMachines()]);
  const deposit = machines.find((m) => m.bookable)?.depositCents ?? 30000;
  return <PricingGrid products={products} addOns={addOns} depositCents={deposit} compact />;
}
