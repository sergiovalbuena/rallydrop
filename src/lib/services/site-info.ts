import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { readOr } from "./fallback";

export const SITE_INFO_TAG = "site-info";

export type SiteInfo = {
  email: string | null;
  phone: string | null;
  /** "tel:" href for the phone, digits only. */
  phoneHref: string | null;
  domain: string | null;
  hubAddress: string | null;
  instagramUrl: string | null;
  /** True when the owner filled in a liability insurance provider. */
  insured: boolean;
  licence: { number: string; municipality: string | null } | null;
};

/**
 * Public business details from Admin → Settings. Anything left blank is
 * null and simply not shown on the site. Cached; saving settings
 * invalidates it with updateTag(SITE_INFO_TAG).
 */
export async function getSiteInfo(): Promise<SiteInfo> {
  "use cache";
  cacheTag(SITE_INFO_TAG);
  cacheLife("hours");
  const s = await readOr(
    "site info",
    () => db.settings.findUnique({ where: { id: "default" } }),
    () => null,
  ).catch(() => null);
  const clean = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);
  const phone = clean(s?.contactPhone);
  return {
    email: clean(s?.contactEmail),
    phone,
    phoneHref: phone ? `tel:${phone.replace(/[^+\d]/g, "")}` : null,
    domain: clean(s?.siteDomain),
    hubAddress: clean(s?.hubAddress),
    instagramUrl: clean(s?.instagramUrl),
    insured: !!clean(s?.insuranceProvider),
    licence: clean(s?.businessLicenceNumber)
      ? { number: clean(s?.businessLicenceNumber)!, municipality: clean(s?.businessLicenceMunicipality) }
      : null,
  };
}
