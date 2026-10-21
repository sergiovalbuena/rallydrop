import { getTranslations } from "next-intl/server";
import { Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { brand } from "@/config/brand";

/** Shown instead of a checkout while online booking can't run (no database yet). */
export async function BookingUnavailable() {
  const t = await getTranslations("book");
  return (
    <div className="court-lines floodlight grain overflow-hidden rounded-3xl bg-court p-8 text-white sm:p-12">
      <h2 className="font-display text-4xl leading-[0.9] font-black uppercase sm:text-5xl">{t("unavailableTitle")}</h2>
      <p className="mt-4 max-w-xl text-lg text-white/80">{t("unavailableBody")}</p>
      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg" variant="accent">
          <a href={`tel:${brand.contact.phone.replace(/[^\d+]/g, "")}`}>
            <Phone /> {brand.contact.phone}
          </a>
        </Button>
        <Button asChild size="lg" variant="inverted">
          <a href={`mailto:${brand.contact.email}`}>
            <Mail /> {brand.contact.email}
          </a>
        </Button>
      </div>
    </div>
  );
}
