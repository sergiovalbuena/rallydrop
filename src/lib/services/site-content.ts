import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";

export const SITE_CONTENT_TAG = "site-content";

/**
 * Admin-edited copy that overrides keys from messages/<locale>.json.
 * Cached and invalidated with updateTag(SITE_CONTENT_TAG) when the admin saves.
 */
export async function getSiteOverrides(locale: string): Promise<Record<string, string>> {
  "use cache";
  cacheTag(SITE_CONTENT_TAG);
  cacheLife("hours");
  try {
    const rows = await db.siteContent.findMany({ where: { locale } });
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  } catch {
    // No database (e.g. building without DATABASE_URL): fall back to the files.
    return {};
  }
}

/** Keys the owner can edit from Admin → Settings → Site texts. */
export const EDITABLE_KEYS = [
  { key: "site.announcement", label: "Announcement banner (empty = hidden)", multiline: false },
  { key: "home.eyebrow", label: "Home · small line above the title", multiline: false },
  { key: "home.heroTitleA", label: "Home · title, first line", multiline: false },
  { key: "home.heroTitleB", label: "Home · title, highlighted line", multiline: false },
  { key: "home.heroBody", label: "Home · intro paragraph", multiline: true },
  { key: "home.ctaTitle", label: "Home · final call-to-action title", multiline: false },
  { key: "home.ctaBody", label: "Home · final call-to-action text", multiline: true },
  { key: "how.rainBody", label: "How it works · rain policy", multiline: true },
  { key: "how.deliveryBody", label: "How it works · delivery ({fee} = delivery price)", multiline: true },
  { key: "contact.subtitle", label: "Contact · intro", multiline: true },
  { key: "footer.blurb", label: "Footer · description", multiline: true },
] as const;
