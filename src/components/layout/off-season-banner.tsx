import { cacheLife, cacheTag } from "next/cache";
import { getTranslations } from "next-intl/server";
import { CloudRain } from "lucide-react";
import { isHighSeason } from "@/lib/domain/season";
import { SITE_INFO_TAG } from "@/lib/services/site-info";
import { getSettings } from "@/lib/services/settings";
import { toLocalDate } from "@/lib/time";
import { AutoHideNotice } from "./auto-hide-notice";

/** Re-checked hourly; saving Settings refreshes it too. */
async function offSeasonToday(): Promise<boolean> {
  "use cache";
  cacheTag(SITE_INFO_TAG);
  cacheLife("hours");
  const s = await getSettings();
  return !isHighSeason(toLocalDate(new Date()), { start: s.seasonStart, end: s.seasonEnd });
}

/** "Off-season prices — if it rains on your day, reschedule free." — floats in for ~5 s, once per visit. */
export async function OffSeasonBanner() {
  if (!(await offSeasonToday())) return null;
  const t = await getTranslations("rain");
  return (
    <AutoHideNotice id="off-season">
      <CloudRain className="size-4 shrink-0 text-optic" aria-hidden />
      {t("banner")}
    </AutoHideNotice>
  );
}
