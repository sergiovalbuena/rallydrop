import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Battery, Gauge, Package, Weight } from "lucide-react";
import { MachineIllustration } from "@/components/brand/court-illustration";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCentsShort } from "@/lib/money";
import type { PublicMachine } from "@/lib/services/catalog";

export async function MachineCards({ machines, detailed = false }: { machines: PublicMachine[]; detailed?: boolean }) {
  const t = await getTranslations("machines");
  const tc = await getTranslations("common");

  if (machines.length === 0) {
    return <p className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">{t("empty")}</p>;
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {machines.map((m) => {
        const stats = [
          m.weightKg !== null && { icon: Weight, label: t("weight"), value: t("kg", { value: m.weightKg }) },
          m.maxSpeedKmh !== null && { icon: Gauge, label: t("maxSpeed"), value: t("kmh", { value: m.maxSpeedKmh }) },
          m.ballCapacity !== null && {
            icon: Package,
            label: t("capacity"),
            value: t("balls", { value: m.ballCapacity }),
          },
          m.batteryHours !== null && {
            icon: Battery,
            label: t("battery"),
            value: t("hours", { value: m.batteryHours }),
          },
        ].filter((s) => !!s);
        return (
          <article
            key={m.id}
            id={m.slug}
            className="group relative flex scroll-mt-24 flex-col overflow-hidden rounded-2xl border bg-card shadow-xs transition-shadow hover:shadow-lg"
          >
            <div className="court-lines relative flex aspect-[16/10] items-center justify-center bg-court p-8 text-white">
              {m.imageUrl ? (
                <Image
                  src={m.imageUrl}
                  alt={m.name}
                  fill
                  className="object-cover"
                  sizes="(min-width: 768px) 50vw, 100vw"
                />
              ) : (
                <MachineIllustration
                  accent={m.calendarColor}
                  className="max-w-56 transition-transform duration-500 group-hover:-translate-y-1"
                />
              )}
              {!m.bookable && (
                <Badge variant="accent" className="absolute top-4 left-4">
                  {tc("comingSoon")}
                </Badge>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-4 p-6">
              <div>
                <h3 className="font-display text-3xl font-extrabold uppercase">{m.name}</h3>
                {m.description && <p className="mt-2 text-muted-foreground">{m.description}</p>}
              </div>
              {stats.length > 0 && (
                <dl className="grid grid-cols-2 gap-3">
                  {stats.map((s) => (
                    <div key={s.label} className="rounded-lg bg-muted/60 p-3">
                      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <s.icon className="size-4 text-primary" aria-hidden />
                        {s.label}
                      </dt>
                      <dd className="mt-0.5 font-semibold">{s.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {detailed && (
                <dl className="space-y-2 text-sm">
                  {m.sports.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <dt className="w-20 text-muted-foreground">{t("sports")}</dt>
                      {m.sports.map((s) => (
                        <dd key={s}>
                          <Badge variant="secondary">{t(`sport_${s}`)}</Badge>
                        </dd>
                      ))}
                    </div>
                  )}
                  {m.levels.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <dt className="w-20 text-muted-foreground">{t("levels")}</dt>
                      {m.levels.map((l) => (
                        <dd key={l}>
                          <Badge variant="outline">{t(`level_${l}`)}</Badge>
                        </dd>
                      ))}
                    </div>
                  )}
                  {m.specs.map((s) => (
                    <div key={s.label} className="flex gap-2">
                      <dt className="w-20 shrink-0 text-muted-foreground">{s.label}</dt>
                      <dd>{s.value}</dd>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <dt className="w-20 text-muted-foreground">{t("deposit")}</dt>
                    <dd>{formatCentsShort(m.depositCents)}</dd>
                  </div>
                </dl>
              )}
              <div className="mt-auto pt-2">
                {m.bookable ? (
                  <Button asChild size="lg" className="w-full sm:w-auto">
                    <Link href={`/book?machine=${m.slug}`}>{t("book", { name: m.name })}</Link>
                  </Button>
                ) : (
                  <Button size="lg" variant="secondary" disabled className="w-full sm:w-auto">
                    {tc("comingSoon")}
                  </Button>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function MachineCardsSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {[0, 1].map((i) => (
        <div key={i} className="overflow-hidden rounded-2xl border">
          <Skeleton className="aspect-[16/10] rounded-none" />
          <div className="space-y-3 p-6">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <div className="grid grid-cols-2 gap-3 pt-2">
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
