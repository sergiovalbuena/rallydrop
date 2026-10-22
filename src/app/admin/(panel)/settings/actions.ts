"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { assertAdmin } from "@/lib/admin/guard";
import { geocodeAddress } from "@/lib/services/geocode";
import { EDITABLE_KEYS, SITE_CONTENT_TAG } from "@/lib/services/site-content";
import { dollarsToCents } from "@/lib/money";
import type { DeliveryZone } from "@/lib/domain/delivery";
import { isValidMonthDay } from "@/lib/domain/season";
import { SITE_INFO_TAG } from "@/lib/services/site-info";
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
  deliveryHubLat: z.coerce.number().min(-90).max(90),
  deliveryHubLng: z.coerce.number().min(-180).max(180),
  seasonStart: z.string().trim().refine(isValidMonthDay, "High season start must look like 04-01."),
  seasonEnd: z.string().trim().refine(isValidMonthDay, "High season end must look like 09-30."),
  highSeasonMonthCap: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || (Number.isInteger(v) && v >= 0), "Month cap must be a whole number."),
  rainCreditMonths: z.coerce.number().int().min(1, "Rain credits: at least 1 month.").max(24),
  contactEmail: z.string().trim().optional(),
  contactPhone: z.string().trim().optional(),
  siteDomain: z.string().trim().optional(),
  hubAddress: z.string().trim().optional(),
  instagramUrl: z.string().trim().optional(),
  gstNumber: z.string().trim().optional(),
  pstNumber: z.string().trim().optional(),
  insuranceProvider: z.string().trim().optional(),
  insurancePolicyNumber: z.string().trim().optional(),
  insuranceCoverage: z.string().trim().optional(),
  businessLicenceNumber: z.string().trim().optional(),
  businessLicenceMunicipality: z.string().trim().optional(),
  careShort: z.string(),
  careWeek: z.string(),
  careMonth: z.string(),
  careCap: z.string(),
});

/** Zone rows from the form → validated, ascending zone table (or an error message). */
function parseZoneRows(formData: FormData): DeliveryZone[] | string {
  const zones: DeliveryZone[] = [];
  for (let i = 0; i < 4; i++) {
    const km = String(formData.get(`zone${i}Km`) ?? "").trim();
    if (!km) continue;
    const maxKm = Number(km);
    const tripCents = dollarsToCents(String(formData.get(`zone${i}Trip`) ?? ""));
    const roundTripCents = dollarsToCents(String(formData.get(`zone${i}Round`) ?? ""));
    if (!(maxKm > 0) || tripCents === null || roundTripCents === null) {
      return `Zone ${i + 1}: enter a distance and both prices.`;
    }
    zones.push({ maxKm, tripCents, roundTripCents });
  }
  zones.sort((a, b) => a.maxKm - b.maxKm);
  if (zones.length === 0) return "Keep at least one delivery zone.";
  if (new Set(zones.map((z) => z.maxKm)).size !== zones.length) return "Two zones have the same distance.";
  return zones;
}

export async function saveSettingsAction(_: SettingsState, formData: FormData): Promise<SettingsState> {
  await assertAdmin();
  const parsed = settings.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" · ") };
  const d = parsed.data;
  if (d.deliveryEnd <= d.deliveryStart) return { ok: false, error: "Delivery hours: end must be after start." };
  const zones = parseZoneRows(formData);
  if (typeof zones === "string") return { ok: false, error: zones };
  const chargeGst = formData.get("chargeGst") === "on";
  const chargePst = formData.get("chargePst") === "on";
  if (chargeGst && !d.gstNumber) return { ok: false, error: "Save your GST number before charging GST." };
  if (chargePst && !d.pstNumber) return { ok: false, error: "Save your PST number before charging PST." };
  const care = [d.careShort, d.careWeek, d.careMonth, d.careCap].map((v) => dollarsToCents(v));
  if (care.some((c) => c === null || c < 0)) return { ok: false, error: "Check the RallyDrop Care prices." };
  const coverage = d.insuranceCoverage ? dollarsToCents(d.insuranceCoverage) : null;
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
      deliveryHubLat: d.deliveryHubLat,
      deliveryHubLng: d.deliveryHubLng,
      deliveryZones: zones,
      seasonStart: d.seasonStart,
      seasonEnd: d.seasonEnd,
      highSeasonMonthCap: d.highSeasonMonthCap,
      allowOffSeason: formData.get("allowOffSeason") === "on",
      rainCreditMonths: d.rainCreditMonths,
      packageRollover: formData.get("packageRollover") === "on",
      smsEnabled: formData.get("smsEnabled") === "on",
      contactEmail: d.contactEmail || null,
      contactPhone: d.contactPhone || null,
      siteDomain: d.siteDomain || null,
      hubAddress: d.hubAddress || null,
      instagramUrl: d.instagramUrl || null,
      chargeGst,
      chargePst,
      gstNumber: d.gstNumber || null,
      pstNumber: d.pstNumber || null,
      insuranceProvider: d.insuranceProvider || null,
      insurancePolicyNumber: d.insurancePolicyNumber || null,
      insuranceCoverageCents: coverage,
      businessLicenceNumber: d.businessLicenceNumber || null,
      businessLicenceMunicipality: d.businessLicenceMunicipality || null,
      careEnabled: formData.get("careEnabled") === "on",
      careShortCents: care[0]!,
      careWeekCents: care[1]!,
      careMonthCents: care[2]!,
      careCapCents: care[3]!,
    },
  });
  updateTag(SITE_INFO_TAG);
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

/** "Find on map": geocodes an address with OpenStreetMap. */
export async function geocodeAction(
  address: string,
): Promise<{ ok: true; lat: number; lng: number } | { ok: false; error: string }> {
  await assertAdmin();
  if (address.trim().length < 4) return { ok: false, error: "Type the court's address first." };
  const point = await geocodeAddress(address);
  if (!point) return { ok: false, error: "Couldn't find that address — click on the map to place the pin instead." };
  return { ok: true, lat: Number(point.lat.toFixed(6)), lng: Number(point.lng.toFixed(6)) };
}

export async function saveCourtAction(_: SettingsState, formData: FormData): Promise<SettingsState> {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  const d = z
    .object({
      name: z.string().trim().min(2),
      address: z.string().trim().min(3),
      lat: z.union([z.literal(""), z.coerce.number().min(-90).max(90)]),
      lng: z.union([z.literal(""), z.coerce.number().min(-180).max(180)]),
    })
    .safeParse(Object.fromEntries(formData));
  if (!d.success) return { ok: false, error: "Name and address are required." };

  // No pin placed → locate the address automatically.
  let { lat, lng } = d.data;
  if (lat === "" || lng === "") {
    const point = await geocodeAddress(d.data.address);
    if (!point) return { ok: false, error: "Couldn't locate that address. Place the pin on the map." };
    lat = point.lat;
    lng = point.lng;
  }
  const data = { name: d.data.name, address: d.data.address, lat, lng, active: formData.get("active") === "on" };
  if (id) await db.court.update({ where: { id }, data });
  else await db.court.create({ data: { ...data, active: true } });
  revalidatePath("/admin/settings");
  return { ok: true, message: "Court saved." };
}
