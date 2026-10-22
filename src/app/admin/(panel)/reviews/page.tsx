import { connection } from "next/server";
import { NewReviewForm, ReviewActions } from "@/components/admin/review-forms";
import { Empty, PageHeader, Panel } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { MIN_PUBLIC_REVIEWS } from "@/lib/services/reviews";
import { formatLocal, toLocalDate } from "@/lib/time";

/** Internal admin: always rendered per request, no instant-navigation shell. */
export const instant = false;

export default async function ReviewsPage() {
  await connection();
  const reviews = await db.review.findMany({ orderBy: { reviewedOn: "desc" } });
  const published = reviews.filter((r) => r.published).length;
  return (
    <>
      <PageHeader
        title="Reviews"
        description={`Real customer reviews only. The home page shows them once ${MIN_PUBLIC_REVIEWS} or more are published (now: ${published}).`}
      />
      <div className="space-y-6">
        <Panel title="Add a review">
          <NewReviewForm today={toLocalDate(new Date())} />
        </Panel>
        <Panel title="All reviews">
          {reviews.length === 0 ? (
            <Empty>No reviews yet.</Empty>
          ) : (
            <ul className="divide-y">
              {reviews.map((r) => (
                <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                      {r.customerName} <span className="text-warning">{"★".repeat(r.rating)}</span>
                      <span className="font-normal text-muted-foreground">
                        {formatLocal(r.reviewedOn, "MMM d, yyyy")}
                      </span>
                      <Badge variant={r.published ? "success" : "secondary"}>
                        {r.published ? "Published" : "Hidden"}
                      </Badge>
                    </p>
                    <p className="mt-1 text-sm">{r.text}</p>
                  </div>
                  <ReviewActions id={r.id} published={r.published} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
