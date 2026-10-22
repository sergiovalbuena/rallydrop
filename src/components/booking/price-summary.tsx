"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ShieldCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCents, bpsToPercent } from "@/lib/money";
import type { Quote } from "@/lib/domain/pricing";

export function PriceSummary({
  quote,
  loading,
  depositKind,
  header,
  creditCents = 0,
}: {
  quote: Quote | null;
  loading: boolean;
  depositKind: "hold" | "saved" | "scheduled";
  header?: ReactNode;
  /** Customer credit applied at checkout (known once the booking is held). */
  creditCents?: number;
}) {
  const t = useTranslations("book");
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-xs">
      <h2 className="font-display text-xl font-bold uppercase">{t("summary")}</h2>
      {header}
      {!quote ? (
        <div className="mt-4 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-6 w-1/2" />
        </div>
      ) : (
        <dl
          className={
            loading
              ? "mt-4 space-y-2 text-sm opacity-60 transition-opacity"
              : "mt-4 space-y-2 text-sm transition-opacity"
          }
          aria-busy={loading}
        >
          {quote.lines.map((l) => (
            <div
              key={l.key}
              className={l.key === "promo" ? "flex justify-between gap-4 text-success" : "flex justify-between gap-4"}
            >
              <dt>
                {l.label}
                {l.note && <span className="block text-xs text-success">{l.note}</span>}
              </dt>
              <dd className="tabular-nums">{formatCents(l.cents)}</dd>
            </div>
          ))}
          <div className="flex justify-between border-t pt-2 text-muted-foreground">
            <dt>{t("subtotal")}</dt>
            <dd className="tabular-nums">{formatCents(quote.subtotalCents)}</dd>
          </div>
          {quote.gstBps > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <dt>{t("gst", { rate: bpsToPercent(quote.gstBps) })}</dt>
              <dd className="tabular-nums">{formatCents(quote.gstCents)}</dd>
            </div>
          )}
          {quote.pstBps > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <dt>{t("pst", { rate: bpsToPercent(quote.pstBps) })}</dt>
              <dd className="tabular-nums">{formatCents(quote.pstCents)}</dd>
            </div>
          )}
          {creditCents > 0 && (
            <div className="flex justify-between text-success">
              <dt>{t("creditApplied")}</dt>
              <dd className="tabular-nums">−{formatCents(creditCents)}</dd>
            </div>
          )}
          <div className="flex items-baseline justify-between border-t pt-3">
            <dt className="font-semibold">{t("total")}</dt>
            <dd className="font-display text-3xl font-extrabold tabular-nums">
              {formatCents(quote.totalCents - creditCents)}
            </dd>
          </div>
          {quote.depositCents > 0 && (
            <div className="mt-3 flex gap-3 rounded-lg bg-muted/60 p-3">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
              <div>
                <dt className="font-semibold">
                  {t("depositLine")} · {formatCents(quote.depositCents)}
                </dt>
                <dd className="text-xs text-muted-foreground">
                  {depositKind === "saved"
                    ? t("depositSaved")
                    : depositKind === "scheduled"
                      ? t("depositScheduled")
                      : t("depositHold")}
                </dd>
              </div>
            </div>
          )}
        </dl>
      )}
    </div>
  );
}
