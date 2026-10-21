import { execSync } from "node:child_process";

/** Applies migrations to the test database before integration tests run. */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return;
  execSync("npx prisma migrate deploy", {
    stdio: "ignore",
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
  });
}
