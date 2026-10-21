import "dotenv/config";
import { defineConfig } from "prisma/config";

// The CLI (migrate, studio) needs a direct, non-pooled connection on Neon.
// The app itself connects through DATABASE_URL (pooled) via @prisma/adapter-pg.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
});
