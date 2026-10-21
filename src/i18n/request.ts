import { getRequestConfig } from "next-intl/server";

/**
 * The site ships in English only for now. To add Spanish later:
 * 1. add messages/es.json with the same keys,
 * 2. pick the locale here (cookie, Accept-Language or a [locale] segment).
 */
export const locales = ["en"] as const;
export const defaultLocale = "en";

export default getRequestConfig(async () => ({
  locale: defaultLocale,
  timeZone: "America/Vancouver",
  messages: (await import(`../../messages/${defaultLocale}.json`)).default,
}));
