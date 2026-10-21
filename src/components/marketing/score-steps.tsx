import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { revealDelay } from "./reveal-delay";

/** "How it works" told as a tennis game: 15 · 30 · 40 · Game. */
export async function ScoreSteps() {
  const t = await getTranslations("home");
  const tc = await getTranslations("common");
  const points = [
    { score: "15", title: t("score15"), body: t("score15Body") },
    { score: "30", title: t("score30"), body: t("score30Body") },
    { score: "40", title: t("score40"), body: t("score40Body") },
    { score: t("scoreGame"), title: t("scoreGame"), body: t("scoreGameBody"), final: true },
  ];
  return (
    <ol className="grid gap-px overflow-hidden rounded-3xl border bg-border sm:grid-cols-2 lg:grid-cols-4">
      {points.map((p, i) => (
        <li
          key={p.score}
          data-reveal
          style={revealDelay(i, 110)}
          className={cn(
            "group relative flex flex-col gap-3 bg-card p-6 transition-colors sm:p-7",
            p.final ? "bg-court text-white" : "hover:bg-muted/50",
          )}
        >
          <span className="sr-only">Step {i + 1}: </span>
          <span
            aria-hidden
            data-reveal="flip"
            style={revealDelay(i + 2, 110)}
            className={cn(
              "tabular inline-block font-display text-7xl leading-none font-black uppercase",
              p.final ? "text-optic" : "numeral-outline text-primary/70 transition-colors group-hover:text-primary",
            )}
          >
            {p.score}
          </span>
          {!p.final && <h3 className="text-xl font-extrabold uppercase">{p.title}</h3>}
          <p className={cn("text-sm leading-relaxed", p.final ? "text-white/80" : "text-muted-foreground")}>{p.body}</p>
          {p.final && (
            <Link
              href="/book"
              className="mt-auto inline-flex items-center gap-1.5 text-sm font-semibold text-optic hover:underline"
            >
              {tc("bookNow")} <ArrowRight className="size-4" aria-hidden />
            </Link>
          )}
        </li>
      ))}
    </ol>
  );
}
