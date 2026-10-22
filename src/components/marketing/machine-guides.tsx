import { getTranslations } from "next-intl/server";
import { Activity, Eye, Megaphone, ScanEye, Trophy } from "lucide-react";
import { revealDelay } from "./reveal-delay";
import { SectionHeading } from "./section";

/** /machines: what the Spotter AI camera does, in four benefits. */
export async function AiCameraBenefits() {
  const t = await getTranslations("machines");
  const items = [
    { icon: Eye, title: t("aiF1Title"), body: t("aiF1Body") },
    { icon: Megaphone, title: t("aiF2Title"), body: t("aiF2Body") },
    { icon: Activity, title: t("aiF3Title"), body: t("aiF3Body") },
    { icon: Trophy, title: t("aiF4Title"), body: t("aiF4Body") },
  ];
  return (
    <div>
      <SectionHeading title={t("aiSectionTitle")} subtitle={t("aiSectionSubtitle")} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((it, i) => (
          <div key={it.title} data-reveal style={revealDelay(i)} className="rounded-2xl border bg-card p-6">
            <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <it.icon className="size-5" aria-hidden />
            </span>
            <h3 className="mt-4 font-display text-xl font-extrabold uppercase">{it.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{it.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** /machines: "Is it right for my level?" — three levels, NTRP up to 4.5. */
export async function LevelGuide() {
  const t = await getTranslations("machines");
  const levels = [
    { title: t("levelBeginnerTitle"), body: t("levelBeginnerBody"), bars: 1 },
    { title: t("levelIntermediateTitle"), body: t("levelIntermediateBody"), bars: 2 },
    { title: t("levelAdvancedTitle"), body: t("levelAdvancedBody"), bars: 3 },
  ];
  return (
    <div>
      <SectionHeading title={t("levelTitle")} subtitle={t("levelSubtitle")} />
      <div className="grid gap-4 md:grid-cols-3">
        {levels.map((l, i) => (
          <div key={l.title} data-reveal style={revealDelay(i, 110)} className="rounded-2xl border bg-card p-6">
            <span className="flex items-end gap-1" aria-hidden>
              {[1, 2, 3].map((n) => (
                <span
                  key={n}
                  className={n <= l.bars ? "w-2.5 rounded-sm bg-accent" : "w-2.5 rounded-sm bg-muted"}
                  style={{ height: `${n * 8 + 4}px` }}
                />
              ))}
            </span>
            <h3 className="mt-4 font-display text-2xl font-extrabold uppercase">{l.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{l.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Home: "Your AI coach, included" — the Spotter as a practice assistant. */
export async function AiCoachIncluded() {
  const t = await getTranslations("aiCoach");
  const items = [
    { icon: ScanEye, title: t("swingTitle"), body: t("swingBody") },
    { icon: Megaphone, title: t("voiceTitle"), body: t("voiceBody") },
    { icon: Activity, title: t("moveTitle"), body: t("moveBody") },
    { icon: Trophy, title: t("refTitle"), body: t("refBody") },
  ];
  return (
    <div>
      <SectionHeading eyebrow={t("eyebrow")} title={t("title")} subtitle={t("subtitle")} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((it, i) => (
          <div
            key={it.title}
            data-reveal
            style={revealDelay(i)}
            className="court-lines rounded-2xl bg-court p-6 text-white"
          >
            <span className="flex size-11 items-center justify-center rounded-xl bg-optic text-court">
              <it.icon className="size-5" aria-hidden />
            </span>
            <h3 className="mt-4 font-display text-xl font-extrabold uppercase">{it.title}</h3>
            <p className="mt-2 text-sm text-white/80">{it.body}</p>
          </div>
        ))}
      </div>
      <p className="mt-5 text-sm text-muted-foreground">{t("disclaimer")}</p>
    </div>
  );
}

/** One line for /machines and pricing. */
export async function AiCoachLine() {
  const t = await getTranslations("aiCoach");
  return (
    <p className="inline-flex items-center gap-2 rounded-full bg-optic px-4 py-1.5 text-sm font-semibold text-court">
      <ScanEye className="size-4" aria-hidden /> {t("line")}
    </p>
  );
}
