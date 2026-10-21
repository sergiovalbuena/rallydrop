import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Check, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCentsShort } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { AddOn, Product } from "@/generated/prisma/client";

const RENTAL_KINDS = ["DAY", "WEEKEND", "WEEK", "MONTH"];

export async function PricingGrid({
  products,
  addOns,
  depositCents,
  compact = false,
}: {
  products: Product[];
  addOns: AddOn[];
  depositCents: number;
  compact?: boolean;
}) {
  const t = await getTranslations("pricing");
  const tc = await getTranslations("common");
  const rentals = products.filter((p) => RENTAL_KINDS.includes(p.kind));
  const packages = products.filter((p) => p.kind === "PACKAGE");
  const group = products.find((p) => p.kind === "GROUP_SESSION");

  return (
    <div className="space-y-12">
      <div>
        {!compact && (
          <div className="mb-6">
            <h2 className="font-display text-3xl font-extrabold uppercase">{t("rentalsTitle")}</h2>
            <p className="text-muted-foreground">{t("rentalsBody")}</p>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {rentals.map((p) => {
            const popular = p.kind === "WEEKEND";
            return (
              <div
                key={p.id}
                className={cn(
                  "relative flex flex-col rounded-2xl border bg-card p-6 transition-all hover:-translate-y-0.5 hover:shadow-lg",
                  popular && "border-primary ring-2 ring-primary/20",
                )}
              >
                {popular && <Badge className="absolute -top-3 left-6">{t("popular")}</Badge>}
                <h3 className="font-display text-2xl font-extrabold uppercase">{p.name}</h3>
                <p className="mt-3 font-display text-5xl font-extrabold">{formatCentsShort(p.priceCents)}</p>
                {p.description && <p className="mt-3 flex-1 text-sm text-muted-foreground">{p.description}</p>}
                <Button asChild variant={popular ? "default" : "outline"} className="mt-6">
                  <Link href={`/book?product=${p.slug}`}>{t("choose")}</Link>
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {!compact && packages.length > 0 && (
        <div>
          <div className="mb-6">
            <h2 className="font-display text-3xl font-extrabold uppercase">{t("packagesTitle")}</h2>
            <p className="text-muted-foreground">{t("packagesBody")}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {packages.map((p) => (
              <div key={p.id} className="court-lines flex flex-col rounded-2xl bg-court p-6 text-white">
                <h3 className="font-display text-2xl font-extrabold uppercase">{p.name}</h3>
                <p className="mt-2 font-display text-5xl font-extrabold text-optic">
                  {formatCentsShort(p.priceCents)}
                  <span className="text-lg font-semibold text-white/70"> {tc("perMonth")}</span>
                </p>
                <ul className="mt-4 space-y-2 text-sm text-white/85">
                  <li className="flex gap-2">
                    <Check className="size-4 text-optic" aria-hidden />
                    {t("sessions", { count: p.sessionsPerMonth ?? 0 })}
                  </li>
                  <li className="flex gap-2">
                    <Check className="size-4 text-optic" aria-hidden />
                    {t("sessionLength", { minutes: p.sessionMinutes ?? 90 })}
                  </li>
                </ul>
                {p.description && <p className="mt-3 flex-1 text-sm text-white/70">{p.description}</p>}
                <Button asChild variant="accent" className="mt-6 self-start">
                  <Link href={`/book/package?product=${p.slug}`}>{t("subscribe")}</Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!compact && (
        <div className="grid gap-4 md:grid-cols-2">
          {group && (
            <div className="rounded-2xl border bg-card p-6">
              <h2 className="font-display text-2xl font-extrabold uppercase">{t("groupTitle")}</h2>
              <p className="mt-2 font-display text-4xl font-extrabold">
                {formatCentsShort(group.priceCents)}
                <span className="text-base font-semibold text-muted-foreground"> {tc("perPerson")}</span>
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{t("groupBody")}</p>
              <Button asChild variant="outline" className="mt-5">
                <Link href="/group-sessions">{tc("learnMore")}</Link>
              </Button>
            </div>
          )}
          <div className="rounded-2xl border bg-card p-6">
            <h2 className="font-display text-2xl font-extrabold uppercase">{t("addOnsTitle")}</h2>
            <ul className="mt-4 space-y-4">
              {addOns.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-4">
                  <div className="flex gap-3">
                    <Plus className="mt-1 size-4 text-primary" aria-hidden />
                    <div>
                      <p className="font-semibold">{a.name}</p>
                      {a.description && <p className="text-sm text-muted-foreground">{a.description}</p>}
                    </div>
                  </div>
                  <span className="font-display text-2xl font-bold">+{formatCentsShort(a.priceCents)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-dashed bg-muted/40 p-6">
        <h2 className="font-display text-xl font-bold uppercase">{t("depositTitle")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("depositBody", { amount: formatCentsShort(depositCents) })}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">{tc("taxesNote")}</p>
      </div>
    </div>
  );
}

export function PricingGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="space-y-4 rounded-2xl border p-6">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-12 w-28" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-10 w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}
