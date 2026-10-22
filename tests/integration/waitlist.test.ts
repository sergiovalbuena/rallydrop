import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { joinWaitlist, waitlistSummary } from "@/lib/services/waitlist";
import { hasTestDb, resetDb, seedCatalog } from "../helpers/fixtures";

describe.skipIf(!hasTestDb)("coming-soon waitlist (Postgres)", () => {
  let catalog: Awaited<ReturnType<typeof seedCatalog>>;

  beforeEach(async () => {
    await resetDb();
    catalog = await seedCatalog();
    await db.machine.update({ where: { id: catalog.pace.id }, data: { bookable: false } });
  });

  it("stores each email once per machine, with the consent wording", async () => {
    expect(await joinWaitlist({ machineId: catalog.pace.id, email: " Fan@Example.com ", source: "home" })).toEqual({
      ok: true,
      already: false,
    });
    expect(await joinWaitlist({ machineId: catalog.pace.id, email: "fan@example.com" })).toEqual({
      ok: true,
      already: true,
    });
    const rows = await db.waitlistSignup.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ email: "fan@example.com", source: "home" });
    expect(rows[0].consent).toMatch(/email me/i);
  });

  it("counts interest per machine and for the last week", async () => {
    await joinWaitlist({ machineId: catalog.pace.id, email: "a@example.com" });
    await joinWaitlist({ machineId: catalog.pace.id, email: "b@example.com" });
    await db.waitlistSignup.updateMany({
      where: { email: "a@example.com" },
      data: { createdAt: new Date(Date.now() - 30 * 86_400_000) },
    });
    const s = await waitlistSummary();
    expect(s.total).toBe(2);
    expect(s.lastWeek).toBe(1);
    expect(s.machines[0].waitlist.map((w) => w.email)).toEqual(["b@example.com", "a@example.com"]);
  });
});
