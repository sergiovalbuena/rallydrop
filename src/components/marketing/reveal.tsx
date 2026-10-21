"use client";

import { useEffect } from "react";

/**
 * Scroll-reveal for marketing pages. Server components opt in with a
 * `data-reveal` attribute (optionally "up" | "scale" | "left" | "right" |
 * "flip") and a stagger via `style={revealDelay(i)}` (reveal-delay.ts); this observer
 * animates them as they scroll into view, including content that streams in
 * later. Without JS, or with reduced motion, everything is simply visible.
 */
export function RevealObserver() {
  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = document.documentElement;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).dataset.visible = "in";
          io.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );

    const watch = (scope: ParentNode, initial: boolean) => {
      scope.querySelectorAll<HTMLElement>("[data-reveal]:not([data-visible])").forEach((el) => {
        // Already on screen at first paint: leave it as it is (no flash).
        if (initial) {
          const r = el.getBoundingClientRect();
          if (r.top < window.innerHeight && r.bottom > 0) {
            el.dataset.visible = "now";
            return;
          }
        }
        io.observe(el);
      });
    };

    watch(document, true);
    root.classList.add("reveal-ready");

    // Suspense boundaries and client navigations add new sections later.
    const mo = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          if (node.matches("[data-reveal]:not([data-visible])")) io.observe(node);
          watch(node, false);
        });
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      mo.disconnect();
      io.disconnect();
      root.classList.remove("reveal-ready");
    };
  }, []);
  return null;
}
