import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createBooking, type CreateBookingInput } from "@/lib/services/bookings";
import { listPublicMachines } from "@/lib/services/catalog";
import { BookingError } from "@/lib/services/errors";
import { localDateMinuteToUtc } from "@/lib/time";
import { hasTestDb, resetDb, seedCatalog } from "../helpers/fixtures";

const now = localDateMinuteToUtc("2027-03-01", 600);

describe.skipIf(!hasTestDb)("v2 launch rules (Postgres)", () => {
  let catalog: Awaited<ReturnType<typeof seedCatalog>>;

  beforeEach(async () => {
    await resetDb();
    catalog = await seedCatalog();
    await db.product.update({ where: { id: catalog.day.id }, data: { priceCents: 5000, offSeasonPriceCents: 4500 } });
  });

  function input(overrides: Partial<CreateBookingInput> = {}): CreateBookingInput {
    return {
      productId: catalog.day.id,
      machineId: catalog.aura.id,
      startsAt: localDateMinuteToUtc("2027-03-10", 600),
      customer: { name: "Robin", email: `r${Math.random()}@example.com` },
      fulfillment: "PICKUP",
      channel: "ONLINE",
      now,
      ...overrides,
    };
  }

  it("keeps hidden machines off the public site", async () => {
    await db.machine.update({ where: { id: catalog.pace.id }, data: { isPublic: false } });
    const slugs = (await listPublicMachines()).map((m) => m.slug);
    expect(slugs).toContain("aura");
    expect(slugs).not.toContain("pace-s");
  });

  it("prices by the season of the start date", async () => {
    const off = await createBooking(input());
    expect(off).toMatchObject({ subtotalCents: 4500, offSeason: true });
    const high = await createBooking(input({ startsAt: localDateMinuteToUtc("2027-04-14", 600) }));
    expect(high).toMatchObject({ subtotalCents: 5000, offSeason: false });
  });

  it("charges GST/PST only when switched on with a registration number", async () => {
    const untaxed = await createBooking(input());
    expect(untaxed.totalCents).toBe(untaxed.subtotalCents);
    await db.settings.update({ where: { id: "default" }, data: { chargeGst: true, gstNumber: "123456789RT0001" } });
    const taxed = await createBooking(input({ startsAt: localDateMinuteToUtc("2027-03-13", 600) }));
    expect(taxed.gstBps).toBe(500);
    expect(taxed.pstBps).toBe(0);
    expect(taxed.totalCents).toBe(4500 + 225);
  });

  it("caps month rentals in high season", async () => {
    const month = await db.product.create({
      data: {
        slug: "month",
        kind: "MONTH",
        name: "Month",
        priceCents: 42000,
        offSeasonPriceCents: 30000,
        durationHours: 720,
      },
    });
    await db.settings.update({ where: { id: "default" }, data: { highSeasonMonthCap: 1 } });
    await createBooking(
      input({
        skipSlotRules: true,
        productId: month.id,
        machineId: catalog.aura.id,
        startsAt: localDateMinuteToUtc("2027-05-01", 600),
      }),
    );
    const second = await createBooking(
      input({
        skipSlotRules: true,
        productId: month.id,
        machineId: catalog.pace.id,
        startsAt: localDateMinuteToUtc("2027-05-15", 600),
      }),
    ).catch((e: unknown) => e);
    expect(second).toBeInstanceOf(BookingError);
    expect((second as BookingError).message).toMatch(/fully booked/);

    // Off-season months aren't capped.
    await createBooking(
      input({ skipSlotRules: true, productId: month.id, startsAt: localDateMinuteToUtc("2027-11-01", 600) }),
    );
    await createBooking(
      input({
        skipSlotRules: true,
        productId: month.id,
        machineId: catalog.pace.id,
        startsAt: localDateMinuteToUtc("2027-11-10", 600),
      }),
    );

    // 0 = not offered in high season.
    await db.settings.update({ where: { id: "default" }, data: { highSeasonMonthCap: 0 } });
    await expect(
      createBooking(
        input({ skipSlotRules: true, productId: month.id, startsAt: localDateMinuteToUtc("2027-07-01", 600) }),
      ),
    ).rejects.toThrow(/fully booked/);
  });
});
