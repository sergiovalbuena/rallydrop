import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { CircleCheckBig } from "lucide-react";
import { BookingUnavailable } from "@/components/booking/booking-unavailable";
import { ContactPayFlow } from "@/components/booking/contact-pay-flow";
import { Section } from "@/components/marketing/section";
import { Skeleton } from "@/components/ui/skeleton";
import { chargedTaxes } from "@/lib/domain/rental";
import { formatCentsShort } from "@/lib/money";
import { databaseConfigured } from "@/lib/services/fallback";
import { currentLegal, toConsentDocs } from "@/lib/services/legal";
import { getSettings } from "@/lib/services/settings";
import { springPassOffer } from "@/lib/services/spring-pass";
import { startSpringPassAction } from "../extra-actions";

export const metadata: Metadata = { title: "Spring Pass" };

export default function SpringPassPage({ searchParams }: PageProps<"/book/spring-pass">) {
  return (
    <Section className="max-w-xl pt-8">
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <SpringPass searchParams={searchParams} />
      </Suspense>
    </Section>
  );
}

async function SpringPass({ searchParams }: { searchParams: PageProps<"/book/spring-pass">["searchParams"] }) {
  await connection();
  if (!databaseConfigured()) return <BookingUnavailable />;
  const [offer, settings, t, sp] = await Promise.all([
    springPassOffer(),
    getSettings(),
    getTranslations("springPass"),
    searchParams,
  ]);
  // Switched off in the admin → the page doesn't exist.
  if (!offer) notFound();
  if (sp.done) {
    return (
      <div className="rounded-3xl border bg-card p-8 text-center">
        <CircleCheckBig className="mx-auto size-12 text-success" />
        <h1 className="mt-4 font-display text-4xl font-extrabold uppercase">{t("doneTitle")}</h1>
        <p className="mt-2 text-muted-foreground">{t("doneBody")}</p>
      </div>
    );
  }
  const taxes = chargedTaxes(settings);
  return (
    <div className="space-y-6">
      <div className="court-lines rounded-2xl bg-court p-6 text-white">
        <h1 className="font-display text-4xl font-extrabold uppercase">{t("title")}</h1>
        <p className="mt-1 font-display text-3xl font-extrabold text-optic">{formatCentsShort(offer.priceCents)}</p>
        <p className="mt-2 text-sm text-white/80">
          {t("body", { weekends: offer.weekends, window: offer.windowLabel })}
        </p>
        <p className="mt-2 text-xs text-white/60">
          {t("left", { left: offer.left, limit: offer.limit })} ·{" "}
          {taxes.gstBps + taxes.pstBps > 0 ? t("plusTax") : t("cad")}
        </p>
      </div>
      {offer.left > 0 ? (
        <ContactPayFlow
          targetId="spring-pass"
          start={startSpringPassAction}
          consentDocs={toConsentDocs(await currentLegal())}
          successPath="/book/spring-pass?done=1"
          cta={t("cta", { price: formatCentsShort(offer.priceCents) })}
        />
      ) : (
        <p className="rounded-2xl border p-5 text-muted-foreground">{t("soldOut")}</p>
      )}
    </div>
  );
}
