import { brand } from "@/config/brand";

const formatter = new Intl.NumberFormat(brand.locale, {
  style: "currency",
  currency: brand.currency.toUpperCase(),
});

/** 4500 → "$45.00" */
export function formatCents(cents: number): string {
  return formatter.format(cents / 100);
}

/** 4500 → "$45" (drops ".00" for whole dollars; used in marketing copy). */
export function formatCentsShort(cents: number): string {
  if (cents % 100 === 0) {
    return new Intl.NumberFormat(brand.locale, {
      style: "currency",
      currency: brand.currency.toUpperCase(),
      maximumFractionDigits: 0,
    }).format(cents / 100);
  }
  return formatCents(cents);
}

/** Percentage of an amount in basis points, rounded half-up to the cent. */
export function applyBps(cents: number, bps: number): number {
  return Math.round((cents * bps) / 10_000);
}

/** "12.5" (dollars, from a form) → 1250. Returns null when invalid. */
export function dollarsToCents(input: string): number | null {
  const n = Number(input.replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export function bpsToPercent(bps: number): string {
  return (bps / 100).toFixed(bps % 100 === 0 ? 0 : 2);
}
