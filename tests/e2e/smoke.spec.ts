import { expect, test, type Page } from "@playwright/test";
import { Pool } from "pg";

/*
 * Launch smoke test: public pages, the booking checkboxes, a paid day rental
 * (Stripe test card) and the admin returning a machine. Uses the dev
 * database (DATABASE_URL) the server under test runs on.
 */

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const one = async <T>(sql: string, params: unknown[] = []) => (await pool.query(sql, params)).rows[0] as T;
const ADMIN = {
  email: process.env.SEED_ADMIN_EMAIL ?? "owner@example.com",
  password: process.env.SEED_ADMIN_PASSWORD ?? "change-me-please",
};
/** The payment step needs Stripe test keys; a confirmed booking also needs `stripe listen` (E2E_STRIPE=1). */
const stripeKeys =
  !!process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_") &&
  !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.startsWith("pk_test_");
const stripeWebhooks = stripeKeys && process.env.E2E_STRIPE === "1";

test.afterAll(async () => pool.end());

const PAGES: [string, RegExp][] = [
  ["/", /AI coach/i],
  ["/machines", /Aura S/i],
  ["/pricing", /Cancellation/i],
  ["/how-it-works", /Frequently asked|FAQ/i],
  ["/book", /How long do you want it/i],
  ["/contact", /Send us a message/i],
  ["/guide", /Voice commands/i],
  ["/terms", /19/],
  ["/waiver", /Release/i],
  ["/privacy", /Spotter/i],
];

test.describe("public pages", () => {
  for (const [path, text] of PAGES) {
    test(`${path} loads`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      await expect(page.locator("main")).toContainText(text);
      await expect(page.locator("body")).not.toContainText(/placeholder text|555-/i);
      expect(errors).toEqual([]);
    });
  }

  test("unknown pages show the branded 404 with a Book button", async ({ page }) => {
    const res = await page.goto("/no-such-page");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("link", { name: /Book a machine/i }).last()).toBeVisible();
  });
});

/** Steps through the wizard to the payment step for a day rental. */
async function toPayment(page: Page) {
  await page.goto("/book?product=day");
  const next = page.getByRole("button", { name: /^Continue/ });
  // One bookable machine is picked automatically; otherwise choose the first.
  const day = page.locator('[role="gridcell"]:not([disabled])').first();
  await expect(day.or(page.getByText("Pick your machine"))).toBeVisible();
  if (!(await day.isVisible())) {
    await page.getByRole("radio").first().click();
    await next.click();
  }
  await day.click();
  await page.getByRole("radio").first().click();
  await next.click();
  // Extras: self-serve (the default).
  await next.click();
  // Details.
  await page.getByLabel("Full name").fill("E2E Tester");
  await page.getByLabel("Email").fill(`e2e+${Date.now()}@example.com`);
  await page.getByRole("button", { name: /Continue to payment/i }).click();
}

