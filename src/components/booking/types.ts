export type CatalogProduct = {
  id: string;
  slug: string;
  kind: "DAY" | "WEEKEND" | "WEEK" | "MONTH" | "PACKAGE" | "GROUP_SESSION";
  name: string;
  description: string | null;
  priceCents: number;
  durationHours: number | null;
};

export type CatalogMachine = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  depositCents: number;
  calendarColor: string;
};

export type CatalogAddOn = { kind: "BALLS" | "DELIVERY"; name: string; description: string | null; priceCents: number };
export type CatalogCourt = { id: string; name: string; address: string };

export type Catalog = {
  products: CatalogProduct[];
  machines: CatalogMachine[];
  addOns: CatalogAddOn[];
  courts: CatalogCourt[];
  holdMinutes: number;
  depositAuthMaxDays: number;
  depositAuthLeadHours: number;
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
  balls: boolean;
  fulfillment: "PICKUP" | "DELIVERY_COURT" | "DELIVERY_ADDRESS";
  courtId: string | null;
  deliveryAddress: string;
};

export type Contact = {
  name: string;
  email: string;
  phone: string;
  skillLevel: "" | "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "PRO";
  notes: string;
  termsAccepted: boolean;
};
