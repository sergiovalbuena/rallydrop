"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { assertAdmin } from "@/lib/admin/guard";
import { EDITABLE_KEYS, SITE_CONTENT_TAG } from "@/lib/services/site-content";
import en from "../../../../../messages/en.json";

type Messages = { [k: string]: string | Messages };
const defaultText = (key: string) => {
  const v = key
    .split(".")
    .reduce<string | Messages | undefined>((n, p) => (typeof n === "object" ? n[p] : undefined), en as Messages);
  return typeof v === "string" ? v : "";
};

export type SettingsState = { ok: boolean; error?: string; message?: string };

const hhmm = z
  .string()
  .regex(/^\d{2}:\d{2}$/)
  .transform((v) => Number(v.slice(0, 2)) * 60 + Number(v.slice(3)));
const percent = z.coerce
  .number()
  .min(0)
  .max(100)
  .transform((v) => Math.round(v * 100));

const settings = z.object({
  gstPercent: percent,
  pstPercent: percent,
  bufferMinutes: z.coerce
    .number()
    .int()
    .min(0)
    .max(24 * 60),
  holdMinutes: z.coerce.number().int().min(5).max(60),
  minLeadTimeHours: z.coerce
    .number()
    .int()
    .min(0)
    .max(24 * 14),
  maxAdvanceDays: z.coerce.number().int().min(1).max(365),
  depositAuthMaxDays: z.coerce.number().int().min(1).max(6),
  depositAuthLeadHours: z.coerce.number().int().min(1).max(120),
  cancelFullRefundHours: z.coerce
    .number()
    .int()
    .min(0)
    .max(24 * 30),
  cancelLatePercent: percent,
  deliveryStart: hhmm,
  deliveryEnd: hhmm,
  freeDeliveryCenterLat: z.coerce.number().min(-90).max(90),
  freeDeliveryCenterLng: z.coerce.number().min(-180).max(180),
  freeDeliveryRadiusKm: z.coerce.number().min(0).max(100),
  seasonStartMonth: z.coerce.number().int().min(1).max(12),
  seasonEndMonth: z.coerce.number().int().min(1).max(12),
  contactEmail: z.string().trim().optional(),
  contactPhone: z.string().trim().optional(),
});

export async function saveSettingsAction(_: SettingsState, formData: FormData): Promise<SettingsState> {
  await assertAdmin();
  const parsed = settings.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" · ") };
  const d = parsed.data;
  if (d.deliveryEnd <= d.deliveryStart) return { ok: false, error: "Delivery hours: end must be after start." };
  await db.settings.update({
    where: { id: "default" },
    data: {
      gstBps: d.gstPercent,
      pstBps: d.pstPercent,
      bufferMinutes: d.bufferMinutes,
      holdMinutes: d.holdMinutes,
      minLeadTimeHours: d.minLeadTimeHours,
      maxAdvanceDays: d.maxAdvanceDays,
      depositAuthMaxDays: d.depositAuthMaxDays,
      depositAuthLeadHours: d.depositAuthLeadHours,
      cancelFullRefundHours: d.cancelFullRefundHours,
      cancelLateRefundBps: d.cancelLatePercent,
      deliveryStartMinute: d.deliveryStart,
      deliveryEndMinute: d.deliveryEnd,
      freeDeliveryCenterLat: d.freeDeliveryCenterLat,
      freeDeliveryCenterLng: d.freeDeliveryCenterLng,
      freeDeliveryRadiusKm: d.freeDeliveryRadiusKm,
      seasonStartMonth: d.seasonStartMonth,
      seasonEndMonth: d.seasonEndMonth,
      allowOffSeason: formData.get("allowOffSeason") === "on",
      smsEnabled: formData.get("smsEnabled") === "on",
      contactEmail: d.contactEmail || null,
      contactPhone: d.contactPhone || null,
    },
  });
  revalidatePath("/admin/settings");
  return { ok: true, message: "Settings saved." };
}

export async function saveSiteTextsAction(_: SettingsState, formData: FormData): Promise<SettingsState> {
  await assertAdmin();
  for (const { key } of EDITABLE_KEYS) {
    const value = formData.get(key);
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    const reset = formData.get(`${key}__reset`) === "on";
    // Unchanged defaults aren't stored, so later edits to messages/en.json still apply.
    if (reset || trimmed === defaultText(key)) await db.siteContent.deleteMany({ where: { key, locale: "en" } });
    else if (trimmed || key === "site.announcement")
      await db.siteContent.upsert({
        where: { key_locale: { key, locale: "en" } },
        update: { value: trimmed },
        create: { key, locale: "en", value: trimmed },
      });
  }
  updateTag(SITE_CONTENT_TAG);
  return { ok: true, message: "Site texts updated." };
}

export async function saveCourtAction(_: SettingsState, formData: FormData): Promise<SettingsState> {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  const d = z
    .object({
      name: z.string().trim().min(2),
      address: z.string().trim().min(3),
      lat: z.coerce.number().min(-90).max(90),
      lng: z.coerce.number().min(-180).max(180),
    })
    .safeParse(Object.fromEntries(formData));
  if (!d.success) return { ok: false, error: "Name, address and coordinates are required." };
  const data = { ...d.data, active: formData.get("active") === "on" };
  if (id) await db.court.update({ where: { id }, data });
  else await db.court.create({ data: { ...data, active: true } });
  revalidatePath("/admin/settings");
  return { ok: true, message: "Court saved." };
}
