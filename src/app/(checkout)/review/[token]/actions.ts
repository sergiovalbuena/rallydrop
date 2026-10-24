"use server";

import { z } from "zod";
import { submitReview } from "@/lib/services/review-requests";

const schema = z.object({
  token: z.string().min(10),
  rating: z.coerce.number().int().min(1, "Pick 1 to 5 stars.").max(5),
  text: z.string().trim().min(3, "Add a line or two.").max(1000),
});

export type ReviewState = { status: "idle" | "done" | "error"; message?: string };

export async function submitReviewAction(_: ReviewState, formData: FormData): Promise<ReviewState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Check the form." };
  const r = await submitReview(parsed.data.token, { rating: parsed.data.rating, text: parsed.data.text });
  return r.ok ? { status: "done" } : { status: "error", message: r.error };
}
