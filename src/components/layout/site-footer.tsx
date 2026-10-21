import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/logo";
import { brand } from "@/config/brand";

export async function SiteFooter() {
  const t = await getTranslations();
  const columns = [
    {
      title: t("footer.explore"),
      links: [
        { href: "/machines", label: t("nav.machines") },
        { href: "/pricing", label: t("nav.pricing") },
        { href: "/group-sessions", label: t("nav.groups") },
      ],
    },
    {
      title: t("footer.help"),
      links: [
        { href: "/how-it-works", label: t("nav.howItWorks") },
        { href: "/how-it-works#faq", label: t("footer.faq") },
        { href: "/contact", label: t("nav.contact") },
        { href: "/account", label: t("nav.myBookings") },
      ],
    },
    {
      title: t("footer.legal"),
      links: [
        { href: "/terms", label: t("footer.terms") },
        { href: "/privacy", label: t("footer.privacy") },
      ],
    },
  ];
  return (
    <footer className="court-lines mt-24 bg-court text-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.5fr_repeat(3,1fr)]">
        <div className="space-y-4">
          <Logo inverted />
          <p className="max-w-xs text-sm text-white/75">{t("footer.blurb")}</p>
          <p className="text-sm text-white/75">
            <a className="hover:text-optic" href={`mailto:${brand.contact.email}`}>{brand.contact.email}</a>
            <br />
            <a className="hover:text-optic" href={`tel:${brand.contact.phone.replace(/[^+\d]/g, "")}`}>{brand.contact.phone}</a>
          </p>
        </div>
        {columns.map((col) => (
          <div key={col.title}>
            <h2 className="font-display text-lg font-bold tracking-wide text-optic uppercase">{col.title}</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-white/80 transition-colors hover:text-white">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-5 text-xs text-white/60 sm:flex-row sm:justify-between sm:px-6">
          <p>© {brand.name}. {t("footer.rights")}</p>
          <p>{t("footer.madeIn")}</p>
        </div>
      </div>
    </footer>
  );
}
