import { getTranslations } from "next-intl/server";

/** Broadcast-style ticker band. Pauses for users who prefer reduced motion. */
export async function Ticker() {
  const t = await getTranslations("home");
  const items = [t("ticker1"), t("ticker2"), t("ticker3"), t("ticker4"), t("ticker5"), t("ticker6")];
  const row = (hidden: boolean) => (
    <ul className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {items.map((item) => (
        <li
          key={item}
          className="flex items-center gap-6 pr-6 font-display text-lg font-extrabold tracking-wide whitespace-nowrap uppercase"
        >
          {item}
          <span className="inline-block size-2.5 rounded-full bg-court" aria-hidden />
        </li>
      ))}
    </ul>
  );
  return (
    <div className="overflow-hidden border-y border-court/10 bg-accent py-2.5 text-accent-foreground">
      <div className="animate-marquee flex w-max motion-reduce:animate-none">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}
