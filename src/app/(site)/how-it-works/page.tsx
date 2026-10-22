import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { CircleDollarSign, CloudRain, MapPin, RotateCcw, Truck, XCircle } from "lucide-react";
import { FaqList } from "@/components/marketing/faq-list";
import { ZoneMap } from "@/components/marketing/zone-map";
import { DeliveryZoneTable } from "@/components/marketing/delivery-service";
import { listCourtsWithLocation } from "@/lib/services/catalog";
import { getSettings } from "@/lib/services/settings";
import { PageHero, Section, SectionHeading } from "@/components/marketing/section";
import { Skeleton } from "@/components/ui/skeleton";
import { revealDelay } from "@/components/marketing/reveal-delay";
import { formatCentsShort } from "@/lib/money";

export const metadata: Metadata = { title: "How it works & FAQ" };

export default async function HowItWorksPage() {
  const t = await getTranslations("how");
  const faq = [1, 2, 3, 4, 5].map((i) => ({ q: t(`q${i}` as "q1"), a: t(`a${i}` as "a1") }));

  return (
    <>
      <PageHero title={t("title")} subtitle={t("subtitle")} />
      <Section>
        <Suspense fallback={<TopicsSkeleton />}>
          <Topics />
        </Suspense>
      </Section>
      <Suspense
        fallback={
          <Section className="pt-0">
            <Skeleton className="h-96 rounded-2xl" />
          </Section>
        }
      >
        <DeliveryZone />
      </Suspense>
      <Section id="faq" className="max-w-3xl pt-0">
        <SectionHeading title={t("faqTitle")} align="center" />
        <div data-reveal>
          <FaqList items={faq} />
        </div>
      </Section>
    </>
  );
}

function TopicsSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} className="h-48 rounded-2xl" />
      ))}
    </div>
  );
}

async function Topics() {
  await connection();
  const t = await getTranslations("how");
  const zone1 = (await getSettings()).deliveryZones[0];
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
  await connection();
  const t = await getTranslations("how");
  const [settings, courts] = await Promise.all([getSettings(), listCourtsWithLocation()]);
  return (
    <Section id="zone" className="pt-0">
      <div className="grid gap-8 lg:grid-cols-[1fr_2fr]">
        <div data-reveal="left">
          <h2 className="font-display text-3xl font-extrabold uppercase">{t("zoneTitle")}</h2>
          <p className="mt-3 text-muted-foreground">{t("zoneBody")}</p>
          <div className="mt-5">
            <DeliveryZoneTable zones={settings.deliveryZones} />
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
          center={{ lat: settings.deliveryHubLat, lng: settings.deliveryHubLng }}
          radiiKm={settings.deliveryZones.map((z) => z.maxKm)}
          courts={courts.map((c) => ({ lat: c.lat, lng: c.lng, label: c.name }))}
        />
      </div>
    </Section>
  );
}
