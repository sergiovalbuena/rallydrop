import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { toCsv } from "@/lib/csv";
import { formatLocal } from "@/lib/time";

/** Waitlist sign-ups (email + machine + consent) for the owner's mailing tool. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await db.waitlistSignup.findMany({
    include: { machine: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });
  const csv = toCsv(
    ["email", "machine", "signed_up", "source", "consent", "notified"],
    rows.map((r) => [
      r.email,
      r.machine.name,
      formatLocal(r.createdAt, "yyyy-MM-dd HH:mm"),
      r.source,
      r.consent,
      r.notifiedAt ? formatLocal(r.notifiedAt, "yyyy-MM-dd") : "",
    ]),
  );
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rallydrop-waitlist.csv"`,
    },
  });
}
