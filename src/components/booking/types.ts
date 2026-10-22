import type { ConsentDocs } from "@/components/legal/terms-consent";
import type { DeliveryZone } from "@/lib/domain/delivery";

export type CatalogProduct = {
  id: string;
  slug: string;
  kind: "DAY" | "WEEKEND" | "WEEK" | "MONTH" | "PACKAGE";
  name: string;
  description: string | null;
  /** High-season price. */
  priceCents: number;
  /** Off-season price (null = same all year). */
  offSeasonPriceCents: number | null;
  durationHours: number | null;
};

export type CatalogMachine = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  depositCents: number;
  depositLongCents: number;
  calendarColor: string;
};

export type CatalogAddOn = { kind: "EXTRA_BALLS"; name: string; description: string | null; priceCents: number };
export type CatalogCourt = { id: string; name: string; address: string };

export type Catalog = {
  products: CatalogProduct[];
  machines: CatalogMachine[];
  addOns: CatalogAddOn[];
  courts: CatalogCourt[];
  holdMinutes: number;
  depositAuthMaxDays: number;
  depositAuthLeadHours: number;
  deliveryZones: DeliveryZone[];
  /** High season window ("MM-DD") and today's local date, for prices. */
  season: { start: string; end: string };
  today: string;
  /** RallyDrop Care price per product kind (null = not offered). */
  care: Partial<Record<CatalogProduct["kind"], number>> | null;
  careCapCents: number;
  /** Live Terms & Waiver shown at payment. */
  legal: ConsentDocs;
};

export type Slot = {
  start: string;
  end: string;
  startLabel: string;
  startFull: string;
  endLabel: string;
  machineIds: string[];
};

export type Extras = {
  /** Optional extra bucket (balls are included). */
  extraBalls: boolean;
  /** RallyDrop Care damage protection. */
  care: boolean;
  /** Where our trips go (court or address). With no trips the server treats it as self-serve. */
  fulfillment: "DELIVERY_COURT" | "DELIVERY_ADDRESS";
  /** We bring it at the start / we come back for it at the end. */
  dropoff: boolean;
  collection: boolean;
  courtId: string | null;
  deliveryAddress: string;
};

export type Contact = {
  name: string;
  email: string;
  phone: string;
  skillLevel: "" | "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "PRO";
  notes: string;
};
