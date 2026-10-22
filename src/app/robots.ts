import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Private or one-off pages: admin, portal, signed links, confirmations.
      disallow: ["/admin", "/account", "/accept/", "/deposit/", "/api/", "/book/confirmation/", "/legal/"],
    },
    sitemap: siteUrl("/sitemap.xml"),
  };
}
