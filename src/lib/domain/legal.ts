import { createHash } from "node:crypto";

/** The two boxes at checkout; their keys are stored with each acceptance. */
export const CONSENT_BOXES = ["terms_waiver", "age_19"] as const;
export type ConsentBox = (typeof CONSENT_BOXES)[number];

export function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** Both boxes must be ticked to pay — the server checks this too. */
export function consentComplete(boxes: readonly string[]): boolean {
  return CONSENT_BOXES.every((b) => boxes.includes(b));
}
