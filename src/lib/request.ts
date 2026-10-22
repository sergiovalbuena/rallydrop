/** Client IP from proxy headers (Vercel sets x-forwarded-for / x-real-ip). */
export function clientIp(h: Headers): string | null {
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim() || null;
  return h.get("x-real-ip");
}
