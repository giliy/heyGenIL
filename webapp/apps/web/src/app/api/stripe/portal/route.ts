// POST /api/stripe/portal — Customer Portal URL (manage/cancel subscription).
// Requires an authed session, a real STRIPE_SECRET_KEY, and an existing stripeCustomerId.
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getStripe, appUrl, hasStripeKey } from '@/lib/stripe';
import { getDb, subscriptions } from '@shorts/db';
import { eq } from 'drizzle-orm';

const db = getDb();

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!hasStripeKey()) {
    return NextResponse.json(
      { error: 'Stripe is not configured (STRIPE_SECRET_KEY missing). Portal unavailable in this dev build.' },
      { status: 503 }
    );
  }

  const sub = await db.query.subscriptions.findFirst({ where: eq(subscriptions.userId, session.user.id) });
  if (!sub?.stripeCustomerId) {
    return NextResponse.json({ error: 'no active Stripe customer' }, { status: 404 });
  }

  try {
    const portal = await getStripe().billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${appUrl()}/billing`,
    });
    return NextResponse.json({ url: portal.url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[stripe portal]', msg);
    return NextResponse.json({ error: `portal failed: ${msg}` }, { status: 500 });
  }
}
