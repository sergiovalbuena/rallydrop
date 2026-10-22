import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CircleCheck } from "lucide-react";
import { Section } from "@/components/marketing/section";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCents } from "@/lib/money";
import { depositCardStatus } from "@/lib/services/deposit-card";
import { DEPOSIT_CARD, idFromSigned } from "@/lib/services/links";
import { formatRange } from "@/lib/time";
import { CardUpdate } from "./card-update";

export const metadata: Metadata = { title: "Update your card", robots: { index: false } };

export default function DepositCardPage({ params }: PageProps<"/deposit/[token]">) {
  return (
    <Section className="max-w-2xl pt-8">
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <DepositCard params={params} />
      </Suspense>
    </Section>
  );
}

async function DepositCard({ params }: { params: PageProps<"/deposit/[token]">["params"] }) {
  await connection();
  const { token } = await params;
  const id = idFromSigned(DEPOSIT_CARD, token);
  if (!id) notFound();
  const status = await depositCardStatus(id);
  if (!status) notFound();
  const { booking, done } = status;
  const amount = formatCents(booking.deposit!.amountCents);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl font-extrabold uppercase sm:text-5xl">Update your card</h1>
        <p className="mt-2 text-muted-foreground">
          {booking.code} · {booking.product.name} · {booking.machine.name}
          <br />
          {formatRange(booking.startsAt, booking.endsAt)}
        </p>
      </div>
      {done ? (
        <p className="flex items-center gap-2 rounded-2xl bg-success/10 p-4 font-medium text-success" role="status">
          <CircleCheck className="size-5 shrink-0" aria-hidden /> Your deposit is in place — nothing to do.
        </p>
      ) : (
        <>
          <p>
            We couldn&apos;t place the refundable <strong>{amount}</strong> deposit hold on your card. Add a card below
            and we&apos;ll place it again right away. It&apos;s a hold, not a charge — released when the machine is back
            in good condition.
          </p>
          <CardUpdate token={token} amountLabel={amount} />
        </>
      )}
    </div>
  );
}
