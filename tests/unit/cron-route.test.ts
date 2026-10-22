import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/cron/[job]/route";

const env = { db: process.env.DATABASE_URL, secret: process.env.CRON_SECRET };
afterEach(() => {
  process.env.DATABASE_URL = env.db;
  process.env.CRON_SECRET = env.secret;
});

const call = (auth?: string) =>
  GET(new NextRequest("http://localhost/api/cron/all", { headers: auth ? { authorization: auth } : {} }), {
    params: Promise.resolve({ job: "all" }),
  });

describe("/api/cron", () => {
  it("rejects calls without the secret", async () => {
    process.env.CRON_SECRET = "s3cret";
    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong")).status).toBe(401);
  });

  it("skips cleanly (200) while the site has no database", async () => {
    process.env.CRON_SECRET = "s3cret";
    delete process.env.DATABASE_URL;
    const res = await call("Bearer s3cret");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ job: "all", skipped: "no database configured" });
  });
});
