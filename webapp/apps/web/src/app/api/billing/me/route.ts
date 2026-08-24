// GET /api/billing/me — the single source for the top-bar credit meter + tier gating.
// Returns tier/status/periodEnd, the live credit balance, the period grant, and the
// monthly render quota (rendersUsed = count of 'deduct:render' ledger rows this period).
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDb } from '@shorts/db';
import { balanceOf, countLedgerSince } from '@shorts/db';
import { getBillingInfo } from '@/lib/billing-server';
import { freeRendersPerMonth } from '@/lib/stripe';

const db = getDb();

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;
  const info = await getBillingInfo(userId, db);
  const creditsBalance = await balanceOf(userId, db);

  // Period start: the subscription period start, else the first of the current month.
  const now = new Date();
  const periodStart = info.currentPeriodEnd
    ? new Date(info.currentPeriodEnd.getTime() - 30 * 24 * 3600 * 1000)
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const rendersUsed = await countLedgerSince(userId, 'deduct:render', periodStart, db);
  const rendersMax = info.tier === 'free' ? freeRendersPerMonth() : Number.POSITIVE_INFINITY;

  return NextResponse.json({
    tier: info.tier,
    status: info.status,
    currentPeriodEnd: info.currentPeriodEnd?.toISOString() ?? null,
    creditsBalance,
    creditsGranted: info.creditsGranted,
    quotas: {
      rendersUsed,
      // JSON-serialize Infinity as null for paid (unbounded quota display).
      rendersMax: info.tier === 'free' ? rendersMax : null,
    },
  });
}
