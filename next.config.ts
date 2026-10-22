import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
      // Manufacturer product photos (Pongbot's Shopify store).
      { protocol: "https", hostname: "cdn.shopify.com" },
      { protocol: "https", hostname: "store.pongbotsports.com" },
    ],
  },
};

export default withNextIntl(nextConfig);
