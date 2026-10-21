import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { CircleDollarSign, CloudRain, RotateCcw, Truck, XCircle } from "lucide-react";
import { FaqList } from "@/components/marketing/faq-list";
import { PageHero, Section, SectionHeading } from "@/components/marketing/section";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from "@/lib/db";
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
      <Section id="faq" className="max-w-3xl pt-0">
        <SectionHeading title={t("faqTitle")} align="center" />
        <FaqList items={faq} />
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
  const delivery = await db.addOn.findUnique({ where: { kind: "DELIVERY" } });
  const fee = formatCentsShort(delivery?.priceCents ?? 1500);
  const topics = [
    { id: "delivery", icon: Truck, title: t("deliveryTitle"), body: t("deliveryBody", { fee }) },
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
      {topics.map((topic) => (
        <article key={topic.id} id={topic.id} className="scroll-mt-24 rounded-2xl border bg-card p-6">
          <topic.icon className="size-7 text-primary" aria-hidden />
          <h2 className="mt-3 font-display text-2xl font-extrabold uppercase">{topic.title}</h2>
          <p className="mt-2 text-muted-foreground">{topic.body}</p>
        </article>
      ))}
    </div>
  );
}
