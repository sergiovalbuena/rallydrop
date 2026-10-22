"use server";

import { z } from "zod";
import { databaseConfigured } from "@/lib/services/fallback";
import { joinWaitlist } from "@/lib/services/waitlist";

const schema = z.object({
  machineId: z.string().min(1),
  email: z.email("Enter a valid email."),
  source: z.string().max(40).optional(),
  /** Honeypot: real people never see or fill this field. */
  website: z.string().max(0).optional(),
});

export type WaitlistState = { status: "idle" | "done" | "error"; message?: string };

export async function joinWaitlistAction(_: WaitlistState, formData: FormData): Promise<WaitlistState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const honeypot = parsed.error.issues.some((i) => i.path[0] === "website");
    // Bots get a fake success so they don't retry.
    if (honeypot) return { status: "done" };
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Check your email." };
  }
  if (!databaseConfigured()) {
    return { status: "error", message: "Sign-ups open very soon — please try again shortly." };
  }
  try {
    const r = await joinWaitlist(parsed.data);
    if (!r.ok) return { status: "error", message: r.error };
    return { status: "done", message: r.already ? "already" : undefined };
  } catch (e) {
    console.error("waitlist", e);
    return { status: "error", message: "Something went wrong. Please try again." };
  }
}
