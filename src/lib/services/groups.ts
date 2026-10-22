import "server-only";
import { db } from "@/lib/db";
import { stripe, type Stripe } from "@/lib/stripe";
import { brand } from "@/config/brand";
import { withTaxes } from "@/lib/domain/pricing";
import { sendEmail } from "@/lib/notify/email";
import { groupEnrollmentEmail } from "@/lib/notify/templates";
import { upsertCustomer, type CustomerInput } from "./customers";
import { BookingError } from "./errors";
import { ensureStripeCustomer } from "./payments";
import { chargedTaxes } from "@/lib/domain/rental";
import { getSettings } from "./settings";

/**
 * Reserves a seat (10-minute hold) and returns a PaymentIntent client secret.
 * Capacity is checked while holding a row lock on the session, so two people
 * can't take the last seat at the same time.
 */
export async function startGroupEnrollment(input: { groupSessionId: string; customer: CustomerInput; now?: Date }) {
  const now = input.now ?? new Date();
  const settings = await getSettings();
  const holdExpiresAt = new Date(now.getTime() + settings.holdMinutes * 60_000);

  const enrollment = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "GroupSession" WHERE id = ${input.groupSessionId} FOR UPDATE`;
    const session = await tx.groupSession.findUnique({ where: { id: input.groupSessionId } });
    if (!session || session.status !== "SCHEDULED" || session.startsAt <= now) {
      throw new BookingError("NOT_FOUND", "That session isn't open for sign-ups.");
    }
    const customer = await upsertCustomer(tx, input.customer);
    const taken = await tx.groupEnrollment.count({
      where: {
        groupSessionId: session.id,
        NOT: { customerId: customer.id },
        OR: [{ status: "CONFIRMED" }, { status: "PENDING_PAYMENT", holdExpiresAt: { gt: now } }],
      },
    });
    if (taken >= session.capacity) throw new BookingError("GROUP_FULL", "Sorry, that session just filled up.");

    const existing = await tx.groupEnrollment.findUnique({
      where: { groupSessionId_customerId: { groupSessionId: session.id, customerId: customer.id } },
    });
    if (existing?.status === "CONFIRMED")
      throw new BookingError("INVALID_STATE", "You're already signed up for this session.");
    return tx.groupEnrollment.upsert({
      where: { groupSessionId_customerId: { groupSessionId: session.id, customerId: customer.id } },
      update: { status: "PENDING_PAYMENT", holdExpiresAt },
      create: { groupSessionId: session.id, customerId: customer.id, status: "PENDING_PAYMENT", holdExpiresAt },
      include: { groupSession: true },
    });
  });

  const price = withTaxes(enrollment.groupSession.priceCents, chargedTaxes(settings));
  const stripeCustomerId = await ensureStripeCustomer(enrollment.customerId);
  const pi = await stripe().paymentIntents.create(
    {
      amount: price.totalCents,
      currency: brand.currency,
      customer: stripeCustomerId,
      allowed_payment_method_types: ["card"],
      description: `${brand.name} group session · ${enrollment.groupSession.title}`,
      metadata: { kind: "group", enrollmentId: enrollment.id },
    },
    { idempotencyKey: `group:${enrollment.id}:${holdExpiresAt.getTime()}` },
  );
  await db.payment.create({
    data: {
      kind: "GROUP_SESSION",
      status: "PENDING",
      amountCents: price.totalCents,
      enrollmentId: enrollment.id,
      stripePaymentIntentId: pi.id,
    },
  });
  return {
    clientSecret: pi.client_secret!,
    enrollmentId: enrollment.id,
    customerId: enrollment.customerId,
    ...price,
  };
}

/** Idempotent: confirm the seat when its payment succeeds. */
export async function handleGroupPaymentSucceeded(pi: Stripe.PaymentIntent) {
  const enrollmentId = pi.metadata.enrollmentId;
  await db.payment.updateMany({
    where: { stripePaymentIntentId: pi.id, status: { not: "SUCCEEDED" } },
    data: { status: "SUCCEEDED", stripeChargeId: typeof pi.latest_charge === "string" ? pi.latest_charge : null },
  });
  const enrollment = await db.groupEnrollment.findUnique({
    where: { id: enrollmentId },
    include: { customer: true, groupSession: { include: { court: true } } },
  });
  if (!enrollment || enrollment.status === "CONFIRMED") return;
  await db.groupEnrollment.update({ where: { id: enrollmentId }, data: { status: "CONFIRMED", holdExpiresAt: null } });
  if (enrollment.customer.email) {
    await sendEmail({
      to: enrollment.customer.email,
      template: "group_enrollment",
      dedupeKey: `group_enrollment:${enrollment.id}`,
      content: groupEnrollmentEmail({
        customerName: enrollment.customer.name,
        title: enrollment.groupSession.title,
        startsAt: enrollment.groupSession.startsAt,
        court: enrollment.groupSession.court.name,
        totalCents: pi.amount,
      }),
    });
  }
}
