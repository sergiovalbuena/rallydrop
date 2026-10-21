import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AtSign, Mail, MapPin, Phone } from "lucide-react";
import { PageHero, Section } from "@/components/marketing/section";
import { revealDelay } from "@/components/marketing/reveal-delay";
import { brand } from "@/config/brand";

export const metadata: Metadata = { title: "Contact" };

export default async function ContactPage() {
  const t = await getTranslations("contact");
  const items = [
    { icon: Mail, label: t("email"), value: brand.contact.email, href: `mailto:${brand.contact.email}` },
    {
      icon: Phone,
      label: t("phone"),
      value: brand.contact.phone,
      href: `tel:${brand.contact.phone.replace(/[^+\d]/g, "")}`,
    },
    { icon: AtSign, label: t("instagram"), value: "@rallydrop", href: brand.contact.instagram },
    { icon: MapPin, label: t("area"), value: t("areaBody") },
  ];
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
