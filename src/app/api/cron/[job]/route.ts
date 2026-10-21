import { NextResponse, type NextRequest } from "next/server";
import { runDeposits, runExpireHolds, runReminders } from "@/lib/services/cron";

const JOBS = {
  "expire-holds": runExpireHolds,
  reminders: runReminders,
  deposits: runDeposits,
  /** The daily job (GitHub Actions, 7:00 AM Victoria): runs everything. */
  all: async () => ({ ...(await runExpireHolds()), ...(await runDeposits()), ...(await runReminders()) }),
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
  const result = await run();
  return NextResponse.json({ job, ...result });
}
