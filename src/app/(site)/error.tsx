"use client";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("common");
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 py-24 text-center">
      <h1 className="font-display text-4xl font-extrabold uppercase">{t("errorTitle")}</h1>
      <p className="text-muted-foreground">{t("errorBody")}</p>
      <Button onClick={reset}>
        <RotateCcw /> {t("tryAgain")}
      </Button>
    </div>
  );
}
