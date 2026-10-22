import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Section } from "@/components/marketing/section";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from "@/lib/db";
import { bookingAcceptance, bookingIdFromToken, currentLegal, toConsentDocs } from "@/lib/services/legal";
import { formatRange } from "@/lib/time";
import { AcceptForm } from "./accept-form";

export const metadata: Metadata = { title: "Accept the rental terms", robots: { index: false } };

export default function AcceptPage({ params }: PageProps<"/accept/[token]">) {
  return (
    <Section className="max-w-2xl pt-8">
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <Accept params={params} />
      </Suspense>
    </Section>
  );
}

async function Accept({ params }: { params: PageProps<"/accept/[token]">["params"] }) {
  await connection();
  const { token } = await params;
  const bookingId = bookingIdFromToken(token);
  if (!bookingId) notFound();
  const t = await getTranslations("accept");
  const [booking, accepted, legal] = await Promise.all([
    db.booking.findUnique({ where: { id: bookingId }, include: { product: true, machine: true } }),
    bookingAcceptance(bookingId),
    currentLegal(),
  ]);
  if (!booking) notFound();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl font-extrabold uppercase sm:text-5xl">{t("title")}</h1>
        <p className="mt-2 text-muted-foreground">
          {booking.code} · {booking.product.name} · {booking.machine.name}
          <br />
          {formatRange(booking.startsAt, booking.endsAt)}
        </p>
      </div>
      {accepted ? (
        <p className="rounded-2xl bg-success/10 p-4 font-medium text-success" role="status">
          {t("already", { date: accepted.acceptedAtLocal })}
        </p>
      ) : (
        <AcceptForm token={token} docs={toConsentDocs(legal)} />
      )}
    </div>
  );
}
