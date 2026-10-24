"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, RotateCcw } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("common");
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="court-lines floodlight flex flex-col items-center gap-5 bg-court px-4 py-24 text-center text-white">
      <LogoMark className="size-16" />
      <h1 className="font-display text-5xl font-extrabold uppercase">{t("errorTitle")}</h1>
      <p className="max-w-md text-white/80">{t("errorBody")}</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button variant="accent" size="lg" onClick={reset}>
          <RotateCcw /> {t("tryAgain")}
        </Button>
        <Button asChild variant="inverted" size="lg">
          <Link href="/book">
            {t("bookNow")} <ArrowRight />
          </Link>
        </Button>
      </div>
      <Link href="/contact" className="text-sm text-white/70 underline hover:text-white">
        {t("contactUs")}
      </Link>
    </div>
  );
}
