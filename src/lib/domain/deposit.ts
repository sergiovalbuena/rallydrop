/*
 * Which deposit flow a booking gets (see docs/PLAN.md §2 "Depósito").
 *
 * - Short rentals (<= depositAuthMaxDays) use a manual-capture PaymentIntent:
 *   the money is held on the card, never charged unless there is damage.
 *   Card authorizations expire after ~7 days, so when the rental starts later
 *   than `leadHours` from now, the card is saved at checkout and the hold is
 *   placed off-session by a cron job `leadHours` before the start.
 * - Long rentals (week, month) outlive any authorization, so the card is only
 *   saved; the owner charges it later off-session if there is damage.
 */

export type DepositPlan =
  | { strategy: "AUTH_HOLD"; placeNow: true; authScheduledFor: null }
  | { strategy: "AUTH_HOLD"; placeNow: false; authScheduledFor: Date }
  | { strategy: "SAVED_CARD"; placeNow: false; authScheduledFor: null };

export function planDeposit(input: {
  startsAt: Date;
  endsAt: Date;
  now: Date;
  authMaxDays: number;
  leadHours: number;
}): DepositPlan {
  const rentalHours = (input.endsAt.getTime() - input.startsAt.getTime()) / 3_600_000;
  if (rentalHours > input.authMaxDays * 24) {
    return { strategy: "SAVED_CARD", placeNow: false, authScheduledFor: null };
  }
  const placeAt = new Date(input.startsAt.getTime() - input.leadHours * 3_600_000);
  if (placeAt <= input.now) {
    return { strategy: "AUTH_HOLD", placeNow: true, authScheduledFor: null };
  }
  return { strategy: "AUTH_HOLD", placeNow: false, authScheduledFor: placeAt };
}

/**
 * Hours we allow after the planned return to inspect the machine and decide
 * on a damage charge before the card hold lapses.
 */
export const RETURN_INSPECTION_HOURS = 12;

/** True when a card hold will lapse before we can inspect the returned machine. */
export function holdLapsesBeforeReturn(authExpiresAt: Date | null, endsAt: Date): boolean {
  if (!authExpiresAt) return false;
  return authExpiresAt.getTime() < endsAt.getTime() + RETURN_INSPECTION_HOURS * 3_600_000;
}

/** Validates an admin capture: amount within the deposit and a note present. */
export function validateCapture(input: {
  amountCents: number;
  depositCents: number;
  alreadyCapturedCents: number;
  note: string;
}): { ok: true } | { ok: false; error: string } {
  if (!input.note.trim()) return { ok: false, error: "A note explaining the damage is required." };
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    return { ok: false, error: "Enter an amount greater than zero." };
  }
  if (input.amountCents + input.alreadyCapturedCents > input.depositCents) {
    return { ok: false, error: "The amount can't exceed the deposit." };
  }
  return { ok: true };
}
