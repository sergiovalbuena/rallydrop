/*
 * Sample data for local development and first deploys.
 * Run with: npm run db:seed   (safe to re-run: upserts by slug/email)
 *
 * Machine specs and court locations are SAMPLE values — verify them in
 * Admin → Machines / Settings before going live.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { addLocalDays, localDateMinuteToUtc, localWeekday, toLocalDate } from "../src/lib/time";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const HOUR = 3_600_000;

async function main() {
  await db.settings.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } });

  const products = [
    { slug: "day", kind: "DAY", name: "Day rental", priceCents: 4500, durationHours: 25, sortOrder: 1,
      description: "25 hours with the machine — delivered, set up and picked up the next day." },
    { slug: "weekend", kind: "WEEKEND", name: "Weekend", priceCents: 8000, durationHours: 48, sortOrder: 2,
      description: "Saturday 9 AM to Monday 9 AM, or Friday 9 PM to Sunday 9 PM.",
      allowedStarts: [{ weekday: 6, minute: 540 }, { weekday: 5, minute: 1260 }] },
    { slug: "week", kind: "WEEK", name: "Week", priceCents: 15000, durationHours: 168, sortOrder: 3,
      description: "Seven days to groove your strokes." },
    { slug: "month", kind: "MONTH", name: "Full month", priceCents: 30000, durationHours: 720, sortOrder: 4,
      description: "Keep it at home for 30 days." },
    { slug: "package-basic", kind: "PACKAGE", name: "Basic package", priceCents: 4000, sortOrder: 5,
      sessionsPerMonth: 4, sessionMinutes: 90,
      description: "4 sessions of 1.5 h per month, delivered to your court." },
    { slug: "package-frequent", kind: "PACKAGE", name: "Frequent package", priceCents: 7000, sortOrder: 6,
      sessionsPerMonth: 8, sessionMinutes: 90,
      description: "8 sessions of 1.5 h per month, delivered to your court." },
    { slug: "group-session", kind: "GROUP_SESSION", name: "Group session", priceCents: 2000, sortOrder: 7,
      groupCapacity: 6, description: "1 h coached machine drills, up to 6 players. Price per person." },
  ] as const;

  for (const p of products) {
    await db.product.upsert({ where: { slug: p.slug }, update: {}, create: { ...p } });
  }

  await db.addOn.upsert({
    where: { kind: "BALLS" },
    update: {},
    create: { kind: "BALLS", name: "Ball bucket", priceCents: 1000,
      description: "100–120 pressureless balls that keep their bounce." },
  });
  await db.addOn.upsert({
    where: { kind: "DELIVERY" },
    update: {},
    create: { kind: "DELIVERY", name: "Delivery & pickup", priceCents: 1500,
      description: "Free within 5 km of downtown Victoria." },
  });

  const aura = await db.machine.upsert({
    where: { slug: "pongbot-aura" },
    update: {},
    create: {
      slug: "pongbot-aura",
      name: "PONGBOT Aura",
      model: "Aura",
      description:
        "Light, smart and battery powered. Phone-controlled drills with spin, oscillation and random play — perfect for groundstrokes and volleys.",
      weightKg: 7,
      maxSpeedKmh: 80,
      ballCapacity: 70,
      batteryHours: 2.5,
      sports: ["TENNIS", "PICKLEBALL"],
      levels: ["BEGINNER", "INTERMEDIATE", "ADVANCED"],
      specs: [
        { label: "Control", value: "Smartphone app + remote" },
        { label: "Spin", value: "Topspin / backspin" },
      ],
      depositCents: 30000,
      calendarColor: "#2563eb",
      sortOrder: 1,
    },
  });

  await db.machine.upsert({
    where: { slug: "pongbot-pace-s" },
    update: {},
    create: {
      slug: "pongbot-pace-s",
      name: "PONGBOT Pace S",
      model: "Pace S",
      description: "More pace, more spin and a bigger hopper for advanced players. Coming soon.",
      sports: ["TENNIS"],
      levels: ["INTERMEDIATE", "ADVANCED", "PRO"],
      depositCents: 40000,
      calendarColor: "#ca8a04",
      bookable: false,
      sortOrder: 2,
    },
  });

  const courts = [
    { name: "Beacon Hill Park courts", address: "Beacon Hill Park, Victoria, BC V8V", lat: 48.4126, lng: -123.3646 },
    { name: "Central Park courts", address: "Central Park, Pandora Ave, Victoria, BC V8W", lat: 48.4297, lng: -123.3561 },
    { name: "Stadacona Park courts", address: "Stadacona Park, Victoria, BC V8R", lat: 48.4262, lng: -123.3320 },
    { name: "Windsor Park courts (Oak Bay)", address: "Windsor Park, Oak Bay, BC V8S", lat: 48.4233, lng: -123.3100 },
    { name: "Vic West Park courts", address: "Victoria West Park, Victoria, BC V9A", lat: 48.4318, lng: -123.3825 },
  ];
  const courtRows = [];
  for (const [i, c] of courts.entries()) {
    const existing = await db.court.findFirst({ where: { name: c.name } });
    courtRows.push(existing ?? (await db.court.create({ data: { ...c, sortOrder: i } })));
  }

  // Upcoming group sessions (Saturdays 10:00 local) with their machine blocks.
  if ((await db.groupSession.count()) === 0) {
    for (let i = 0; i < 3; i++) {
      const startsAt = nextWeekday(6, i);
      const endsAt = new Date(startsAt.getTime() + HOUR);
      await db.groupSession.create({
        data: {
          title: i === 1 ? "Volley & net play" : "Groundstroke rally clinic",
          description: "Machine-fed drills with a coach. All rackets welcome; balls provided.",
          startsAt,
          endsAt,
          capacity: 6,
          priceCents: 2000,
          level: i === 2 ? "INTERMEDIATE" : null,
          court: { connect: { id: courtRows[0].id } },
          machine: { connect: { id: aura.id } },
          occupancy: {
            create: {
              machine: { connect: { id: aura.id } },
              source: "GROUP_SESSION",
              blockStart: startsAt,
              blockEnd: new Date(endsAt.getTime() + 2 * HOUR),
            },
          },
        },
      });
    }
  }

  const email = process.env.SEED_ADMIN_EMAIL ?? "owner@example.com";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "change-me-please";
  await db.user.upsert({
    where: { email },
    update: {},
    create: { email, name: "Owner", role: "ADMIN", passwordHash: await bcrypt.hash(password, 12) },
  });

  console.log(`Seeded. Admin login: ${email} / ${password === "change-me-please" ? password : "(from env)"}`);
}

/** Upcoming given weekday (0 = Sun), N weeks out, at 10:00 Victoria time. */
function nextWeekday(weekday: number, weeksOut = 0): Date {
  let date = addLocalDays(toLocalDate(new Date()), 1);
  while (localWeekday(date) !== weekday) date = addLocalDays(date, 1);
  return localDateMinuteToUtc(addLocalDays(date, weeksOut * 7), 600);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
