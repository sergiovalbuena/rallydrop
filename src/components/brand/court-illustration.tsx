import { cn } from "@/lib/utils";

/**
 * Hard court in perspective with a ball machine feeding a rally arc.
 * Pure SVG (no photo needed), scales crisply on any screen.
 */
export function CourtIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 640 520"
      className={cn("h-auto w-full", className)}
      role="img"
      aria-label="A ball machine on a blue hard court feeding balls over the net"
    >
      <defs>
        <linearGradient id="court-surface" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a5ee8" />
          <stop offset="1" stopColor="#1a3fb0" />
        </linearGradient>
        <linearGradient id="court-apron" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b3a8a" />
          <stop offset="1" stopColor="#0f2560" />
        </linearGradient>
        <radialGradient id="ball-shine" cx="0.35" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#f3ff9a" />
          <stop offset="1" stopColor="#c9e52a" />
        </radialGradient>
      </defs>
      {/* apron + court in perspective */}
      <path d="M90 120 L550 120 L640 520 L0 520 Z" fill="url(#court-apron)" />
      <path d="M150 150 L490 150 L580 500 L60 500 Z" fill="url(#court-surface)" />
      {/* lines */}
      <g stroke="#ffffff" strokeWidth="4" fill="none" strokeLinejoin="round">
        <path d="M150 150 L490 150 L580 500 L60 500 Z" />
        <path d="M185 150 L118 500 M455 150 L522 500" strokeWidth="3" />
        <path d="M168 225 L472 225" strokeWidth="3" />
        <path d="M138 400 L502 400" strokeWidth="3" />
        <path d="M320 225 L320 400" strokeWidth="3" />
      </g>
      {/* net */}
      <g>
        <path d="M120 300 L520 300 L524 268 L116 268 Z" fill="#0b1b44" opacity="0.55" />
        <path d="M116 268 L524 268" stroke="#ffffff" strokeWidth="5" />
        <path d="M120 268 L120 304 M520 268 L520 304" stroke="#e5e7eb" strokeWidth="6" />
        <g stroke="#ffffff" strokeOpacity="0.25" strokeWidth="1">
          {Array.from({ length: 20 }, (_, i) => (
            <path key={i} d={`M${136 + i * 19.5} 270 L${136 + i * 19.5} 300`} />
          ))}
        </g>
      </g>
      {/* rally arc */}
      <path
        id="rally-arc"
        d="M318 440 C 300 240, 260 150, 205 175"
        stroke="#d9f23f"
        strokeWidth="3"
        strokeDasharray="2 12"
        strokeLinecap="round"
        fill="none"
        opacity="0.9"
      />
      {/* Static balls for reduced motion */}
      <g className="motion-safe:hidden">
        {[
          [306, 360, 9],
          [287, 262, 8],
          [254, 196, 7],
          [214, 176, 6],
        ].map(([cx, cy, r]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill="url(#ball-shine)" />
        ))}
      </g>
      {/* Balls flying out of the machine, staggered */}
      <g className="motion-reduce:hidden">
        {[0, 0.6, 1.2].map((delay) => (
          <circle key={delay} r="8" fill="url(#ball-shine)" opacity="0">
            <animateMotion
              dur="1.8s"
              begin={`${delay}s`}
              repeatCount="indefinite"
              keyPoints="0;1"
              keyTimes="0;1"
              calcMode="spline"
              keySplines="0.2 0.6 0.4 1"
            >
              <mpath href="#rally-arc" />
            </animateMotion>
            <animate attributeName="r" values="10;5" dur="1.8s" begin={`${delay}s`} repeatCount="indefinite" />
            <animate
              attributeName="opacity"
              values="0;1;1;0"
              keyTimes="0;0.08;0.85;1"
              dur="1.8s"
              begin={`${delay}s`}
              repeatCount="indefinite"
            />
          </circle>
        ))}
      </g>
      {/* ball machine */}
      <g transform="translate(286 418)">
        <ellipse cx="34" cy="76" rx="52" ry="9" fill="#071233" opacity="0.45" />
        <rect x="0" y="22" width="68" height="50" rx="12" fill="#0e2350" />
        <rect x="6" y="28" width="56" height="10" rx="5" fill="#2457e6" />
        <path d="M8 22 C 8 0, 60 0, 60 22 Z" fill="#132c63" />
        <circle cx="22" cy="12" r="6" fill="url(#ball-shine)" />
        <circle cx="36" cy="9" r="6" fill="url(#ball-shine)" />
        <circle cx="47" cy="14" r="6" fill="url(#ball-shine)" />
        <rect x="27" y="44" width="14" height="14" rx="7" fill="#d9f23f" />
        <circle cx="12" cy="74" r="6" fill="#1f2937" />
        <circle cx="56" cy="74" r="6" fill="#1f2937" />
      </g>
    </svg>
  );
}

/** Generic ball-machine illustration used when a machine has no photo. */
export function MachineIllustration({ className, accent = "#2457e6" }: { className?: string; accent?: string }) {
  return (
    <svg viewBox="0 0 200 160" className={cn("h-auto w-full", className)} aria-hidden>
      <ellipse cx="100" cy="146" rx="70" ry="8" fill="currentColor" opacity="0.12" />
      <path d="M48 58 C 48 18, 152 18, 152 58 Z" fill="#132c63" />
      <circle cx="78" cy="40" r="11" fill="#d9f23f" />
      <circle cx="100" cy="34" r="11" fill="#d9f23f" />
      <circle cx="122" cy="42" r="11" fill="#d9f23f" />
      <rect x="40" y="56" width="120" height="80" rx="18" fill="#0e2350" />
      <rect x="50" y="66" width="100" height="14" rx="7" fill={accent} />
      <circle cx="100" cy="108" r="14" fill="#d9f23f" />
      <circle cx="100" cy="108" r="6" fill="#0e2350" />
      <circle cx="58" cy="138" r="9" fill="#1f2937" />
      <circle cx="142" cy="138" r="9" fill="#1f2937" />
    </svg>
  );
}
