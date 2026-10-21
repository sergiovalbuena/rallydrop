import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { bookableMachineIds, daySlots, monthAvailability } from "@/lib/services/availability";
import { getSettings } from "@/lib/services/settings";
import { formatLocal, toLocalDate } from "@/lib/time";

const query = z.object({
  product: z.string().min(1),
  machine: z.string().optional(),
  /** Month view: first date + number of days. */
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  days: z.coerce.number().int().min(1).max(62).optional(),
  /** Day view: one date. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  /** When rescheduling, ignore the booking's own block. */
  exclude: z.string().optional(),
});

/**
 * GET /api/availability?product=…&machine=…&from=YYYY-MM-DD&days=42  → { dates }
 * GET /api/availability?product=…&machine=…&date=YYYY-MM-DD           → { slots }
 * Only real availability is returned (holds, buffer, blackouts, season, hours).
 */
export async function GET(request: NextRequest) {
  const parsed = query.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  const q = parsed.data;

  const [product, settings] = await Promise.all([
    db.product.findFirst({ where: { OR: [{ id: q.product }, { slug: q.product }], active: true } }),
    getSettings(),
  ]);
  if (!product) return NextResponse.json({ error: "Unknown product" }, { status: 404 });

  const allowed = await bookableMachineIds();
  const machineIds = q.machine ? allowed.filter((id) => id === q.machine) : allowed;
  const now = new Date();

  if (q.date) {
    const slots = await daySlots({ product, machineIds, date: q.date, settings, now, excludeBookingId: q.exclude });
    return NextResponse.json(
      {
        date: q.date,
        slots: slots.map((s) => ({
          start: s.start.toISOString(),
          end: s.end.toISOString(),
          startLabel: formatLocal(s.start, "h:mm a"),
          startFull: formatLocal(s.start, "EEE, MMM d · h:mm a"),
          endLabel: formatLocal(s.end, "EEE, MMM d · h:mm a"),
          machineIds: s.machineIds,
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const from = q.from ?? toLocalDate(now);
  const dates = await monthAvailability({ product, machineIds, fromDate: from, days: q.days ?? 42, settings, now });
  return NextResponse.json({ from, today: toLocalDate(now), dates }, { headers: { "Cache-Control": "no-store" } });
}
