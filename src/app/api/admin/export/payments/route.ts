import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { cents, toCsv } from "@/lib/csv";
import { addLocalDays, formatLocal, localDateMinuteToUtc } from "@/lib/time";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  const payments = await db.payment.findMany({
    where: {
      createdAt: {
        ...(from ? { gte: localDateMinuteToUtc(from, 0) } : {}),
        ...(to ? { lt: localDateMinuteToUtc(addLocalDays(to, 1), 0) } : {}),
      },
    },
    include: {
      booking: { include: { customer: true } },
      subscription: { include: { customer: true, product: true } },
      enrollment: { include: { customer: true, groupSession: true } },
      refunds: true,
    },
    orderBy: { createdAt: "asc" },
  });
  const csv = toCsv(
    [
      "date",
      "kind",
      "status",
      "amount",
      "refunded",
      "net",
      "booking",
      "customer",
      "description",
      "stripe_payment_intent",
      "stripe_invoice",
    ],
    payments.map((p) => {
      const customer = p.booking?.customer ?? p.subscription?.customer ?? p.enrollment?.customer;
      const description = p.subscription?.product.name ?? p.enrollment?.groupSession.title ?? "";
      return [
        formatLocal(p.createdAt, "yyyy-MM-dd HH:mm"),
        p.kind,
        p.status,
        cents(p.amountCents),
        cents(p.refundedCents),
        cents(p.amountCents - p.refundedCents),
        p.booking?.code ?? "",
        customer?.name ?? "",
        description,
        p.stripePaymentIntentId ?? "",
        p.stripeInvoiceId ?? "",
      ];
    }),
  );
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="payments.csv"',
    },
  });
}
