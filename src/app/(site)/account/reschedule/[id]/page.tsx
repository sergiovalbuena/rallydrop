import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { Section } from "@/components/marketing/section";
import { RescheduleClient } from "@/components/portal/reschedule-client";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from "@/lib/db";
import { getPortalCustomer } from "@/lib/services/portal-auth";
import { formatRange } from "@/lib/time";

export const metadata: Metadata = { title: "Reschedule", robots: { index: false } };

export default function ReschedulePage({ params }: PageProps<"/account/reschedule/[id]">) {
  return (
    <Section className="pt-8">
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <Reschedule params={params} />
      </Suspense>
    </Section>
  );
}

async function Reschedule({ params }: { params: PageProps<"/account/reschedule/[id]">["params"] }) {
  const customer = await getPortalCustomer();
  if (!customer) redirect("/account");
  const { id } = await params;
  const booking = await db.booking.findFirst({
    where: { id, customerId: customer.id, status: "CONFIRMED" },
    include: { product: true, machine: true },
  });
  if (!booking) notFound();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-5xl font-extrabold uppercase">Reschedule {booking.code}</h1>
        <p className="mt-2 text-muted-foreground">
          {booking.product.name} · {booking.machine.name} · now {formatRange(booking.startsAt, booking.endsAt)}
        </p>
      </div>
      <RescheduleClient bookingId={booking.id} productId={booking.productId} machineId={booking.machineId} />
    </div>
  );
}
