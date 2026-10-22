import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Lock, Phone } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { getSiteInfo } from "@/lib/services/site-info";

/** Focused checkout: no site navigation or footer to pull people out of the booking. */
export default async function CheckoutLayout({ children }: LayoutProps<"/">) {
  const t = await getTranslations("checkout");
  const site = await getSiteInfo();
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:h-16 sm:px-6">
          <Link href="/" aria-label={t("backHome")} className="shrink-0">
            <Logo className="[&_svg]:size-8 [&>span>span]:text-xl" />
          </Link>
          <span className="ml-2 hidden items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success sm:inline-flex">
            <Lock className="size-3.5" aria-hidden /> {t("secure")}
          </span>
          <div className="ml-auto flex items-center gap-1">
            {site.phone && site.phoneHref && (
              <>
                <a
                  href={site.phoneHref}
                  className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground sm:inline-flex"
                >
                  <Phone className="size-4" aria-hidden /> {t("help")} {site.phone}
                </a>
                <a
                  href={site.phoneHref}
                  aria-label={t("help")}
                  className="inline-flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary sm:hidden"
                >
                  <Phone className="size-5" aria-hidden />
                </a>
              </>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main id="main" className="flex-1">
        {children}
      </main>
    </>
  );
}
