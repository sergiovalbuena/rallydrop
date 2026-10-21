import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { Providers } from "@/components/layout/providers";
import { brand } from "@/config/brand";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const barlow = Barlow_Condensed({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: `${brand.name} — Ball machine rentals in ${brand.city}`,
    template: `%s · ${brand.name}`,
  },
  description:
    "Rent a smart tennis & pickleball ball machine in Victoria, BC. Delivered to your court or door. Day, weekend, week and month rentals.",
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
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${barlow.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
