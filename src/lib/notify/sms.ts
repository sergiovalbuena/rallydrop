import "server-only";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/services/settings";

/** True when SMS is switched on in Admin → Settings AND Twilio is configured. */
export async function smsEnabled(): Promise<boolean> {
  const configured =
    !!process.env.TWILIO_ACCOUNT_SID && !!process.env.TWILIO_AUTH_TOKEN && !!process.env.TWILIO_FROM_NUMBER;
  if (!configured) return false;
  return (await getSettings()).smsEnabled;
}

/** Sends an SMS via Twilio's REST API (no SDK needed). No-op when disabled. */
export async function sendSms(input: { to: string; body: string; template: string; dedupeKey?: string }) {
  if (!(await smsEnabled())) return;
  if (input.dedupeKey && (await db.notificationLog.findUnique({ where: { dedupeKey: input.dedupeKey } }))) return;

  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  let providerId: string | null = null;
  let error: string | null = null;
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: input.to, From: process.env.TWILIO_FROM_NUMBER!, Body: input.body }),
    });
    const json = (await res.json()) as { sid?: string; message?: string };
    if (res.ok) providerId = json.sid ?? null;
    else error = json.message ?? `HTTP ${res.status}`;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  await db.notificationLog.create({
    data: {
      channel: "SMS",
      template: input.template,
      to: input.to,
      dedupeKey: input.dedupeKey ?? null,
      providerId,
      error,
    },
  });
}
