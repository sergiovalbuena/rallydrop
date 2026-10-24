import "server-only";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/notify/email";
import { reviewRequestEmail } from "@/lib/notify/templates";
import { siteUrl } from "@/lib/site-url";
import { toLocalDate } from "@/lib/time";
import { REVIEW, idFromSigned, signedId } from "./links";

const DONE = ["RETURNED_OK", "COMPLETED"] as const;
const HOUR = 3_600_000;

/** Short public name: "Alex Smith" → "Alex S." */
export function reviewerName(full: string): string {
  const [first, ...rest] = full.trim().split(/\s+/);
  const last = rest.at(-1);
  return last ? `${first} ${last[0]!.toUpperCase()}.` : (first ?? "Customer");
}

export function reviewUrl(bookingId: string): string {
  return siteUrl(`/review/${signedId(REVIEW, bookingId)}`);
}

/**
 * 24 h after a rental came back OK, ask for a review once. Only bookings
 * returned in the last two weeks, so turning this on never emails old customers.
 */
export async function runReviewRequests(now = new Date()) {
  const due = await db.booking.findMany({
    where: {
      status: { in: [...DONE] },
      reviewRequestedAt: null,
      customer: { email: { not: null } },
      events: {
        some: {
          type: "status_changed",
          createdAt: { lte: new Date(now.getTime() - 24 * HOUR), gte: new Date(now.getTime() - 14 * 24 * HOUR) },
        },
      },
    },
    include: { customer: true, product: true, events: { where: { type: "status_changed" } } },
  });
  let sent = 0;
  for (const b of due) {
    // The 24 h count from when it was marked returned, not from any status change.
    const returned = b.events.find((e) =>
      DONE.includes((e.data as { to?: string } | null)?.to as (typeof DONE)[number]),
    );
    if (!returned || returned.createdAt.getTime() > now.getTime() - 24 * HOUR) continue;
    const already = await db.review.findUnique({ where: { bookingId: b.id }, select: { id: true } });
    if (!already) {
      await sendEmail({
        to: b.customer.email!,
        template: "review_request",
        dedupeKey: `review_request:${b.id}`,
        content: reviewRequestEmail({
          customerName: b.customer.name,
          productName: b.product.name,
          url: reviewUrl(b.id),
        }),
      });
      sent++;
    }
    await db.booking.update({ where: { id: b.id }, data: { reviewRequestedAt: now } });
  }
  return { reviewRequests: sent };
}

/** The booking behind a review link, if it can still be reviewed. */
export async function reviewTarget(token: string) {
  const id = idFromSigned(REVIEW, token);
  if (!id) return null;
  const booking = await db.booking.findUnique({
    where: { id },
    include: { customer: true, product: true, machine: true },
  });
  if (!booking || !DONE.includes(booking.status as (typeof DONE)[number])) return null;
  const existing = await db.review.findUnique({ where: { bookingId: id }, select: { id: true } });
  return { booking, done: !!existing };
}

/** Saves the customer's review, hidden until the owner publishes it. One per booking. */
export async function submitReview(token: string, input: { rating: number; text: string }, now = new Date()) {
  const target = await reviewTarget(token);
  if (!target) return { ok: false as const, error: "This review link isn't valid." };
  if (target.done) return { ok: true as const };
  await db.review.create({
    data: {
      bookingId: target.booking.id,
      customerName: reviewerName(target.booking.customer.name),
      rating: input.rating,
      text: input.text,
      reviewedOn: new Date(`${toLocalDate(now)}T12:00:00Z`),
      published: false,
    },
  });
  return { ok: true as const };
}
