"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { assertAdmin } from "@/lib/admin/guard";

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
