import "server-only";
import { db } from "@/lib/db";
import { stripe, type Stripe } from "@/lib/stripe";
import { brand } from "@/config/brand";
import { withTaxes } from "@/lib/domain/pricing";
import { chargedTaxes } from "@/lib/domain/rental";
import { passWindow, passesLeft } from "@/lib/domain/spring-pass";
import { sendEmail } from "@/lib/notify/email";
import { springPassEmail } from "@/lib/notify/templates";
import { formatLocalDate, toLocalDate } from "@/lib/time";
import { upsertCustomer, type CustomerInput } from "./customers";
import { BookingError } from "./errors";
import { ensureStripeCustomer } from "./payments";
import { getSettings } from "./settings";
import { readOr } from "./fallback";

/*
 * Spring Pass (off by default, Admin → Settings): bought up front with a
 * one-time card payment; weekends are booked one by one from the portal.
 * The card is saved for deposits and paid deliveries.
 */

/** Unpaid checkouts hold a pass for this long. */
const PENDING_HOLD_MS = 30 * 60_000;

async function soldCount(now: Date, tx: Pick<typeof db, "springPass"> = db) {
  return tx.springPass.count({
    where: {
      OR: [
        { status: "ACTIVE" },
        { status: "PENDING_PAYMENT", createdAt: { gt: new Date(now.getTime() - PENDING_HOLD_MS) } },
      ],
    },
  });
}

/** What the pricing page shows, or null when the pass isn't on sale. */
export async function springPassOffer(now = new Date()) {
  const settings = await getSettings();
  if (!settings.springPassEnabled) return null;
  const sold = await readOr(
    "spring pass",
    () => soldCount(now),
    () => 0,
  );
  const left = passesLeft(settings, sold);
  if (left === null) return null;
  const window = passWindow(settings, toLocalDate(now));
  return {
    priceCents: settings.springPassPriceCents,
    weekends: settings.springPassWeekends,
    limit: settings.springPassLimit,
    left,
    window,
    windowLabel: `${formatLocalDate(window.from, "MMM d")} – ${formatLocalDate(window.to, "MMM d")}`,
  };
}

export async function startSpringPassPurchase(input: { customer: CustomerInput; now?: Date }) {
  const now = input.now ?? new Date();
  const settings = await getSettings();
  if (!settings.springPassEnabled) throw new BookingError("NOT_FOUND", "The Spring Pass isn't on sale right now.");
  const window = passWindow(settings, toLocalDate(now));
  const amounts = withTaxes(settings.springPassPriceCents, chargedTaxes(settings));

  const { pass, customer } = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('spring-pass'))`;
    if ((await soldCount(now, tx)) >= settings.springPassLimit) {
      throw new BookingError("NOT_FOUND", "All Spring Passes are sold. Weekends are still bookable one by one.");
    }
    const customer = await upsertCustomer(tx, input.customer);
    const pass = await tx.springPass.create({
      data: {
        customerId: customer.id,
        weekends: settings.springPassWeekends,
        priceCents: amounts.totalCents,
        validFrom: new Date(`${window.from}T00:00:00Z`),
        validTo: new Date(`${window.to}T00:00:00Z`),
        createdAt: now,
      },
    });
    return { pass, customer };
  });

  const pi = await stripe().paymentIntents.create(
    {
      amount: amounts.totalCents,
      currency: brand.currency,
      customer: await ensureStripeCustomer(customer.id),
      allowed_payment_method_types: ["card"],
      // Saved for the deposits and any paid deliveries of the pass weekends.
      setup_future_usage: "off_session",
      description: `${brand.name} Spring Pass (${settings.springPassWeekends} weekends)`,
      metadata: { kind: "spring_pass", springPassId: pass.id },
    },
    { idempotencyKey: `spring_pass:${pass.id}` },
  );
  await db.springPass.update({ where: { id: pass.id }, data: { stripePaymentIntentId: pi.id } });
  await db.payment.create({
    data: {
      kind: "SPRING_PASS",
      status: "PENDING",
      amountCents: amounts.totalCents,
      springPassId: pass.id,
      stripePaymentIntentId: pi.id,
    },
  });
  return {
    clientSecret: pi.client_secret!,
    amountCents: amounts.totalCents,
    customerId: customer.id,
    customerName: customer.name,
  };
}

/** Webhook / browser: the pass is paid → active. Idempotent. */
export async function handleSpringPassSucceeded(pi: Stripe.PaymentIntent) {
  const passId = pi.metadata.springPassId;
  if (!passId) return;
  const paymentMethod = typeof pi.payment_method === "string" ? pi.payment_method : (pi.payment_method?.id ?? null);
  const pass = await db.springPass.findUnique({ where: { id: passId }, include: { customer: true } });
  if (!pass || pass.status === "ACTIVE") return;
  await db.$transaction([
    db.springPass.update({ where: { id: passId }, data: { status: "ACTIVE", stripePaymentMethodId: paymentMethod } }),
    db.payment.updateMany({ where: { stripePaymentIntentId: pi.id }, data: { status: "SUCCEEDED" } }),
  ]);
  if (pass.customer.email) {
    await sendEmail({
      to: pass.customer.email,
      template: "spring_pass",
      dedupeKey: `spring_pass:${pass.id}`,
      content: springPassEmail({
        customerName: pass.customer.name,
        weekends: pass.weekends,
        window: `${formatLocalDate(pass.validFrom.toISOString().slice(0, 10), "MMM d")} – ${formatLocalDate(pass.validTo.toISOString().slice(0, 10), "MMM d, yyyy")}`,
      }),
    });
  }
}

/** The customer's active pass and how many weekends are left. */
export async function customerSpringPass(customerId: string) {
  const pass = await db.springPass.findFirst({
    where: { customerId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  });
  if (!pass) return null;
  const used = await db.booking.count({
    where: { springPassId: pass.id, status: { notIn: ["CANCELLED", "EXPIRED"] } },
  });
  return {
    pass,
    used,
    left: Math.max(0, pass.weekends - used),
    validFrom: pass.validFrom.toISOString().slice(0, 10),
    validTo: pass.validTo.toISOString().slice(0, 10),
  };
}
