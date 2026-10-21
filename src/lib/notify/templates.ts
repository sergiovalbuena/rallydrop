import { brand } from "@/config/brand";
import { formatCents } from "@/lib/money";
import { siteUrl } from "@/lib/site-url";
import { formatRange, formatSlot } from "@/lib/time";

/*
 * Transactional email templates. Plain functions returning HTML + text so
 * they work with any provider and are trivial to test. Inline styles only —
 * email clients ignore stylesheets.
 */

export type EmailContent = { subject: string; html: string; text: string };

const NAVY = "#0E2350";
const BLUE = "#2457E6";
const OPTIC = "#D9F23F";

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function layout(title: string, bodyHtml: string, cta?: { label: string; url: string }): string {
  const button = cta
    ? `<p style="margin:28px 0"><a href="${cta.url}" style="background:${BLUE};color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:600;display:inline-block">${esc(cta.label)}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f4f6fb;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;color:#13203d">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden">
<tr><td style="background:${NAVY};padding:22px 28px;color:#fff;font-size:22px;font-weight:800;letter-spacing:1px;text-transform:uppercase">
<span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${OPTIC};margin-right:8px"></span>Rally<span style="color:${OPTIC}">Drop</span></td></tr>
<tr><td style="height:5px;background:${OPTIC}"></td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 16px;font-size:26px;line-height:1.1;text-transform:uppercase;color:${NAVY}">${esc(title)}</h1>
${bodyHtml}${button}
<p style="margin-top:28px;font-size:13px;color:#5b6784">Questions? Reply to this email or call ${esc(brand.contact.phone)}.</p>
</td></tr></table>
<p style="font-size:12px;color:#8a94ad;margin-top:16px">${esc(brand.name)} · ${esc(brand.city)}</p>
</td></tr></table></body></html>`;
}

function rows(items: [string, string][]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:15px">${items
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 0;color:#5b6784;border-bottom:1px solid #eef1f7">${esc(k)}</td><td style="padding:8px 0;text-align:right;font-weight:600;border-bottom:1px solid #eef1f7">${esc(v)}</td></tr>`,
    )
    .join("")}</table>`;
}

export type BookingEmailData = {
  code: string;
  customerName: string;
  productName: string;
  machineName: string;
  startsAt: Date;
  endsAt: Date;
  where: string;
  lines: { label: string; cents: number }[];
  subtotalCents: number;
  gstCents: number;
  pstCents: number;
  totalCents: number;
  depositCents: number;
  depositNote: string;
  receiptUrl?: string | null;
};

export function bookingConfirmedEmail(d: BookingEmailData): EmailContent {
  const manageUrl = siteUrl("/account");
  const summary = rows([
    ["Booking code", d.code],
    ["Machine", d.machineName],
    ["Rental", d.productName],
    ["Drop-off", formatSlot(d.startsAt)],
    ["Pickup", formatSlot(d.endsAt)],
    ["Where", d.where],
  ]);
  const receipt = rows([
    ...d.lines.map((l): [string, string] => [l.label, formatCents(l.cents)]),
    ["GST", formatCents(d.gstCents)],
    ["PST", formatCents(d.pstCents)],
    ["Total paid", formatCents(d.totalCents)],
    ["Deposit", `${formatCents(d.depositCents)} — ${d.depositNote}`],
  ]);
  const html = layout(
    "You're booked!",
    `<p>Hi ${esc(d.customerName)}, thanks for booking with ${esc(brand.name)}. Here are your details:</p>
${summary}
<h2 style="font-size:16px;margin:24px 0 8px;text-transform:uppercase;color:${NAVY}">Receipt</h2>
${receipt}
${d.receiptUrl ? `<p style="font-size:13px"><a href="${d.receiptUrl}" style="color:${BLUE}">View your Stripe receipt</a></p>` : ""}
<p style="font-size:14px">Cancel 48 h or more before drop-off for a full refund (50% inside 48 h). Rainy day? Reply and we'll reschedule for free.</p>`,
    { label: "Manage my booking", url: manageUrl },
  );
  const text = `You're booked! Code ${d.code}
${d.machineName} · ${d.productName}
${formatRange(d.startsAt, d.endsAt)}
Where: ${d.where}
Total paid: ${formatCents(d.totalCents)} · Deposit: ${formatCents(d.depositCents)} (${d.depositNote})
Manage: ${manageUrl}`;
  return { subject: `Booking confirmed · ${d.code}`, html, text };
}

