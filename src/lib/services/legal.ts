import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import type { LegalDocument, LegalKind } from "@/generated/prisma/client";
import { TERMS_BODY, TERMS_TITLE } from "@/content/legal/terms";
import { WAIVER_BODY, WAIVER_TITLE } from "@/content/legal/waiver";
import { CONSENT_BOXES, consentComplete, sha256 } from "@/lib/domain/legal";
import { formatLocal } from "@/lib/time";
import { BookingError } from "./errors";
import { databaseConfigured, readOr } from "./fallback";

/** Version stamped on the starting texts in src/content/legal. */
export const DEFAULT_LEGAL_VERSION = "2026-10-23";

export type PublicLegalDoc = Pick<
  LegalDocument,
  "id" | "kind" | "version" | "title" | "body" | "sha256" | "publishedAt"
>;
export type CurrentLegal = { terms: PublicLegalDoc; waiver: PublicLegalDoc };

const DEFAULTS: Record<LegalKind, { title: string; body: string }> = {
  TERMS: { title: TERMS_TITLE, body: TERMS_BODY },
  WAIVER: { title: WAIVER_TITLE, body: WAIVER_BODY },
};

function fallbackDoc(kind: LegalKind): PublicLegalDoc {
  const d = DEFAULTS[kind];
  return {
    id: `fallback-${kind.toLowerCase()}`,
    kind,
    version: DEFAULT_LEGAL_VERSION,
    title: d.title,
    body: d.body,
    sha256: sha256(d.body),
    publishedAt: null,
  };
}

/**
 * The live (latest published) Terms and Waiver. On a fresh database the
 * starting texts are published automatically as DEFAULT_LEGAL_VERSION.
 */
export async function currentLegal(): Promise<CurrentLegal> {
  return readOr(
    "legal documents",
    async () => ({ terms: await current("TERMS"), waiver: await current("WAIVER") }),
    () => ({ terms: fallbackDoc("TERMS"), waiver: fallbackDoc("WAIVER") }),
  );
}

async function current(kind: LegalKind): Promise<PublicLegalDoc> {
  const found = await db.legalDocument.findFirst({
    where: { kind, publishedAt: { not: null } },
    orderBy: { publishedAt: "desc" },
  });
  if (found) return found;
  const d = DEFAULTS[kind];
  return db.legalDocument.upsert({
    where: { kind_version: { kind, version: DEFAULT_LEGAL_VERSION } },
    update: { publishedAt: new Date() },
    create: {
      kind,
      version: DEFAULT_LEGAL_VERSION,
      title: d.title,
      body: d.body,
      sha256: sha256(d.body),
      draft: true,
      publishedAt: new Date(),
    },
  });
}

/** A specific published version (links in confirmation emails). */
export async function legalVersion(kind: LegalKind, version: string): Promise<PublicLegalDoc | null> {
  if (!databaseConfigured()) return version === DEFAULT_LEGAL_VERSION ? fallbackDoc(kind) : null;
  return db.legalDocument.findFirst({ where: { kind, version, publishedAt: { not: null } } });
}

/** What the checkout needs to show the documents and record which ones were shown. */
export function toConsentDocs(l: CurrentLegal) {
  const pick = (d: PublicLegalDoc) => ({ id: d.id, version: d.version, title: d.title, body: d.body });
  return { terms: pick(l.terms), waiver: pick(l.waiver) };
}

export type AcceptanceInput = {
  bookingId?: string | null;
  customerId?: string | null;
  name: string;
  contact: string;
  /** Ids of the documents the customer was shown. */
  termsId: string;
  waiverId: string;
  boxes: readonly string[];
  method: "checkout" | "accept_link" | "package" | "carried_over";
  ip?: string | null;
  userAgent?: string | null;
  now?: Date;
};

/**
 * Stores proof of acceptance (clickwrap). Refuses if a box is missing or if
 * the texts shown are no longer the live versions (published meanwhile).
 */
