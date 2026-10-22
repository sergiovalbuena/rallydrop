import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/logo";
import { brand } from "@/config/brand";
import { getSiteInfo } from "@/lib/services/site-info";

export async function SiteFooter() {
  const t = await getTranslations();
  const site = await getSiteInfo();
  const columns = [
    {
      title: t("footer.explore"),
      links: [
        { href: "/machines", label: t("nav.machines") },
        { href: "/pricing", label: t("nav.pricing") },
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
        { href: "/waiver", label: t("footer.waiver") },
        { href: "/privacy", label: t("footer.privacy") },
      ],
    },
  ];
  return (
    <footer className="court-lines mt-24 bg-court text-white print:hidden">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.5fr_repeat(3,1fr)]">
        <div className="space-y-4">
          <Logo inverted />
          <p className="max-w-xs text-sm text-white/75">{t("footer.blurb")}</p>
          {(site.email || site.phone) && (
            <p className="text-sm text-white/75">
              {site.email && (
                <a className="block hover:text-optic" href={`mailto:${site.email}`}>
                  {site.email}
                </a>
              )}
              {site.phone && site.phoneHref && (
                <a className="block hover:text-optic" href={site.phoneHref}>
                  {site.phone}
                </a>
              )}
            </p>
          )}
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
          <p>
            © {brand.name}. {t("footer.rights")}
          </p>
          {(site.insured || site.licence) && (
            <p>
              {[
                site.insured && t("footer.insured"),
                site.licence &&
                  t("footer.licence", {
                    municipality: site.licence.municipality ?? "City of Victoria",
                    number: site.licence.number,
                  }),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          <p>{t("footer.madeIn")}</p>
        </div>
      </div>
    </footer>
  );
}