export function reminderEmail(
  d: Pick<BookingEmailData, "code" | "customerName" | "machineName" | "startsAt" | "endsAt" | "where">,
): EmailContent {
  const html = layout(
    "See you tomorrow",
    `<p>Hi ${esc(d.customerName)}, a quick reminder about your rental:</p>
${rows([
  ["Booking code", d.code],
  ["Machine", d.machineName],
  ["Drop-off", formatSlot(d.startsAt)],
  ["Pickup", formatSlot(d.endsAt)],
  ["Where", d.where],
])}
<p style="font-size:14px">Tips: use pressureless balls, keep the machine dry, and never stand in front of it while it's running.</p>`,
    { label: "Quick-start guide", url: siteUrl("/account/guide") },
  );
  return {
    subject: `Reminder: your ${brand.name} rental is tomorrow (${d.code})`,
    html,
    text: `Reminder: ${d.machineName}, ${formatRange(d.startsAt, d.endsAt)} at ${d.where}. Code ${d.code}.`,
  };
}

export function depositReleasedEmail(d: { code: string; customerName: string; amountCents: number }): EmailContent {
  return {
    subject: `Your deposit has been released (${d.code})`,
    html: layout(
      "Deposit released",
      `<p>Hi ${esc(d.customerName)}, the machine is back safe and sound — thank you! We've released your ${formatCents(d.amountCents)} deposit. Depending on your bank, the hold can take a few business days to disappear from your statement.</p>`,
      { label: "Book again", url: siteUrl("/book") },
    ),
    text: `Your ${formatCents(d.amountCents)} deposit for booking ${d.code} has been released. Thanks for renting with ${brand.name}!`,
  };
}

export function depositChargedEmail(d: {
  code: string;
  customerName: string;
  amountCents: number;
  note: string;
}): EmailContent {
  return {
    subject: `Deposit charge for booking ${d.code}`,
    html: layout(
      "Deposit charge",
      `<p>Hi ${esc(d.customerName)}, after inspecting the machine from booking ${esc(d.code)} we charged ${formatCents(d.amountCents)} from your deposit.</p>
<p><strong>Reason:</strong> ${esc(d.note)}</p>
<p>If you have questions about this charge, just reply to this email.</p>`,
    ),
    text: `We charged ${formatCents(d.amountCents)} from your deposit for booking ${d.code}. Reason: ${d.note}`,
  };
}

export function depositActionNeededEmail(d: { code: string; customerName: string }): EmailContent {
  return {
    subject: `Action needed: card for booking ${d.code}`,
    html: layout(
      "We couldn't place your deposit",
      `<p>Hi ${esc(d.customerName)}, we tried to place the refundable deposit hold for booking ${esc(d.code)} but your card was declined or needs verification. Please contact us before your rental so we can sort it out.</p>`,
      { label: "Contact us", url: siteUrl("/contact") },
    ),
    text: `We couldn't place the deposit hold for booking ${d.code}. Please contact us before your rental.`,
  };
}

export function bookingCancelledEmail(d: { code: string; customerName: string; refundCents: number }): EmailContent {
  const refund =
    d.refundCents > 0
      ? `A refund of ${formatCents(d.refundCents)} is on its way to your card.`
      : "No refund applies under our cancellation policy.";
  return {
    subject: `Booking cancelled (${d.code})`,
    html: layout(
      "Booking cancelled",
      `<p>Hi ${esc(d.customerName)}, your booking ${esc(d.code)} has been cancelled. ${refund} Any deposit hold has been released.</p>`,
      {
        label: "Book another time",
        url: siteUrl("/book"),
      },
    ),
    text: `Booking ${d.code} cancelled. ${refund}`,
  };
}

