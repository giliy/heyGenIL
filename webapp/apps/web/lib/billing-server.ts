// billing-server.ts — server-side tier/subscription resolution. Single source of truth for
// "what is this user's tier right now" used by /api/billing/me, the render gate, and the
// AI-image gate. A user with no subscriptions row is on the FREE tier.
import { getDb, subscriptions, type Db } from '@shorts/db';
import { eq } from 'drizzle-orm';

export type Tier = 'free' | 'creator' | 'pro';

export interface BillingInfo {
  tier: Tier;
  status: string;
  currentPeriodEnd: Date | null;
  creditsGranted: number;
  stripeCustomerId: string | null;
  stripeSubId: string | null;
}

/** Resolve the user's billing state. No row → free tier, active. */
export async function getBillingInfo(userId: string, db: Db = getDb()): Promise<BillingInfo> {
  const sub = await db.query.subscriptions.findFirst({ where: eq(subscriptions.userId, userId) });
  if (!sub) {
    return {
      tier: 'free',
      status: 'active',
      currentPeriodEnd: null,
      creditsGranted: 0,
      stripeCustomerId: null,
      stripeSubId: null,
    };
  }
  // A canceled/past_due subscription falls back to free (credits already granted are kept).
  const activeLike = sub.status === 'active' || sub.status === 'trialing';
  const tier: Tier = activeLike ? sub.tier : 'free';
  return {
    tier,
    status: sub.status,
    currentPeriodEnd: sub.currentPeriodEnd,
    creditsGranted: sub.creditsGranted,
    stripeCustomerId: sub.stripeCustomerId,
    stripeSubId: sub.stripeSubId,
  };
}

/** Is this tier a paid (non-free) tier? Drives every paid gate. */
export function isPaidTier(tier: Tier): boolean {
  return tier !== 'free';
}
