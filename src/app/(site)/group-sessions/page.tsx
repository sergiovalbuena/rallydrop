import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { CalendarDays, Check, MapPin, Users } from "lucide-react";
import { PageHero, Section } from "@/components/marketing/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCentsShort } from "@/lib/money";
import { upcomingGroupSessions } from "@/lib/services/catalog";
import { formatLocal } from "@/lib/time";

export const metadata: Metadata = { title: "Group sessions" };

export default async function GroupSessionsPage() {
  const t = await getTranslations("groups");
  return (
    <>
      <PageHero title={t("title")} subtitle={t("subtitle")} />
      <Section className="grid gap-10 lg:grid-cols-[1fr_2fr]">
        <div>
          <h2 className="font-display text-3xl font-extrabold uppercase">{t("whatTitle")}</h2>
          <ul className="mt-4 space-y-3">
            {[t("what1"), t("what2"), t("what3")].map((item) => (
              <li key={item} className="flex gap-3">
                <Check className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="mb-4 font-display text-3xl font-extrabold uppercase">{t("upcoming")}</h2>
          <Suspense fallback={<SessionsSkeleton />}>
            <Sessions />
          </Suspense>
        </div>
      </Section>
    </>
  );
}

async function Sessions() {
  await connection();
  const t = await getTranslations("groups");
  const tm = await getTranslations("machines");
  const sessions = await upcomingGroupSessions(new Date());
  if (sessions.length === 0) {
    return <p className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">{t("empty")}</p>;
  }
  return (
    <ul className="space-y-4">
      {sessions.map((s) => (
        <li key={s.id} className="flex flex-col gap-4 rounded-2xl border bg-card p-5 sm:flex-row sm:items-center">
          <div className="flex size-16 shrink-0 flex-col items-center justify-center rounded-xl bg-court text-white">
            <span className="text-xs font-semibold text-optic uppercase">{formatLocal(s.startsAt, "MMM")}</span>
            <span className="font-display text-3xl leading-none font-extrabold">{formatLocal(s.startsAt, "d")}</span>
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold">{s.title}</h3>
              <Badge variant="secondary">{s.level ? tm(`level_${s.level}`) : t("allLevels")}</Badge>
            </div>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CalendarDays className="size-4" aria-hidden />
              {formatLocal(s.startsAt, "EEEE · h:mm a")} – {formatLocal(s.endsAt, "h:mm a")}
            </p>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="size-4" aria-hidden />
              {s.court.name}
            </p>
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <Users className="size-4 text-primary" aria-hidden />
              {t("spotsLeft", { count: s.spotsLeft })}
            </p>
          </div>
          {s.spotsLeft > 0 ? (
            <Button asChild>
              <Link href={`/book/group/${s.id}`}>{t("join", { price: formatCentsShort(s.priceCents) })}</Link>
            </Button>
          ) : (
            <Button disabled variant="secondary">{t("full")}</Button>
          )}
        </li>
      ))}
    </ul>
  );
}

function SessionsSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-28 rounded-2xl" />
      ))}
    </div>
  );
}
