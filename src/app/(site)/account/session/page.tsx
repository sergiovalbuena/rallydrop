import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Section } from "@/components/marketing/section";
import { SessionBooker } from "@/components/portal/session-booker";
import { Skeleton } from "@/components/ui/skeleton";
import { brand } from "@/config/brand";
import { resolveDelivery } from "@/lib/domain/delivery";
import { chargedTaxes } from "@/lib/domain/rental";
import { listCourtsWithLocation } from "@/lib/services/catalog";
import { getSettings } from "@/lib/services/settings";
import { currentLegal, customerAcceptedLive, toConsentDocs } from "@/lib/services/legal";
import { customerPackage } from "@/lib/services/portal";
import { getPortalCustomer } from "@/lib/services/portal-auth";
import { formatLocal } from "@/lib/time";

export const metadata: Metadata = { title: "Book a session", robots: { index: false } };

export default function SessionPage() {
  return (
    <Section className="pt-8">
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <Session />
      </Suspense>
    </Section>
  );
}

async function Session() {
  const customer = await getPortalCustomer();
  if (!customer) redirect("/account");
  const pkg = await customerPackage(customer.id);
  if (!pkg || pkg.usage.left <= 0) redirect("/account");
  const [courts, accepted, legal, settings] = await Promise.all([
    listCourtsWithLocation(),
    customerAcceptedLive(customer.id),
    currentLegal(),
    getSettings(),
  ]);
  // Round trip to each court, priced by its zone (charged to the package card).
  const courtFees = courts.flatMap((c) => {
    const d = resolveDelivery({
      legs: { dropoff: true, collection: true },
      point: { lat: c.lat, lng: c.lng },
      hub: { lat: settings.deliveryHubLat, lng: settings.deliveryHubLng },
      zones: settings.deliveryZones,
      zone1Fsas: brand.zone1Fsas,
    });
    return d.status === "ok" ? [{ id: c.id, name: c.name, address: c.address, feeCents: d.feeCents }] : [];
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-5xl font-extrabold uppercase">Book a session</h1>
        <p className="mt-2 text-muted-foreground">
          {pkg.subscription.product.name} · {pkg.usage.left} of {pkg.usage.total} left until{" "}
          {formatLocal(pkg.usage.periodEnd, "MMM d")}. Pick it up downtown for free, or we bring it to your court for
          the zone&apos;s delivery fee.
        </p>
      </div>
      <SessionBooker
        productId={pkg.subscription.productId}
        courts={courtFees}
        plusTax={chargedTaxes(settings).gstBps + chargedTaxes(settings).pstBps > 0}
        consentDocs={accepted ? null : toConsentDocs(legal)}
      />
    </div>
  );
}
