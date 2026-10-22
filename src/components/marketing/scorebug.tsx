import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { formatCentsShort } from "@/lib/money";
import { nextAvailableSlot } from "@/lib/services/availability";
import { listActiveProducts } from "@/lib/services/catalog";
import { databaseConfigured } from "@/lib/services/fallback";
import { getSettings } from "@/lib/services/settings";
import { formatLocal } from "@/lib/time";

/** TV-style score overlay with live data: next free slot, price, delivery zone. */
export async function Scorebug() {
  await connection();
  const t = await getTranslations("home");
  const [settings, products] = await Promise.all([getSettings(), listActiveProducts()]);
  const day = products.find((p) => p.kind === "DAY");
  const slot =
    day && databaseConfigured()
      ? await nextAvailableSlot({ product: day, settings, now: new Date() }).catch(() => null)
      : null;
  return (
    <ScorebugFrame
      cells={[
        {
          label: t("nextAvailable"),
          value: slot ? formatLocal(slot.start, "EEE d MMM") : t("nextNone"),
          sub: slot ? formatLocal(slot.start, "h:mm a") : undefined,
          live: !!slot,
        },
        { label: t("fromLabel"), value: day ? formatCentsShort(day.priceCents) : "—", sub: "CAD" },
        {
          label: t("zoneLabel"),
          value: t("zoneValue", { price: formatCentsShort(settings.deliveryZones[0]?.tripCents ?? 1500) }),
          sub: t("zoneSub"),
        },
      ]}
    />
  );
}

export function ScorebugFrame({ cells }: { cells: { label: string; value: string; sub?: string; live?: boolean }[] }) {
  return (
    <dl className="grid grid-cols-3 overflow-hidden rounded-xl border border-white/15 bg-black/25 backdrop-blur-sm">
      {cells.map((c, i) => (
        <div
          key={c.label}
          className={i > 0 ? "min-w-0 border-l border-white/15 px-3 py-2.5 sm:px-4" : "min-w-0 px-3 py-2.5 sm:px-4"}
        >
          <dt className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.14em] text-white/60 uppercase sm:text-[11px]">
            {c.live && (
              <span className="relative flex size-2" aria-hidden>
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-optic opacity-60 motion-reduce:animate-none" />
                <span className="relative inline-flex size-2 rounded-full bg-optic" />
              </span>
            )}
            {c.label}
          </dt>
          {/* Values may wrap (long copy, narrow phones) instead of spilling out of the cell. */}
          <dd className="tabular mt-1 font-display text-lg leading-[0.95] font-extrabold text-balance break-words text-white uppercase sm:text-2xl">
            {c.value}
            {c.sub && <span className="mt-0.5 block text-sm leading-tight font-bold text-optic">{c.sub}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function ScorebugSkeleton() {
  return (
    <ScorebugFrame
      cells={[
        { label: "Next available", value: "···" },
        { label: "Day rental from", value: "···" },
        { label: "Drop-off", value: "···" },
      ]}
    />
  );
}
