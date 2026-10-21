import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { MobileNav } from "./mobile-nav";
import { NavLinks } from "./nav-links";
import { ThemeToggle } from "./theme-toggle";

export async function SiteHeader() {
  const t = await getTranslations();
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:absolute focus:top-2 focus:left-2"
      >
        {t("common.skipToContent")}
      </a>
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" aria-label={`${t("common.home")}`} className="shrink-0">
          <Logo />
        </Link>
        <NavLinks className="ml-4 hidden items-center gap-1 md:flex" />
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <Button asChild variant="ghost" className="hidden sm:inline-flex">
            <Link href="/account">{t("nav.myBookings")}</Link>
          </Button>
          <Button asChild className="hidden sm:inline-flex">
            <Link href="/book">{t("common.bookNow")}</Link>
          </Button>
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
