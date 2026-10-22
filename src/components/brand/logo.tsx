import { cn } from "@/lib/utils";

/**
 * RallyDrop mark: a tennis ball inside a map pin — the ball that gets
 * dropped wherever you play — with an optic "landing" shadow under the tip.
 * Original artwork.
 */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={cn("size-9 shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <ellipse cx="24" cy="44.5" rx="7" ry="2" fill="#D9F23F" />
      <path
        d="M24 3C34.5 3 42 10.8 42 20.6 42 32.2 24 44 24 44S6 32.2 6 20.6C6 10.8 13.5 3 24 3Z"
        className="fill-court-light dark:fill-primary"
      />
      <circle cx="24" cy="20.5" r="11" fill="#D9F23F" />
      <path
        d="M15.2 13.8c4.6 3.6 4.6 9.8 0 13.4M32.8 13.8c-4.6 3.6-4.6 9.8 0 13.4"
        stroke="#0E2350"
        strokeWidth="2.4"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Logo({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <LogoMark />
      <span
        className={cn(
          "font-sans text-[1.6rem] leading-none font-extrabold tracking-[-0.04em] lowercase",
          inverted ? "text-white" : "text-court dark:text-white",
        )}
      >
        rally
        <span className={inverted ? "text-optic" : "text-court-light dark:text-optic"}>drop</span>
      </span>
    </span>
  );
}
