import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Progress: compact label + bar on phones, labelled dots on larger screens. */
export function Stepper({ steps, current, stepOfLabel }: { steps: string[]; current: number; stepOfLabel: string }) {
  const pct = ((current + 1) / steps.length) * 100;
  return (
    <nav aria-label="Booking progress">
      <div className="sm:hidden">
        <p className="flex items-baseline justify-between text-sm">
          <span className="font-display text-lg font-extrabold uppercase">{steps[current]}</span>
          <span className="text-muted-foreground">{stepOfLabel}</span>
        </p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <ol className="hidden items-center gap-3 text-sm font-semibold sm:flex">
        {steps.map((label, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={label} className="flex items-center gap-3" aria-current={active ? "step" : undefined}>
              <span
                className={cn(
                  "tabular flex size-7 items-center justify-center rounded-full border text-xs transition-colors",
                  done && "border-primary bg-primary text-primary-foreground",
                  active && "border-primary text-primary ring-4 ring-primary/15",
                  !done && !active && "text-muted-foreground",
                )}
              >
                {done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
              </span>
              <span className={cn(active ? "text-foreground" : "text-muted-foreground", "hidden md:inline")}>
                {label}
              </span>
              {i < steps.length - 1 && (
                <span className={cn("h-px w-6 lg:w-8", done ? "bg-primary" : "bg-border")} aria-hidden />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
