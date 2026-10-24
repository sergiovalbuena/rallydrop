"use server";

import { z } from "zod";
import { sendEmail } from "@/lib/notify/email";
import { contactMessageEmail } from "@/lib/notify/templates";
import { getSiteInfo } from "@/lib/services/site-info";

const schema = z
  .object({
    name: z.string().trim().min(1, "Tell us your name.").max(80),
    contact: z.string().trim().min(3, "Add an email or phone number so we can reply.").max(120),
    message: z.string().trim().min(5, "Write a short message.").max(4000),
    /** Honeypot: real people never see or fill this field. */
    website: z.string().max(0).optional(),
  })
  .transform((d) => {
    const isEmail = z.email().safeParse(d.contact).success;
    const digits = d.contact.replace(/\D/g, "");
    return { ...d, email: isEmail ? d.contact : null, phone: !isEmail && digits.length >= 7 ? d.contact : null };
  })
  .refine((d) => d.email || d.phone, { message: "Enter a valid email or phone number.", path: ["contact"] });

export type ContactState = {
  status: "idle" | "done" | "error";
  message?: string;
  /** What the visitor typed, so an error doesn't wipe the form. */
  values?: { name: string; contact: string; message: string };
};

/** Contact form → an email to the owner (Settings contact email, else ADMIN_ALERT_EMAIL). */
export async function sendContactAction(_: ContactState, formData: FormData): Promise<ContactState> {
  const raw = Object.fromEntries(formData);
  const values = {
    name: String(raw.name ?? ""),
    contact: String(raw.contact ?? ""),
    message: String(raw.message ?? ""),
  };
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    // Bots get a fake success so they don't retry.
    if (parsed.error.issues.some((i) => i.path[0] === "website")) return { status: "done" };
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Check the form.", values };
  }
  const site = await getSiteInfo();
  const to = site.email ?? process.env.ADMIN_ALERT_EMAIL;
  if (!to) {
    return { status: "error", message: "Messages aren't set up yet — please try again soon.", values };
  }
  const d = parsed.data;
  try {
    await sendEmail({
      to,
      template: "contact",
      replyTo: d.email ?? undefined,
      content: contactMessageEmail({ name: d.name, email: d.email, phone: d.phone, message: d.message }),
    });
    return { status: "done" };
  } catch (e) {
    console.error("contact form", e);
    return { status: "error", message: "We couldn't send that. Please try again.", values };
  }
}
