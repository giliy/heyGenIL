// GET /api/billing/ledger — the user's append-only credit ledger, newest first.
// Powers the ledger table on /billing. Capped at 100 rows.
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDb, creditLedger } from '@shorts/db';
import { eq, desc } from 'drizzle-orm';

const db = getDb();

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;
  const rows = await db
    .select({
      id: creditLedger.id,
      delta: creditLedger.delta,
      reason: creditLedger.reason,
      balanceAfter: creditLedger.balanceAfter,
      createdAt: creditLedger.createdAt,
    })
    .from(creditLedger)
    .where(eq(creditLedger.userId, userId))
    .orderBy(desc(creditLedger.createdAt))
    .limit(100);

  return NextResponse.json({
    rows: rows.map((r) => ({
      id: r.id,
      delta: r.delta,
      reason: r.reason,
      balanceAfter: r.balanceAfter,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
    })),
  });
}
