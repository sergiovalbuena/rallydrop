"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/lib/admin/guard";
import { BookingError } from "@/lib/services/errors";
import { declareRainDay, removeRainDay } from "@/lib/services/rain";

export type RainState = { ok: boolean; error?: string; message?: string };

export async function declareRainDayAction(_: RainState, formData: FormData): Promise<RainState> {
  const user = await assertAdmin();
  const date = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .safeParse(formData.get("date"));
  if (!date.success) return { ok: false, error: "Pick a date." };
  try {
    const r = await declareRainDay({
      date: date.data,
      note: String(formData.get("note") ?? ""),
      actor: `admin:${user.id}`,
    });
    revalidatePath("/admin/rain");
    return {
      ok: true,
      message:
        r.notified === 0
          ? "Rain day saved. No confirmed rentals start that day."
          : `Rain day saved. ${r.notified} customer${r.notified === 1 ? "" : "s"} notified.`,
    };
  } catch (e) {
    if (e instanceof BookingError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Something went wrong." };
  }
}

export async function removeRainDayAction(id: string): Promise<void> {
  await assertAdmin();
  await removeRainDay(z.string().min(1).parse(id));
  revalidatePath("/admin/rain");
}
