import "server-only";
import { db } from "@/lib/db";
import { siteUrl } from "@/lib/site-url";
import { formatRange } from "@/lib/time";
import { sendEmail } from "./email";
import { sendSms } from "./sms";
import { legsLabel } from "@/lib/domain/delivery";
import { logistics } from "@/lib/domain/logistics";
import {
  adminAlertEmail,
  bookingCancelledEmail,
  bookingConfirmedEmail,
  bookingRescheduledEmail,
  depositActionNeededEmail,
  depositChargedEmail,
  depositReleasedEmail,
  reminderEmail,
  slotLostRefundEmail,
} from "./templates";

async function loadBooking(bookingId: string) {
  return db.booking.findUnique({
    where: { id: bookingId },
    include: {
      customer: true,
      machine: true,
      product: true,
      promoCode: { select: { code: true } },
      court: true,
      deposit: true,
      addOns: { include: { addOn: true } },
      payments: { where: { kind: "RENTAL" }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
}

type LoadedBooking = NonNullable<Awaited<ReturnType<typeof loadBooking>>>;

export function bookingWhere(
  b: Pick<LoadedBooking, "fulfillment" | "dropoff" | "collection" | "court" | "deliveryAddress">,
): string {
  return logistics(b).short;
}

function depositNote(b: LoadedBooking): string {
  if (!b.deposit) return "none";
  if (b.deposit.strategy === "SAVED_CARD") return "card saved, charged only if there's damage";
  if (b.deposit.authScheduledFor) return "held on your card the day before drop-off";
  return "held on your card, not charged";
}

async function toAll(b: LoadedBooking, email: () => Promise<void>, sms?: string, smsKey?: string) {
  if (b.customer.email) await email();
  if (b.customer.phone && sms) {
    await sendSms({ to: b.customer.phone, body: sms, template: "sms", dedupeKey: smsKey });
  }
}

export async function notifyBookingConfirmed(bookingId: string) {
  const b = await loadBooking(bookingId);
  if (!b) return;
  const lines = [
    {
      label: b.product.name,
      cents: b.subtotalCents + b.discountCents - b.deliveryFeeCents - b.addOns.reduce((s, a) => s + a.priceCents, 0),
    },
    ...b.addOns.map((a) => ({ label: a.addOn.name, cents: a.priceCents })),
    ...(b.dropoff || b.collection
      ? [{ label: `${legsLabel(b)}${b.deliveryZone ? ` · Zone ${b.deliveryZone}` : ""}`, cents: b.deliveryFeeCents }]
      : []),
    ...(b.discountCents > 0 ? [{ label: `Promo ${b.promoCode?.code ?? ""}`.trim(), cents: -b.discountCents }] : []),
  ];
  await toAll(
    b,
    () =>
      sendEmail({
        to: b.customer.email!,
        template: "booking_confirmed",
        dedupeKey: `booking_confirmed:${b.id}`,
        content: bookingConfirmedEmail({
          code: b.code,
          customerName: b.customer.name,
          productName: b.product.name,
          machineName: b.machine.name,
          startsAt: b.startsAt,
          endsAt: b.endsAt,
          startHow: logistics(b).start,
          endHow: logistics(b).end,
          lines,
          subtotalCents: b.subtotalCents,
          gstCents: b.gstCents,
          pstCents: b.pstCents,
          totalCents: b.totalCents,
          depositCents: b.deposit?.amountCents ?? 0,
          depositNote: depositNote(b),
          receiptUrl: b.payments[0]?.receiptUrl,
        }),
      }),
    `RallyDrop: booking ${b.code} confirmed. ${formatRange(b.startsAt, b.endsAt)}. Manage: ${siteUrl("/account")}`,
    `sms_confirmed:${b.id}`,
  );
  await alertAdmin(
    `New booking ${b.code}`,
    [`${b.customer.name} · ${b.machine.name} · ${b.product.name}`, formatRange(b.startsAt, b.endsAt), bookingWhere(b)],
    `/admin/bookings/${b.id}`,
    `admin_new:${b.id}`,
  );
}

export async function notifyReminder(bookingId: string) {
  const b = await loadBooking(bookingId);
  if (!b) return;
  await toAll(
    b,
    () =>
      sendEmail({
        to: b.customer.email!,
        template: "reminder_24h",
        dedupeKey: `reminder_24h:${b.id}:${b.startsAt.toISOString()}`,
        content: reminderEmail({
          code: b.code,
          customerName: b.customer.name,
          machineName: b.machine.name,
          startsAt: b.startsAt,
          endsAt: b.endsAt,
          startHow: logistics(b).start,
          endHow: logistics(b).end,
        }),
      }),
    `RallyDrop reminder: ${b.machine.name} tomorrow, ${formatRange(b.startsAt, b.endsAt)}. Code ${b.code}.`,
    `sms_reminder:${b.id}:${b.startsAt.toISOString()}`,
  );
}

export async function notifyDepositReleased(bookingId: string) {
  const b = await loadBooking(bookingId);
  if (!b?.deposit) return;
  await toAll(b, () =>
    sendEmail({
      to: b.customer.email!,
      template: "deposit_released",
      dedupeKey: `deposit_released:${b.id}`,
      content: depositReleasedEmail({
        code: b.code,
        customerName: b.customer.name,
        amountCents: b.deposit!.amountCents,
      }),
    }),
  );
}

export async function notifyDepositCharged(bookingId: string, amountCents: number, note: string) {
  const b = await loadBooking(bookingId);
  if (!b) return;
  await toAll(b, () =>
    sendEmail({
      to: b.customer.email!,
      template: "deposit_charged",
      content: depositChargedEmail({ code: b.code, customerName: b.customer.name, amountCents, note }),
    }),
  );
}

export async function notifyDepositFailed(bookingId: string) {
  const b = await loadBooking(bookingId);
  if (!b) return;
  await toAll(
    b,
    () =>
      sendEmail({
        to: b.customer.email!,
        template: "deposit_failed",
        dedupeKey: `deposit_failed:${b.id}`,
        content: depositActionNeededEmail({ code: b.code, customerName: b.customer.name }),
      }),
    `RallyDrop: we couldn't place the deposit for booking ${b.code}. Please contact us.`,
    `sms_deposit_failed:${b.id}`,
  );
  await alertAdmin(
    `Deposit failed for ${b.code}`,
    [`${b.customer.name}`, formatRange(b.startsAt, b.endsAt)],
    `/admin/bookings/${b.id}`,
    `admin_deposit_failed:${b.id}`,
  );
}

export async function notifyCancelled(bookingId: string, refundCents: number) {
  const b = await loadBooking(bookingId);
  if (!b) return;
  await toAll(b, () =>
    sendEmail({
      to: b.customer.email!,
      template: "booking_cancelled",
      dedupeKey: `booking_cancelled:${b.id}`,
      content: bookingCancelledEmail({ code: b.code, customerName: b.customer.name, refundCents }),
    }),
  );
}

export async function notifyRescheduled(bookingId: string) {
  const b = await loadBooking(bookingId);
  if (!b) return;
  await toAll(b, () =>
    sendEmail({
      to: b.customer.email!,
      template: "booking_rescheduled",
      content: bookingRescheduledEmail({
        code: b.code,
        customerName: b.customer.name,
        startsAt: b.startsAt,
        endsAt: b.endsAt,
      }),
    }),
  );
}

export async function notifySlotLost(bookingId: string, amountCents: number) {
  const b = await loadBooking(bookingId);
  if (!b) return;
  await toAll(b, () =>
    sendEmail({
      to: b.customer.email!,
      template: "slot_lost",
      dedupeKey: `slot_lost:${b.id}`,
      content: slotLostRefundEmail({ code: b.code, customerName: b.customer.name, amountCents }),
    }),
  );
}

export async function alertAdmin(subject: string, lines: string[], path?: string, dedupeKey?: string) {
  const to = process.env.ADMIN_ALERT_EMAIL;
  if (!to) return;
  await sendEmail({
    to,
    template: "admin_alert",
    dedupeKey,
    content: adminAlertEmail({ subject, lines, url: path ? siteUrl(path) : undefined }),
  });
}
