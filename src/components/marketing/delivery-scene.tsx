import { Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Little animated road scenes for the drop-off / collection / round-trip
 * cards. Pure CSS (keyframes in globals.css, off for reduced motion); the
 * resting layout already tells the story without animation.
 */

export type SceneKind = "dropoff" | "collection" | "round";

const BLUE = "#2457e6";
const OPTIC = "#d9f23f";

/** Side-view delivery van facing right (flip with `facing="left"`). */
function Van({ color, facing = "right", className }: { color: string; facing?: "left" | "right"; className?: string }) {
  return (
    <svg
      viewBox="0 0 64 34"
      className={cn("h-8 w-[3.75rem]", facing === "left" && "-scale-x-100", className)}
      aria-hidden
    >
      <ellipse cx="32" cy="31.5" rx="28" ry="2.5" fill="#000" opacity="0.18" />
      {/* cargo box */}
      <rect x="2" y="4" width="38" height="22" rx="3" fill={color} />
      <rect x="6" y="11" width="22" height="4" rx="2" fill="#fff" opacity="0.35" />
      {/* cab */}
      <path d="M40 10 h11 l9 9 v7 a2 2 0 0 1 -2 2 H40 Z" fill={color} />
      <path d="M43 12.5 h7 l6 6 h-13 Z" fill="#0b1b44" opacity="0.75" />
      <rect x="57" y="21" width="4" height="2.5" rx="1" fill="#fde68a" />
      {/* wheels */}
      <circle cx="13" cy="27" r="5" fill="#0b0f18" />
      <circle cx="13" cy="27" r="2" fill="#94a3b8" />
      <circle cx="49" cy="27" r="5" fill="#0b0f18" />
      <circle cx="49" cy="27" r="2" fill="#94a3b8" />
    </svg>
  );
}

/** Tiny top-down tennis court. */
function MiniCourt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 44 28" className={cn("h-7 w-11", className)} aria-hidden>
      <rect x="1" y="1" width="42" height="26" rx="2" fill="#2457e6" stroke="#fff" strokeWidth="1.5" />
      <path d="M22 1 V27 M1 7 H43 M1 21 H43 M11 7 V21 M33 7 V21 M11 14 H33" stroke="#fff" strokeWidth="1" fill="none" />
      <circle cx="30" cy="10" r="2" fill={OPTIC} />
    </svg>
  );
}

/** Our downtown hub (a small garage). */
function Hub({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 34 28" className={cn("h-7 w-9", className)} aria-hidden>
      <path d="M2 12 L17 3 L32 12 V27 H2 Z" fill="#0e2350" stroke="#94a3b8" strokeWidth="1" />
      <rect x="9" y="15" width="16" height="12" rx="1" fill="#1e3a8a" />
      <path d="M9 18 H25 M9 21 H25 M9 24 H25" stroke="#94a3b8" strokeWidth="0.8" opacity="0.6" />
      <circle cx="17" cy="9.5" r="2" fill={OPTIC} />
    </svg>
  );
}

export function DeliveryScene({ kind, dark = false }: { kind: SceneKind; dark?: boolean }) {
  const road = dark ? "border-white/25" : "border-primary/25";
  return (
    <div
      aria-hidden
      className={cn(
        "relative h-24 overflow-hidden rounded-xl",
        dark ? "bg-white/[0.06]" : "bg-gradient-to-b from-primary/[0.06] to-primary/[0.02]",
      )}
    >
      {/* road */}
      <div className={cn("absolute inset-x-3 bottom-5 border-t-2 border-dashed", road)} />
      {kind === "round" && <div className={cn("absolute inset-x-3 bottom-11 border-t-2 border-dashed", road)} />}
      <Hub className="absolute bottom-6 left-3" />
      <MiniCourt className="absolute right-3 bottom-6" />

      {kind === "dropoff" && (
        <div className="scene-dropoff absolute bottom-[1.375rem] left-[55%]">
          <Van color={BLUE} />
        </div>
      )}

      {kind === "collection" && (
        <>
          <Undo2
            className="scene-arrow absolute top-2 left-1/2 size-6 -translate-x-1/2 text-primary"
            strokeWidth={2.5}
          />
          <div className="scene-collection absolute bottom-[1.375rem] left-[22%]">
            <Van color={BLUE} facing="left" />
          </div>
        </>
      )}

      {kind === "round" && (
        <>
          {/* going out (blue, upper lane) and coming back (optic, lower lane) */}
          <div className="scene-lane-right absolute bottom-[2.875rem] left-[30%]">
            <Van color={BLUE} />
          </div>
          <div className="scene-lane-left absolute bottom-[1.375rem] left-[52%]">
            <Van color={OPTIC} facing="left" />
          </div>
        </>
      )}
    </div>
  );
}
