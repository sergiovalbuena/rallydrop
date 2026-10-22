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
import { PrismaClient } from "../src/generated/prisma/client";
import { DEFAULT_ADD_ONS, DEFAULT_COURTS, DEFAULT_MACHINES, DEFAULT_PRODUCTS } from "../src/lib/catalog-defaults";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

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

  for (const m of DEFAULT_MACHINES) {
    await db.machine.upsert({
      where: { slug: m.slug },
      update: {},
      create: { ...m, sports: [...m.sports], levels: [...m.levels], specs: "specs" in m ? [...m.specs] : undefined },
    });
  }

  for (const [i, c] of DEFAULT_COURTS.entries()) {
    const existing = await db.court.findFirst({ where: { name: c.name } });
    if (!existing) await db.court.create({ data: { ...c, sortOrder: i } });
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

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
