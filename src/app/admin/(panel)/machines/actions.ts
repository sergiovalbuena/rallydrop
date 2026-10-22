"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { put } from "@vercel/blob";
import { z } from "zod";
import { db } from "@/lib/db";
import { assertAdmin } from "@/lib/admin/guard";
import { dollarsToCents } from "@/lib/money";
import { localDateMinuteToUtc } from "@/lib/time";

export type FormState = { ok: boolean; error?: string; message?: string };

const machine = z.object({
  name: z.string().trim().min(2),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and dashes."),
  model: z.string().trim().min(1),
  description: z.string().trim().optional(),
  status: z.enum(["AVAILABLE", "RENTED", "MAINTENANCE", "RETIRED"]),
  bookable: z.boolean(),
  aiCoach: z.boolean(),
  calendarColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  sortOrder: z.coerce.number().int(),
  weightKg: z.coerce.number().positive().optional(),
  maxSpeedKmh: z.coerce.number().int().positive().optional(),
  ballCapacity: z.coerce.number().int().positive().optional(),
  batteryHours: z.coerce.number().positive().optional(),
  sports: z.array(z.enum(["TENNIS", "PICKLEBALL"])),
  levels: z.array(z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED", "PRO"])),
  deposit: z.string(),
  depositLong: z.string(),
  purchaseCost: z.string(),
  isPublic: z.boolean(),
  imageUrl: z.string().trim().optional(),
  specs: z.string().optional(),
});

const blank = (v: FormDataEntryValue | null) => (v === null || v === "" ? undefined : String(v));

export async function saveMachineAction(_: FormState, formData: FormData): Promise<FormState> {
  await assertAdmin();
  const id = blank(formData.get("id"));
  const parsed = machine.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    model: formData.get("model"),
    description: blank(formData.get("description")),
    status: formData.get("status"),
    bookable: formData.get("bookable") === "on",
    aiCoach: formData.get("aiCoach") === "on",
    calendarColor: formData.get("calendarColor"),
    sortOrder: formData.get("sortOrder") ?? 0,
    weightKg: blank(formData.get("weightKg")),
    maxSpeedKmh: blank(formData.get("maxSpeedKmh")),
    ballCapacity: blank(formData.get("ballCapacity")),
    batteryHours: blank(formData.get("batteryHours")),
    sports: formData.getAll("sports"),
    levels: formData.getAll("levels"),
    deposit: formData.get("deposit") ?? "0",
    depositLong: formData.get("depositLong") ?? "0",
    purchaseCost: formData.get("purchaseCost") ?? "",
    isPublic: formData.get("isPublic") === "on",
    imageUrl: blank(formData.get("imageUrl")),
    specs: blank(formData.get("specs")),
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" · ") };
  const d = parsed.data;
  const depositCents = dollarsToCents(d.deposit);
  if (depositCents === null) return { ok: false, error: "Invalid deposit amount." };
  const depositLongCents = dollarsToCents(d.depositLong);
  if (depositLongCents === null) return { ok: false, error: "Invalid week/month deposit." };
  const purchaseCostCents = d.purchaseCost.trim() ? dollarsToCents(d.purchaseCost) : null;

  let imageUrl = d.imageUrl ?? null;
  const file = formData.get("image");
  if (file instanceof File && file.size > 0) {
    if (!process.env.BLOB_READ_WRITE_TOKEN)
      return { ok: false, error: "Set BLOB_READ_WRITE_TOKEN to upload photos, or paste an image URL." };
    imageUrl = (await put(`machines/${d.slug}-${Date.now()}-${file.name}`, file, { access: "public" })).url;
  }
  // Specs: one "Label: value" per line.
  const specs = (d.specs ?? "")
    .split("\n")
    .map((l) => l.split(":"))
    .filter((p) => p.length >= 2 && p[0].trim())
    .map(([label, ...rest]) => ({ label: label.trim(), value: rest.join(":").trim() }));

  const data = {
    name: d.name,
    slug: d.slug,
    model: d.model,
    description: d.description ?? null,
    status: d.status,
    bookable: d.bookable,
    aiCoach: d.aiCoach,
    calendarColor: d.calendarColor,
    sortOrder: d.sortOrder,
    weightKg: d.weightKg ?? null,
    maxSpeedKmh: d.maxSpeedKmh ?? null,
    ballCapacity: d.ballCapacity ?? null,
    batteryHours: d.batteryHours ?? null,
    sports: d.sports,
    levels: d.levels,
    depositCents,
    depositLongCents,
    purchaseCostCents,
    isPublic: d.isPublic,
    imageUrl,
    specs,
  };
  try {
    const saved = id ? await db.machine.update({ where: { id }, data }) : await db.machine.create({ data });
    revalidatePath("/admin/machines");
    if (!id) redirect(`/admin/machines/${saved.id}`);
    return { ok: true, message: "Machine saved." };
  } catch (e) {
    if (e instanceof Error && e.message.includes("Unique constraint"))
      return { ok: false, error: "That slug is already used." };
    throw e;
  }
}

export async function addMaintenanceAction(_: FormState, formData: FormData): Promise<FormState> {
  await assertAdmin();
  const machineId = String(formData.get("machineId") ?? "");
  const date = String(formData.get("date") ?? "");
  const summary = String(formData.get("summary") ?? "").trim();
  if (!machineId || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !summary)
    return { ok: false, error: "Date and summary are required." };
  const cost = blank(formData.get("cost"));
  await db.maintenanceLog.create({
    data: {
      machineId,
      performedAt: localDateMinuteToUtc(date, 12 * 60),
      summary,
      notes: blank(formData.get("notes")) ?? null,
      costCents: cost ? dollarsToCents(cost) : null,
    },
  });
  revalidatePath(`/admin/machines/${machineId}`);
  return { ok: true, message: "Maintenance logged." };
}
