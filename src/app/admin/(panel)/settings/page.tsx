import { connection } from "next/server";
import { CourtRow, SettingsForm, SiteTextsForm } from "@/components/admin/settings-forms";
import { PageHeader, Panel } from "@/components/admin/ui";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/services/settings";
import { EDITABLE_KEYS } from "@/lib/services/site-content";
import en from "../../../../../messages/en.json";

/** Internal admin: always rendered per request, no instant-navigation shell. */
export const instant = false;

type Messages = { [k: string]: string | Messages };

function lookup(messages: Messages, key: string): string {
  const v = key.split(".").reduce<string | Messages | undefined>((node, part) => (typeof node === "object" ? node[part] : undefined), messages);
  return typeof v === "string" ? v : "";
}

export default async function SettingsPage() {
  await connection();
  const [settings, courts, overrides] = await Promise.all([
    getSettings(),
    db.court.findMany({ orderBy: { sortOrder: "asc" } }),
    db.siteContent.findMany({ where: { locale: "en" } }),
  ]);
  const mm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  return (
    <>
      <PageHeader title="Settings" />
      <div className="space-y-6">
        <Panel title="Booking rules, taxes & delivery">
          <SettingsForm
            s={{
              gstPercent: settings.gstBps / 100,
              pstPercent: settings.pstBps / 100,
              bufferMinutes: settings.bufferMinutes,
              holdMinutes: settings.holdMinutes,
              minLeadTimeHours: settings.minLeadTimeHours,
              maxAdvanceDays: settings.maxAdvanceDays,
              depositAuthMaxDays: settings.depositAuthMaxDays,
              depositAuthLeadHours: settings.depositAuthLeadHours,
              cancelFullRefundHours: settings.cancelFullRefundHours,
              cancelLatePercent: settings.cancelLateRefundBps / 100,
              deliveryStart: mm(settings.deliveryStartMinute),
              deliveryEnd: mm(settings.deliveryEndMinute),
              freeDeliveryCenterLat: settings.freeDeliveryCenterLat,
              freeDeliveryCenterLng: settings.freeDeliveryCenterLng,
              freeDeliveryRadiusKm: settings.freeDeliveryRadiusKm,
              seasonStartMonth: settings.seasonStartMonth,
              seasonEndMonth: settings.seasonEndMonth,
              allowOffSeason: settings.allowOffSeason,
              smsEnabled: settings.smsEnabled,
              contactEmail: settings.contactEmail ?? "",
              contactPhone: settings.contactPhone ?? "",
            }}
          />
        </Panel>
        <Panel title="Courts (delivery list)">
          <div className="space-y-3">
            {courts.map((c) => (
              <CourtRow key={c.id} court={{ id: c.id, name: c.name, address: c.address, lat: Number(c.lat), lng: Number(c.lng), active: c.active }} />
            ))}
            <CourtRow court={null} />
          </div>
        </Panel>
        <Panel title="Site texts">
          <SiteTextsForm
            fields={EDITABLE_KEYS.map((f) => ({
              ...f,
              defaultValue: lookup(en as Messages, f.key),
              value: overrides.find((o) => o.key === f.key)?.value ?? null,
            }))}
          />
        </Panel>
      </div>
    </>
  );
}
