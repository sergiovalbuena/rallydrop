import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page not found", robots: { index: false } };

export default async function NotFound() {
  const t = await getTranslations("common");
  return (
    <main className="court-lines floodlight flex flex-1 flex-col items-center justify-center gap-6 bg-court px-4 py-24 text-center text-white">
      <LogoMark className="size-20" />
      <p className="font-display text-sm font-bold tracking-[0.3em] text-optic uppercase">
        404 · {t("notFoundEyebrow")}
      </p>
      <h1 className="font-display text-6xl font-extrabold uppercase">{t("notFoundTitle")}</h1>
      <p className="max-w-md text-white/80">{t("notFoundBody")}</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild variant="accent" size="lg">
          <Link href="/book">
            {t("bookNow")} <ArrowRight />
          </Link>
        </Button>
        <Button asChild variant="inverted" size="lg">
          <Link href="/">{t("home")}</Link>
        </Button>
      </div>
    </main>
  );
}
