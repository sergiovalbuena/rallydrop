import "server-only";
import type { Prisma, SkillLevel } from "@/generated/prisma/client";
import { BookingError } from "./errors";

export type CustomerInput = {
  name: string;
  email?: string | null;
  phone?: string | null;
  skillLevel?: SkillLevel | null;
};

export function normalizeEmail(email: string | null | undefined): string | null {
  const v = email?.trim().toLowerCase();
  return v ? v : null;
}

/** Normalizes North American numbers to E.164 (+12501234567). */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 8 && phone.trim().startsWith("+")) return `+${digits}`;
  return null;
}

/**
 * Finds a customer by email (preferred) or phone, or creates one. Fills in
 * missing contact details but never overwrites an existing email/phone that
 * belongs to someone else.
 */
export async function upsertCustomer(tx: Prisma.TransactionClient, input: CustomerInput) {
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  if (!email && !phone) throw new BookingError("INVALID_STATE", "An email or phone number is required.");

  const existing =
    (email ? await tx.customer.findUnique({ where: { email } }) : null) ??
    (phone ? await tx.customer.findUnique({ where: { phone } }) : null);

  if (existing) {
    if (existing.blocked) {
      throw new BookingError("CUSTOMER_BLOCKED", "We can't take this booking online. Please contact us.");
    }
    const phoneFree = phone && !existing.phone && !(await tx.customer.findUnique({ where: { phone } }));
    const emailFree = email && !existing.email && !(await tx.customer.findUnique({ where: { email } }));
    return tx.customer.update({
      where: { id: existing.id },
      data: {
        name: input.name.trim() || existing.name,
        skillLevel: input.skillLevel ?? existing.skillLevel,
        ...(phoneFree ? { phone } : {}),
        ...(emailFree ? { email } : {}),
      },
    });
  }

  return tx.customer.create({
    data: { name: input.name.trim(), email, phone, skillLevel: input.skillLevel ?? null },
  });
}
