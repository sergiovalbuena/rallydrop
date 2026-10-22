"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { assertAdmin } from "@/lib/admin/guard";
import { dollarsToCents } from "@/lib/money";
import { issueGoodwillCredit } from "@/lib/services/credits";

export async function updateCustomerAction(
  _: { ok: boolean; message?: string },
  formData: FormData,
): Promise<{ ok: boolean; message?: string }> {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  await db.customer.update({
    where: { id },
    data: {
      internalNotes: String(formData.get("internalNotes") ?? "").trim() || null,
      trusted: formData.get("trusted") === "on",
      blocked: formData.get("blocked") === "on",
    },
  });
  revalidatePath(`/admin/customers/${id}`);
  return { ok: true, message: "Customer updated." };
}

export async function giveCreditAction(
  _: { ok: boolean; message?: string; error?: string },
  formData: FormData,
): Promise<{ ok: boolean; message?: string; error?: string }> {
  const user = await assertAdmin();
  const id = String(formData.get("id") ?? "");
  const cents = dollarsToCents(String(formData.get("amount") ?? ""));
  const months = Number(formData.get("months") ?? 6);
  if (!cents || cents <= 0) return { ok: false, error: "Enter an amount." };
  if (!Number.isInteger(months) || months < 1 || months > 24) return { ok: false, error: "Validity: 1–24 months." };
  await issueGoodwillCredit({
    customerId: id,
    amountCents: cents,
    months,
    note: String(formData.get("note") ?? ""),
    actor: `admin:${user.id}`,
  });
  revalidatePath(`/admin/customers/${id}`);
  return { ok: true, message: "Credit added. It comes off their next booking automatically." };
}
