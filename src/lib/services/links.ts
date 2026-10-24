import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/*
 * Signed links that let a customer act on one booking without signing in
 * (e.g. update the card for a deposit). The id is in the link; the HMAC
 * proves we issued it.
 */

function secret(): string {
  const s = process.env.PORTAL_SECRET ?? process.env.AUTH_SECRET;
  if (!s) throw new Error("PORTAL_SECRET is not set.");
  return s;
}

export function signedId(purpose: string, id: string): string {
  const mac = createHmac("sha256", secret()).update(`${purpose}:${id}`).digest("base64url");
  return `${id}.${mac}`;
}

export function idFromSigned(purpose: string, token: string): string | null {
  const [id, mac] = token.split(".");
  if (!id || !mac) return null;
  const expected = createHmac("sha256", secret()).update(`${purpose}:${id}`).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b) ? id : null;
}

export const DEPOSIT_CARD = "deposit-card";
export const REVIEW = "review";
