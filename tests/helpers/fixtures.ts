import { db } from "@/lib/db";

export const hasTestDb = !!process.env.TEST_DATABASE_URL;

/** Wipes every table (fast, keeps the schema). */
export async function resetDb() {
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
  if (list) await db.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

export async function seedCatalog() {
  await db.settings.create({ data: { id: "default" } });
  const [day, weekend, week] = await Promise.all([
    db.product.create({
      data: { slug: "day", kind: "DAY", name: "Day rental", priceCents: 4500, durationHours: 25 },
    }),
    db.product.create({
      data: {
        slug: "weekend",
        kind: "WEEKEND",
        name: "Weekend",
        priceCents: 8000,
        durationHours: 48,
        allowedStarts: [
          { weekday: 6, minute: 540 },
          { weekday: 5, minute: 1260 },
        ],
      },
    }),
    db.product.create({
      data: { slug: "week", kind: "WEEK", name: "Week", priceCents: 15000, durationHours: 168 },
    }),
  ]);
  const [aura, pace] = await Promise.all([
    db.machine.create({ data: { slug: "aura", name: "PONGBOT Aura", model: "Aura", depositCents: 40000 } }),
    db.machine.create({ data: { slug: "pace-s", name: "PONGBOT Pace S", model: "Pace S", depositCents: 40000 } }),
  ]);
  await db.addOn.createMany({
    data: [{ kind: "EXTRA_BALLS", name: "Extra bucket (+50 balls)", priceCents: 800 }],
  });
  const court = await db.court.create({
    data: { name: "Beacon Hill Park", address: "Victoria", lat: 48.4125, lng: -123.364 },
  });
  return { day, weekend, week, aura, pace, court };
}

/** Records the clickwrap acceptance like the checkout does before charging. */
export async function acceptTerms(bookingId: string) {
  const { currentLegal, recordAcceptance } = await import("@/lib/services/legal");
  const live = await currentLegal();
  return recordAcceptance({
    bookingId,
    name: "Test",
    contact: "test@example.com",
    termsId: live.terms.id,
    waiverId: live.waiver.id,
    boxes: ["terms_waiver", "age_19"],
    method: "checkout",
  });
}
