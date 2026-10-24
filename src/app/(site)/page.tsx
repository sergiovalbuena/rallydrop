import Link from "next/link";
import { JsonLd } from "@/components/seo/json-ld";
import { faqPageLd, localBusinessLd } from "@/lib/services/structured-data";
import { getSiteInfo } from "@/lib/services/site-info";
import { getTranslations } from "next-intl/server";
import { ArrowRight, Check } from "lucide-react";
import { CourtIllustration } from "@/components/brand/court-illustration";
import { DeliveryService } from "@/components/marketing/delivery-service";
import { FaqList } from "@/components/marketing/faq-list";
import { MachineFeature } from "@/components/marketing/machine-cards";
import { PricingGrid } from "@/components/marketing/pricing-grid";
import { Scorebug } from "@/components/marketing/scorebug";
import { ScoreSteps } from "@/components/marketing/score-steps";
import { Section, SectionHeading } from "@/components/marketing/section";
import { StickyBookBar } from "@/components/marketing/sticky-book-bar";
import { revealDelay } from "@/components/marketing/reveal-delay";
import { AiCoachIncluded } from "@/components/marketing/machine-guides";
import { Ticker } from "@/components/marketing/ticker";
import { Button } from "@/components/ui/button";
import { PhotoSlot } from "@/components/marketing/photo-slot";
import { PHOTOS } from "@/config/photos";
import { formatCentsShort } from "@/lib/money";
import { faqItems } from "@/lib/services/faq";
import { heroStats, publicCatalog, publicPricing } from "@/lib/services/public-data";
import { publicReviews } from "@/lib/services/reviews";
import { formatLocal } from "@/lib/time";

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
            <PhotoSlot
              media={PHOTOS.hero}
              label="Player rallying against the Aura S"
              sizes="(min-width: 1024px) 34rem, 100vw"
              priority
              className="mx-auto aspect-[4/3] max-w-[34rem] shadow-2xl"
              fallback={
                <CourtIllustration className="mx-auto max-w-[34rem] animate-in drop-shadow-2xl duration-1000 zoom-in-95 fade-in" />
              }
            />
            <Scorebug />
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
          <HomeMachines />
        </Section>
      </div>

      {/* The Spotter: an AI practice assistant in every rental */}
      <Section id="ai-coach">
        <AiCoachIncluded />
      </Section>

      {/* Pricing */}
      <div className="bg-muted/40">
        <Section id="pricing">
          <SectionHeading title={t("pricingTitle")} subtitle={t("pricingSubtitle")} />
          <HomePricing />
          <Button asChild variant="link" className="mt-6 px-0">
            <Link href="/pricing">
              {tc("seePricing")} <ArrowRight />
            </Link>
          </Button>
        </Section>
      </div>

      {/* Paid drop-off & collection */}
      <div>
        <Section id="delivery">
          <SectionHeading eyebrow={t("deliveryEyebrow")} title={t("deliveryTitle")} subtitle={t("deliverySubtitle")} />
          <HomeDelivery />
        </Section>
      </div>

      {/* Real reviews only — the section appears once 2+ are published in the admin. */}
      <Testimonials />

      {/* FAQ */}
      <Section id="faq" className="max-w-3xl">
        <SectionHeading title={t("faqTitle")} align="center" />
        <div data-reveal>
          <HomeFaq />
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

      <StickyBar />
    </>
  );
}

/*
 * Every section below reads cached data (lib/services/public-data), so it is
 * rendered into the HTML on the server — visible without JavaScript and to
 * search engines — instead of streaming in after load.
 */

async function HomeMachines() {
  const [{ machines }, site] = await Promise.all([publicCatalog(), getSiteInfo()]);
  return (
    <>
      <JsonLd data={localBusinessLd(site)} />
      <MachineFeature machines={machines} />
    </>
  );
}

async function Testimonials() {
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
  const ids = ["where", "delivery", "deposit", "rain", "late"];
  const items = (await faqItems()).filter((i) => ids.includes(i.id));
  return (
    <>
      <JsonLd data={faqPageLd(items)} />
      <FaqList items={items} />
    </>
  );
}

async function HomeDelivery() {
  const { deliveryZones } = await publicCatalog();
  return <DeliveryService zones={deliveryZones} />;
}

async function HomePricing() {
  const [{ products, addOns }, ctx] = await Promise.all([publicCatalog(), publicPricing()]);
  return <PricingGrid products={products} addOns={addOns} ctx={ctx} compact />;
}

async function StickyBar() {
  const t = await getTranslations("home");
  const tc = await getTranslations("common");
  const { dayCents } = await heroStats();
  return (
    <StickyBookBar
      watchId="hero-cta"
      label={t("stickyFrom", { price: formatCentsShort(dayCents ?? 4500) })}
      cta={tc("bookNow")}
    />
  );
}
