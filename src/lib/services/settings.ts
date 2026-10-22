import "server-only";
import { db } from "@/lib/db";
import type { Settings } from "@/generated/prisma/client";
import { parseDeliveryZones, type DeliveryZone } from "@/lib/domain/delivery";
import { fallbackSettings, readOr } from "./fallback";

/** Settings with Decimal columns converted to plain numbers. */
export type AppSettings = Omit<Settings, "deliveryHubLat" | "deliveryHubLng" | "deliveryZones"> & {
  deliveryHubLat: number;
  deliveryHubLng: number;
  deliveryZones: DeliveryZone[];
};

export function toAppSettings(s: Settings): AppSettings {
  return {
    ...s,
    deliveryHubLat: Number(s.deliveryHubLat),
    deliveryHubLng: Number(s.deliveryHubLng),
    deliveryZones: parseDeliveryZones(s.deliveryZones),
  };
}

/** Reads the singleton settings row, creating it with defaults if missing. */
export async function getSettings(): Promise<AppSettings> {
  return readOr(
    "settings",
    async () => {
      const row =
        (await db.settings.findUnique({ where: { id: "default" } })) ??
        (await db.settings.create({ data: { id: "default" } }));
      return toAppSettings(row);
    },
    fallbackSettings,
  );
}
