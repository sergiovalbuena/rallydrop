import type { CSSProperties } from "react";

/** Stagger for `data-reveal` elements: `style={revealDelay(i)}`. */
export function revealDelay(index: number, stepMs = 90): CSSProperties {
  return { "--reveal-delay": `${index * stepMs}ms` } as CSSProperties;
}
