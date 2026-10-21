import "server-only";
import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/notify/email";
import { sendSms, smsEnabled } from "@/lib/notify/sms";
import { otpEmail } from "@/lib/notify/templates";
import { siteUrl } from "@/lib/site-url";
import { normalizeEmail, normalizePhone } from "./customers";

/*
 * Passwordless customer portal. A one-time 6-digit code (email or SMS) or a
 * magic link signs the customer in. Only HMAC hashes are stored; the session
 * cookie holds a random token whose hash lives in CustomerSession.
 */

export const PORTAL_COOKIE = "rd_portal";
const CODE_TTL_MS = 10 * 60_000;
const SESSION_TTL_MS = 30 * 24 * 3_600_000;
const MAX_ATTEMPTS = 5;
const MAX_CODES_PER_WINDOW = 5;
const RATE_WINDOW_MS = 15 * 60_000;

function secret(): string {
  const s = process.env.PORTAL_SECRET ?? process.env.AUTH_SECRET;
  if (!s) throw new Error("PORTAL_SECRET is not set.");
  return s;
}

export function hashToken(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Parses "email or phone" input. */
export function parseContact(input: string): { email: string | null; phone: string | null } {
  const v = input.trim();
  if (v.includes("@")) return { email: normalizeEmail(v), phone: null };
  return { email: null, phone: normalizePhone(v) };
}

async function findCustomer(contact: string) {
  const { email, phone } = parseContact(contact);
  if (email) return db.customer.findUnique({ where: { email } });
  if (phone) return db.customer.findUnique({ where: { phone } });
  return null;
}

/**
 * Sends a code + magic link. Always reports success so the form can't be
 * used to discover who is a customer.
 */
export async function requestLoginCode(
  contact: string,
  now = new Date(),
): Promise<{ sent: boolean; channel: "EMAIL" | "SMS" }> {
  const { phone } = parseContact(contact);
  const channel = phone ? "SMS" : "EMAIL";
  const customer = await findCustomer(contact);
  if (!customer || customer.blocked) return { sent: true, channel };

  const recent = await db.customerOtp.count({
    where: { customerId: customer.id, createdAt: { gt: new Date(now.getTime() - RATE_WINDOW_MS) } },
  });
  if (recent >= MAX_CODES_PER_WINDOW) return { sent: true, channel };

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const magic = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + CODE_TTL_MS);
  await db.customerOtp.createMany({
    data: [
      { customerId: customer.id, channel, codeHash: hashToken(`code:${customer.id}:${code}`), expiresAt },
      { customerId: customer.id, channel: "EMAIL", codeHash: hashToken(`magic:${magic}`), expiresAt },
    ],
  });

  const magicLink = siteUrl(`/account/magic?token=${magic}`);
  if (channel === "SMS" && customer.phone && (await smsEnabled())) {
    await sendSms({
      to: customer.phone,
      body: `Your RallyDrop code is ${code}. It expires in 10 minutes.`,
      template: "otp",
    });
  } else if (customer.email) {
    await sendEmail({ to: customer.email, template: "otp", content: otpEmail({ code, magicLink }) });
  }
  return { sent: true, channel };
}

async function startSession(customerId: string, now: Date) {
  const token = randomBytes(32).toString("base64url");
  await db.customerSession.create({
    data: { customerId, tokenHash: hashToken(`session:${token}`), expiresAt: new Date(now.getTime() + SESSION_TTL_MS) },
  });
  const jar = await cookies();
  jar.set(PORTAL_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function verifyLoginCode(contact: string, code: string, now = new Date()): Promise<boolean> {
  const customer = await findCustomer(contact);
  if (!customer || customer.blocked || !/^\d{6}$/.test(code.trim())) return false;
  const otp = await db.customerOtp.findFirst({
    where: { customerId: customer.id, consumedAt: null, expiresAt: { gt: now }, attempts: { lt: MAX_ATTEMPTS } },
    orderBy: { createdAt: "desc" },
  });
  if (!otp) return false;
  const ok = safeEqual(otp.codeHash, hashToken(`code:${customer.id}:${code.trim()}`));
  if (!ok) {
    await db.customerOtp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    return false;
  }
  await db.customerOtp.updateMany({ where: { customerId: customer.id, consumedAt: null }, data: { consumedAt: now } });
  await startSession(customer.id, now);
  return true;
}

export async function verifyMagicLink(token: string, now = new Date()): Promise<boolean> {
  const otp = await db.customerOtp.findFirst({
    where: { codeHash: hashToken(`magic:${token}`), consumedAt: null, expiresAt: { gt: now } },
    include: { customer: true },
  });
  if (!otp || otp.customer.blocked) return false;
  await db.customerOtp.updateMany({
    where: { customerId: otp.customerId, consumedAt: null },
    data: { consumedAt: now },
  });
  await startSession(otp.customerId, now);
  return true;
}

/** The signed-in customer, or null. */
export async function getPortalCustomer() {
  const token = (await cookies()).get(PORTAL_COOKIE)?.value;
  if (!token) return null;
  const session = await db.customerSession.findUnique({
    where: { tokenHash: hashToken(`session:${token}`) },
    include: { customer: true },
  });
  if (!session || session.expiresAt < new Date() || session.customer.blocked) return null;
  return session.customer;
}

export async function signOutPortal() {
  const jar = await cookies();
  const token = jar.get(PORTAL_COOKIE)?.value;
  if (token) await db.customerSession.deleteMany({ where: { tokenHash: hashToken(`session:${token}`) } });
  jar.delete(PORTAL_COOKIE);
}
