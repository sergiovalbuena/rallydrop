"use server";

import { revalidatePath } from "next/cache";
import { put } from "@vercel/blob";
import { z } from "zod";
import { db } from "@/lib/db";
import { assertAdmin } from "@/lib/admin/guard";
import { dollarsToCents } from "@/lib/money";
import { notifyRescheduled } from "@/lib/notify/booking-notifications";
import { rescheduleBooking } from "@/lib/services/bookings";
import { BookingError } from "@/lib/services/errors";
import { cancelBooking, captureDeposit, refundRental, releaseDeposit, setBookingStatus } from "@/lib/services/payments";
import { notifyAcceptanceNeeded } from "@/lib/notify/booking-notifications";
import type { BookingStatus } from "@/generated/prisma/client";

export type AdminResult = { ok: true; message?: string } | { ok: false; error: string };

async function run(bookingId: string, fn: (actor: string) => Promise<string | void>): Promise<AdminResult> {
  try {
    const user = await assertAdmin();
    const message = await fn(`admin:${user.id}`);
    revalidatePath(`/admin/bookings/${bookingId}`);
    revalidatePath("/admin");
    return { ok: true, message: message ?? undefined };
  } catch (e) {
    if (e instanceof BookingError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

const STATUSES = [
  "CONFIRMED",
  "CHECKED_OUT",
  "RETURNED_OK",
  "RETURNED_DAMAGED",
  "COMPLETED",
  "NO_SHOW",
  "CANCELLED",
] as const;

export async function setStatusAction(bookingId: string, status: string) {
  return run(bookingId, async (actor) => {
    const s = z.enum(STATUSES).parse(status) as BookingStatus;
    await setBookingStatus(bookingId, s, actor);
    if (s === "RETURNED_OK") return "Marked returned — deposit released.";
  });
}

export async function releaseDepositAction(bookingId: string) {
  return run(bookingId, async (actor) => {
    await releaseDeposit(bookingId, actor);
    return "Deposit released.";
  });
}

const EXCLUSIONS = ["THEFT", "LOSS", "RAIN", "GROSS_NEGLIGENCE"] as const;

export async function captureDepositAction(bookingId: string, amount: string, note: string, exclusion?: string) {
  return run(bookingId, async (actor) => {
    const cents = dollarsToCents(amount);
    if (cents === null) throw new BookingError("INVALID_STATE", "Enter a valid amount.");
    const ex = EXCLUSIONS.find((e) => e === exclusion) ?? null;
    await captureDeposit(bookingId, cents, note, actor, ex);
    return "Deposit charged. The customer has been emailed the reason.";
  });
}

export async function refundAction(bookingId: string, amount: string, reason: string) {
  return run(bookingId, async (actor) => {
    const cents = dollarsToCents(amount);
    if (!cents) throw new BookingError("INVALID_STATE", "Enter a valid amount.");
    const refunded = await refundRental(bookingId, cents, reason || "admin refund", actor);
    if (!refunded) throw new BookingError("INVALID_STATE", "Nothing refundable on this booking.");
    return "Refund issued.";
  });
}

export async function cancelAdminAction(bookingId: string, refund: "policy" | "full" | "none") {
  return run(bookingId, async (actor) => {
    const r = await cancelBooking(bookingId, { actor, refund, reason: "admin" });
    return `Cancelled. Refunded ${(r.refundedCents / 100).toFixed(2)} CAD.`;
  });
}

export async function rescheduleAdminAction(bookingId: string, startsAt: string, machineId?: string) {
  return run(bookingId, async (actor) => {
    await rescheduleBooking({
      bookingId,
      startsAt: new Date(z.iso.datetime().parse(startsAt)),
      machineId,
      actor,
      skipSlotRules: true,
    });
    await notifyRescheduled(bookingId);
    revalidatePath("/admin/calendar");
    return "Booking moved.";
  });
}

const inspection = z.object({
  bookingId: z.string().min(1),
  kind: z.enum(["CHECK_OUT", "CHECK_IN"]),
  condition: z.enum(["EXCELLENT", "GOOD", "MINOR_WEAR", "DAMAGED"]),
  batteryPercent: z.coerce.number().int().min(0).max(100).optional(),
  ballsCount: z.coerce.number().int().min(0).max(1000).optional(),
  notes: z.string().max(2000).optional(),
  // Hand-off checklist, each item checked separately.
  machineOk: z.boolean(),
  spotterOk: z.boolean(),
  batteryOk: z.boolean(),
  chargerOk: z.boolean(),
  idVerified: z.boolean(),
  licenceLast4: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{4}$/, "Licence: enter the last 4 characters.")
    .optional(),
});

/** Check-out / check-in with optional photos (stored in Vercel Blob). */
export async function inspectionAction(formData: FormData): Promise<AdminResult> {
  const parsed = inspection.safeParse({
    bookingId: formData.get("bookingId"),
    kind: formData.get("kind"),
    condition: formData.get("condition"),
    batteryPercent: formData.get("batteryPercent") || undefined,
    ballsCount: formData.get("ballsCount") || undefined,
    notes: formData.get("notes") || undefined,
    machineOk: formData.get("machineOk") === "on",
    spotterOk: formData.get("spotterOk") === "on",
    batteryOk: formData.get("batteryOk") === "on",
    chargerOk: formData.get("chargerOk") === "on",
    idVerified: formData.get("idVerified") === "on",
    licenceLast4: formData.get("licenceLast4") || undefined,
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please fill in the condition fields." };
  const d = parsed.data;
  if (d.kind === "CHECK_OUT") {
    const target = await db.booking.findUnique({ where: { id: d.bookingId }, select: { deposit: true } });
    // Week & month rentals: ID must be seen at hand-off.
    if (target?.deposit?.strategy === "SAVED_CARD" && (!d.idVerified || !d.licenceLast4)) {
      return { ok: false, error: "Long rental: check the customer's ID and enter the last 4 of their licence." };
    }
  }
  return run(d.bookingId, async (actor) => {
    const user = await assertAdmin();
    const photos = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
    const photoUrls: string[] = [];
    let skipped = 0;
    for (const file of photos.slice(0, 8)) {
      if (!process.env.BLOB_READ_WRITE_TOKEN) {
        skipped++;
        continue;
      }
      const blob = await put(`inspections/${d.bookingId}/${d.kind}-${Date.now()}-${file.name}`, file, {
        access: "public",
      });
      photoUrls.push(blob.url);
    }
    await db.inspection.upsert({
      where: { bookingId_kind: { bookingId: d.bookingId, kind: d.kind } },
      update: {
        condition: d.condition,
        batteryPercent: d.batteryPercent,
        ballsCount: d.ballsCount,
        notes: d.notes,
        photoUrls: { push: photoUrls },
        performedById: user.id,
      },
      create: { ...d, photoUrls, performedById: user.id },
    });
    const booking = await db.booking.findUniqueOrThrow({ where: { id: d.bookingId } });
    if (d.kind === "CHECK_OUT" && booking.status === "CONFIRMED") {
      await setBookingStatus(d.bookingId, "CHECKED_OUT", actor);
    }
    if (d.kind === "CHECK_IN" && (booking.status === "CHECKED_OUT" || booking.status === "CONFIRMED")) {
      await setBookingStatus(d.bookingId, d.condition === "DAMAGED" ? "RETURNED_DAMAGED" : "RETURNED_OK", actor);
    }
    const note = skipped ? ` ${skipped} photo(s) not saved — set BLOB_READ_WRITE_TOKEN to enable uploads.` : "";
    return `${d.kind === "CHECK_OUT" ? "Check-out" : "Check-in"} saved.${note}`;
  });
}

/** Re-sends the Terms & Waiver acceptance link to the customer. */
export async function sendAcceptanceLinkAction(bookingId: string) {
  return run(bookingId, async () => {
    await notifyAcceptanceNeeded(bookingId);
    return "Link sent to the customer.";
  });
}

export async function recordManualPaymentAction(bookingId: string, amount: string) {
  return run(bookingId, async () => {
    const cents = dollarsToCents(amount);
    if (!cents) throw new BookingError("INVALID_STATE", "Enter a valid amount.");
    await db.payment.create({ data: { kind: "MANUAL", status: "SUCCEEDED", amountCents: cents, bookingId } });
    return "Payment recorded.";
  });
}
