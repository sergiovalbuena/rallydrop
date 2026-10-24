import { describe, expect, it } from "vitest";
import { faqPageLd, localBusinessLd, machineProductLd } from "@/lib/services/structured-data";
import type { PublicMachine } from "@/lib/services/catalog";
import type { Product } from "@/generated/prisma/client";
import type { SiteInfo } from "@/lib/services/site-info";

const site: SiteInfo = {
  email: null,
  phone: null,
  phoneHref: null,
  domain: null,
  hubAddress: null,
  instagramUrl: null,
  insured: false,
  licence: null,
  pickleball: true,
};

describe("structured data", () => {
  it("describes the business without inventing contact details", () => {
    const ld = localBusinessLd(site);
    expect(ld).toMatchObject({ "@type": "LocalBusiness", name: "RallyDrop", address: { addressLocality: "Victoria" } });
    expect(ld).not.toHaveProperty("telephone");
    expect(ld).not.toHaveProperty("email");
    expect(localBusinessLd({ ...site, phone: "+1 250 123 4567" })).toHaveProperty("telephone", "+1 250 123 4567");
  });

  it("gives the machine a CAD price range from the rental products", () => {
    const products = [
      { kind: "DAY", priceCents: 5000, offSeasonPriceCents: 4500 },
      { kind: "MONTH", priceCents: 42000, offSeasonPriceCents: 30000 },
      { kind: "PACKAGE", priceCents: 4900, offSeasonPriceCents: null },
    ] as Product[];
    const machine = {
      name: "PONGBOT Aura S",
      description: "AI coach",
      imageUrl: "/machines/pongbot-aura-s.png",
      bookable: true,
    } as PublicMachine;
    expect(machineProductLd(machine, products)).toMatchObject({
      "@type": "Product",
      brand: { name: "PONGBOT" },
      offers: { priceCurrency: "CAD", lowPrice: "45.00", highPrice: "420.00", offerCount: 2 },
    });
  });

  it("turns the FAQ into a FAQPage", () => {
    expect(faqPageLd([{ id: "x", q: "Q?", a: "A." }]).mainEntity).toEqual([
      { "@type": "Question", name: "Q?", acceptedAnswer: { "@type": "Answer", text: "A." } },
    ]);
  });
});
