import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CircleCheckBig } from "lucide-react";
import { ContactPayFlow } from "@/components/booking/contact-pay-flow";
import { Section } from "@/components/marketing/section";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from "@/lib/db";
import { formatCentsShort } from "@/lib/money";
import { startPackageAction } from "../extra-actions";

export const metadata: Metadata = { title: "Session package" };

export default function PackagePage({ searchParams }: PageProps<"/book/package">) {
  return (
    <Section className="max-w-xl pt-8">
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <Package searchParams={searchParams} />
      </Suspense>
    </Section>
  );
}

async function Package({ searchParams }: { searchParams: PageProps<"/book/package">["searchParams"] }) {
  const sp = await searchParams;
  const slug = Array.isArray(sp.product) ? sp.product[0] : sp.product;
  const t = await getTranslations();
  const product = slug ? await db.product.findFirst({ where: { slug, kind: "PACKAGE", active: true } }) : null;
  if (!product) notFound();

  if (sp.done) {
    return (
      <div className="rounded-3xl border bg-card p-8 text-center">
        <CircleCheckBig className="mx-auto size-12 text-success" />
        <h1 className="mt-4 font-display text-4xl font-extrabold uppercase">{t("book.confirmedTitle")}</h1>
        <p className="mt-2 text-muted-foreground">
          {product.name} — {t("portal.bookSession")} → {t("nav.myBookings")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="court-lines rounded-2xl bg-court p-6 text-white">
        <h1 className="font-display text-4xl font-extrabold uppercase">{product.name}</h1>
        <p className="mt-1 font-display text-3xl font-extrabold text-optic">
          {formatCentsShort(product.priceCents)} <span className="text-base text-white/70">{t("common.perMonth")}</span>
        </p>
        <p className="mt-2 text-sm text-white/80">{product.description}</p>
        <p className="mt-2 text-xs text-white/60">{t("common.taxesNote")}</p>
      </div>
      <ContactPayFlow
        targetId={product.id}
        start={startPackageAction}
        successPath={`/book/package?product=${product.slug}&done=1`}
        cta={t("pricing.subscribe")}
      />
    </div>
  );
}
