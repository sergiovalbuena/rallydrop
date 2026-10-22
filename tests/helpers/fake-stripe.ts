import Stripe from "stripe";

/*
 * Minimal in-memory Stripe double covering the calls the app makes.
 * Webhook signing/verification uses the real library (pure crypto, no network).
 */

type FakePI = {
  id: string;
  object: "payment_intent";
  amount: number;
  amount_capturable: number;
  amount_received: number;
  currency: string;
  status: Stripe.PaymentIntent.Status;
  capture_method: "automatic" | "manual";
  customer: string | null;
  payment_method: string | null;
  client_secret: string;
  metadata: Record<string, string>;
  latest_charge: string | null;
  created: number;
  last_payment_error: null | { message: string };
};

export type Call = { method: string; args: unknown[] };

export function createFakeStripe(options: { declineOffSession?: boolean } = {}) {
  const real = new Stripe("sk_test_dummy");
  const intents = new Map<string, FakePI>();
  const calls: Call[] = [];
  let n = 0;
  const next = (prefix: string) => `${prefix}_${++n}`;
  const record = (method: string, ...args: unknown[]) => calls.push({ method, args });
  const subscriptions = new Map<string, Record<string, unknown>>();

  const fake = {
    webhooks: real.webhooks,
    customers: {
      create: async (params: Stripe.CustomerCreateParams) => {
        record("customers.create", params);
        return { id: next("cus") };
      },
    },
    charges: {
      retrieve: async (id: string) => ({ id, receipt_url: `https://pay.stripe.com/receipts/${id}` }),
    },
    paymentIntents: {
      create: async (params: Stripe.PaymentIntentCreateParams) => {
        record("paymentIntents.create", params);
        if (options.declineOffSession && params.off_session) {
          throw new Error("Your card was declined.");
        }
        const manual = params.capture_method === "manual";
        const status: Stripe.PaymentIntent.Status = params.confirm
          ? manual
            ? "requires_capture"
            : "succeeded"
          : "requires_payment_method";
        const pi: FakePI = {
          id: next("pi"),
          object: "payment_intent",
          amount: params.amount,
          amount_capturable: status === "requires_capture" ? params.amount : 0,
          amount_received: status === "succeeded" ? params.amount : 0,
          currency: params.currency,
          status,
          capture_method: manual ? "manual" : "automatic",
          customer: typeof params.customer === "string" ? params.customer : null,
          payment_method: params.payment_method ?? null,
          client_secret: `secret_${n}`,
          metadata: (params.metadata ?? {}) as Record<string, string>,
          latest_charge: status === "succeeded" ? next("ch") : null,
          created: Math.floor(Date.now() / 1000),
          last_payment_error: null,
        };
        intents.set(pi.id, pi);
        return pi;
      },
      retrieve: async (id: string) => {
        const pi = intents.get(id);
        if (!pi) throw new Error(`No such payment_intent: ${id}`);
        return pi;
      },
      confirm: async (id: string, params: Stripe.PaymentIntentConfirmParams = {}) => {
        record("paymentIntents.confirm", id, params);
        if (options.declineOffSession && params.off_session) throw new Error("Your card was declined.");
        const pi = intents.get(id)!;
        pi.status = pi.capture_method === "manual" ? "requires_capture" : "succeeded";
        pi.amount_received = pi.status === "succeeded" ? pi.amount : 0;
        pi.latest_charge = next("ch");
        return pi;
      },
      cancel: async (id: string) => {
        record("paymentIntents.cancel", id);
        const pi = intents.get(id)!;
        pi.status = "canceled";
        return pi;
      },
      capture: async (id: string, params: Stripe.PaymentIntentCaptureParams) => {
        record("paymentIntents.capture", id, params);
        const pi = intents.get(id)!;
        pi.status = "succeeded";
        pi.amount_received = params.amount_to_capture ?? pi.amount;
        return pi;
      },
    },
    subscriptions: {
      retrieve: async (id: string) => {
        const sub = subscriptions.get(id);
        if (!sub) throw new Error(`No such subscription: ${id}`);
        return sub;
      },
      update: async (id: string, params: Stripe.SubscriptionUpdateParams) => {
        record("subscriptions.update", id, params);
        const sub = { ...subscriptions.get(id)!, ...params };
        subscriptions.set(id, sub);
        return sub;
      },
    },
    refunds: {
      create: async (params: Stripe.RefundCreateParams) => {
        record("refunds.create", params);
        return { id: next("re"), amount: params.amount };
      },
    },
  };

  /** Simulates the customer completing the Payment Element for a PI. */
  function succeed(id: string, paymentMethod = "pm_card_visa") {
    const pi = intents.get(id)!;
    pi.status = "succeeded";
    pi.payment_method = paymentMethod;
    pi.amount_received = pi.amount;
    pi.latest_charge = next("ch");
    return pi;
  }

  function event(type: string, object: unknown, id = next("evt")) {
    const payload = JSON.stringify({ id, object: "event", type, data: { object }, api_version: "2026-09-30.endive" });
    const header = real.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET! });
    return { payload, header, id };
  }

  /** A package subscription as Stripe returns it (card on file: pm_sub_card). */
  function addSubscription(input: {
    id: string;
    productId: string;
    customerId: string;
    periodStart: Date;
    periodEnd: Date;
  }) {
    subscriptions.set(input.id, {
      id: input.id,
      object: "subscription",
      status: "active",
      default_payment_method: "pm_sub_card",
      cancel_at_period_end: false,
      canceled_at: null,
      metadata: { productId: input.productId, customerId: input.customerId },
      items: {
        data: [
          {
            current_period_start: Math.floor(input.periodStart.getTime() / 1000),
            current_period_end: Math.floor(input.periodEnd.getTime() / 1000),
          },
        ],
      },
    });
  }

  return { client: fake as unknown as Stripe, calls, intents, succeed, event, addSubscription };
}
