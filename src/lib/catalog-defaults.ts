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
    priceCents: 4500,
    durationHours: 25,
    sortOrder: 1,
    description: "25 hours with the machine — delivered, set up and picked up the next day.",
  },
  {
    slug: "weekend",
    kind: "WEEKEND",
    name: "Weekend",
    priceCents: 8000,
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
    priceCents: 15000,
    durationHours: 168,
    sortOrder: 3,
    description: "Seven days to groove your strokes.",
  },
  {
    slug: "month",
    kind: "MONTH",
    name: "Full month",
    priceCents: 30000,
    durationHours: 720,
    sortOrder: 4,
    description: "Keep it at home for 30 days.",
  },
  {
    slug: "package-basic",
    kind: "PACKAGE",
    name: "Basic package",
    priceCents: 4000,
    sortOrder: 5,
    sessionsPerMonth: 4,
    sessionMinutes: 90,
    description: "4 sessions of 1.5 h per month, delivered to your court.",
  },
  {
    slug: "package-frequent",
    kind: "PACKAGE",
    name: "Frequent package",
    priceCents: 7000,
    sortOrder: 6,
    sessionsPerMonth: 8,
    sessionMinutes: 90,
    description: "8 sessions of 1.5 h per month, delivered to your court.",
  },
  {
    slug: "group-session",
    kind: "GROUP_SESSION",
    name: "Group session",
    priceCents: 2000,
    sortOrder: 7,
    groupCapacity: 6,
    description: "1 h coached machine drills, up to 6 players. Price per person.",
  },
] as const;

export const DEFAULT_ADD_ONS = [
  {
    kind: "BALLS",
    name: "Ball bucket",
    priceCents: 1000,
    description: "100–120 pressureless balls that keep their bounce.",
  },
] as const;

export const DEFAULT_MACHINES = [
  {
    slug: "pongbot-aura",
    name: "PONGBOT Aura",
    model: "Aura",
    description:
      "Light, smart and battery powered. Phone-controlled drills with spin, oscillation and random play — perfect for groundstrokes and volleys.",
    weightKg: 7,
    maxSpeedKmh: 80,
    ballCapacity: 70,
    batteryHours: 2.5,
    sports: ["TENNIS", "PICKLEBALL"],
    levels: ["BEGINNER", "INTERMEDIATE", "ADVANCED"],
    specs: [
      { label: "Control", value: "Smartphone app + remote" },
      { label: "Spin", value: "Topspin / backspin" },
    ],
    depositCents: 30000,
    calendarColor: "#2563eb",
    bookable: true,
    sortOrder: 1,
  },
  {
    slug: "pongbot-pace-s",
    name: "PONGBOT Pace S",
    model: "Pace S",
    description: "More pace, more spin and a bigger hopper for advanced players. Coming soon.",
    sports: ["TENNIS"],
    levels: ["INTERMEDIATE", "ADVANCED", "PRO"],
    depositCents: 40000,
    calendarColor: "#ca8a04",
    bookable: false,
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
