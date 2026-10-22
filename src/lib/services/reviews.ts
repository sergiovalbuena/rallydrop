import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { readOr } from "./fallback";

export const REVIEWS_TAG = "reviews";

/** The site only shows a reviews section with at least this many. */
export const MIN_PUBLIC_REVIEWS = 2;

/** Published reviews, newest first; [] when fewer than MIN_PUBLIC_REVIEWS. */
export async function publicReviews() {
  "use cache";
  cacheTag(REVIEWS_TAG);
  cacheLife("hours");
  const rows = await readOr(
    "reviews",
    () =>
      db.review.findMany({
        where: { published: true },
        orderBy: { reviewedOn: "desc" },
        take: 6,
        select: { id: true, customerName: true, text: true, rating: true, reviewedOn: true },
      }),
    () => [],
  ).catch(() => []);
  return rows.length >= MIN_PUBLIC_REVIEWS ? rows : [];
}
