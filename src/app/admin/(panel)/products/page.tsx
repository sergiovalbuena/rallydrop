import { connection } from "next/server";
import { AddOnRow, ProductRow } from "@/components/admin/product-forms";
import { PageHeader, Panel } from "@/components/admin/ui";
import { db } from "@/lib/db";
import { minuteToLabel } from "@/lib/time";
import { parseAllowedStarts } from "@/lib/services/availability";

/** Internal admin: always rendered per request, no instant-navigation shell. */
export const instant = false;

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function ProductsPage() {
  await connection();
  const [products, addOns] = await Promise.all([
    db.product.findMany({ orderBy: { sortOrder: "asc" } }),
    db.addOn.findMany({ orderBy: { kind: "asc" } }),
  ]);
  return (
    <>
      <PageHeader
        title="Prices & products"
        description="Prices in CAD before tax. Changes apply to new bookings only."
      />
      <div className="space-y-6">
        <Panel title="Products">
          <div className="space-y-4">
            {products.map((p) => {
              const starts = parseAllowedStarts(p.allowedStarts);
              return (
                <ProductRow
                  key={p.id}
                  product={{
                    id: p.id,
                    kind: p.kind,
                    name: p.name,
                    description: p.description ?? "",
                    price: (p.priceCents / 100).toFixed(2),
                    active: p.active,
                    durationHours: p.durationHours,
                    sessionsPerMonth: p.sessionsPerMonth,
                    sessionMinutes: p.sessionMinutes,
                    allowedStarts: starts
                      ? starts
                          .map(
                            (s) =>
                              `${DAY[s.weekday]} ${String(Math.floor(s.minute / 60)).padStart(2, "0")}:${String(s.minute % 60).padStart(2, "0")}`,
                          )
                          .join(", ")
                      : "",
                    startsHint: starts
                      ? starts.map((s) => `${DAY[s.weekday]} ${minuteToLabel(s.minute)}`).join(" or ")
                      : "",
                  }}
                />
              );
            })}
          </div>
        </Panel>
        <Panel title="Add-ons">
          <div className="space-y-4">
            {addOns.map((a) => (
              <AddOnRow
                key={a.id}
                addOn={{
                  id: a.id,
                  kind: a.kind,
                  name: a.name,
                  description: a.description ?? "",
                  price: (a.priceCents / 100).toFixed(2),
                  active: a.active,
                }}
              />
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            The delivery add-on is free inside the free-delivery zone (Settings → Delivery).
          </p>
        </Panel>
      </div>
    </>
  );
}