test.describe("booking", () => {
  test("the details step needs a name and a way to reach you", async ({ page }) => {
    await page.goto("/book?product=day");
    const day = page.locator('[role="gridcell"]:not([disabled])').first();
    await expect(day).toBeVisible();
    await day.click();
    await page.getByRole("radio").first().click();
    const next = page.getByRole("button", { name: /^Continue/ });
    await next.click();
    await next.click();
    await page.getByRole("button", { name: /Continue to payment/i }).click();
    await expect(page.getByLabel("Full name")).toHaveAttribute("aria-invalid", "true");
  });

  test("payment is blocked until both boxes are ticked", async ({ page }) => {
    test.skip(!stripeKeys, "Needs Stripe test keys (STRIPE_SECRET_KEY / NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY).");
    await toPayment(page);
    const pay = page.getByRole("button", { name: /^Pay /i });
    await expect(pay).toBeDisabled();
    await page.getByRole("checkbox").first().check();
    await expect(pay).toBeDisabled();
    await page.getByRole("checkbox").nth(1).check();
    await expect(pay).toBeEnabled();
  });

  test("a day rental is paid with a Stripe test card", async ({ page }) => {
    test.skip(!stripeWebhooks, "Needs Stripe test keys and `stripe listen` (E2E_STRIPE=1).");
    await toPayment(page);
    await page.getByRole("checkbox").first().check();
    await page.getByRole("checkbox").nth(1).check();
    const card = page.frameLocator('iframe[title*="Secure payment"]').first();
    await card.getByPlaceholder(/1234/).fill("4242424242424242");
    await card.getByPlaceholder(/MM/).fill("12 / 34");
    await card.getByPlaceholder(/CVC/).fill("123");
    await page.getByRole("button", { name: /^Pay /i }).click();
    await expect(page.getByText(/You're booked|Booking confirmed/i)).toBeVisible({ timeout: 30_000 });
  });
});

test.describe("admin", () => {
  test("marking a rental “Returned – OK” releases the deposit", async ({ page }) => {
    const machine = await one<{ id: string }>(`SELECT id FROM "Machine" WHERE bookable ORDER BY "createdAt" LIMIT 1`);
    const product = await one<{ id: string; priceCents: number }>(
      `SELECT id, "priceCents" FROM "Product" WHERE kind = 'WEEK' LIMIT 1`,
    );
    const code = `E2E${Date.now().toString(36).toUpperCase()}`;
    const ids = { customer: `e2e_c_${code}`, booking: `e2e_b_${code}`, deposit: `e2e_d_${code}` };
    const startsAt = new Date(Date.now() - 2 * 86_400_000);
    const endsAt = new Date(startsAt.getTime() + 7 * 86_400_000);
    // An admin booking that is out with the customer, deposit = saved card.
    await pool.query(`INSERT INTO "Customer" (id, name, email, "updatedAt") VALUES ($1, 'E2E Return', $2, now())`, [
      ids.customer,
      `${code.toLowerCase()}@example.com`,
    ]);
    await pool.query(
      `INSERT INTO "Booking" (id, code, "customerId", "machineId", "productId", status, channel, "startsAt", "endsAt",
        "subtotalCents", "gstCents", "pstCents", "totalCents", "gstBps", "pstBps", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, 'CHECKED_OUT', 'ADMIN', $6, $7, $8, 0, 0, $8, 0, 0, now())`,
      [ids.booking, code, ids.customer, machine.id, product.id, startsAt, endsAt, product.priceCents],
    );
    await pool.query(
      `INSERT INTO "Deposit" (id, "bookingId", strategy, status, "amountCents", "updatedAt")
       VALUES ($1, $2, 'SAVED_CARD', 'CARD_SAVED', 60000, now())`,
      [ids.deposit, ids.booking],
    );
    const depositStatus = async () =>
      (await one<{ status: string }>(`SELECT status FROM "Deposit" WHERE id = $1`, [ids.deposit])).status;
    try {
      await page.goto("/admin/login");
      await page.getByLabel("Email").fill(ADMIN.email);
      await page.getByLabel("Password").fill(ADMIN.password);
      await page.getByRole("button", { name: "Sign in" }).click();
      await page.waitForURL(/\/admin(?!\/login)/);

      await page.goto(`/admin/bookings/${ids.booking}`);
      await page.getByLabel("Booking status").selectOption("RETURNED_OK");
      await page.getByRole("button", { name: "Update status" }).click();
      await expect.poll(depositStatus).toBe("RELEASED");
      const booking = await one<{ status: string }>(`SELECT status FROM "Booking" WHERE id = $1`, [ids.booking]);
      expect(booking.status).toBe("RETURNED_OK");
    } finally {
      await pool.query(`DELETE FROM "Booking" WHERE id = $1`, [ids.booking]);
      await pool.query(`DELETE FROM "Customer" WHERE id = $1`, [ids.customer]);
    }
  });
});
