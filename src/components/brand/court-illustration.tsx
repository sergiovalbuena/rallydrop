import { cn } from "@/lib/utils";

type Pt = [number, number];

/** Seconds for the whole drill to repeat (one ball every CYCLE / SHOTS.length). */
const CYCLE = 4.8;
const MOUTH: Pt = [320, 436];

/**
 * Shot pattern: where each ball lands on the far court, how high the arc
 * goes (drives are flat, lobs are high) and how far the bounce carries
 * (as a share of the flight). Like real tennis balls they kick up and keep
 * going after the bounce — often right off the court.
 */
const PATTERN: { id: string; land: Pt; height: number; flight: number; carry: number }[] = [
  { id: "deep-cross", land: [196, 176], height: 150, flight: 1.4, carry: 0.42 },
  { id: "short-angle", land: [452, 244], height: 105, flight: 1.0, carry: 0.55 },
  { id: "lob", land: [330, 170], height: 235, flight: 1.9, carry: 0.4 },
  { id: "line-drive", land: [462, 188], height: 95, flight: 0.95, carry: 0.5 },
  { id: "drop", land: [292, 252], height: 150, flight: 1.3, carry: 0.22 },
  { id: "wide-left", land: [204, 226], height: 120, flight: 1.15, carry: 0.5 },
];

function cubic(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const u = 1 - t;
  return [0, 1].map((k) => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]) as Pt;
}

function quad(p0: Pt, p1: Pt, p2: Pt, t: number): Pt {
  const u = 1 - t;
  return [0, 1].map((k) => u * u * p0[k] + 2 * u * t * p1[k] + t * t * p2[k]) as Pt;
}

function length(points: Pt[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++)
    total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  return total;
}

const round = (p: Pt): Pt => [Math.round(p[0]), Math.round(p[1])];

