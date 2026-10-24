import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CalendarX, CloudRain, ShieldCheck, Timer } from "lucide-react";
import { formatCentsShort } from "@/lib/money";
import { publicPolicies, publicPricing } from "@/lib/services/public-data";
import { revealDelay } from "./reveal-delay";
import { SectionHeading } from "./section";

/** /pricing: the four policies people ask about, with the numbers from Settings. */
export async function PoliciesBlock() {
  const t = await getTranslations("policies");
  const [p, ctx] = await Promise.all([publicPolicies(), publicPricing()]);
  const items = [
    {
      icon: CalendarX,
      title: t("cancelTitle"),
      body: t("cancelBody", { hours: p.cancelFullRefundHours, percent: p.cancelLatePercent }),
    },
    { icon: CloudRain, title: t("rainTitle"), body: t("rainBody", { months: p.rainCreditMonths }) },
    {
      icon: Timer,
      title: t("lateTitle"),
      body: t("lateBody", {
        grace: p.lateGraceMinutes,
        hourly: formatCentsShort(p.lateHourlyCents),
        hours: p.lateUnreturnedHours,
      }),
    },
    {
      icon: ShieldCheck,
      title: t("depositTitle"),
      body: t("depositBody", {
        short: formatCentsShort(ctx.deposit.short),
        long: formatCentsShort(ctx.deposit.long),
      }),
    },
  ];
  return (
    <div>
      <SectionHeading title={t("title")} subtitle={t("subtitle")} />
      <dl className="grid gap-4 sm:grid-cols-2">
        {items.map((it, i) => (
          <div key={it.title} data-reveal style={revealDelay(i)} className="flex gap-4 rounded-2xl border bg-card p-5">
            <it.icon className="mt-0.5 size-6 shrink-0 text-primary" aria-hidden />
            <div>
              <dt className="font-semibold">{it.title}</dt>
              <dd className="mt-1 text-sm text-muted-foreground">{it.body}</dd>
            </div>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-sm text-muted-foreground">
        {t("full")}{" "}
        <Link href="/terms" className="font-medium text-primary underline underline-offset-2">
          {t("termsLink")}
        </Link>
      </p>
    </div>
  );
}
