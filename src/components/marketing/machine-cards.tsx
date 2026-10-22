import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { MachineIllustration } from "@/components/brand/court-illustration";
import { Check, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { WaitlistForm } from "./waitlist-form";
import { formatCentsShort } from "@/lib/money";
import { cn } from "@/lib/utils";
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
  const tw = await getTranslations("waitlist");
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
        <div
          key={m.id}
          id={m.slug}
          data-reveal
          className="grid scroll-mt-24 items-center gap-5 rounded-3xl border border-dashed bg-card p-5 sm:grid-cols-[auto_1fr] sm:p-6"
        >
          <MachineIllustration
            accent={m.calendarColor}
            camera={m.aiCoach}
            className="mx-auto w-28 opacity-90 sm:w-32"
          />
          <div className="space-y-3">
            <div>
              <Badge variant="accent">{tc("comingSoon")}</Badge>
              <h3 className="mt-2 font-display text-2xl font-extrabold uppercase">{tw("title", { name: m.name })}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {m.description} {tw("body")}
              </p>
            </div>
            <WaitlistForm machineId={m.id} machineName={m.name} source={detailed ? "machines" : "home"} />
          </div>
        </div>
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
      data-reveal="scale"
      className="grid scroll-mt-24 overflow-hidden rounded-3xl border bg-card shadow-xs md:grid-cols-[1fr_1.1fr]"
    >
      <div
        className={cn(
          "relative flex min-h-72 items-center justify-center p-8 sm:p-12",
          // Product photos usually have a white background: show them on a light stage.
          featured.imageUrl ? "bg-gradient-to-b from-white to-slate-100" : "court-lines floodlight grain bg-court",
        )}
      >
        {featured.imageUrl ? (
          <Image
            src={featured.imageUrl}
            alt={featured.name}
            fill
            className="object-contain p-8"
            sizes="(min-width: 768px) 45vw, 100vw"
          />
        ) : (
          <MachineIllustration
            accent={featured.calendarColor}
            camera={featured.aiCoach}
            className="animate-float max-w-72 drop-shadow-2xl"
          />
        )}
        <span className="absolute top-4 left-4 rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground uppercase">
          {featured.sports.map((s) => t(`sport_${s}`)).join(" · ")}
        </span>
        {featured.aiCoach && (
          <span className="absolute top-4 right-4 inline-flex items-center gap-1.5 rounded-full bg-court px-3 py-1 text-xs font-bold text-white uppercase ring-1 ring-white/20">
            <Sparkles className="size-3.5 text-optic" aria-hidden /> {t("aiBadge")}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-6 p-6 sm:p-8">
        <div>
          <h3 className="font-display text-4xl font-black uppercase sm:text-5xl">{featured.name}</h3>
          {featured.description && <p className="mt-3 text-muted-foreground">{featured.description}</p>}
        </div>
        {featured.aiCoach && (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <p className="flex items-center gap-2 font-display text-lg font-extrabold uppercase">
              <Sparkles className="size-4 text-primary" aria-hidden /> {t("aiTitle")}
            </p>
            <ul className="mt-2 grid gap-1.5 text-sm sm:grid-cols-3">
              {[t("ai1"), t("ai2"), t("ai3")].map((item) => (
                <li key={item} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
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
