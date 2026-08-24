// GET /api/billing/tiers — publish the tier → capability unlock matrix + per-block credit
// basis as DATA so the billing page and wizard never hardcode tier math. Pure read of the
// shared TIERS/CREDIT_BASIS tables in @shorts/spec; no ledger touch. The `free` rendersPerMonth
// reflects the env override (FREE_RENDERS_PER_MONTH) so the published number matches what the
// render gate enforces.
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { TIERS, CREDIT_BASIS, getTier } from '@shorts/spec';
import { freeRendersPerMonth } from '@/lib/stripe';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // free.rendersPerMonth is the env-backed default — surface the effective number.
  const free = getTier('free');
  const tiers = TIERS.map((t) =>
    t.id === 'free' ? { ...t, rendersPerMonth: freeRendersPerMonth() } : t
  );

  return NextResponse.json({ tiers, creditBasis: CREDIT_BASIS });
}
