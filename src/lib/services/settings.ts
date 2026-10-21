import "server-only";
import { db } from "@/lib/db";
import type { Settings } from "@/generated/prisma/client";

/** Settings with Decimal columns converted to plain numbers. */
export type AppSettings = Omit<
  Settings,
  "freeDeliveryCenterLat" | "freeDeliveryCenterLng" | "freeDeliveryRadiusKm"
> & {
  freeDeliveryCenterLat: number;
  freeDeliveryCenterLng: number;
  freeDeliveryRadiusKm: number;
};

export function toAppSettings(s: Settings): AppSettings {
  return {
    ...s,
    freeDeliveryCenterLat: Number(s.freeDeliveryCenterLat),
    freeDeliveryCenterLng: Number(s.freeDeliveryCenterLng),
    freeDeliveryRadiusKm: Number(s.freeDeliveryRadiusKm),
  };
}

/** Reads the singleton settings row, creating it with defaults if missing. */
export async function getSettings(): Promise<AppSettings> {
  const row =
    (await db.settings.findUnique({ where: { id: "default" } })) ??
    (await db.settings.create({ data: { id: "default" } }));
  return toAppSettings(row);
}
