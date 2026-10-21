"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { assertAdmin } from "@/lib/admin/guard";
import { dollarsToCents } from "@/lib/money";
import { isOverlapError } from "@/lib/services/errors";
import { getSettings } from "@/lib/services/settings";
import { localDateMinuteToUtc } from "@/lib/time";

export type GroupState = { ok: boolean; error?: string; message?: string };

const schema = z.object({
  title: z.string().trim().min(3),
  description: z.string().trim().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  minutes: z.coerce.number().int().min(30).max(240),
  capacity: z.coerce.number().int().min(1).max(20),
  price: z.string(),
  courtId: z.string().min(1),
  machineId: z.string().min(1),
  level: z.enum(["", "BEGINNER", "INTERMEDIATE", "ADVANCED", "PRO"]),
});

export async function createGroupAction(_: GroupState, formData: FormData): Promise<GroupState> {
  await assertAdmin();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Please fill in all fields." };
  const d = parsed.data;
  const priceCents = dollarsToCents(d.price);
  if (priceCents === null) return { ok: false, error: "Invalid price." };
  const [h, m] = d.time.split(":").map(Number);
  const startsAt = localDateMinuteToUtc(d.date, h * 60 + m);
  const endsAt = new Date(startsAt.getTime() + d.minutes * 60_000);
  const settings = await getSettings();
  try {
    await db.groupSession.create({
      data: {
        title: d.title,
        description: d.description || null,
        startsAt,
        endsAt,
        capacity: d.capacity,
        priceCents,
        level: d.level || null,
        court: { connect: { id: d.courtId } },
        machine: { connect: { id: d.machineId } },
        occupancy: {
          create: {
            machine: { connect: { id: d.machineId } },
            source: "GROUP_SESSION",
            blockStart: startsAt,
            blockEnd: new Date(endsAt.getTime() + settings.bufferMinutes * 60_000),
          },
        },
      },
    });
  } catch (e) {
    if (isOverlapError(e)) return { ok: false, error: "That machine is busy at that time (booking, block or buffer)." };
    throw e;
  }
  revalidatePath("/admin/groups");
  revalidatePath("/group-sessions");
  return { ok: true, message: "Session created." };
}

/** Cancels a session, refunds every paid seat in full and frees the machine. */
export async function cancelGroupAction(id: string): Promise<GroupState> {
  await assertAdmin();
  const session = await db.groupSession.findUniqueOrThrow({
    where: { id },
    include: { enrollments: { include: { payments: true } } },
  });
  for (const e of session.enrollments) {
    for (const p of e.payments.filter((p) => p.status === "SUCCEEDED" && p.stripePaymentIntentId)) {
      await stripe().refunds.create({ payment_intent: p.stripePaymentIntentId! }, { idempotencyKey: `group_cancel:${p.id}` });
      await db.payment.update({ where: { id: p.id }, data: { status: "REFUNDED", refundedCents: p.amountCents } });
    }
  }
  await db.$transaction([
    db.groupEnrollment.updateMany({ where: { groupSessionId: id }, data: { status: "CANCELLED" } }),
    db.groupSession.update({ where: { id }, data: { status: "CANCELLED" } }),
    db.machineOccupancy.updateMany({ where: { groupSessionId: id }, data: { active: false } }),
  ]);
  revalidatePath("/admin/groups");
  return { ok: true, message: "Session cancelled and players refunded." };
}
