import { NextResponse, type NextRequest } from "next/server";
import { runDeposits, runExpireHolds, runReminders } from "@/lib/services/cron";
import { toLocalMinute } from "@/lib/time";
import { databaseConfigured } from "@/lib/services/fallback";

/** Reminders only go out in the daytime (7 AM–9 PM Victoria), even though the job runs hourly. */
function daytime(now = new Date()) {
  const minute = toLocalMinute(now);
  return minute >= 7 * 60 && minute < 21 * 60;
}

const JOBS = {
  "expire-holds": runExpireHolds,
  reminders: runReminders,
  deposits: runDeposits,
  /** The hourly job (GitHub Actions): deposit holds 24 h before each start, cleanup, daytime reminders. */
  all: async () => ({
    ...(await runExpireHolds()),
    ...(await runDeposits()),
    ...(daytime() ? await runReminders() : { reminders: "skipped (night)" }),
  }),
} as const;

/**
 * Scheduled jobs. GitHub Actions calls these with `Authorization: Bearer $CRON_SECRET`
 * (see .github/workflows/daily-jobs.yml). Safe to run as often as you like — every job is idempotent.
 */
export async function GET(request: NextRequest, { params }: RouteContext<"/api/cron/[job]">) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { job } = await params;
  const run = JOBS[job as keyof typeof JOBS];
  if (!run) return NextResponse.json({ error: "Unknown job" }, { status: 404 });
  // No database yet (site in preview mode): nothing to do, and not an error.
  if (!databaseConfigured()) return NextResponse.json({ job, skipped: "no database configured" });
  const result = await run();
  return NextResponse.json({ job, ...result });
}
