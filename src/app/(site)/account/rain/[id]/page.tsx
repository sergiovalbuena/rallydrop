import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CalendarClock, CloudRain } from "lucide-react";
import { Section } from "@/components/marketing/section";
import { RainCreditButton } from "@/components/portal/rain-credit-button";
import { SignInForm } from "@/components/portal/sign-in-form";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from "@/lib/db";
import { creditExpiry } from "@/lib/domain/credit";
import { formatCents } from "@/lib/money";
import { isRainEligible } from "@/lib/services/credits";
import { getPortalCustomer } from "@/lib/services/portal-auth";
import { getSettings } from "@/lib/services/settings";
import { formatLocal, formatRange } from "@/lib/time";

export const metadata: Metadata = { title: "Rained out?", robots: { index: false } };

export default function RainPage({ params }: PageProps<"/account/rain/[id]">) {
  return (
    <Section className="max-w-3xl pt-8">
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <Rain params={params} />
      </Suspense>
    </Section>
  );
}

async function Rain({ params }: { params: PageProps<"/account/rain/[id]">["params"] }) {
  // Rain-day emails link here: signing in brings the customer straight back.
  const customer = await getPortalCustomer();
  if (!customer) return <SignInForm linkExpired={false} />;
  const { id } = await params;
  const booking = await db.booking.findFirst({
    where: { id, customerId: customer.id },
    include: { product: true, payments: { where: { kind: "RENTAL" } } },
  });
  if (!booking) notFound();
  const t = await getTranslations("rain");
  const now = new Date();
  const [eligible, settings] = await Promise.all([isRainEligible(booking, now), getSettings()]);
  const paid = booking.payments
    .filter((p) => p.status === "SUCCEEDED" || p.status === "PARTIALLY_REFUNDED")
    .reduce((s, p) => s + p.amountCents - p.refundedCents, 0);
  const credit = paid + booking.creditCents;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-3 font-display text-5xl font-extrabold uppercase">
          <CloudRain className="size-10 text-primary" aria-hidden /> {t("title")}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {t("intro", { code: booking.code, when: formatRange(booking.startsAt, booking.endsAt) })}
        </p>
      </div>
      {!eligible ? (
        <p className="rounded-2xl border bg-muted/40 p-5">{t("notEligible")}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-3 rounded-2xl border bg-card p-6">
            <CalendarClock className="size-7 text-primary" aria-hidden />
            <h2 className="font-display text-2xl font-extrabold uppercase">{t("rescheduleTitle")}</h2>
            <p className="text-muted-foreground">{t("rescheduleBody")}</p>
            <Button asChild className="mt-auto">
              <Link href={`/account/reschedule/${booking.id}`}>{t("rescheduleCta")}</Link>
            </Button>
          </div>
          <div className="flex flex-col gap-3 rounded-2xl border bg-card p-6">
            <CloudRain className="size-7 text-primary" aria-hidden />
            <h2 className="font-display text-2xl font-extrabold uppercase">{t("creditTitle")}</h2>
            <p className="text-muted-foreground">
              {booking.subscriptionId
                ? t("creditBodyPackage")
                : credit === 0
                  ? t("creditBodyNone")
                  : t("creditBody", {
                      amount: formatCents(credit),
                      date: formatLocal(creditExpiry(now, settings.rainCreditMonths), "MMM d, yyyy"),
                    })}
            </p>
            <RainCreditButton bookingId={booking.id} code={booking.code} />
          </div>
        </div>
      )}
    </div>
  );
}
