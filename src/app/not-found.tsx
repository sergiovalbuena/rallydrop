import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default async function NotFound() {
  const t = await getTranslations("common");
  return (
    <main className="court-lines flex flex-1 flex-col items-center justify-center gap-6 bg-court px-4 py-24 text-center text-white">
      <LogoMark className="size-20" />
      <h1 className="font-display text-6xl font-extrabold uppercase">{t("notFoundTitle")}</h1>
      <p className="max-w-md text-white/80">{t("notFoundBody")}</p>
      <Button asChild variant="accent" size="lg">
        <Link href="/">{t("home")}</Link>
      </Button>
    </main>
  );
}
