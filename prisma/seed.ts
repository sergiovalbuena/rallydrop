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
import { DEFAULT_ADD_ONS, DEFAULT_COURTS, DEFAULT_MACHINES, DEFAULT_PRODUCTS } from "../src/lib/catalog-defaults";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const HOUR = 3_600_000;

async function main() {
  await db.settings.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } });

  for (const p of DEFAULT_PRODUCTS) {
    await db.product.upsert({ where: { slug: p.slug }, update: {}, create: { ...p } });
  }

  for (const a of DEFAULT_ADD_ONS) {
    await db.addOn.upsert({ where: { kind: a.kind }, update: {}, create: { ...a } });
  }

  // A launch code to try the checkout with (deactivate it in Admin → Promo codes).
  await db.promoCode.upsert({
    where: { code: "FIRSTSERVE" },
    update: {},
    create: { code: "FIRSTSERVE", kind: "PERCENT", percentBps: 1000, description: "Launch: 10% off any rental" },
  });

  const machines = [];
  for (const m of DEFAULT_MACHINES) {
    machines.push(
      await db.machine.upsert({
        where: { slug: m.slug },
        update: {},
        create: { ...m, sports: [...m.sports], levels: [...m.levels], specs: "specs" in m ? [...m.specs] : undefined },
      }),
    );
  }
  const aura = machines[0];

  const courtRows = [];
  for (const [i, c] of DEFAULT_COURTS.entries()) {
    const existing = await db.court.findFirst({ where: { name: c.name } });
    courtRows.push(existing ?? (await db.court.create({ data: { ...c, sortOrder: i } })));
  }

  // Upcoming group sessions (Wednesdays 18:00 local) with their machine blocks.
  if ((await db.groupSession.count()) === 0) {
    for (let i = 0; i < 3; i++) {
      const startsAt = nextWeekday(3, i, 18 * 60);
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

/** Upcoming given weekday (0 = Sun), N weeks out, at a local time (minutes). */
function nextWeekday(weekday: number, weeksOut = 0, minute = 600): Date {
  let date = addLocalDays(toLocalDate(new Date()), 1);
  while (localWeekday(date) !== weekday) date = addLocalDays(date, 1);
  return localDateMinuteToUtc(addLocalDays(date, weeksOut * 7), minute);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
