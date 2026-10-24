import "server-only";
import { Resend } from "resend";
import { db } from "@/lib/db";
import type { EmailContent } from "./templates";

let resend: Resend | null = null;

/**
 * Sends a transactional email through Resend. Without RESEND_API_KEY (local
 * dev) the email is printed to the server log instead. `dedupeKey` makes
 * retries safe: the same key is never sent twice.
 */
export async function sendEmail(input: {
  to: string;
  content: EmailContent;
  template: string;
  dedupeKey?: string;
  /** Where replies go (e.g. the visitor who used the contact form). */
  replyTo?: string;
}): Promise<void> {
  if (input.dedupeKey) {
    const already = await db.notificationLog.findUnique({ where: { dedupeKey: input.dedupeKey } });
    if (already && !already.error) return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  let providerId: string | null = null;
  let error: string | null = null;

  if (!apiKey) {
    console.info(`[email:dev] to=${input.to} subject="${input.content.subject}"\n${input.content.text}`);
  } else {
    resend ??= new Resend(apiKey);
    const result = await resend.emails.send({
      from: process.env.EMAIL_FROM ?? "RallyDrop <onboarding@resend.dev>",
      to: input.to,
      ...(input.replyTo ? { replyTo: input.replyTo } : {}),
      subject: input.content.subject,
      html: input.content.html,
      text: input.content.text,
    });
    providerId = result.data?.id ?? null;
    error = result.error ? `${result.error.name}: ${result.error.message}` : null;
    if (error) console.error(`[email] failed to=${input.to}: ${error}`);
  }

  await db.notificationLog.upsert({
    where: { dedupeKey: input.dedupeKey ?? `nodedupe:${crypto.randomUUID()}` },
    update: { providerId, error },
    create: {
      channel: "EMAIL",
      template: input.template,
      to: input.to,
      dedupeKey: input.dedupeKey ?? null,
      providerId,
      error,
    },
  });
}
