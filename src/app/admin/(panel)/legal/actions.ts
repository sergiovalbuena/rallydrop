"use server";

import { PUBLIC_TAG } from "@/lib/services/public-data";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { assertAdmin } from "@/lib/admin/guard";
import { sha256 } from "@/lib/domain/legal";
import { isUniqueViolation } from "@/lib/services/errors";

export type LegalState = { ok: boolean; error?: string; message?: string };

const schema = z.object({
  kind: z.enum(["TERMS", "WAIVER"]),
  version: z
    .string()
    .trim()
    .regex(/^[\w.-]{1,40}$/, "Version: letters, numbers, dots and dashes (e.g. 2026-11-02)."),
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().min(50, "The document looks empty."),
  reviewed: z.boolean(),
  publish: z.boolean(),
});

/**
 * Saves a NEW version (old versions are never edited or deleted — customers'
 * acceptances point at them). Publishing makes it the live version: the next
 * checkout shows it and package members accept it again before their next
 * session.
 */
export async function saveLegalVersionAction(_: LegalState, formData: FormData): Promise<LegalState> {
  await assertAdmin();
  const parsed = schema.safeParse({
    kind: formData.get("kind"),
    version: formData.get("version"),
    title: formData.get("title"),
    body: formData.get("body"),
    reviewed: formData.get("reviewed") === "on",
    publish: formData.get("publish") === "on",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  const d = parsed.data;
  // Normalise line endings so the hash matches what customers are shown.
  const body = d.body.replace(/\r\n/g, "\n");
  try {
    await db.legalDocument.create({
      data: {
        kind: d.kind,
        version: d.version,
        title: d.title,
        body,
        sha256: sha256(body),
        draft: !d.reviewed,
        publishedAt: d.publish ? new Date() : null,
      },
    });
  } catch (e) {
    if (isUniqueViolation(e))
      return { ok: false, error: `Version ${d.version} already exists — use a new version name.` };
    throw e;
  }
  revalidatePath("/admin/legal");
  updateTag(PUBLIC_TAG); // public pages are prerendered from cached data
  return {
    ok: true,
    message: d.publish ? `Version ${d.version} is now live.` : `Version ${d.version} saved (not published).`,
  };
}

/** Publishes a saved version (it becomes the live one). */
export async function publishLegalVersionAction(id: string): Promise<void> {
  await assertAdmin();
  await db.legalDocument.update({ where: { id: z.string().min(1).parse(id) }, data: { publishedAt: new Date() } });
  revalidatePath("/admin/legal");
  updateTag(PUBLIC_TAG); // public pages are prerendered from cached data
}

/** Marks a version as reviewed by a lawyer (removes the DRAFT badge in admin). */
export async function markReviewedAction(id: string): Promise<void> {
  await assertAdmin();
  await db.legalDocument.update({ where: { id: z.string().min(1).parse(id) }, data: { draft: false } });
  revalidatePath("/admin/legal");
  updateTag(PUBLIC_TAG); // public pages are prerendered from cached data
}
