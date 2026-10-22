import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Section } from "@/components/marketing/section";
import { SessionBooker } from "@/components/portal/session-booker";
import { Skeleton } from "@/components/ui/skeleton";
import { listActiveCourts } from "@/lib/services/catalog";
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
  const [courts, accepted, legal] = await Promise.all([
    listActiveCourts(),
    customerAcceptedLive(customer.id),
    currentLegal(),
  ]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-5xl font-extrabold uppercase">Book a session</h1>
        <p className="mt-2 text-muted-foreground">
          {pkg.subscription.product.name} · {pkg.usage.left} of {pkg.usage.total} left until{" "}
          {formatLocal(pkg.usage.periodEnd, "MMM d")}. Delivery to the court is included.
        </p>
      </div>
      <SessionBooker
        productId={pkg.subscription.productId}
        courts={courts}
        consentDocs={accepted ? null : toConsentDocs(legal)}
      />
    </div>
  );
}
