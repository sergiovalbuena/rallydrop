"use client";

import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const VISIBLE_MS = 5000;
const FADE_MS = 400;

/**
 * A notice that slides in over the top of the page, stays ~5 seconds and
 * goes away. Shown once per browser session; it floats, so the page never
 * jumps when it appears or leaves.
 */
export function AutoHideNotice({ id, children }: { id: string; children: ReactNode }) {
  const [phase, setPhase] = useState<"off" | "in" | "out">("off");

  useEffect(() => {
    const key = `notice:${id}`;
    let seen = false;
    try {
      seen = sessionStorage.getItem(key) === "1";
    } catch {
      // Storage blocked: just show it.
    }
    if (seen) return;
    const show = setTimeout(() => {
      try {
        sessionStorage.setItem(key, "1");
      } catch {
        // ignore
      }
      setPhase("in");
    }, 300);
    const hide = setTimeout(() => setPhase("out"), 300 + VISIBLE_MS);
    const done = setTimeout(() => setPhase("off"), 300 + VISIBLE_MS + FADE_MS);
    return () => [show, hide, done].forEach(clearTimeout);
  }, [id]);

  if (phase === "off") return null;
  return (
    <div
      role="status"
      className={cn(
        "pointer-events-none fixed inset-x-0 top-16 z-50 flex justify-center px-4 pt-3 transition-all duration-[400ms] ease-out motion-reduce:transition-none print:hidden",
        phase === "in" ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0",
      )}
      style={phase === "in" ? { animation: "notice-in 400ms ease-out" } : undefined}
    >
      <p className="pointer-events-auto flex items-center gap-2 rounded-full bg-court py-2 pr-2 pl-4 text-sm font-medium text-white shadow-lg ring-2 ring-optic/70">
        {children}
        <button
          type="button"
          onClick={() => setPhase("out")}
          aria-label="Dismiss"
          className="ml-1 inline-flex size-7 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
        >
          <X className="size-4" aria-hidden />
        </button>
      </p>
    </div>
  );
}
