import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AtSign, Mail, MapPin, Phone } from "lucide-react";
import { PageHero, Section } from "@/components/marketing/section";
import { revealDelay } from "@/components/marketing/reveal-delay";
import { getSiteInfo } from "@/lib/services/site-info";

export const metadata: Metadata = { title: "Contact" };

export default async function ContactPage() {
  const t = await getTranslations("contact");
  const site = await getSiteInfo();
  // Only details the owner has filled in (Admin → Settings) are shown.
  const items = [
    site.email && { icon: Mail, label: t("email"), value: site.email, href: `mailto:${site.email}` },
    site.phone && { icon: Phone, label: t("phone"), value: site.phone, href: site.phoneHref ?? undefined },
    site.instagramUrl && {
      icon: AtSign,
      label: t("instagram"),
      value: site.instagramUrl.replace(/^https?:\/\/(www\.)?instagram\.com\//, "@").replace(/\/$/, ""),
      href: site.instagramUrl,
    },
    { icon: MapPin, label: t("area"), value: site.hubAddress ? `${t("areaBody")} ${site.hubAddress}` : t("areaBody") },
  ].filter((i): i is Exclude<typeof i, string | null | false> => !!i);
  return (
    <>
      <PageHero title={t("title")} subtitle={t("subtitle")} />
      <Section>
        <ul className="grid gap-4 sm:grid-cols-2">
          {items.map((item, i) => (
            <li
              key={item.label}
              data-reveal
              style={revealDelay(i)}
              className="flex gap-4 rounded-2xl border bg-card p-6"
            >
              <item.icon className="size-6 shrink-0 text-primary" aria-hidden />
              <div>
                <p className="text-sm text-muted-foreground">{item.label}</p>
                {item.href ? (
                  <a href={item.href} className="text-lg font-semibold hover:text-primary">
                    {item.value}
                  </a>
                ) : (
                  <p className="text-lg font-semibold">{item.value}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
