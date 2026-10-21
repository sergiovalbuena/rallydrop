import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Large tappable radio card (mobile friendly). */
export function OptionCard({
  selected,
  onSelect,
  title,
  aside,
  children,
  disabled,
  name,
  value,
}: {
  selected: boolean;
  onSelect: () => void;
  title: ReactNode;
  aside?: ReactNode;
  children?: ReactNode;
  disabled?: boolean;
  name: string;
  value: string;
}) {
  return (
    <label
      className={cn(
        "relative flex cursor-pointer gap-4 rounded-xl border bg-card p-4 transition-all hover:border-primary/60 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
        selected && "border-primary bg-primary/5 ring-1 ring-primary",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={selected}
        onChange={onSelect}
        disabled={disabled}
        className="sr-only"
      />
      <span
        className={cn(
          "mt-1 flex size-5 shrink-0 items-center justify-center rounded-full border-2",
          selected ? "border-primary" : "border-input",
        )}
        aria-hidden
      >
        {selected && <span className="size-2.5 rounded-full bg-primary" />}
      </span>
      <span className="flex-1">
        <span className="flex items-start justify-between gap-3">
          <span className="font-semibold">{title}</span>
          {aside && <span className="shrink-0 font-display text-xl font-bold">{aside}</span>}
        </span>
        {children && <span className="mt-1 block text-sm text-muted-foreground">{children}</span>}
      </span>
    </label>
  );
}
