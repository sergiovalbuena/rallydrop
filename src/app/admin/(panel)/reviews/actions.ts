"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { assertAdmin } from "@/lib/admin/guard";
import { REVIEWS_TAG } from "@/lib/services/reviews";

export type ReviewState = { ok: boolean; error?: string; message?: string };

const schema = z.object({
  customerName: z.string().trim().min(2).max(60),
  text: z.string().trim().min(10).max(600),
  rating: z.coerce.number().int().min(1).max(5),
  reviewedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the review date."),
});

export async function createReviewAction(_: ReviewState, formData: FormData): Promise<ReviewState> {
  await assertAdmin();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  await db.review.create({
    data: {
      ...parsed.data,
      reviewedOn: new Date(`${parsed.data.reviewedOn}T12:00:00Z`),
      published: formData.get("published") === "on",
    },
  });
  done();
  return { ok: true, message: "Review saved." };
}

export async function setReviewPublishedAction(id: string, published: boolean): Promise<void> {
  await assertAdmin();
  await db.review.update({ where: { id: z.string().min(1).parse(id) }, data: { published } });
  done();
}

export async function deleteReviewAction(id: string): Promise<void> {
  await assertAdmin();
  await db.review.delete({ where: { id: z.string().min(1).parse(id) } });
  done();
}

function done() {
  updateTag(REVIEWS_TAG);
  revalidatePath("/admin/reviews");
}
