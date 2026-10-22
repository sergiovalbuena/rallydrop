import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { ArrowRight, Check } from "lucide-react";
import { CourtIllustration } from "@/components/brand/court-illustration";
import { DeliveryService, DeliveryServiceSkeleton } from "@/components/marketing/delivery-service";
import { FaqList } from "@/components/marketing/faq-list";
import { MachineFeature } from "@/components/marketing/machine-cards";
import { PricingGrid, PricingGridSkeleton } from "@/components/marketing/pricing-grid";
import { Scorebug, ScorebugSkeleton } from "@/components/marketing/scorebug";
import { ScoreSteps } from "@/components/marketing/score-steps";
import { Section, SectionHeading } from "@/components/marketing/section";
import { StickyBookBar } from "@/components/marketing/sticky-book-bar";
import { revealDelay } from "@/components/marketing/reveal-delay";
import { Ticker } from "@/components/marketing/ticker";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCentsShort } from "@/lib/money";
import { listActiveAddOns, listActiveProducts, listPublicMachines } from "@/lib/services/catalog";
import { pricingContext } from "@/lib/services/pricing-context";
import { faqItems } from "@/lib/services/faq";
import { publicReviews } from "@/lib/services/reviews";
import { formatLocal } from "@/lib/time";
import { getSettings } from "@/lib/services/settings";

