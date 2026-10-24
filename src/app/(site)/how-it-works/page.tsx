import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/json-ld";
import { faqPageLd } from "@/lib/services/structured-data";
import { getTranslations } from "next-intl/server";
import { CircleDollarSign, CloudRain, MapPin, RotateCcw, Truck, XCircle } from "lucide-react";
import { FaqList } from "@/components/marketing/faq-list";
import { ZoneMap } from "@/components/marketing/zone-map";
import { DeliveryZoneTable } from "@/components/marketing/delivery-service";
import { PageHero, Section, SectionHeading } from "@/components/marketing/section";
import { revealDelay } from "@/components/marketing/reveal-delay";
import { faqItems } from "@/lib/services/faq";
import { publicCatalog, publicCourts, publicPolicies, publicPricing } from "@/lib/services/public-data";
import { ScoreSteps } from "@/components/marketing/score-steps";
import { formatCentsShort } from "@/lib/money";

export const metadata: Metadata = {
  title: "How it works & FAQ",
  description:
    "How renting an AI tennis ball machine in Victoria works: booking, delivery to your door or next to your court, the refundable deposit, rain policy and more.",
};

export default async function HowItWorksPage() {
  const t = await getTranslations("how");

  return (
    <>
      <PageHero title={t("title")} subtitle={t("subtitle")} />
      <Section id="steps">
        <SectionHeading title={t("stepsTitle")} subtitle={t("stepsSubtitle")} />
        <ScoreSteps />
        <StepDetails />
      </Section>
      <Section className="pt-0">
        <Topics />
      </Section>
      <DeliveryZone />
      <Section id="faq" className="max-w-3xl pt-0">
        <SectionHeading title={t("faqTitle")} align="center" />
        <div data-reveal>
          <Faq />
        </div>
      </Section>
    </>
  );
}

// Cached data → the answers are in the server HTML (visible without JavaScript).
async function Faq() {
  const items = await faqItems();
  return (
    <>
      <JsonLd data={faqPageLd(items)} />
      <FaqList items={items} />
    </>
  );
}

/** The four steps, with the details people ask about (delivery, deposit hold, return, rain). */
async function StepDetails() {
  const t = await getTranslations("how");
  const [ctx, p] = await Promise.all([publicPricing(), publicPolicies()]);
  const details = [
    t("step1Detail"),
    t("step2Detail", { short: formatCentsShort(ctx.deposit.short) }),
    t("step3Detail"),
    t("step4Detail", { grace: p.lateGraceMinutes, hourly: formatCentsShort(p.lateHourlyCents) }),
  ];
  return (
    <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {details.map((text, i) => (
        <li key={i} className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">Step {i + 1}. </span>
          {text}
        </li>
      ))}
    </ol>
  );
}

async function Topics() {
  const t = await getTranslations("how");
  const zone1 = (await publicCatalog()).deliveryZones[0];
  const prices = {
    trip: formatCentsShort(zone1?.tripCents ?? 1500),
    round: formatCentsShort(zone1?.roundTripCents ?? 2500),
  };
  const topics = [
    { id: "delivery", icon: Truck, title: t("deliveryTitle"), body: t("deliveryBody", prices) },
    { id: "returns", icon: RotateCcw, title: t("returnTitle"), body: t("returnBody") },
    { id: "deposit", icon: CircleDollarSign, title: t("depositTitle"), body: t("depositBody") },
    { id: "rain", icon: CloudRain, title: t("rainTitle"), body: t("rainBody") },
    { id: "cancellation", icon: XCircle, title: t("cancelTitle"), body: t("cancelBody") },
    {
      id: "balls",
      icon: () => (
        <svg
          viewBox="0 0 24 24"
          className="size-7 text-primary"
          aria-hidden
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M5 6c3 3 3 9 0 12M19 6c-3 3-3 9 0 12" />
        </svg>
      ),
      title: t("ballsTitle"),
      body: t("ballsBody"),
    },
  ];
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {topics.map((topic, i) => (
        <article
          key={topic.id}
          id={topic.id}
          data-reveal
          style={revealDelay(i % 3)}
          className="scroll-mt-24 rounded-2xl border bg-card p-6"
        >
          <topic.icon className="size-7 text-primary" aria-hidden />
          <h2 className="mt-3 font-display text-2xl font-extrabold uppercase">{topic.title}</h2>
          <p className="mt-2 text-muted-foreground">{topic.body}</p>
        </article>
      ))}
    </div>
  );
}

async function DeliveryZone() {
  const t = await getTranslations("how");
  const [{ deliveryZones, hub }, courts] = await Promise.all([publicCatalog(), publicCourts()]);
  return (
    <Section id="zone" className="pt-0">
      <div className="grid gap-8 lg:grid-cols-[1fr_2fr]">
        <div data-reveal="left">
          <h2 className="font-display text-3xl font-extrabold uppercase">{t("zoneTitle")}</h2>
          <p className="mt-3 text-muted-foreground">{t("zoneBody")}</p>
          <div className="mt-5">
            <DeliveryZoneTable zones={deliveryZones} />
          </div>
          <h3 className="mt-6 font-semibold">{t("courtsTitle")}</h3>
          <ul className="mt-2 space-y-1.5 text-sm">
            {courts.map((c) => (
              <li key={c.id} className="flex gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <span>
                  <span className="font-medium">{c.name}</span>
                  <span className="block text-muted-foreground">{c.address}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <ZoneMap
          label={t("zoneMapLabel")}
          center={hub}
          radiiKm={deliveryZones.map((z) => z.maxKm)}
          courts={courts.map((c) => ({ lat: c.lat, lng: c.lng, label: c.name }))}
        />
      </div>
    </Section>
  );
}
