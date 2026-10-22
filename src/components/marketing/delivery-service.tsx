import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight, Repeat, Truck, Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { DeliveryZone } from "@/lib/domain/delivery";
import { formatCentsShort } from "@/lib/money";
import { cn } from "@/lib/utils";
import { revealDelay } from "./reveal-delay";

/** The three paid services (drop-off, collection, round trip) with prices from zone 1. */
export async function DeliveryServiceCards({ zones }: { zones: DeliveryZone[] }) {
  const t = await getTranslations("delivery");
  const first = zones[0];
  if (!first) return null;
  const cards = [
    { icon: Truck, title: t("dropoffTitle"), body: t("dropoffBody"), cents: first.tripCents },
    { icon: Undo2, title: t("collectionTitle"), body: t("collectionBody"), cents: first.tripCents },
    { icon: Repeat, title: t("roundTitle"), body: t("roundBody"), cents: first.roundTripCents, best: true },
  ];
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {cards.map((c, i) => (
        <div
          key={c.title}
          data-reveal
          style={revealDelay(i, 110)}
          className={cn(
            "relative flex flex-col rounded-2xl border bg-card p-6",
            c.best && "court-lines border-transparent bg-court text-white",
          )}
        >
          {c.best && (
            <Badge variant="accent" className="absolute -top-2.5 right-5">
              {t("bestValue")}
            </Badge>
          )}
          <c.icon className={cn("size-8", c.best ? "text-optic" : "text-primary")} aria-hidden />
          <h3 className="mt-4 font-display text-2xl font-extrabold uppercase">{c.title}</h3>
          <p className={cn("mt-2 text-sm", c.best ? "text-white/80" : "text-muted-foreground")}>{c.body}</p>
          <p className={cn("mt-auto pt-5 font-display text-4xl font-black", c.best && "text-optic")}>
            <span className="mr-1.5 align-middle text-sm font-bold tracking-wide uppercase opacity-70">
              {t("from")}
            </span>
            {formatCentsShort(c.cents)}
          </p>
        </div>
      ))}
    </div>
  );
}

/** Zone price table: one trip vs round trip per distance band. */
export async function DeliveryZoneTable({ zones }: { zones: DeliveryZone[] }) {
  const t = await getTranslations("delivery");
  return (
    <div data-reveal className="overflow-hidden rounded-2xl border bg-card">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{t("tableCaption")}</caption>
        <thead className="bg-muted/60 text-xs tracking-wide text-muted-foreground uppercase">
          <tr>
            <th scope="col" className="px-4 py-3 font-semibold">
              {t("zone")}
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              {t("distance")}
            </th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">
              {t("oneTrip")}
            </th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">
              {t("roundTrip")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {zones.map((z, i) => (
            <tr key={z.maxKm}>
              <th scope="row" className="px-4 py-3 font-display text-lg font-extrabold">
                {i + 1}
              </th>
              <td className="px-4 py-3 text-muted-foreground">
                {i === 0 ? t("upTo", { km: z.maxKm }) : t("between", { from: zones[i - 1].maxKm, to: z.maxKm })}
              </td>
              <td className="tabular px-4 py-3 text-right font-semibold">{formatCentsShort(z.tripCents)}</td>
              <td className="tabular px-4 py-3 text-right font-semibold text-primary">
                {formatCentsShort(z.roundTripCents)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="space-y-1 border-t bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        <p>{t("selfServe")}</p>
        <p>{t("beyond")}</p>
      </div>
    </div>
  );
}

/** Home / pricing section: the service cards, the zone table and a CTA. */
export async function DeliveryService({ zones }: { zones: DeliveryZone[] }) {
  const t = await getTranslations("delivery");
  return (
    <div className="space-y-8">
      <DeliveryServiceCards zones={zones} />
      <div className="grid items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
        <DeliveryZoneTable zones={zones} />
        <div data-reveal="right" className="rounded-2xl border bg-card p-6">
          <h3 className="font-display text-xl font-extrabold uppercase">{t("howTitle")}</h3>
          <ol className="mt-4 space-y-3 text-sm">
            {[t("how1"), t("how2"), t("how3")].map((step, i) => (
              <li key={step} className="flex gap-3">
                <span
                  aria-hidden
                  className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent font-display text-sm font-black text-accent-foreground"
                >
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs text-muted-foreground">{t("packagesNote")}</p>
          <Button asChild size="lg" className="mt-5 w-full sm:w-auto">
            <Link href="/book">
              {t("cta")} <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export function DeliveryServiceSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-56 rounded-2xl" />
      ))}
    </div>
  );
}
