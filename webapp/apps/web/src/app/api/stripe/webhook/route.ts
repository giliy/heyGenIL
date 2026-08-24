// POST /api/stripe/webhook — Stripe webhook receiver. Signature-verified via constructEvent
// against STRIPE_WEBHOOK_SECRET. Handles:
//   checkout.session.completed       → upsert subscription (tier=creator, active) + grant credits
//   customer.subscription.updated    → update status/tier/periodEnd
//   customer.subscription.deleted    → tier→free (credits roll — never deleted)
//
// This route is PUBLIC (no auth session) — Stripe servers call it. Verified by signature only.
// The middleware must NOT require a session for /api/stripe/webhook (see middleware.ts).
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { constructWebhookEvent, creditsPerPeriod } from '@/lib/stripe';
import { getDb, users, subscriptions, appendLedger } from '@shorts/db';
import { eq } from 'drizzle-orm';

const db = getDb();

/** Year-month tag for the grant reason ('grant:creator:2026-08'). */
function yearMonth(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function upsertSubscription(opts: {
  userId: string;
  stripeCustomerId: string | null;
  stripeSubId: string | null;
  tier: 'free' | 'creator' | 'pro';
  status: string;
  currentPeriodEnd: Date | null;
  creditsGranted: number;
}) {
  const existing = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, opts.userId),
  });
  if (existing) {
    await db
      .update(subscriptions)
      .set({
        stripeCustomerId: opts.stripeCustomerId ?? existing.stripeCustomerId,
        stripeSubId: opts.stripeSubId ?? existing.stripeSubId,
        tier: opts.tier,
        status: opts.status,
        currentPeriodEnd: opts.currentPeriodEnd,
        creditsGranted: opts.creditsGranted,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.userId, opts.userId));
  } else {
    await db.insert(subscriptions).values({
      userId: opts.userId,
      stripeCustomerId: opts.stripeCustomerId,
      stripeSubId: opts.stripeSubId,
      tier: opts.tier,
      status: opts.status,
      currentPeriodEnd: opts.currentPeriodEnd,
      creditsGranted: opts.creditsGranted,
    });
  }
}

export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature');
  if (!sig) {
    return NextResponse.json({ error: 'missing stripe-signature header' }, { status: 400 });
  }

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(rawBody, sig);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `signature verification failed: ${msg}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        // Identify the user: client_reference_id (we set it = userId) or customer_email.
        const refId = session.client_reference_id;
        const email = session.customer_details?.email ?? session.customer_email ?? undefined;
        let user = null;
        if (refId) {
          user = await db.query.users.findFirst({ where: eq(users.id, refId) });
        }
        if (!user && email) {
          user = await db.query.users.findFirst({ where: eq(users.email, email) });
        }
        if (!user) {
          return NextResponse.json({ error: 'user not found for checkout session' }, { status: 404 });
        }

        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null;
        const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id ?? null;
        const grant = creditsPerPeriod();

        // The plan the user bought rides in checkout metadata (set by /api/stripe/checkout).
        const plan = session.metadata?.plan === 'pro' ? 'pro' : 'creator';

        // Idempotent per plan+month: a webhook replay for the same plan+month grants once.
        const reason = `grant:${plan}:${yearMonth()}`;
        const already = await db.query.creditLedger.findFirst({
          where: (t, { and, eq: e2 }) => and(e2(t.userId, user.id), e2(t.reason, reason)),
        });
        await upsertSubscription({
          userId: user.id,
          stripeCustomerId: customerId,
          stripeSubId: subId,
          tier: plan,
          status: 'active',
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 3600 * 1000), // ~1 month (test)
          creditsGranted: grant,
        });
        if (!already) {
          await appendLedger(user.id, grant, reason, undefined, db);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
        const row = await db.query.subscriptions.findFirst({
          where: eq(subscriptions.stripeCustomerId, customerId ?? ''),
        });
        if (!row) break;
        const status = sub.status; // active|trialing|past_due|canceled|incomplete...
        const activeLike = status === 'active' || status === 'trialing';
        // Preserve the stored tier (creator|pro) when still active; only demote to free when
        // the subscription lapses. Never hardcode 'creator' — Pro must survive renewal updates.
        await db
          .update(subscriptions)
          .set({
            status,
            tier: activeLike ? row.tier : 'free',
            currentPeriodEnd: sub.items.data[0]?.current_period_end
              ? new Date(sub.items.data[0].current_period_end * 1000)
              : row.currentPeriodEnd,
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.userId, row.userId));
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
        const row = await db.query.subscriptions.findFirst({
          where: eq(subscriptions.stripeCustomerId, customerId ?? ''),
        });
        if (!row) break;
        // Cancel → free tier. Leftover credits ROLL (never deleted) — "keeps projects forever".
        await db
          .update(subscriptions)
          .set({ status: 'canceled', tier: 'free', updatedAt: new Date() })
          .where(eq(subscriptions.userId, row.userId));
        break;
      }

      default:
        // Unhandled event type — acknowledge so Stripe stops retrying.
        break;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[stripe webhook] handler error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
