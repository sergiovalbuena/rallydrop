import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Section } from "@/components/marketing/section";
import { SessionBooker } from "@/components/portal/session-booker";
import { Skeleton } from "@/components/ui/skeleton";
import { brand } from "@/config/brand";
import { db } from "@/lib/db";
import { resolveDelivery } from "@/lib/domain/delivery";
import { chargedTaxes } from "@/lib/domain/rental";
import { listCourtsWithLocation } from "@/lib/services/catalog";
import { currentLegal, customerAcceptedLive, toConsentDocs } from "@/lib/services/legal";
import { customerPackage } from "@/lib/services/portal";
import { getPortalCustomer } from "@/lib/services/portal-auth";
import { getSettings } from "@/lib/services/settings";
import { customerSpringPass } from "@/lib/services/spring-pass";
import { formatLocal, formatLocalDate } from "@/lib/time";

export const metadata: Metadata = { title: "Book a session", robots: { index: false } };

/** Package sessions, or Spring Pass weekends with ?source=pass. */
export default function SessionPage({ searchParams }: PageProps<"/account/session">) {
  return (
    <Section className="pt-8">
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <Session searchParams={searchParams} />
      </Suspense>
    </Section>
  );
}

async function Session({ searchParams }: { searchParams: PageProps<"/account/session">["searchParams"] }) {
  const customer = await getPortalCustomer();
  if (!customer) redirect("/account");
  const source = (await searchParams).source === "pass" ? "pass" : "package";

  let heading: string;
  let intro: string;
  let productId: string;
  if (source === "pass") {
    const pass = await customerSpringPass(customer.id);
    const weekend = await db.product.findFirst({
      where: { kind: "WEEKEND", active: true },
      orderBy: { sortOrder: "asc" },
    });
    if (!pass || pass.left <= 0 || !weekend) redirect("/account");
    heading = "Book a pass weekend";
    intro = `Spring Pass · ${pass.left} of ${pass.pass.weekends} weekends left. Weekends must start between ${formatLocalDate(pass.validFrom, "MMM d")} and ${formatLocalDate(pass.validTo, "MMM d")}.`;
    productId = weekend.id;
  } else {
    const pkg = await customerPackage(customer.id);
    if (!pkg || pkg.usage.left <= 0) redirect("/account");
    heading = "Book a session";
    intro = `${pkg.subscription.product.name} · ${pkg.usage.left} of ${pkg.usage.total} left until ${formatLocal(pkg.usage.periodEnd, "MMM d")}.`;
    productId = pkg.subscription.productId;
  }

  const [courts, accepted, legal, settings] = await Promise.all([
    listCourtsWithLocation(),
    customerAcceptedLive(customer.id),
    currentLegal(),
    getSettings(),
  ]);
  // Round trip next to each court, priced by its zone (charged to the card on file).
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
  const taxes = chargedTaxes(settings);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-5xl font-extrabold uppercase">{heading}</h1>
        <p className="mt-2 text-muted-foreground">
          {intro} Pick it up downtown for free, or we bring it to your door or next to your court for the zone&apos;s
          delivery fee.
        </p>
      </div>
      <SessionBooker
        source={source}
        productId={productId}
        courts={courtFees}
        plusTax={taxes.gstBps + taxes.pstBps > 0}
        consentDocs={accepted ? null : toConsentDocs(legal)}
      />
    </div>
  );
}
