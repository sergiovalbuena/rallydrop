import { getRequestConfig } from "next-intl/server";
import { getSiteOverrides } from "@/lib/services/site-content";

/**
 * The site ships in English only for now. To add Spanish later:
 * 1. add messages/es.json with the same keys,
 * 2. pick the locale here (cookie, Accept-Language or a [locale] segment).
 * Texts edited in Admin → Settings override the JSON files.
 */
export const locales = ["en"] as const;
export const defaultLocale = "en";

type Messages = { [key: string]: string | Messages };

function setDeep(target: Messages, path: string, value: string) {
  const parts = path.split(".");
  let node: Messages = target;
  for (const part of parts.slice(0, -1)) {
    const next = node[part];
    if (typeof next !== "object") return; // unknown key — ignore
    node = next;
  }
  const leaf = parts.at(-1)!;
  if (typeof node[leaf] === "string") node[leaf] = value;
}

export default getRequestConfig(async () => {
  const locale = defaultLocale;
  const base = (await import(`../../messages/${locale}.json`)).default as Messages;
  const messages = structuredClone(base);
  for (const [key, value] of Object.entries(await getSiteOverrides(locale))) setDeep(messages, key, value);
  return { locale, timeZone: "America/Vancouver", messages };
});
