import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { MachineIllustration } from "@/components/brand/court-illustration";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCentsShort } from "@/lib/money";
import type { PublicMachine } from "@/lib/services/catalog";

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

/** Home: one featured machine as a wide "spec sheet" + a slim line for upcoming ones. */
export async function MachineFeature({
  machines,
  detailed = false,
}: {
  machines: PublicMachine[];
  detailed?: boolean;
}) {
  const th = await getTranslations("home");
  const tc = await getTranslations("common");
  const bookable = machines.filter((m) => m.bookable);
  const shown = detailed ? bookable : bookable.slice(0, 1);
  if (shown.length === 0 && machines[0]) shown.push(machines[0]);
  const upcoming = machines.filter((m) => !m.bookable);
  return (
    <div className="space-y-4">
      {shown.map((featured) => (
        <FeatureCard key={featured.id} featured={featured} detailed={detailed} />
      ))}
      {upcoming.map((m) => (
        <p key={m.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed px-5 py-3 text-sm">
          <Badge variant="accent">{tc("comingSoon")}</Badge>
          <span className="font-semibold">{th("comingSoonShort", { name: m.name })}</span>
          <span className="text-muted-foreground">— {m.description}</span>
        </p>
      ))}
    </div>
  );
}

async function FeatureCard({ featured, detailed }: { featured: PublicMachine; detailed: boolean }) {
  const t = await getTranslations("machines");
  const stats = [
    featured.weightKg !== null && { label: t("weight"), value: `${featured.weightKg}`, unit: "kg" },
    featured.maxSpeedKmh !== null && { label: t("maxSpeed"), value: `${featured.maxSpeedKmh}`, unit: "km/h" },
    featured.ballCapacity !== null && { label: t("capacity"), value: `${featured.ballCapacity}`, unit: "balls" },
    featured.batteryHours !== null && { label: t("battery"), value: `${featured.batteryHours}`, unit: "h" },
  ].filter((s) => !!s);
  return (
    <article
      id={featured.slug}
      className="grid scroll-mt-24 overflow-hidden rounded-3xl border bg-card shadow-xs md:grid-cols-[1fr_1.1fr]"
    >
      <div className="court-lines floodlight grain relative flex items-center justify-center bg-court p-8 sm:p-12">
        {featured.imageUrl ? (
          <Image
            src={featured.imageUrl}
            alt={featured.name}
            fill
            className="object-cover"
            sizes="(min-width: 768px) 45vw, 100vw"
          />
        ) : (
          <MachineIllustration accent={featured.calendarColor} className="max-w-64 drop-shadow-2xl" />
        )}
        <span className="absolute top-4 left-4 rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground uppercase">
          {featured.sports.map((s) => t(`sport_${s}`)).join(" · ")}
        </span>
      </div>
      <div className="flex flex-col gap-6 p-6 sm:p-8">
        <div>
          <h3 className="font-display text-4xl font-black uppercase sm:text-5xl">{featured.name}</h3>
          {featured.description && <p className="mt-3 text-muted-foreground">{featured.description}</p>}
        </div>
        {stats.length > 0 && (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-y py-5 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label}>
                <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{s.label}</dt>
                <dd className="tabular mt-1 font-display text-3xl leading-none font-black">
                  {s.value}
                  <span className="ml-1 text-sm font-bold text-primary">{s.unit}</span>
                </dd>
              </div>
            ))}
          </dl>
        )}
        {detailed && (
          <dl className="space-y-2 text-sm">
            {featured.levels.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <dt className="w-24 text-muted-foreground">{t("levels")}</dt>
                {featured.levels.map((l) => (
                  <dd key={l}>
                    <Badge variant="outline">{t(`level_${l}`)}</Badge>
                  </dd>
                ))}
              </div>
            )}
            {featured.specs.map((sp) => (
              <div key={sp.label} className="flex gap-2">
                <dt className="w-24 shrink-0 text-muted-foreground">{sp.label}</dt>
                <dd>{sp.value}</dd>
              </div>
            ))}
            <div className="flex gap-2">
              <dt className="w-24 text-muted-foreground">{t("deposit")}</dt>
              <dd>{formatCentsShort(featured.depositCents)}</dd>
            </div>
          </dl>
        )}
        <div className="mt-auto flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <Link href={`/book?machine=${featured.slug}`}>{t("book", { name: featured.name })}</Link>
          </Button>
          {!detailed && (
            <Button asChild variant="link">
              <Link href="/machines">{t("title")} →</Link>
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
