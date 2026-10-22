import "server-only";
import type { Product } from "@/generated/prisma/client";
import { brand } from "@/config/brand";
import { siteUrl } from "@/lib/site-url";
import type { PublicMachine } from "./catalog";
import type { FaqItem } from "./faq";
import type { SiteInfo } from "./site-info";

/*
 * schema.org data for search engines: the business (home), the machine as a
 * rental product with its price range (/machines) and the FAQ.
 */

const absolute = (path: string) => (path.startsWith("http") ? path : siteUrl(path));

export function localBusinessLd(site: SiteInfo) {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": siteUrl("/#business"),
    name: brand.name,
    description:
      "AI tennis ball machine rental in Victoria, BC: the PONGBOT Aura S with a built-in AI coach, delivered to your door or next to your court.",
    url: siteUrl(),
    image: siteUrl("/opengraph-image"),
    logo: siteUrl("/icon.svg"),
    priceRange: "$$",
    currenciesAccepted: "CAD",
    areaServed: { "@type": "City", name: "Victoria, British Columbia" },
    address: {
      "@type": "PostalAddress",
      ...(site.hubAddress ? { streetAddress: site.hubAddress } : {}),
      addressLocality: "Victoria",
      addressRegion: "BC",
      addressCountry: "CA",
    },
    ...(site.phone ? { telephone: site.phone } : {}),
    ...(site.email ? { email: site.email } : {}),
    ...(site.instagramUrl ? { sameAs: [site.instagramUrl] } : {}),
  };
}

const RENTALS = ["DAY", "WEEKEND", "WEEK", "MONTH"];

export function machineProductLd(machine: PublicMachine, products: Product[]) {
  const rentals = products.filter((p) => RENTALS.includes(p.kind));
  const prices = rentals.flatMap((p) => [p.priceCents, p.offSeasonPriceCents ?? p.priceCents]);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${machine.name} rental`,
    description: machine.description ?? undefined,
    brand: { "@type": "Brand", name: "PONGBOT" },
    category: "AI tennis ball machine",
    ...(machine.imageUrl ? { image: absolute(machine.imageUrl) } : {}),
    ...(prices.length
      ? {
          offers: {
            "@type": "AggregateOffer",
            priceCurrency: "CAD",
            lowPrice: (Math.min(...prices) / 100).toFixed(2),
            highPrice: (Math.max(...prices) / 100).toFixed(2),
            offerCount: rentals.length,
            availability: machine.bookable ? "https://schema.org/InStock" : "https://schema.org/PreOrder",
            seller: { "@id": siteUrl("/#business") },
            url: siteUrl("/pricing"),
          },
        }
      : {}),
  };
}

export function faqPageLd(items: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((i) => ({
      "@type": "Question",
      name: i.q,
      acceptedAnswer: { "@type": "Answer", text: i.a },
    })),
  };
}
