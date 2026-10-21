import { fileURLToPath } from "node:url";
import "dotenv/config";
import { defineConfig } from "vitest/config";

// Integration tests run against TEST_DATABASE_URL (never your dev database).
// They are skipped when it isn't set.
const testDb = process.env.TEST_DATABASE_URL;

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` throws outside the React server runtime.
      "server-only": fileURLToPath(new URL("./tests/helpers/empty.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/helpers/global-setup.ts"],
    // Integration tests share one database; run files sequentially.
    fileParallelism: false,
    env: {
      TZ: "UTC",
      ...(testDb ? { DATABASE_URL: testDb } : { DATABASE_URL: "" }),
      STRIPE_SECRET_KEY: "sk_test_dummy",
      STRIPE_WEBHOOK_SECRET: "whsec_test_secret",
      PORTAL_SECRET: "test-portal-secret-test-portal-secret",
    },
  },
});
