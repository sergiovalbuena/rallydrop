import "server-only";
import { db } from "@/lib/db";
import type { Machine } from "@/generated/prisma/client";
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

export async function upcomingGroupSessions(now: Date) {
  return readOr(
    "group sessions",
    () => queryGroupSessions(now),
    () => [],
  );
}

async function queryGroupSessions(now: Date) {
  const sessions = await db.groupSession.findMany({
    where: { status: "SCHEDULED", startsAt: { gt: now } },
    orderBy: { startsAt: "asc" },
    take: 12,
    include: {
      court: { select: { name: true, address: true } },
      _count: {
        select: {
          enrollments: {
            where: {
              OR: [{ status: "CONFIRMED" }, { status: "PENDING_PAYMENT", holdExpiresAt: { gt: now } }],
            },
          },
        },
      },
    },
  });
  return sessions.map((s) => ({
    id: s.id,
    title: s.title,
    description: s.description,
    startsAt: s.startsAt,
    endsAt: s.endsAt,
    level: s.level,
    priceCents: s.priceCents,
    capacity: s.capacity,
    spotsLeft: Math.max(0, s.capacity - s._count.enrollments),
    court: s.court,
  }));
}
