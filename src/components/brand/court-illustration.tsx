import { cn } from "@/lib/utils";

type Pt = [number, number];

/** Seconds for the whole drill to repeat (one ball every CYCLE / SHOTS.length). */
const CYCLE = 4.8;
const MOUTH: Pt = [320, 436];

/**
 * Shot pattern: landing spot on the far court, how far the bounce carries,
 * and how high the arc goes (drives are flat, lobs are high, drops are short).
 */
const PATTERN: { id: string; land: Pt; hop: Pt; height: number; flight: number }[] = [
  { id: "deep-cross", land: [196, 172], hop: [178, 154], height: 150, flight: 1.4 },
  { id: "short-angle", land: [452, 242], hop: [490, 230], height: 105, flight: 1.0 },
  { id: "lob", land: [330, 168], hop: [334, 152], height: 235, flight: 1.9 },
  { id: "line-drive", land: [462, 184], hop: [472, 164], height: 95, flight: 0.95 },
  { id: "drop", land: [292, 252], hop: [286, 244], height: 150, flight: 1.3 },
  { id: "wide-left", land: [204, 224], hop: [172, 210], height: 120, flight: 1.15 },
];

function cubic(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const u = 1 - t;
  return [0, 1].map((k) => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]) as Pt;
}

function length(points: Pt[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++)
    total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  return total;
}

const SHOTS = PATTERN.map((shot) => {
  const [lx, ly] = shot.land;
  // Rises while already heading to its target, peaks past the net, drops onto the spot.
  const c1: Pt = [MOUTH[0] + (lx - MOUTH[0]) * 0.35, MOUTH[1] - shot.height * 1.1];
  const c2: Pt = [MOUTH[0] + (lx - MOUTH[0]) * 0.85, ly - shot.height * 0.55];
  // Small second hop after the bounce, a fraction of the arc's height.
  const hopMid: Pt = [(lx + shot.hop[0]) / 2, Math.min(ly, shot.hop[1]) - shot.height * 0.12];
  const arcLen = length(Array.from({ length: 33 }, (_, i) => cubic(MOUTH, c1, c2, shot.land, i / 32)));
  const hopLen = length([shot.land, hopMid, shot.hop]);
  const groundLen = length([MOUTH, shot.land]);
  const groundHop = length([shot.land, shot.hop]);
  return {
    ...shot,
    arc: `M${MOUTH[0]} ${MOUTH[1]} C${c1.join(" ")} ${c2.join(" ")} ${lx} ${ly}`,
    hop: `Q${hopMid.join(" ")} ${shot.hop.join(" ")}`,
    split: arcLen / (arcLen + hopLen),
    ground: `M${MOUTH[0]} ${MOUTH[1] + 4} L${lx} ${ly + 2} L${shot.hop[0]} ${shot.hop[1] + 2}`,
    groundSplit: groundLen / (groundLen + groundHop),
    bounce: 0.35,
    // Far-court balls look smaller.
    size: 4 + Math.round(((ly - 150) / 110) * 3),
  };
});

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
      {/* Static balls for reduced motion */}
      <g className="motion-safe:hidden">
        {SHOTS.slice(0, 4).map((shot) => (
          <circle key={shot.id} cx={shot.land[0]} cy={shot.land[1]} r={5} fill="url(#ball-shine)" />
        ))}
      </g>
      {/* A drill: one ball every beat, each to a different angle and depth, bouncing on landing */}
      <g className="motion-reduce:hidden">
        {SHOTS.map((shot, i) => {
          const begin = `${(i * CYCLE) / SHOTS.length}s`;
          const dur = `${CYCLE}s`;
          const t = (x: number) => (x / CYCLE).toFixed(3);
          const land = t(shot.flight);
          const done = t(shot.flight + shot.bounce);
          const fade = t(Math.min(shot.flight + shot.bounce + 0.15, CYCLE - 0.01));
          return (
            <g key={shot.id}>
              {/* landing mark */}
              <ellipse
                cx={shot.land[0]}
                cy={shot.land[1] + 2}
                rx="0"
                ry="0"
                fill="none"
                stroke="#f3ff9a"
                strokeWidth="2"
                opacity="0"
              >
                <animate
                  attributeName="rx"
                  values="0;0;14;14"
                  keyTimes={`0;${land};${fade};1`}
                  dur={dur}
                  begin={begin}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="ry"
                  values="0;0;4;4"
                  keyTimes={`0;${land};${fade};1`}
                  dur={dur}
                  begin={begin}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0;0.9;0;0"
                  keyTimes={`0;${land};${fade};1`}
                  dur={dur}
                  begin={begin}
                  repeatCount="indefinite"
                />
              </ellipse>
              {/* shadow on the court: shows how far and where each ball travels */}
              <ellipse rx="7" ry="2.5" fill="#071233" opacity="0">
                <animateMotion
                  path={shot.ground}
                  dur={dur}
                  begin={begin}
                  repeatCount="indefinite"
                  keyPoints={`0;${shot.groundSplit.toFixed(3)};1;1`}
                  keyTimes={`0;${land};${done};1`}
                  calcMode="linear"
                />
                <animate
                  attributeName="rx"
                  values={`8;${shot.size};${shot.size};${shot.size}`}
                  keyTimes={`0;${land};${done};1`}
                  dur={dur}
                  begin={begin}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0;0.35;0.35;0;0"
                  keyTimes={`0;0.02;${done};${fade};1`}
                  dur={dur}
                  begin={begin}
                  repeatCount="indefinite"
                />
              </ellipse>
              <circle r="9" fill="url(#ball-shine)" opacity="0">
                <animateMotion
                  path={`${shot.arc} ${shot.hop}`}
                  dur={dur}
                  begin={begin}
                  repeatCount="indefinite"
                  keyPoints={`0;${shot.split.toFixed(3)};1;1`}
                  keyTimes={`0;${land};${done};1`}
                  calcMode="spline"
                  keySplines="0.25 0.5 0.6 1; 0.2 0.6 0.5 1; 0 0 1 1"
                />
                {/* smaller as it travels away (perspective) */}
                <animate
                  attributeName="r"
                  values={`10;${shot.size};${shot.size - 1};${shot.size - 1}`}
                  keyTimes={`0;${land};${done};1`}
                  dur={dur}
                  begin={begin}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0;1;1;0;0"
                  keyTimes={`0;0.02;${done};${fade};1`}
                  dur={dur}
                  begin={begin}
                  repeatCount="indefinite"
                />
              </circle>
            </g>
          );
        })}
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
