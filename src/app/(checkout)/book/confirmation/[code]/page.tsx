import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CalendarPlus, CircleCheckBig, Clock, XCircle } from "lucide-react";
import { Section } from "@/components/marketing/section";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from "@/lib/db";
import { finalizeRentalPayment } from "@/lib/services/payments";
import { formatRange } from "@/lib/time";

export const metadata: Metadata = { title: "Booking confirmation", robots: { index: false } };

export default function ConfirmationPage({ params, searchParams }: PageProps<"/book/confirmation/[code]">) {
  return (
    <Section className="max-w-2xl">
      <Suspense fallback={<Skeleton className="h-80 rounded-2xl" />}>
        <Confirmation params={params} searchParams={searchParams} />
      </Suspense>
    </Section>
  );
}

async function Confirmation({
  params,
  searchParams,
}: {
  params: PageProps<"/book/confirmation/[code]">["params"];
  searchParams: PageProps<"/book/confirmation/[code]">["searchParams"];
}) {
  const t = await getTranslations("book");
  const { code } = await params;
  const { b } = await searchParams;
  const bookingId = Array.isArray(b) ? b[0] : b;
  // Both the code and the id are required, so links can't be guessed.
  const booking = bookingId
    ? await db.booking.findFirst({
        where: { id: bookingId, code },
        include: { customer: true, machine: true, product: true, court: true },
      })
    : null;
  if (!booking) notFound();

  // Covers redirect-based payments (3-D Secure) that return here directly.
  let status = booking.status;
  if (status === "PENDING_PAYMENT" || status === "EXPIRED") {
    const r = await finalizeRentalPayment(booking.id).catch(() => null);
    if (r?.status === "confirmed") status = "CONFIRMED";
    if (r?.status === "slot_lost") status = "CANCELLED";
  }

  const contact = booking.customer.email ?? booking.customer.phone ?? "";

  if (status === "CONFIRMED") {
    return (
      <div className="overflow-hidden rounded-3xl border bg-card text-center shadow-sm">
        <div className="court-lines bg-court px-6 py-10 text-white">
          <CircleCheckBig className="mx-auto size-14 text-optic" aria-hidden />
          <h1 className="mt-4 font-display text-5xl font-extrabold uppercase">{t("confirmedTitle")}</h1>
        </div>
        <div className="space-y-5 p-6 sm:p-10">
          <p className="text-muted-foreground">{t("confirmedBody")}</p>
          <p className="font-display text-5xl font-extrabold tracking-wider text-primary">{booking.code}</p>
          <p className="font-semibold">
            {booking.machine.name} · {booking.product.name}
          </p>
          <p className="text-muted-foreground">{formatRange(booking.startsAt, booking.endsAt)}</p>
          <p className="text-sm text-muted-foreground">{t("confirmedEmail", { contact })}</p>
          <div className="flex flex-col justify-center gap-3 pt-2 sm:flex-row">
            <Button asChild variant="outline">
              <a href={`/api/bookings/${booking.id}/ics?code=${booking.code}`}>
                <CalendarPlus /> {t("addToCalendar")}
              </a>
            </Button>
            <Button asChild>
              <Link href="/account">{t("manage")}</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const failed = status === "CANCELLED" || status === "EXPIRED";
  return (
    <div className="rounded-3xl border bg-card p-8 text-center">
      {failed ? (
        <XCircle className="mx-auto size-12 text-destructive" />
      ) : (
        <Clock className="mx-auto size-12 text-primary" />
      )}
      <h1 className="mt-4 font-display text-4xl font-extrabold uppercase">
        {failed ? t("failedTitle") : t("pendingTitle")}
      </h1>
      <p className="mt-3 text-muted-foreground">{failed ? t("failedBody") : t("pendingBody")}</p>
      <Button asChild className="mt-6">
        <Link href={failed ? "/book" : `/book/confirmation/${booking.code}?b=${booking.id}`}>
          {failed ? t("title") : "Refresh"}
        </Link>
      </Button>
    </div>
  );
}