export async function recordAcceptance(input: AcceptanceInput) {
  if (!consentComplete(input.boxes)) {
    throw new BookingError("TERMS_REQUIRED", "Tick both boxes to continue.");
  }
  const live = await currentLegal();
  if (live.terms.id !== input.termsId || live.waiver.id !== input.waiverId) {
    throw new BookingError(
      "TERMS_REQUIRED",
      "Our terms were just updated. Please review them and tick the boxes again.",
    );
  }
  const now = input.now ?? new Date();
  return db.waiverAcceptance.create({
    data: {
      bookingId: input.bookingId ?? null,
      customerId: input.customerId ?? null,
      name: input.name,
      contact: input.contact,
      termsId: live.terms.id,
      waiverId: live.waiver.id,
      termsVersion: live.terms.version,
      termsSha256: live.terms.sha256,
      waiverVersion: live.waiver.version,
      waiverSha256: live.waiver.sha256,
      checkboxes: CONSENT_BOXES.filter((b) => input.boxes.includes(b)),
      method: input.method,
      ip: input.ip ?? null,
      userAgent: input.userAgent?.slice(0, 500) ?? null,
      acceptedAt: now,
      acceptedAtLocal: `${formatLocal(now, "yyyy-MM-dd HH:mm:ss")} America/Vancouver`,
    },
  });
}

/** Latest acceptance on a booking (null = not accepted yet). */
export async function bookingAcceptance(bookingId: string) {
  return db.waiverAcceptance.findFirst({ where: { bookingId }, orderBy: { acceptedAt: "desc" } });
}

/**
 * Package sessions: if the customer already accepted the live versions,
 * copy that acceptance onto the new booking (no boxes to tick again).
 * Returns false when they must accept the new version first.
 */
export async function carryOverAcceptance(customerId: string, bookingId: string): Promise<boolean> {
  const live = await currentLegal();
  const last = await db.waiverAcceptance.findFirst({
    where: { customerId, termsId: live.terms.id, waiverId: live.waiver.id },
    orderBy: { acceptedAt: "desc" },
  });
  if (!last) return false;
  const now = new Date();
  await db.waiverAcceptance.create({
    data: {
      bookingId,
      customerId,
      name: last.name,
      contact: last.contact,
      termsId: last.termsId,
      waiverId: last.waiverId,
      termsVersion: last.termsVersion,
      termsSha256: last.termsSha256,
      waiverVersion: last.waiverVersion,
      waiverSha256: last.waiverSha256,
      checkboxes: last.checkboxes ?? [],
      method: "carried_over",
      ip: last.ip,
      userAgent: last.userAgent,
      acceptedAt: now,
      acceptedAtLocal: `${formatLocal(now, "yyyy-MM-dd HH:mm:ss")} America/Vancouver (carried over from ${last.acceptedAtLocal})`,
    },
  });
  return true;
}

/** Whether a customer has accepted the live versions (e.g. package members). */
export async function customerAcceptedLive(customerId: string): Promise<boolean> {
  const live = await currentLegal();
  const n = await db.waiverAcceptance.count({
    where: { customerId, termsId: live.terms.id, waiverId: live.waiver.id },
  });
  return n > 0;
}

// --- Acceptance links (phone bookings, or a payment that arrived without one)

function secret(): string {
  const s = process.env.PORTAL_SECRET ?? process.env.AUTH_SECRET;
  if (!s) throw new Error("PORTAL_SECRET is not set.");
  return s;
}

export function acceptanceToken(bookingId: string): string {
  const mac = createHmac("sha256", secret()).update(`accept:${bookingId}`).digest("base64url");
  return `${bookingId}.${mac}`;
}

export function bookingIdFromToken(token: string): string | null {
  const [id, mac] = token.split(".");
  if (!id || !mac) return null;
  const expected = acceptanceToken(id).split(".")[1];
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b) ? id : null;
}
