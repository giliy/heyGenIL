// Server-side Stripe client + config (TEST MODE on localhost).
// Centralizes the Stripe construction so every route shares one instance and the
// missing-key behavior is consistent. In this dev environment there may be NO real
// sk_test_ key — the webhook path still works (it only needs STRIPE_WEBHOOK_SECRET),
// while checkout/portal require the key and return a clear error without it.
import Stripe from 'stripe';

let _stripe: Stripe | null = null;

/** The Stripe client. Throws if STRIPE_SECRET_KEY is missing (checkout/portal need it). */
export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      'STRIPE_SECRET_KEY is not set — add a test key (sk_test_...) to apps/web/.env.local to enable checkout/portal'
    );
  }
  _stripe = new Stripe(key, { apiVersion: '2026-07-29.dahlia' });
  return _stripe;
}

/** True when a real-looking STRIPE_SECRET_KEY is present (sk_test_/sk_live_). */
export function hasStripeKey(): boolean {
  const key = process.env.STRIPE_SECRET_KEY;
  return !!key && /^sk_(test|live)_/.test(key);
}

export function stripeWebhookSecret(): string {
  const s = process.env.STRIPE_WEBHOOK_SECRET;
  if (!s) throw new Error('STRIPE_WEBHOOK_SECRET is not set');
  return s;
}

// The Stripe SDK's webhooks.constructEvent is a pure HMAC function — it needs the endpoint
// secret (whsec_...) but NOT the API key. To verify + parse a webhook without requiring a real
// sk_test_ key, build a keyless client on the fly (Stripe() requires a non-empty string, so we
// pass a placeholder — constructEvent never calls the API).
let _webhookClient: Stripe | null = null;
export function constructWebhookEvent(rawBody: string, signature: string): Stripe.Event {
  if (!_webhookClient) {
    _webhookClient = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder_webhook_only', {
      apiVersion: '2026-07-29.dahlia',
    });
  }
  return _webhookClient.webhooks.constructEvent(rawBody, signature, stripeWebhookSecret());
}

export function creditsPerPeriod(): number {
  const n = Number(process.env.CREDITS_PER_PERIOD ?? '500');
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 500;
}

export function freeRendersPerMonth(): number {
  const n = Number(process.env.FREE_RENDERS_PER_MONTH ?? '10');
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 10;
}

export function appUrl(): string {
  return (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
}

export function creatorPriceId(): string {
  const p = process.env.STRIPE_PRICE_CREATOR;
  if (!p) throw new Error('STRIPE_PRICE_CREATOR is not set');
  return p;
}

export function proPriceId(): string {
  const p = process.env.STRIPE_PRICE_PRO;
  if (!p) throw new Error('STRIPE_PRICE_PRO is not set');
  return p;
}

/** Resolve a plan name ('creator'|'pro') to its Stripe price id. */
export function priceIdForPlan(plan: 'creator' | 'pro'): string {
  return plan === 'pro' ? proPriceId() : creatorPriceId();
}
