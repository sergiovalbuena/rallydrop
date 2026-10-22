"use server";

import { BookingError } from "@/lib/services/errors";
import { confirmDepositHold, finishDepositCardUpdate, startDepositCardUpdate } from "@/lib/services/deposit-card";
import { DEPOSIT_CARD, idFromSigned } from "@/lib/services/links";

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

function bookingId(token: string): string {
  const id = idFromSigned(DEPOSIT_CARD, token);
  if (!id) throw new BookingError("NOT_FOUND", "This link isn't valid. Use the latest email we sent you.");
  return id;
}

async function guard<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, ...(await fn()) };
  } catch (e) {
    if (e instanceof BookingError) return { ok: false, error: e.message };
    console.error("deposit card", e);
    return { ok: false, error: "Something went wrong. Please try again or contact us." };
  }
}

export async function startCardUpdateAction(token: string) {
  return guard(() => startDepositCardUpdate(bookingId(token)));
}

/** The card is saved → place the hold again. */
export async function finishCardUpdateAction(token: string, setupIntentId: string) {
  return guard(async () => {
    const hold = await finishDepositCardUpdate(bookingId(token), setupIntentId);
    if (hold.status === "failed") throw new BookingError("PAYMENT_FAILED", hold.message);
    return { hold: hold.status, clientSecret: hold.status === "requires_action" ? hold.clientSecret : null };
  });
}

export async function confirmHoldAction(token: string) {
  return guard(async () => ({ held: await confirmDepositHold(bookingId(token)) }));
}
