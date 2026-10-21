import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * RallyDrop mark: an optic-yellow ball carrying a service "T" (the court on
 * the ball) dropping in on three motion streaks. Original artwork.
 */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  const clipId = useId();
  return (
    <svg
      viewBox="0 0 48 48"
      className={cn("size-9 shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx="28" cy="28" r="17" />
        </clipPath>
      </defs>
      <g className="stroke-court-light dark:stroke-optic" strokeWidth="3" strokeLinecap="round">
        <path d="M3 10l7 7M10 3l6 6M3 19l4 4" />
      </g>
      <circle cx="28" cy="28" r="17" fill="#D9F23F" />
      <g clipPath={`url(#${clipId})`} stroke="#0E2350" strokeWidth="2.6" fill="none">
        <path d="M9 24.5h38M28 24.5V47" />
      </g>
      <circle cx="28" cy="28" r="17" fill="none" stroke="#0E2350" strokeWidth="2.6" />
    </svg>
  );
}

export function Logo({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      <span
        className={cn(
          "font-display text-2xl leading-none font-extrabold tracking-wide uppercase",
          inverted ? "text-white" : "text-court dark:text-white",
        )}
      >
        Rally
        <span className={inverted ? "text-optic" : "text-court-light dark:text-optic"}>Drop</span>
      </span>
    </span>
  );
}
