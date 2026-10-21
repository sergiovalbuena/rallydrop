import { NextResponse, type NextRequest } from "next/server";
import { brand } from "@/config/brand";
import { db } from "@/lib/db";
import { toIcsUtc } from "@/lib/time";

/** Calendar file for a booking (requires id + code). */
export async function GET(request: NextRequest, { params }: RouteContext<"/api/bookings/[id]/ics">) {
  const { id } = await params;
  const code = request.nextUrl.searchParams.get("code");
  const booking = await db.booking.findFirst({
    where: { id, code: code ?? "" },
    include: { machine: true, court: true },
  });
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const where = booking.court?.name ?? booking.deliveryAddress ?? brand.city;
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${brand.name}//Bookings//EN`,
    "BEGIN:VEVENT",
    `UID:${booking.id}@rallydrop`,
    `DTSTAMP:${toIcsUtc(new Date())}`,
    `DTSTART:${toIcsUtc(booking.startsAt)}`,
    `DTEND:${toIcsUtc(booking.endsAt)}`,
    `SUMMARY:${brand.name}: ${booking.machine.name} (${booking.code})`,
    `LOCATION:${where.replace(/[,;]/g, "\\$&")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${booking.code}.ics"`,
    },
  });
}
