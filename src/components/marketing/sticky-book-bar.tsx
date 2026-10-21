"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Mobile-only booking bar that slides in once the hero CTA scrolls out of view. */
export function StickyBookBar({ label, cta, watchId }: { label: string; cta: string; watchId: string }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const target = document.getElementById(watchId);
    if (!target) return;
    const io = new IntersectionObserver(([entry]) => setVisible(!entry.isIntersecting), {
      rootMargin: "0px 0px -40% 0px",
    });
    io.observe(target);
    return () => io.disconnect();
  }, [watchId]);
  return (
    <div
      className={cn(
        "fixed inset-x-3 bottom-3 z-40 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-court/95 p-2 pl-4 text-white shadow-2xl backdrop-blur transition-all duration-300 sm:hidden",
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-24 opacity-0",
      )}
      aria-hidden={!visible}
    >
      <span className="font-display text-lg font-extrabold tracking-wide uppercase">{label}</span>
      <Link
        href="/book"
        tabIndex={visible ? 0 : -1}
        className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-accent px-5 text-sm font-bold text-accent-foreground"
      >
        {cta} <ArrowRight className="size-4" aria-hidden />
      </Link>
    </div>
  );
}
