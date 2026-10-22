/**
 * The site's public origin: NEXT_PUBLIC_SITE_URL when set (your own domain),
 * otherwise the Vercel production domain, otherwise localhost.
 */
export function siteOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit && !explicit.includes("localhost")) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;
  return (explicit ?? "http://localhost:3000").replace(/\/$/, "");
}

export function siteUrl(path = ""): string {
  return `${siteOrigin()}${path}`;
}
