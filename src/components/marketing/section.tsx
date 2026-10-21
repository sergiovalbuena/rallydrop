import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Section({ id, className, children }: { id?: string; className?: string; children: ReactNode }) {
  return (
    <section id={id} className={cn("mx-auto w-full max-w-6xl scroll-mt-24 px-4 py-16 sm:px-6 sm:py-20", className)}>
      {children}
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "left",
  as: Tag = "h2",
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: "left" | "center";
  as?: "h1" | "h2";
}) {
  return (
    <div className={cn("mb-10 max-w-2xl", align === "center" && "mx-auto text-center")}>
      {eyebrow && (
        <p className="mb-3 inline-flex items-center gap-2 text-xs font-bold tracking-[0.2em] text-primary uppercase">
          <span className="h-0.5 w-6 bg-accent" aria-hidden />
          {eyebrow}
        </p>
      )}
      <Tag className="font-display text-4xl leading-[0.95] font-extrabold uppercase sm:text-5xl">{title}</Tag>
      {subtitle && <p className="mt-4 text-lg text-balance text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

/** Navy hero band with court lines, used at the top of inner pages. */
export function PageHero({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="court-lines floodlight grain relative overflow-hidden bg-court text-white">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-20">
        <h1 className="font-display text-5xl leading-[0.88] font-black uppercase sm:text-8xl">{title}</h1>
        {subtitle && <p className="mt-5 max-w-2xl text-lg text-balance text-white/80">{subtitle}</p>}
        {children}
      </div>
      <div className="h-1.5 bg-accent" aria-hidden />
    </div>
  );
}