export default async function HomePage() {
  const t = await getTranslations("home");
  const tc = await getTranslations("common");
  const trust = [t("trust1"), t("trust2"), t("trust3")];

  return (
    <>
      {/* Hero — night session under the floodlights */}
      <div className="court-lines floodlight grain lights-on relative overflow-hidden bg-court text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 pt-10 pb-12 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:gap-12 lg:pt-20 lg:pb-20">
          <div>
            <p className="mb-5 inline-flex animate-in items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-optic uppercase duration-500 fade-in">
              {t("eyebrow")}
            </p>
            <h1 className="font-display text-[3.4rem] leading-[0.9] font-black uppercase sm:text-8xl lg:text-[6.25rem] xl:text-[6.75rem]">
              <span className="block animate-in duration-700 fade-in slide-in-from-bottom-3">{t("heroTitleA")}</span>
              <span className="block animate-in text-optic delay-150 duration-700 fill-mode-both fade-in slide-in-from-bottom-3">
                {t("heroTitleB")}
              </span>
            </h1>
            <p className="mt-6 max-w-xl animate-in text-lg text-pretty text-white/80 delay-300 duration-700 fill-mode-both fade-in">
              {t("heroBody")}
            </p>
            <div id="hero-cta" className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                variant="accent"
                className="h-14 text-base shadow-[0_0_40px_-8px] shadow-optic/60"
              >
                <Link href="/book">
                  {tc("bookNow")} <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="inverted" className="h-14 text-base">
                <Link href="/pricing">{tc("seePricing")}</Link>
              </Button>
            </div>
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/75">
              {trust.map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <Check className="size-4 text-optic" aria-hidden /> {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-4">
            <CourtIllustration className="mx-auto max-w-[34rem] animate-in drop-shadow-2xl duration-1000 zoom-in-95 fade-in" />
            <Suspense fallback={<ScorebugSkeleton />}>
              <Scorebug />
            </Suspense>
          </div>
        </div>
      </div>
      <Ticker />

      {/* How it works — scored like a tennis game */}
      <Section id="how">
        <SectionHeading title={t("scoreTitle")} subtitle={t("scoreSubtitle")} />
        <ScoreSteps />
      </Section>

      {/* Machine */}
      <div className="bg-muted/40">
        <Section id="machines">
          <SectionHeading title={t("machinesTitle")} subtitle={t("machinesSubtitle")} />
          <Suspense fallback={<Skeleton className="h-[28rem] rounded-3xl" />}>
            <HomeMachines />
          </Suspense>
        </Section>
      </div>

      {/* Pricing */}
      <Section id="pricing">
        <SectionHeading title={t("pricingTitle")} subtitle={t("pricingSubtitle")} />
        <Suspense fallback={<PricingGridSkeleton />}>
          <HomePricing />
        </Suspense>
        <Button asChild variant="link" className="mt-6 px-0">
          <Link href="/pricing">
            {tc("seePricing")} <ArrowRight />
          </Link>
        </Button>
      </Section>

      {/* Paid drop-off & collection */}
      <div className="bg-muted/40">
        <Section id="delivery">
          <SectionHeading eyebrow={t("deliveryEyebrow")} title={t("deliveryTitle")} subtitle={t("deliverySubtitle")} />
          <Suspense fallback={<DeliveryServiceSkeleton />}>
            <HomeDelivery />
          </Suspense>
        </Section>
      </div>

      {/* Real reviews only — the section appears once 2+ are published in the admin. */}
      <Suspense>
        <Testimonials />
      </Suspense>

      {/* FAQ */}
      <Section id="faq" className="max-w-3xl">
        <SectionHeading title={t("faqTitle")} align="center" />
        <div data-reveal>
          <Suspense fallback={<Skeleton className="h-72 rounded-2xl" />}>
            <HomeFaq />
          </Suspense>
        </div>
        <div className="mt-6 text-center">
          <Button asChild variant="link">
            <Link href="/how-it-works#faq">
              {tc("learnMore")} <ArrowRight />
            </Link>
          </Button>
        </div>
      </Section>

      {/* Final CTA */}
      <Section className="pt-0 pb-28 sm:pb-20">
        <div
          data-reveal="scale"
          className="relative isolate overflow-hidden rounded-3xl bg-accent p-8 text-accent-foreground sm:p-14"
        >
          <svg
            viewBox="0 0 200 200"
            className="animate-spin-slow absolute -top-16 -right-20 -z-10 size-72 text-accent-foreground/15 sm:-top-10 sm:-right-10 sm:size-96"
            aria-hidden
          >
            <circle cx="100" cy="100" r="90" fill="none" stroke="currentColor" strokeWidth="6" />
            <path d="M10 80h180M100 80v110" stroke="currentColor" strokeWidth="6" fill="none" />
          </svg>
          <div className="max-w-xl">
            <h2 className="font-display text-6xl leading-[0.85] font-black uppercase sm:text-7xl">{t("ctaTitle")}</h2>
            <p className="mt-4 text-lg">{t("ctaBody")}</p>
            <Button asChild size="lg" className="mt-7 h-14 text-base">
              <Link href="/book">
                {t("ctaButton")} <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </Section>

      <Suspense>
        <StickyBar />
      </Suspense>
    </>
  );
}

async function HomeMachines() {
  await connection();
  return <MachineFeature machines={await listPublicMachines()} />;
}

async function Testimonials() {
  await connection();
  const reviews = await publicReviews();
  if (reviews.length === 0) return null;
  const t = await getTranslations("home");
  return (
    <div className="court-lines floodlight grain bg-court text-white">
      <Section>
        <h2 data-reveal className="mb-8 font-display text-5xl font-black uppercase sm:text-6xl">
          {t("testimonialsTitle")}
        </h2>
        <div
          role="region"
          aria-label={t("testimonialsTitle")}
          tabIndex={0}
          className="-mx-4 flex snap-x snap-mandatory [scrollbar-width:none] gap-4 overflow-x-auto px-4 pb-2 focus-visible:outline-optic sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0"
        >
          {reviews.map((r, i) => (
            <figure
              key={r.id}
              data-reveal
              style={revealDelay(i, 120)}
              className="w-[82%] shrink-0 snap-center rounded-2xl border border-white/15 bg-white/[0.06] p-6 backdrop-blur sm:w-auto"
            >
              <p className="text-optic" aria-label={`${r.rating} out of 5 stars`}>
                {"★".repeat(r.rating)}
              </p>
              <blockquote className="mt-3 text-lg leading-snug">“{r.text}”</blockquote>
              <figcaption className="mt-4 text-sm text-white/65">
                {r.customerName} · {formatLocal(r.reviewedOn, "MMMM yyyy")}
              </figcaption>
            </figure>
          ))}
        </div>
      </Section>
    </div>
  );
}

async function HomeFaq() {
  await connection();
  const ids = ["where", "delivery", "deposit", "rain", "easy"];
  const items = (await faqItems()).filter((i) => ids.includes(i.id));
  return <FaqList items={items} />;
}

async function HomeDelivery() {
  await connection();
  const settings = await getSettings();
  return <DeliveryService zones={settings.deliveryZones} />;
}

async function HomePricing() {
  await connection();
  const [products, addOns, machines] = await Promise.all([
    listActiveProducts(),
    listActiveAddOns(),
    listPublicMachines(),
  ]);
  const ctx = await pricingContext(machines);
  return <PricingGrid products={products} addOns={addOns} ctx={ctx} compact />;
}

async function StickyBar() {
  await connection();
  const t = await getTranslations("home");
  const tc = await getTranslations("common");
  const products = await listActiveProducts();
  const from = Math.min(...products.filter((p) => p.kind === "DAY").map((p) => p.priceCents), 4500);
  return (
    <StickyBookBar watchId="hero-cta" label={t("stickyFrom", { price: formatCentsShort(from) })} cta={tc("bookNow")} />
  );
}
