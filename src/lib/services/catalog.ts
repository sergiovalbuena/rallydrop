import "server-only";
import { db } from "@/lib/db";
import type { Machine } from "@/generated/prisma/client";
import { forSports } from "@/lib/domain/sports";
import { getSettings } from "./settings";
import { fallbackAddOns, fallbackCourts, fallbackMachines, fallbackProducts, readOr } from "./fallback";

/** Machine with Decimal specs converted for client components. */
export type PublicMachine = Omit<Machine, "weightKg" | "batteryHours" | "specs"> & {
  weightKg: number | null;
  batteryHours: number | null;
  specs: { label: string; value: string }[];
};

export function toPublicMachine(m: Machine): PublicMachine {
  const specs = Array.isArray(m.specs)
    ? m.specs.flatMap((s) =>
        s && typeof s === "object" && "label" in s && "value" in s
          ? [{ label: String(s.label), value: String(s.value) }]
          : [],
      )
    : [];
  return {
    ...m,
    weightKg: m.weightKg === null ? null : Number(m.weightKg),
    batteryHours: m.batteryHours === null ? null : Number(m.batteryHours),
    specs,
  };
}

export async function listPublicMachines(): Promise<PublicMachine[]> {
  const [machines, settings] = await Promise.all([queryPublicMachines(), getSettings()]);
  return machines.map((m) => forSports(m, settings.pickleballEnabled));
}

async function queryPublicMachines(): Promise<PublicMachine[]> {
  return readOr(
    "machines",
    async () => {
      const machines = await db.machine.findMany({
        // Hidden machines never reach the public site.
        where: { status: { not: "RETIRED" }, isPublic: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      });
      return machines.map(toPublicMachine);
    },
    () => fallbackMachines().filter((m) => m.isPublic),
  );
}

export async function listActiveProducts() {
  return readOr(
    "products",
    () => db.product.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    fallbackProducts,
  );
}

export async function listActiveAddOns() {
  return readOr(
    "add-ons",
    () => db.addOn.findMany({ where: { active: true }, orderBy: { kind: "asc" } }),
    fallbackAddOns,
  );
}

export async function listActiveCourts() {
  const courts = await listCourtsWithLocation();
  return courts.map((c) => ({ id: c.id, name: c.name, address: c.address }));
}

export async function listCourtsWithLocation() {
  return readOr(
    "courts",
    async () => {
      const courts = await db.court.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
      return courts.map((c) => ({
        id: c.id,
        name: c.name,
        address: c.address,
        lat: Number(c.lat),
        lng: Number(c.lng),
      }));
    },
    fallbackCourts,
  );
}
