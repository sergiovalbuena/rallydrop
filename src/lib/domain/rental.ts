/*
 * Per-rental rules that depend on the product and the owner's settings:
 * RallyDrop Care price, deposit size and which taxes are charged.
 */

type Kind = "DAY" | "WEEKEND" | "WEEK" | "MONTH" | "PACKAGE" | "GROUP_SESSION";

export type CareSettings = {
  careEnabled: boolean;
  careShortCents: number;
  careWeekCents: number;
  careMonthCents: number;
};

/** Care price for a product, or null when Care isn't offered for it. */
export function carePrice(kind: Kind, s: CareSettings): number | null {
  if (!s.careEnabled) return null;
  if (kind === "DAY" || kind === "WEEKEND") return s.careShortCents;
  if (kind === "WEEK") return s.careWeekCents;
  if (kind === "MONTH") return s.careMonthCents;
  return null;
}

/**
 * Short rentals get a card hold; rentals longer than the hold window (week,
 * month) get the bigger saved-card deposit.
 */
export function depositAmount(
  machine: { depositCents: number; depositLongCents: number },
  rentalHours: number,
  authMaxDays: number,
): number {
  return rentalHours > authMaxDays * 24 ? machine.depositLongCents : machine.depositCents;
}

/**
 * Taxes actually charged. A tax is only charged when the owner switched it
 * on AND saved the registration number.
 * NOTE FOR THE OWNER: confirm with your accountant when you must register.
 */
export function chargedTaxes(s: {
  gstBps: number;
  pstBps: number;
  chargeGst: boolean;
  chargePst: boolean;
  gstNumber: string | null;
  pstNumber: string | null;
}): { gstBps: number; pstBps: number } {
  return {
    gstBps: s.chargeGst && s.gstNumber ? s.gstBps : 0,
    pstBps: s.chargePst && s.pstNumber ? s.pstBps : 0,
  };
}

/**
 * Most a customer can be charged for damage. With Care the cap applies
 * unless the owner records an exclusion (theft, loss, rain, gross negligence).
 */
export function maxDamageCharge(input: {
  depositCents: number;
  care: boolean;
  careCapCents: number;
  exclusion: string | null;
}): number {
  if (!input.care || input.exclusion) return input.depositCents;
  return Math.min(input.depositCents, input.careCapCents);
}
