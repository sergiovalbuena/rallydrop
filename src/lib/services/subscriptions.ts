import "server-only";
import { db } from "@/lib/db";
import { stripe, type Stripe } from "@/lib/stripe";
import { brand } from "@/config/brand";
import type { SubscriptionStatus } from "@/generated/prisma/client";
import { sendEmail } from "@/lib/notify/email";
import { subscriptionWelcomeEmail } from "@/lib/notify/templates";
import { upsertCustomer, type CustomerInput } from "./customers";
import { BookingError } from "./errors";
import { ensureStripeCustomer } from "./payments";
import { chargedTaxes } from "@/lib/domain/rental";
import { getSettings } from "./settings";

/*
 * Monthly session packages are Stripe subscriptions. GST/PST are applied as
 * Stripe Tax Rates so invoices show them separately.
 */

async function ensureTaxRates(): Promise<string[]> {
  const settings = await getSettings();
  const ids: string[] = [];
  // Only taxes the owner is registered for and has switched on.
  const taxes = chargedTaxes(settings);
  const specs = [
    { field: "stripeGstTaxRateId" as const, name: "GST", bps: taxes.gstBps, id: settings.stripeGstTaxRateId },
    { field: "stripePstTaxRateId" as const, name: "PST", bps: taxes.pstBps, id: settings.stripePstTaxRateId },
  ];
  for (const spec of specs) {
    if (spec.bps <= 0) continue;
    let rateId = spec.id;
    if (rateId) {
      const rate = await stripe().taxRates.retrieve(rateId);
      if (!rate.active || Math.round(rate.percentage * 100) !== spec.bps) rateId = null;
    }
    if (!rateId) {
      const rate = await stripe().taxRates.create({
        display_name: spec.name,
        percentage: spec.bps / 100,
        inclusive: false,
        country: "CA",
        state: "BC",
        jurisdiction: spec.name === "GST" ? "CA" : "BC",
      });
      rateId = rate.id;
      await db.settings.update({ where: { id: "default" }, data: { [spec.field]: rateId } });
    }
    ids.push(rateId);
  }
  return ids;
}

/** Creates the Stripe product/price for a package if missing or outdated. */
export async function ensureStripePrice(productId: string): Promise<string> {
  const product = await db.product.findUniqueOrThrow({ where: { id: productId } });
  if (product.stripePriceId) {
    const price = await stripe().prices.retrieve(product.stripePriceId);
    if (price.active && price.unit_amount === product.priceCents) return price.id;
    await stripe().prices.update(price.id, { active: false });
  }
  const stripeProductId =
    product.stripeProductId ??
    (
      await stripe().products.create({
        name: `${brand.name} ${product.name}`,
        description: product.description ?? undefined,
        metadata: { productId: product.id },
      })
    ).id;
  const price = await stripe().prices.create({
    product: stripeProductId,
    unit_amount: product.priceCents,
    currency: brand.currency,
    recurring: { interval: "month" },
    metadata: { productId: product.id },
  });
  await db.product.update({ where: { id: product.id }, data: { stripeProductId, stripePriceId: price.id } });
  return price.id;
}

export async function startSubscription(input: { productId: string; customer: CustomerInput }) {
  const product = await db.product.findUnique({ where: { id: input.productId } });
  if (!product || product.kind !== "PACKAGE" || !product.active)
    throw new BookingError("NOT_FOUND", "Package not found.");

  const customer = await db.$transaction((tx) => upsertCustomer(tx, input.customer));
  const active = await db.subscription.findFirst({
    where: { customerId: customer.id, status: { in: ["ACTIVE", "PAST_DUE"] } },
  });
  if (active)
    throw new BookingError("INVALID_STATE", "You already have an active package. Manage it from “My bookings”.");

  const stripeCustomerId = await ensureStripeCustomer(customer.id);
  const [priceId, taxRates] = await Promise.all([ensureStripePrice(product.id), ensureTaxRates()]);

  const sub = await stripe().subscriptions.create({
    customer: stripeCustomerId,
    items: [{ price: priceId }],
    default_tax_rates: taxRates,
    payment_behavior: "default_incomplete",
    payment_settings: { save_default_payment_method: "on_subscription", payment_method_types: ["card"] },
    expand: ["latest_invoice.confirmation_secret"],
    metadata: { productId: product.id, customerId: customer.id },
  });
  await syncSubscription(sub);

  const invoice = sub.latest_invoice;
  const clientSecret = invoice && typeof invoice === "object" ? invoice.confirmation_secret?.client_secret : null;
  if (!clientSecret) throw new BookingError("PAYMENT_FAILED", "Couldn't start the payment. Please try again.");
  const amountCents = invoice && typeof invoice === "object" ? invoice.amount_due : product.priceCents;
  return { clientSecret, subscriptionId: sub.id, amountCents, customerId: customer.id, customerName: customer.name };
}

function mapStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "active":
    case "trialing":
      return "ACTIVE";
    case "past_due":
      return "PAST_DUE";
    case "unpaid":
      return "UNPAID";
    case "canceled":
    case "incomplete_expired":
      return "CANCELED";
    default:
      return "INCOMPLETE";
  }
}

/** Mirrors a Stripe subscription into our DB (webhooks + creation). */
export async function syncSubscription(sub: Stripe.Subscription) {
  const item = sub.items.data[0];
  const productId = sub.metadata.productId;
  const customerId = sub.metadata.customerId;
  if (!productId || !customerId || !item) return null;
  const status = mapStatus(sub.status);
  const data = {
    status,
    currentPeriodStart: new Date(item.current_period_start * 1000),
    currentPeriodEnd: new Date(item.current_period_end * 1000),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
  };
  const before = await db.subscription.findUnique({ where: { stripeSubscriptionId: sub.id } });
  const row = await db.subscription.upsert({
    where: { stripeSubscriptionId: sub.id },
    update: data,
    create: { ...data, stripeSubscriptionId: sub.id, productId, customerId },
    include: { customer: true, product: true },
  });
  if (status === "ACTIVE" && before?.status !== "ACTIVE" && row.customer.email) {
    await sendEmail({
      to: row.customer.email,
      template: "subscription_welcome",
      dedupeKey: `sub_welcome:${row.id}`,
      content: subscriptionWelcomeEmail({
        customerName: row.customer.name,
        productName: row.product.name,
        sessions: row.product.sessionsPerMonth ?? 0,
      }),
    });
  }
  return row;
}

export async function recordInvoicePaid(invoice: Stripe.Invoice) {
  const subRef = invoice.parent?.subscription_details?.subscription;
  const stripeSubId = typeof subRef === "string" ? subRef : subRef?.id;
  if (!stripeSubId || !invoice.id) return;
  const sub = await db.subscription.findUnique({ where: { stripeSubscriptionId: stripeSubId } });
  if (!sub) return;
  await db.payment.upsert({
    where: { stripeInvoiceId: invoice.id },
    update: { status: "SUCCEEDED", receiptUrl: invoice.hosted_invoice_url ?? null },
    create: {
      kind: "SUBSCRIPTION_INVOICE",
      status: "SUCCEEDED",
      amountCents: invoice.amount_paid,
      subscriptionId: sub.id,
      stripeInvoiceId: invoice.id,
      receiptUrl: invoice.hosted_invoice_url ?? null,
    },
  });
}

/** Sessions used / left in the current billing period. */
export async function sessionsUsage(subscriptionId: string) {
  const sub = await db.subscription.findUniqueOrThrow({ where: { id: subscriptionId }, include: { product: true } });
  const used = await db.booking.count({
    where: {
      subscriptionId,
      startsAt: { gte: sub.currentPeriodStart, lt: sub.currentPeriodEnd },
      status: { notIn: ["CANCELLED", "EXPIRED"] },
    },
  });
  const total = sub.product.sessionsPerMonth ?? 0;
  return { used, total, left: Math.max(0, total - used), periodEnd: sub.currentPeriodEnd };
}

/** Stripe Customer Portal for updating the card or cancelling. */
export async function billingPortalUrl(customerId: string, returnUrl: string) {
  const stripeCustomerId = await ensureStripeCustomer(customerId);
  const session = await stripe().billingPortal.sessions.create({ customer: stripeCustomerId, return_url: returnUrl });
  return session.url;
}
