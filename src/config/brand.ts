/**
 * Brand configuration — the ONE place to rename the business.
 * Everything user-facing (site, emails, Stripe statement descriptor,
 * booking codes) reads from here.
 */
export const brand = {
  name: "RallyDrop",
  /** Short uppercase prefix for booking codes, e.g. "RD-7K3Q9". */
  codePrefix: "RD",
  tagline: "Your hitting partner, delivered.",
  city: "Victoria, BC",
  /** Max 22 chars, shown on the customer's card statement. */
  statementDescriptor: "RALLYDROP VICTORIA",
  timeZone: "America/Vancouver",
  currency: "cad",
  locale: "en-CA",
  contact: {
    email: "hello@rallydrop.ca",
    phone: "+1 (250) 555-0142",
    instagram: "https://instagram.com/rallydrop",
  },
  /**
   * Postal-code areas (FSA) inside the free-delivery zone, used when an
   * address can't be geocoded. Roughly downtown Victoria + 5 km.
   */
  freeDeliveryFsas: ["V8W", "V8V", "V8T", "V8R", "V8S", "V9A"],
} as const;

export type Brand = typeof brand;
