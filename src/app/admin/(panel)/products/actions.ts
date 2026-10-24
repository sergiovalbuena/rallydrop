"use server";

import { PUBLIC_TAG } from "@/lib/services/public-data";
import { revalidatePath, updateTag } from "next/cache";
import { db } from "@/lib/db";
import { assertAdmin } from "@/lib/admin/guard";
import { dollarsToCents } from "@/lib/money";

export type SaveState = { ok: boolean; error?: string; message?: string };

const DAYS: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

/** "Sat 09:00, Fri 21:00" → [{weekday:6, minute:540}, {weekday:5, minute:1260}] */
export async function parseStarts(text: string) {
  const out: { weekday: number; minute: number }[] = [];
  for (const part of text
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)) {
    const m = part.match(/^(sun|mon|tue|wed|thu|fri|sat)\w*\s+(\d{1,2}):(\d{2})$/i);
    if (!m) return null;
    out.push({ weekday: DAYS[m[1].toLowerCase()], minute: Number(m[2]) * 60 + Number(m[3]) });
  }
  return out;
}

export async function saveProductAction(_: SaveState, formData: FormData): Promise<SaveState> {
  await assertAdmin();
  const id = String(formData.get("id"));
  const priceCents = dollarsToCents(String(formData.get("price") ?? ""));
  if (priceCents === null) return { ok: false, error: "Invalid price." };
  const offText = String(formData.get("offSeasonPrice") ?? "").trim();
  const offSeasonPriceCents = offText ? dollarsToCents(offText) : null;
  if (offText && offSeasonPriceCents === null) return { ok: false, error: "Invalid off-season price." };
  const num = (k: string) => {
    const v = formData.get(k);
    return v === null || v === "" ? undefined : Number(v);
  };
  const startsText = formData.get("allowedStarts");
  const allowedStarts = typeof startsText === "string" ? await parseStarts(startsText) : undefined;
  if (allowedStarts === null) return { ok: false, error: "Fixed starts must look like “Sat 09:00, Fri 21:00”." };

  const product = await db.product.findUniqueOrThrow({ where: { id } });
  await db.product.update({
    where: { id },
    data: {
      name: String(formData.get("name") ?? product.name).trim() || product.name,
      description: String(formData.get("description") ?? "").trim() || null,
      priceCents,
      ...(formData.has("offSeasonPrice") ? { offSeasonPriceCents } : {}),
      active: formData.get("active") === "on",
      durationHours: num("durationHours") ?? product.durationHours,
      sessionsPerMonth: num("sessionsPerMonth") ?? product.sessionsPerMonth,
      sessionMinutes: num("sessionMinutes") ?? product.sessionMinutes,
      ...(allowedStarts !== undefined ? { allowedStarts: allowedStarts.length ? allowedStarts : [] } : {}),
    },
  });
  revalidatePath("/admin/products");
  updateTag(PUBLIC_TAG); // public pages are prerendered from cached data
  // Packages get a new Stripe Price automatically on the next sign-up; existing
  // subscribers keep their price until you migrate them in Stripe.
  return { ok: true, message: `${product.name} saved.` };
}

export async function saveAddOnAction(_: SaveState, formData: FormData): Promise<SaveState> {
  await assertAdmin();
  const id = String(formData.get("id"));
  const priceCents = dollarsToCents(String(formData.get("price") ?? ""));
  if (priceCents === null) return { ok: false, error: "Invalid price." };
  await db.addOn.update({
    where: { id },
    data: {
      name: String(formData.get("name") ?? "").trim(),
      description: String(formData.get("description") ?? "").trim() || null,
      priceCents,
      active: formData.get("active") === "on",
    },
  });
  revalidatePath("/admin/products");
  updateTag(PUBLIC_TAG); // public pages are prerendered from cached data
  return { ok: true, message: "Add-on saved." };
}
