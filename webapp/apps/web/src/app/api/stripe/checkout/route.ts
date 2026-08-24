// POST /api/stripe/checkout — start a checkout for a plan (creator|pro) → returns a Stripe
// Checkout session URL. The client redirects to it; on completion the webhook grants credits.
// Body: { plan?: 'creator'|'pro' } (default 'creator'). Requires an authed session AND a real
// STRIPE_SECRET_KEY (test mode). Without a key we return a clear 503 so the UI can point at
// setup rather than silently failing. The chosen plan rides in metadata so the webhook can
// grant the right tier idempotently.
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getStripe, priceIdForPlan, appUrl, hasStripeKey } from '@/lib/stripe';

type Plan = 'creator' | 'pro';
const PLANS: Plan[] = ['creator', 'pro'];

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!hasStripeKey()) {
    return NextResponse.json(
      { error: 'Stripe is not configured (STRIPE_SECRET_KEY missing). Checkout unavailable in this dev build.' },
      { status: 503 }
    );
  }

  let plan: Plan = 'creator';
  try {
    const body = (await req.json().catch(() => ({}))) as { plan?: string };
    if (body.plan && PLANS.includes(body.plan as Plan)) plan = body.plan as Plan;
  } catch {
    /* default creator */
  }

  try {
    const checkout = await getStripe().checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceIdForPlan(plan), quantity: 1 }],
      customer_email: session.user.email ?? undefined,
      client_reference_id: session.user.id,
      success_url: `${appUrl()}/billing?checkout=success`,
      cancel_url: `${appUrl()}/billing?checkout=cancelled`,
      // metadata.plan tells the webhook which tier to grant (idempotent per plan+month).
      metadata: { userId: session.user.id, plan },
    });
    return NextResponse.json({ url: checkout.url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[stripe checkout]', msg);
    return NextResponse.json({ error: `checkout failed: ${msg}` }, { status: 500 });
  }
}