export function bookingRescheduledEmail(d: {
  code: string;
  customerName: string;
  startsAt: Date;
  endsAt: Date;
}): EmailContent {
  return {
    subject: `Booking updated (${d.code})`,
    html: layout(
      "New time confirmed",
      `<p>Hi ${esc(d.customerName)}, your booking ${esc(d.code)} now runs:</p>${rows([
        ["Drop-off", formatSlot(d.startsAt)],
        ["Pickup", formatSlot(d.endsAt)],
      ])}`,
      { label: "Manage my booking", url: siteUrl("/account") },
    ),
    text: `Booking ${d.code} moved to ${formatRange(d.startsAt, d.endsAt)}.`,
  };
}

export function slotLostRefundEmail(d: { code: string; customerName: string; amountCents: number }): EmailContent {
  return {
    subject: `We couldn't complete booking ${d.code}`,
    html: layout(
      "Sorry — that slot was taken",
      `<p>Hi ${esc(d.customerName)}, your payment arrived after the 10-minute hold expired and someone else had already booked that time. We've fully refunded ${formatCents(d.amountCents)}. Please pick another time — we'd love to see you on court.</p>`,
      { label: "Pick another time", url: siteUrl("/book") },
    ),
    text: `Your payment for ${d.code} arrived after the slot was taken. We refunded ${formatCents(d.amountCents)} in full.`,
  };
}

export function otpEmail(d: { code: string; magicLink: string }): EmailContent {
  return {
    subject: `Your ${brand.name} sign-in code: ${d.code}`,
    html: layout(
      "Your sign-in code",
      `<p>Use this code to see your bookings. It expires in 10 minutes.</p>
<p style="font-size:34px;font-weight:800;letter-spacing:8px;color:${NAVY};margin:16px 0">${esc(d.code)}</p>
<p>Or sign in with one click:</p>`,
      { label: "Open my bookings", url: d.magicLink },
    ),
    text: `Your ${brand.name} code is ${d.code} (expires in 10 minutes). Or open: ${d.magicLink}`,
  };
}

export function groupEnrollmentEmail(d: {
  customerName: string;
  title: string;
  startsAt: Date;
  court: string;
  totalCents: number;
}): EmailContent {
  return {
    subject: `You're in: ${d.title}`,
    html: layout(
      "You're in!",
      `<p>Hi ${esc(d.customerName)}, see you on court.</p>${rows([
        ["Session", d.title],
        ["When", formatSlot(d.startsAt)],
        ["Where", d.court],
        ["Paid", formatCents(d.totalCents)],
      ])}<p style="font-size:14px">Bring your racket, water and court shoes. Balls are provided.</p>`,
    ),
    text: `You're in: ${d.title}, ${formatSlot(d.startsAt)} at ${d.court}.`,
  };
}

export function subscriptionWelcomeEmail(d: {
  customerName: string;
  productName: string;
  sessions: number;
}): EmailContent {
  return {
    subject: `Welcome to your ${d.productName}`,
    html: layout(
      "Your package is active",
      `<p>Hi ${esc(d.customerName)}, your ${esc(d.productName)} is active: ${d.sessions} sessions of 1.5 h every month. Book your sessions any time from “My bookings”.</p>`,
      { label: "Book a session", url: siteUrl("/account") },
    ),
    text: `Your ${d.productName} is active. Book sessions at ${siteUrl("/account")}`,
  };
}

export function adminAlertEmail(d: { subject: string; lines: string[]; url?: string }): EmailContent {
  return {
    subject: `[${brand.name}] ${d.subject}`,
    html: layout(
      d.subject,
      d.lines.map((l) => `<p>${esc(l)}</p>`).join(""),
      d.url ? { label: "Open in admin", url: d.url } : undefined,
    ),
    text: [d.subject, ...d.lines, d.url ?? ""].join("\n"),
  };
}
