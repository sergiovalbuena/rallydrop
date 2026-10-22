import { siteOrigin } from "@/lib/site-url";
import type { Metadata, Viewport } from "next";
import { Big_Shoulders, Instrument_Sans } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { Providers } from "@/components/layout/providers";
import { Analytics } from "@/components/layout/analytics";
import { brand } from "@/config/brand";
import "./globals.css";

// Display: stadium-scoreboard condensed sans. Body: crisp humanist grotesk.
const body = Instrument_Sans({ variable: "--font-body", subsets: ["latin"], display: "swap" });
const display = Big_Shoulders({
  variable: "--font-scoreboard",
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: {
    default: `${brand.name} — AI tennis ball machine rental in ${brand.city}`,
    template: `%s · ${brand.name}`,
  },
  description:
    "Rent an AI tennis ball machine in Victoria, BC: the PONGBOT Aura S with a built-in AI coach. Delivered to your door or next to your court. Day, weekend, week and month rentals.",
  keywords: [
    "AI tennis ball machine",
    "ball machine rental Victoria BC",
    "tennis ball machine rental",
    "PONGBOT Aura S",
  ],
  openGraph: { siteName: brand.name, locale: "en_CA", type: "website" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f9fc" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1730" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${body.variable} ${display.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
          <Analytics />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
