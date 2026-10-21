import { connection } from "next/server";
import { CreatePromoForm, TogglePromoButton } from "@/components/admin/promo-forms";
import { Empty, PageHeader, Panel } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { promoRedemptions } from "@/lib/services/promo";
import { formatLocal } from "@/lib/time";

/** Internal admin: always rendered per request, no instant-navigation shell. */
export const instant = false;

export default async function PromoCodesPage() {
  await connection();
  const now = new Date();
  const promos = await db.promoCode.findMany({ orderBy: { createdAt: "desc" } });
  const uses = await Promise.all(promos.map((p) => promoRedemptions(p.id)));
  const saved = await db.booking.groupBy({
    by: ["promoCodeId"],
    where: {
      promoCodeId: { in: promos.map((p) => p.id) },
      status: { notIn: ["PENDING_PAYMENT", "CANCELLED", "EXPIRED"] },
    },
    _sum: { discountCents: true },
  });

  return (
    <>
      <PageHeader
        title="Promo codes"
        description="Discounts customers enter right before paying. They come off the rental before tax and never touch the deposit."
      />
      <div className="space-y-6">
        <Panel title="New code">
          <CreatePromoForm />
        </Panel>
        <Panel title="Codes">
          {promos.length === 0 ? (
            <Empty>No promo codes yet.</Empty>
          ) : (
            <ul className="divide-y">
              {promos.map((p, i) => {
                const expired = !!p.endsAt && p.endsAt <= now;
                const upcoming = !!p.startsAt && p.startsAt > now;
                const used = uses[i];
                const full = p.maxRedemptions !== null && used >= p.maxRedemptions;
                const status = !p.active
                  ? { label: "Inactive", variant: "secondary" as const }
                  : expired
                    ? { label: "Expired", variant: "secondary" as const }
                    : full
                      ? { label: "Used up", variant: "secondary" as const }
                      : upcoming
                        ? { label: "Scheduled", variant: "outline" as const }
                        : { label: "Live", variant: "accent" as const };
                const total = saved.find((s) => s.promoCodeId === p.id)?._sum.discountCents ?? 0;
                return (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-lg font-semibold tracking-wider">{p.code}</span>
                        <Badge variant={status.variant}>{status.label}</Badge>
                        <span className="text-sm font-medium">
                          {p.kind === "PERCENT"
                            ? `${(p.percentBps ?? 0) / 100}% off`
                            : `${formatCents(p.amountCents ?? 0)} off`}
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {[
                          p.description,
                          p.productKinds.length ? p.productKinds.map((k) => k.toLowerCase()).join(", ") : "all rentals",
                          p.startsAt && `from ${formatLocal(p.startsAt, "MMM d, yyyy")}`,
                          p.endsAt && `until ${formatLocal(new Date(p.endsAt.getTime() - 1), "MMM d, yyyy")}`,
                          `${used}${p.maxRedemptions !== null ? ` / ${p.maxRedemptions}` : ""} used`,
                          total > 0 && `${formatCents(total)} given`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <TogglePromoButton id={p.id} active={p.active} />
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
