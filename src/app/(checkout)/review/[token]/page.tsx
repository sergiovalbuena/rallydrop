import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CircleCheck } from "lucide-react";
import { Section } from "@/components/marketing/section";
import { Skeleton } from "@/components/ui/skeleton";
import { reviewTarget } from "@/lib/services/review-requests";
import { formatRange } from "@/lib/time";
import { ReviewForm } from "./review-form";

export const metadata: Metadata = { title: "Leave a review", robots: { index: false } };

export default function ReviewPage({ params }: PageProps<"/review/[token]">) {
  return (
    <Section className="max-w-2xl pt-8">
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <Review params={params} />
      </Suspense>
    </Section>
  );
}

async function Review({ params }: { params: PageProps<"/review/[token]">["params"] }) {
  await connection();
  const { token } = await params;
  const target = await reviewTarget(token);
  if (!target) notFound();
  const { booking, done } = target;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl font-extrabold uppercase sm:text-5xl">How was your rally?</h1>
        <p className="mt-2 text-muted-foreground">
          {booking.product.name} · {booking.machine.name} · {formatRange(booking.startsAt, booking.endsAt)}
        </p>
      </div>
      {done ? (
        <p className="flex items-center gap-2 rounded-2xl bg-success/10 p-4 font-medium text-success" role="status">
          <CircleCheck className="size-5 shrink-0" aria-hidden /> Thanks — we already have your review.
        </p>
      ) : (
        <ReviewForm token={token} />
      )}
    </div>
  );
}
