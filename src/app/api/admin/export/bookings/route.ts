import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { bookingWhere } from "@/lib/admin/queries";
import { cents, toCsv } from "@/lib/csv";
import { formatLocal } from "@/lib/time";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const p = request.nextUrl.searchParams;
  const bookings = await db.booking.findMany({
    where: bookingWhere({
      q: p.get("q") ?? undefined,
      status: p.get("status") ?? undefined,
      machine: p.get("machine") ?? undefined,
      from: p.get("from") ?? undefined,
      to: p.get("to") ?? undefined,
    }),
    include: {
      customer: true,
      machine: true,
      product: true,
      court: true,
      deposit: true,
      promoCode: { select: { code: true } },
    },
    orderBy: { startsAt: "asc" },
  });
  const csv = toCsv(
    [
      "code",
      "status",
      "channel",
      "start",
      "end",
      "product",
      "machine",
      "customer",
      "email",
      "phone",
      "fulfillment",
      "dropoff",
      "collection",
      "zone",
      "delivery_fee",
      "where",
      "promo_code",
      "discount",
      "subtotal",
      "gst",
      "pst",
      "total",
      "deposit",
      "deposit_status",
      "deposit_charged",
      "created",
    ],
    bookings.map((b) => [
      b.code,
      b.status,
      b.channel,
      formatLocal(b.startsAt, "yyyy-MM-dd HH:mm"),
      formatLocal(b.endsAt, "yyyy-MM-dd HH:mm"),
      b.product.name,
      b.machine.name,
      b.customer.name,
      b.customer.email,
      b.customer.phone,
      b.fulfillment,
      b.dropoff ? "yes" : "no",
      b.collection ? "yes" : "no",
      b.deliveryZone ?? "",
      cents(b.deliveryFeeCents),
      b.court?.name ?? b.deliveryAddress ?? "",
      b.promoCode?.code ?? "",
      cents(b.discountCents),
      cents(b.subtotalCents),
      cents(b.gstCents),
      cents(b.pstCents),
      cents(b.totalCents),
      b.deposit ? cents(b.deposit.amountCents) : "",
      b.deposit?.status ?? "",
      b.deposit ? cents(b.deposit.capturedCents) : "",
      formatLocal(b.createdAt, "yyyy-MM-dd HH:mm"),
    ]),
  );
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="bookings.csv"',
    },
  });
}
