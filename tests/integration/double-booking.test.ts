import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  confirmBooking,
  createBooking,
  expireAllStaleHolds,
  rescheduleBooking,
  type CreateBookingInput,
} from "@/lib/services/bookings";
import { BookingError } from "@/lib/services/errors";
import { localDateMinuteToUtc } from "@/lib/time";
import { hasTestDb, resetDb, seedCatalog } from "../helpers/fixtures";

// Wed Apr 28 2027 10:00 Victoria
const now = localDateMinuteToUtc("2027-04-28", 600);
const MIN = 60_000;

describe.skipIf(!hasTestDb)("booking concurrency (Postgres)", () => {
  let catalog: Awaited<ReturnType<typeof seedCatalog>>;

  beforeEach(async () => {
    await resetDb();
    catalog = await seedCatalog();
  });

  function input(overrides: Partial<CreateBookingInput> = {}): CreateBookingInput {
    return {
      productId: catalog.day.id,
      machineId: catalog.aura.id,
      startsAt: localDateMinuteToUtc("2027-05-03", 600), // Mon 10:00
      customer: { name: "Alex", email: `alex${Math.random()}@example.com` },
      balls: true,
      fulfillment: "DELIVERY_COURT",
      courtId: catalog.court.id,
      channel: "ONLINE",
      termsAccepted: true,
      now,
      ...overrides,
    };
  }

  it("creates a held booking with price snapshot, buffer and deposit plan", async () => {
    const booking = await createBooking(input());
    expect(booking.status).toBe("PENDING_PAYMENT");
    expect(booking.code).toMatch(/^RD-[A-Z0-9]{5}$/);
    // 45 + 10 balls + free court delivery = 55 → +12% tax
    expect(booking.subtotalCents).toBe(5500);
    expect(booking.totalCents).toBe(6160);
    expect(booking.endsAt.getTime() - booking.startsAt.getTime()).toBe(25 * 60 * MIN);
    expect(booking.deposit?.strategy).toBe("AUTH_HOLD");
    expect(booking.deposit?.amountCents).toBe(30000);

    const occ = await db.machineOccupancy.findUniqueOrThrow({ where: { bookingId: booking.id } });
    expect(occ.blockEnd.getTime() - booking.endsAt.getTime()).toBe(120 * MIN);
    expect(occ.holdExpiresAt?.getTime()).toBe(now.getTime() + 10 * MIN);
  });

  it("lets exactly one of many concurrent requests win the same slot", async () => {
    const attempts = await Promise.allSettled(Array.from({ length: 8 }, () => createBooking(input())));
    const won = attempts.filter((a) => a.status === "fulfilled");
    const lost = attempts.filter((a): a is PromiseRejectedResult => a.status === "rejected");
    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(7);
    for (const l of lost) {
      expect(l.reason).toBeInstanceOf(BookingError);
      expect((l.reason as BookingError).code).toBe("SLOT_TAKEN");
    }
    expect(await db.machineOccupancy.count({ where: { active: true } })).toBe(1);
  });

  it("rejects overlaps that only touch the 2 h buffer", async () => {
    await createBooking(input());
    // Previous rental returns Tue 11:00; buffer until 13:00. 12:00 must fail.
    await expect(
      createBooking(input({ startsAt: localDateMinuteToUtc("2027-05-04", 720) })),
    ).rejects.toMatchObject({ code: "SLOT_TAKEN" });
    await expect(createBooking(input({ startsAt: localDateMinuteToUtc("2027-05-04", 780) }))).resolves.toBeTruthy();
  });

  it("allows the same slot on a different machine", async () => {
    await createBooking(input());
    await expect(createBooking(input({ machineId: catalog.pace.id }))).resolves.toBeTruthy();
  });

  it("lets a new customer take a slot whose hold expired", async () => {
    const first = await createBooking(input());
    const later = new Date(now.getTime() + 11 * MIN);
    const second = await createBooking(input({ now: later }));
    expect(second.status).toBe("PENDING_PAYMENT");
    expect((await db.booking.findUniqueOrThrow({ where: { id: first.id } })).status).toBe("EXPIRED");
    // The first customer pays late: the slot is gone, so confirmation fails (→ refund).
    expect(await confirmBooking(first.id)).toBe(false);
    expect(await confirmBooking(second.id)).toBe(true);
  });

  it("confirms a late payment when nobody took the slot", async () => {
    const booking = await createBooking(input());
    await expireAllStaleHolds(new Date(now.getTime() + 11 * MIN));
    expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("EXPIRED");
    expect(await confirmBooking(booking.id)).toBe(true);
    const occ = await db.machineOccupancy.findUniqueOrThrow({ where: { bookingId: booking.id } });
    expect(occ.active).toBe(true);
    expect(occ.holdExpiresAt).toBeNull();
  });

  it("refuses start times outside the product rules", async () => {
    await expect(
      createBooking(input({ productId: catalog.weekend.id, startsAt: localDateMinuteToUtc("2027-05-03", 600) })),
    ).rejects.toMatchObject({ code: "SLOT_NOT_ALLOWED" });
    await expect(
      createBooking(input({ productId: catalog.weekend.id, startsAt: localDateMinuteToUtc("2027-04-30", 1260) })),
    ).resolves.toMatchObject({ status: "PENDING_PAYMENT" });
  });

  it("uses a saved card instead of a hold for week rentals", async () => {
    const b = await createBooking(input({ productId: catalog.week.id }));
    expect(b.deposit?.strategy).toBe("SAVED_CARD");
  });

  it("blocks bookings over admin blackouts", async () => {
    const blackout = await db.blackout.create({
      data: {
        startsAt: localDateMinuteToUtc("2027-05-04", 0),
        endsAt: localDateMinuteToUtc("2027-05-05", 0),
        reason: "WEATHER",
      },
    });
    await db.machineOccupancy.create({
      data: {
        machineId: catalog.aura.id,
        source: "BLACKOUT",
        blockStart: blackout.startsAt,
        blockEnd: blackout.endsAt,
        blackoutId: blackout.id,
      },
    });
    await expect(createBooking(input())).rejects.toMatchObject({ code: "SLOT_TAKEN" });
  });

  it("reschedules only into free time", async () => {
    const a = await createBooking(input({ channel: "ADMIN" }));
    const b = await createBooking(input({ channel: "ADMIN", startsAt: localDateMinuteToUtc("2027-05-06", 600) }));
    await expect(
      rescheduleBooking({ bookingId: b.id, startsAt: localDateMinuteToUtc("2027-05-03", 900), actor: "test", now }),
    ).rejects.toMatchObject({ code: "SLOT_TAKEN" });
    const moved = await rescheduleBooking({
      bookingId: a.id,
      startsAt: localDateMinuteToUtc("2027-05-10", 600),
      actor: "test",
      now,
    });
    expect(moved.startsAt.toISOString()).toBe(localDateMinuteToUtc("2027-05-10", 600).toISOString());
  });

  it("refuses blocked customers", async () => {
    await db.customer.create({ data: { name: "Nope", email: "blocked@example.com", blocked: true } });
    await expect(createBooking(input({ customer: { name: "Nope", email: "blocked@example.com" } }))).rejects.toMatchObject(
      { code: "CUSTOMER_BLOCKED" },
    );
  });
});