const SHOTS = PATTERN.map((shot) => {
  const [lx, ly] = shot.land;
  // Rises while already heading to its target, peaks past the net, drops onto the spot.
  const c1: Pt = [MOUTH[0] + (lx - MOUTH[0]) * 0.35, MOUTH[1] - shot.height * 1.1];
  const c2: Pt = [MOUTH[0] + (lx - MOUTH[0]) * 0.85, ly - shot.height * 0.55];
  // The bounce keeps the ball's direction across the court and kicks up to
  // roughly half the incoming height, so deep balls sail past the baseline.
  const out = round([lx + (lx - MOUTH[0]) * shot.carry, ly + (ly - MOUTH[1]) * shot.carry]);
  const kick = round([(lx + out[0]) / 2, Math.min(ly, out[1]) - shot.height * 0.9]);
  const arcLen = length(Array.from({ length: 33 }, (_, i) => cubic(MOUTH, c1, c2, shot.land, i / 32)));
  const hopLen = length(Array.from({ length: 17 }, (_, i) => quad(shot.land, kick, out, i / 16)));
  const groundLen = length([MOUTH, shot.land]);
  const groundHop = length([shot.land, out]);
  return {
    ...shot,
    arc: `M${MOUTH[0]} ${MOUTH[1]} C${round(c1).join(" ")} ${round(c2).join(" ")} ${lx} ${ly}`,
    hop: `Q${kick.join(" ")} ${out.join(" ")}`,
    split: arcLen / (arcLen + hopLen),
    ground: `M${MOUTH[0]} ${MOUTH[1] + 4} L${lx} ${ly + 2} L${out[0]} ${out[1] + 2}`,
    groundSplit: groundLen / (groundLen + groundHop),
    // A bounced ball is slower: give the kick a good share of time.
    bounce: shot.flight * (0.35 + shot.carry * 0.6),
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
      overflow="visible"
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
          const fade = t(Math.min(shot.flight + shot.bounce + 0.2, CYCLE - 0.01));
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
                  keySplines="0.25 0.5 0.6 1; 0.15 0.45 0.55 0.95; 0 0 1 1"
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

/**
 * Product-style render of a modern ball machine, used until a real photo is
 * uploaded in Admin → Machines: matte body, see-through hopper, launch
 * aperture, AI camera module and wheels.
 */
export function MachineIllustration({
  className,
  accent = "#2457e6",
  camera = true,
}: {
  className?: string;
  accent?: string;
  camera?: boolean;
}) {
  const ball = (cx: number, cy: number, r = 9, rot = 0) => (
    <g key={`${cx}-${cy}`} transform={`rotate(${rot} ${cx} ${cy})`}>
      <circle cx={cx} cy={cy} r={r} fill="url(#mi-ball)" />
      <path
        d={`M${cx - r * 0.85} ${cy - r * 0.35} C ${cx - r * 0.2} ${cy + r * 0.15}, ${cx + r * 0.2} ${cy + r * 0.15}, ${cx + r * 0.85} ${cy - r * 0.35}`}
        stroke="#f8fbe0"
        strokeWidth="1.2"
        fill="none"
        opacity="0.8"
      />
    </g>
  );
  return (
    <svg viewBox="0 0 240 230" className={cn("h-auto w-full", className)} aria-hidden>
      <defs>
        <linearGradient id="mi-body" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#1b2233" />
          <stop offset="0.45" stopColor="#2c3446" />
          <stop offset="1" stopColor="#141a27" />
        </linearGradient>
        <linearGradient id="mi-top" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a4358" />
          <stop offset="1" stopColor="#232a3a" />
        </linearGradient>
        <linearGradient id="mi-glass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.06" />
        </linearGradient>
        <radialGradient id="mi-ball" cx="0.35" cy="0.3" r="0.75">
          <stop offset="0" stopColor="#f1ff8f" />
          <stop offset="1" stopColor="#b9d61c" />
        </radialGradient>
        <radialGradient id="mi-mouth" cx="0.5" cy="0.45" r="0.6">
          <stop offset="0" stopColor="#05070c" />
          <stop offset="1" stopColor="#1d2433" />
        </radialGradient>
        <radialGradient id="mi-lens" cx="0.35" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#7aa2ff" />
          <stop offset="0.5" stopColor="#1b2a5e" />
          <stop offset="1" stopColor="#05070c" />
        </radialGradient>
      </defs>
      {/* floor shadow */}
      <ellipse cx="120" cy="214" rx="86" ry="9" fill="#000" opacity="0.28" />
      {/* telescopic handle */}
      <rect x="166" y="34" width="7" height="110" rx="3.5" fill="#3b4457" />
      <rect x="152" y="28" width="35" height="10" rx="5" fill="#4a5470" />
      {/* hopper: see-through with balls */}
      <path d="M58 62 L182 62 L172 104 L68 104 Z" fill="#141a27" opacity="0.65" />
      {ball(82, 92)}
      {ball(102, 94, 9, 30)}
      {ball(122, 92, 9, -20)}
      {ball(142, 94, 9, 60)}
      {ball(160, 92, 8.5, 10)}
      {ball(92, 76, 9, -40)}
      {ball(112, 78, 9, 15)}
      {ball(132, 76, 9, -10)}
      {ball(152, 78, 8.5, 40)}
      <path
        d="M58 62 L182 62 L172 104 L68 104 Z"
        fill="url(#mi-glass)"
        stroke="#9aa6c4"
        strokeOpacity="0.5"
        strokeWidth="1.5"
      />
      <path d="M62 64 L82 64 L74 100 L70 100 Z" fill="#fff" opacity="0.12" />
      {/* body */}
      <path
        d="M60 104 L180 104 Q186 104 186 112 L182 186 Q181 196 170 196 L70 196 Q59 196 58 186 L54 112 Q54 104 60 104 Z"
        fill="url(#mi-body)"
      />
      <path d="M60 104 L180 104 Q186 104 186 112 L185 122 L55 122 L54 112 Q54 104 60 104 Z" fill="url(#mi-top)" />
      {/* accent band + status light */}
      <rect x="57" y="128" width="126" height="5" rx="2.5" fill={accent} />
      <circle cx="170" cy="144" r="2.5" fill="#d9f23f" />
      {/* launch aperture */}
      <ellipse cx="120" cy="160" rx="25" ry="19" fill="#0b0f18" />
      <ellipse cx="120" cy="160" rx="19" ry="14" fill="url(#mi-mouth)" />
      <ellipse cx="114" cy="155" rx="6" ry="3" fill="#fff" opacity="0.08" />
      {/* side highlight */}
      <path d="M62 112 L66 190" stroke="#fff" strokeOpacity="0.08" strokeWidth="3" strokeLinecap="round" />
      {/* AI camera module on a short mast */}
      {camera && (
        <g>
          <rect x="74" y="40" width="5" height="24" rx="2" fill="#3b4457" />
          <rect x="60" y="22" width="34" height="22" rx="7" fill="#1b2233" stroke="#4a5470" strokeWidth="1.5" />
          <circle cx="71" cy="33" r="6.5" fill="url(#mi-lens)" />
          <circle cx="85" cy="33" r="4" fill="url(#mi-lens)" />
          <circle cx="69" cy="31" r="1.6" fill="#fff" opacity="0.7" />
          <circle cx="90" cy="26" r="1.5" fill="#d9f23f" />
        </g>
      )}
      {/* wheels */}
      <g>
        <circle cx="74" cy="198" r="13" fill="#0b0f18" />
        <circle cx="74" cy="198" r="5" fill="#4a5470" />
        <circle cx="166" cy="198" r="13" fill="#0b0f18" />
        <circle cx="166" cy="198" r="5" fill="#4a5470" />
      </g>
    </svg>
  );
}
