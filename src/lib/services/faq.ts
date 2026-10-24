import "server-only";
import { getTranslations } from "next-intl/server";
import { formatCentsShort } from "@/lib/money";
import { publicCatalog, publicPolicies, publicPricing } from "./public-data";
import { getSiteInfo } from "./site-info";

export type FaqItem = { id: string; q: string; a: string };

/**
 * The FAQ with live numbers (deposits, Care, delivery prices). Questions
 * that don't apply are left out: pickleball only if a public machine plays
 * it, insurance only when a policy is on file.
 */
export async function faqItems(): Promise<FaqItem[]> {
  const t = await getTranslations("faq");
  // Cached reads: the answers are part of the server HTML (no JS needed).
  const [catalog, ctx, policies, site] = await Promise.all([
    publicCatalog(),
    publicPricing(),
    publicPolicies(),
    getSiteInfo(),
  ]);
  const zone1 = catalog.deliveryZones[0];
  const pickleball =
    policies.pickleballEnabled && catalog.machines.some((m) => m.bookable && m.sports.includes("PICKLEBALL"));
  const money = formatCentsShort;
  const items: (FaqItem | false)[] = [
    { id: "account", q: t("account.q"), a: t("account.a") },
    { id: "where", q: t("where.q"), a: t("where.a") },
    {
      id: "delivery",
      q: t("delivery.q"),
      a: t("delivery.a", { trip: money(zone1?.tripCents ?? 1500), round: money(zone1?.roundTripCents ?? 2500) }),
    },
    { id: "balls", q: t("balls.q"), a: t("balls.a") },
    { id: "easy", q: t("easy.q"), a: t("easy.a") },
    { id: "ai", q: t("ai.q"), a: t("ai.a") },
    { id: "coach", q: t("coach.q"), a: t("coach.a") },
    { id: "court", q: t("court.q"), a: t("court.a") },
    { id: "speed", q: t("speed.q"), a: t("speed.a") },
    pickleball && { id: "pickleball", q: t("pickleball.q"), a: t("pickleball.a") },
    {
      id: "deposit",
      q: t("deposit.q"),
      a: t("deposit.a", { short: money(ctx.deposit.short), long: money(ctx.deposit.long) }),
    },
    !!ctx.care && {
      id: "care",
      q: t("care.q"),
      a: t("care.a", { price: money(ctx.care.short), cap: money(ctx.care.cap) }),
    },
    { id: "rain", q: t("rain.q"), a: t("rain.a", { months: policies.rainCreditMonths }) },
    {
      id: "late",
      q: t("late.q"),
      a: t("late.a", {
        grace: policies.lateGraceMinutes,
        hourly: money(policies.lateHourlyCents),
        hours: policies.lateUnreturnedHours,
      }),
    },
    { id: "breaks", q: t("breaks.q"), a: t("breaks.a") },
    { id: "friends", q: t("friends.q"), a: t("friends.a") },
    {
      id: "cancel",
      q: t("cancel.q"),
      a: t("cancel.a", { hours: policies.cancelFullRefundHours, percent: policies.cancelLatePercent }),
    },
    site.insured && { id: "insured", q: t("insured.q"), a: t("insured.a") },
  ];
  return items.filter((i): i is FaqItem => !!i);
}
