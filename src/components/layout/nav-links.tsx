"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export const NAV = [
  { href: "/machines", key: "machines" },
  { href: "/pricing", key: "pricing" },
  { href: "/group-sessions", key: "groups" },
  { href: "/how-it-works", key: "howItWorks" },
  { href: "/contact", key: "contact" },
] as const;

type Props = { className?: string; onNavigate?: () => void };

/** Main navigation. The active-link highlight streams in (pathname is request data). */
export function NavLinks(props: Props) {
  return (
    <Suspense fallback={<Links {...props} pathname={null} />}>
      <ActiveLinks {...props} />
    </Suspense>
  );
}

function ActiveLinks(props: Props) {
  return <Links {...props} pathname={usePathname()} />;
}

function Links({ className, onNavigate, pathname }: Props & { pathname: string | null }) {
  const t = useTranslations("nav");
  return (
    <nav aria-label="Main" className={className}>
      {NAV.map((item) => {
        const active = !!pathname?.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-full px-3 py-2 text-sm font-medium transition-colors hover:text-primary",
              active ? "text-primary" : "text-foreground/80",
            )}
          >
            {t(item.key)}
          </Link>
        );
      })}
    </nav>
  );
}
