"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { assertAdmin } from "@/lib/admin/guard";
import { dollarsToCents } from "@/lib/money";
import { isUniqueViolation } from "@/lib/services/errors";
import { normalizePromoCode } from "@/lib/services/promo";
import { addLocalDays, localDateMinuteToUtc } from "@/lib/time";

export type PromoState = { ok: boolean; error?: string; message?: string };

const RENTAL_KINDS = ["DAY", "WEEKEND", "WEEK", "MONTH"] as const;
const localDate = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]);

const promoSchema = z.object({
  code: z
    .string()
    .transform(normalizePromoCode)
    .pipe(z.string().regex(/^[A-Z0-9_-]{3,30}$/, "Codes use 3–30 letters, numbers, - or _.")),
  description: z.string().trim().max(200),
  kind: z.enum(["PERCENT", "FIXED"]),
  value: z.string().trim().min(1, "Enter the discount."),
  startsOn: localDate,
  endsOn: localDate,
  maxRedemptions: z.union([z.literal(""), z.coerce.number().int().min(1)]),
});

export async function createPromoAction(_: PromoState, formData: FormData): Promise<PromoState> {
  await assertAdmin();
  const parsed = promoSchema.safeParse({
    code: formData.get("code") ?? "",
    description: formData.get("description") ?? "",
    kind: formData.get("kind"),
    value: formData.get("value") ?? "",
    startsOn: formData.get("startsOn") ?? "",
    endsOn: formData.get("endsOn") ?? "",
    maxRedemptions: formData.get("maxRedemptions") ?? "",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  const d = parsed.data;

  let percentBps: number | null = null;
  let amountCents: number | null = null;
  if (d.kind === "PERCENT") {
    const pct = Number(d.value.replace("%", ""));
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) return { ok: false, error: "Percent must be 1–100." };
    percentBps = Math.round(pct * 100);
  } else {
    amountCents = dollarsToCents(d.value);
    if (!amountCents || amountCents <= 0) return { ok: false, error: "Enter a valid amount off." };
  }

  // Dates are BC calendar days; the end date is inclusive.
  const startsAt = d.startsOn ? localDateMinuteToUtc(d.startsOn, 0) : null;
  const endsAt = d.endsOn ? localDateMinuteToUtc(addLocalDays(d.endsOn, 1), 0) : null;
  if (startsAt && endsAt && endsAt <= startsAt) return { ok: false, error: "The end date is before the start." };

  const productKinds = formData
    .getAll("productKinds")
    .filter((k): k is (typeof RENTAL_KINDS)[number] => RENTAL_KINDS.includes(k as (typeof RENTAL_KINDS)[number]));

  try {
    await db.promoCode.create({
      data: {
        code: d.code,
        description: d.description || null,
        kind: d.kind,
        percentBps,
        amountCents,
        startsAt,
        endsAt,
        maxRedemptions: d.maxRedemptions === "" ? null : d.maxRedemptions,
        productKinds,
      },
    });
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, error: `${d.code} already exists.` };
    throw e;
  }
  revalidatePath("/admin/promo-codes");
  return { ok: true, message: `${d.code} created.` };
}

export async function togglePromoAction(id: string, active: boolean): Promise<void> {
  await assertAdmin();
  await db.promoCode.update({ where: { id: z.string().min(1).parse(id) }, data: { active } });
  revalidatePath("/admin/promo-codes");
}
