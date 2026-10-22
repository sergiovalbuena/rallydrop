/*
 * Starting catalog: used by the seed and, when there is no database yet,
 * as read-only fallback content so the public site still renders.
 * Machine specs and court locations are SAMPLE values.
 */

export const DEFAULT_PRODUCTS = [
  {
    slug: "day",
    kind: "DAY",
    name: "Day rental",
    priceCents: 5000,
    offSeasonPriceCents: 4500,
    durationHours: 25,
    sortOrder: 1,
    description: "25 hours with the machine and a full bucket of balls.",
  },
  {
    slug: "weekend",
    kind: "WEEKEND",
    name: "Weekend",
    priceCents: 8500,
    offSeasonPriceCents: 7500,
    durationHours: 48,
    sortOrder: 2,
    description: "Saturday 9 AM to Monday 9 AM, or Friday 9 PM to Sunday 9 PM.",
    allowedStarts: [
      { weekday: 6, minute: 540 },
      { weekday: 5, minute: 1260 },
    ],
  },
  {
    slug: "week",
    kind: "WEEK",
    name: "Week",
    priceCents: 16000,
    offSeasonPriceCents: 14000,
    durationHours: 168,
    sortOrder: 3,
    description: "Seven days to groove your strokes.",
  },
  {
    slug: "month",
    kind: "MONTH",
    name: "Full month",
    priceCents: 42000,
    offSeasonPriceCents: 30000,
    durationHours: 720,
    sortOrder: 4,
    description: "Keep it at home for 30 days.",
  },
  {
    slug: "package-basic",
    kind: "PACKAGE",
    name: "Basic package",
    priceCents: 4900,
    sortOrder: 5,
    sessionsPerMonth: 4,
    sessionMinutes: 90,
    description:
      "4 sessions of 1.5 h per month. Pick up and return downtown, or add delivery to your door or next to your court per session.",
  },
  {
    slug: "package-frequent",
    kind: "PACKAGE",
    name: "Frequent package",
    priceCents: 8900,
    sortOrder: 6,
    sessionsPerMonth: 8,
    sessionMinutes: 90,
    description:
      "8 sessions of 1.5 h per month. Pick up and return downtown, or add delivery to your door or next to your court per session.",
  },
] as const;

export const DEFAULT_ADD_ONS = [
  {
    kind: "EXTRA_BALLS",
    name: "Extra bucket (+50 balls)",
    priceCents: 800,
    description: "50 more pressureless balls on top of the ones included.",
  },
] as const;

export const DEFAULT_MACHINES = [
  {
    slug: "pongbot-aura",
    name: "PONGBOT Aura S",
    model: "Aura S",
    description:
      "Ultralight, battery-powered and coached by AI. The Spotter camera watches every swing and talks you through corrections while the machine feeds topspin, slice and flat balls from your phone or your voice.",
    imageUrl: "/machines/pongbot-aura-s.png",
    weightKg: 7,
    maxSpeedKmh: 100,
    ballCapacity: 120,
    batteryHours: 5,
    sports: ["TENNIS", "PICKLEBALL"],
    levels: ["BEGINNER", "INTERMEDIATE", "ADVANCED"],
    specs: [
      { label: "Speed", value: "Up to 100 km/h (62 mph) in tennis" },
      { label: "Lob", value: "Up to 8 m high" },
      { label: "Spin", value: "Topspin, slice and flat, up to 60 RPS" },
      { label: "Feed rate", value: "Up to one ball every 1.5 s" },
      { label: "Capacity", value: "120 tennis balls · 100 pickleballs" },
      { label: "Battery", value: "Up to 5 h, hot-swappable" },
      { label: "Weight", value: "About 7 kg plus the Spotter module — fits in a backpack" },
      { label: "Control", value: "PONGBOT app and natural voice commands (“more topspin”, “wider angle”)" },
      { label: "AI coach", value: "Spotter: dual 120 fps cameras, swing & movement analysis, voice tips, heatmaps" },
      { label: "Levels", value: "Beginner to advanced (up to NTRP 4.5)" },
    ],
    depositCents: 40000,
    depositLongCents: 60000,
    aiCoach: true,
    isPublic: true,
    calendarColor: "#2563eb",
    bookable: true,
    sortOrder: 1,
  },
  {
    slug: "pongbot-pace-s",
    name: "PONGBOT Pace S",
    model: "Pace S",
    description: "More pace, more spin and a bigger hopper for advanced players.",
    sports: ["TENNIS"],
    levels: ["INTERMEDIATE", "ADVANCED", "PRO"],
    depositCents: 40000,
    depositLongCents: 60000,
    calendarColor: "#ca8a04",
    bookable: false,
    // Hidden on the site for now; flip it on in Admin → Machines.
    isPublic: false,
    sortOrder: 2,
  },
] as const;

export const DEFAULT_COURTS = [
  { name: "Beacon Hill Park courts", address: "Beacon Hill Park, Victoria, BC V8V", lat: 48.4126, lng: -123.3646 },
  { name: "Central Park courts", address: "Central Park, Pandora Ave, Victoria, BC V8W", lat: 48.4297, lng: -123.3561 },
  { name: "Stadacona Park courts", address: "Stadacona Park, Victoria, BC V8R", lat: 48.4262, lng: -123.332 },
  { name: "Windsor Park courts (Oak Bay)", address: "Windsor Park, Oak Bay, BC V8S", lat: 48.4233, lng: -123.31 },
  { name: "Vic West Park courts", address: "Victoria West Park, Victoria, BC V9A", lat: 48.4318, lng: -123.3825 },
] as const;
