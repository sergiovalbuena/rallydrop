import "server-only";
import type { AddOn, Product } from "@/generated/prisma/client";
import { DEFAULT_DELIVERY_ZONES } from "@/lib/domain/delivery";
import { DEFAULT_ADD_ONS, DEFAULT_COURTS, DEFAULT_MACHINES, DEFAULT_PRODUCTS } from "@/lib/catalog-defaults";
import type { PublicMachine } from "./catalog";
import type { AppSettings } from "./settings";

/*
 * Lets the public site render before a database exists (first deploy) or
 * while it is unreachable: catalog reads fall back to the starting catalog.
 * Anything that writes (bookings, accounts, admin) still needs the database.
 */

export function databaseConfigured(): boolean {
  return !!process.env.DATABASE_URL;
}

const UNREACHABLE_CODES = ["P1000", "P1001", "P1002", "P1003", "P1017", "ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT"];

function isUnreachable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  if (typeof code === "string" && UNREACHABLE_CODES.includes(code)) return true;
  return String((error as { message?: unknown }).message ?? "").includes("DatabaseNotReachable");
}

/** Runs a read; without a usable database returns the fallback instead of failing the page. */
export async function readOr<T>(label: string, query: () => Promise<T>, fallback: () => T): Promise<T> {
  if (!databaseConfigured()) return fallback();
  try {
    return await query();
  } catch (error) {
    if (!isUnreachable(error)) throw error;
    console.error(`[db unreachable] ${label}: showing fallback content`);
    return fallback();
  }
}

const EPOCH = new Date(0);

export function fallbackProducts(): Product[] {
  return DEFAULT_PRODUCTS.map((p) => ({
    id: `fallback-${p.slug}`,
    slug: p.slug,
    kind: p.kind,
    name: p.name,
    description: p.description,
    priceCents: p.priceCents,
    offSeasonPriceCents: "offSeasonPriceCents" in p ? p.offSeasonPriceCents : null,
    active: true,
    sortOrder: p.sortOrder,
    durationHours: "durationHours" in p ? p.durationHours : null,
    allowedStarts: "allowedStarts" in p ? p.allowedStarts.map((s) => ({ ...s })) : null,
    sessionsPerMonth: "sessionsPerMonth" in p ? p.sessionsPerMonth : null,
    sessionMinutes: "sessionMinutes" in p ? p.sessionMinutes : null,
    stripeProductId: null,
    stripePriceId: null,
    createdAt: EPOCH,
    updatedAt: EPOCH,
  }));
}

export function fallbackAddOns(): AddOn[] {
  return DEFAULT_ADD_ONS.map((a) => ({ id: `fallback-${a.kind}`, active: true, ...a }));
}

export function fallbackMachines(): PublicMachine[] {
  return DEFAULT_MACHINES.map((m) => ({
    id: `fallback-${m.slug}`,
    slug: m.slug,
    name: m.name,
    model: m.model,
    description: m.description,
    imageUrl: "imageUrl" in m ? m.imageUrl : null,
    status: "AVAILABLE",
    bookable: m.bookable,
    calendarColor: m.calendarColor,
    sortOrder: m.sortOrder,
    weightKg: "weightKg" in m ? m.weightKg : null,
    maxSpeedKmh: "maxSpeedKmh" in m ? m.maxSpeedKmh : null,
    ballCapacity: "ballCapacity" in m ? m.ballCapacity : null,
    batteryHours: "batteryHours" in m ? m.batteryHours : null,
    sports: [...m.sports],
    levels: [...m.levels],
    specs: "specs" in m ? m.specs.map((s) => ({ ...s })) : [],
    depositCents: m.depositCents,
    depositLongCents: m.depositLongCents,
    isPublic: m.isPublic,
    purchaseCostCents: null,
    aiCoach: "aiCoach" in m ? m.aiCoach : false,
    createdAt: EPOCH,
    updatedAt: EPOCH,
  }));
}

export function fallbackCourts() {
  return DEFAULT_COURTS.map((c, i) => ({ id: `fallback-court-${i}`, ...c }));
}

/** Same values as the Settings column defaults in schema.prisma. */
export function fallbackSettings(): AppSettings {
  return {
    id: "default",
    gstBps: 500,
    pstBps: 700,
    chargeGst: false,
    chargePst: false,
    gstNumber: null,
    pstNumber: null,
    siteDomain: null,
    hubAddress: null,
    instagramUrl: null,
    insuranceProvider: null,
    insurancePolicyNumber: null,
    insuranceCoverageCents: null,
    businessLicenceNumber: null,
    businessLicenceMunicipality: null,
    careEnabled: true,
    careShortCents: 800,
    careWeekCents: 1500,
    careMonthCents: 2500,
    careCapCents: 10000,
    identityCheck: "MANUAL",
    bufferMinutes: 120,
    holdMinutes: 10,
    minLeadTimeHours: 12,
    maxAdvanceDays: 90,
    depositAuthMaxDays: 6,
    depositAuthLeadHours: 24,
    cancelFullRefundHours: 48,
    cancelLateRefundBps: 5000,
    deliveryStartMinute: 480,
    deliveryEndMinute: 1260,
    deliveryHubLat: 48.4284,
    deliveryHubLng: -123.3656,
    deliveryZones: DEFAULT_DELIVERY_ZONES,
    seasonStart: "04-01",
    seasonEnd: "09-30",
    allowOffSeason: true,
    highSeasonMonthCap: 1,
    rainCreditMonths: 6,
    packageRollover: false,
    lateGraceMinutes: 30,
    lateHourlyCents: 1500,
    lateUnreturnedHours: 24,
    pickleballEnabled: true,
    springPassEnabled: false,
    springPassPriceCents: 19900,
    springPassWeekends: 3,
    springPassLimit: 20,
    springPassStart: "04-01",
    springPassEnd: "06-30",
    smsEnabled: false,
    contactEmail: null,
    contactPhone: null,
    stripeGstTaxRateId: null,
    stripePstTaxRateId: null,
    updatedAt: EPOCH,
  };
}
