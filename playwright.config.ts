import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";

/*
 * Smoke tests against a running build: `npm run build && npm run test:e2e`
 * (starts `next start` on :3200 unless E2E_BASE_URL points at a server).
 * The payment test needs Stripe test keys plus `stripe listen --forward-to
 * localhost:3200/api/stripe/webhook`; it is skipped otherwise.
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3200";

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  reporter: [["list"]],
  use: { baseURL, trace: "retain-on-failure", ...devices["Desktop Chrome"] },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "npx next start -p 3200", url: baseURL, reuseExistingServer: true, timeout: 120_000 },
});
