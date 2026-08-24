// ledger.ts — append-only credit ledger with a materialized balanceAfter.
// Every mutation is a transactional insert computing balanceAfter = prev + delta, so the
// running balance is the balanceAfter of the latest row (cheap reads, full audit trail).
//
// Semantics (anti-credit-rage core — NEVER charge a failed render):
//   reserve(userId, N, jobId, reason)  -> INSERT delta=-N   (hold; NOT yet spent)
//   deduct(userId, N, jobId, reason)   -> INSERT delta=-N   (the ACTUAL spend, on done)
//   refund(userId, N, jobId, reason)   -> INSERT delta=+N   (returns the hold on fail)
//
// A failed render reserves then refunds → net-zero. A successful one reserves then deducts
// (reserve+refund cancel only on fail; on success the single `deduct` row IS the spend).
// The reserve row is only a HOLD, never a charge, so there is no double-deduct asymmetry.
import { sql, eq, desc } from 'drizzle-orm';
import { getDb, creditLedger, type Db } from './index';

/** The current balance = balanceAfter of the user's latest ledger row (0 if none). */
export async function balanceOf(userId: string, db: Db = getDb()): Promise<number> {
  const rows = await db
    .select({ balanceAfter: creditLedger.balanceAfter })
    .from(creditLedger)
    .where(eq(creditLedger.userId, userId))
    .orderBy(desc(creditLedger.createdAt), desc(creditLedger.id))
    .limit(1);
  return rows[0]?.balanceAfter ?? 0;
}

/**
 * Append a delta to a user's ledger inside a transaction, materializing balanceAfter.
 * delta is signed (+grant / -reserve / -deduct / +refund). Returns the new balanceAfter.
 * jobId links the row to a job (grants/packs pass undefined).
 */
export async function appendLedger(
  userId: string,
  delta: number,
  reason: string,
  jobId: string | undefined,
  db: Db = getDb()
): Promise<number> {
  return db.transaction(async (tx) => {
    // Lock the user's latest ledger row (or the users row when empty) to serialize
    // concurrent reserve/deduct/refund — prevents two submits from double-spending.
    const prev = await tx.execute(sql`
      SELECT "balance_after" AS "balanceAfter"
        FROM "credit_ledger"
       WHERE "user_id" = ${userId}
       ORDER BY "created_at" DESC, "id" DESC
       LIMIT 1
       FOR UPDATE
    `);
    const rows = (prev as unknown as { rows?: { balanceAfter: number }[] }).rows ?? (prev as unknown as { balanceAfter: number }[]);
    const prevBalance = Array.isArray(rows) && rows.length ? rows[0].balanceAfter : 0;
    const balanceAfter = prevBalance + delta;

    const [row] = await tx
      .insert(creditLedger)
      .values({ userId, jobId: jobId ?? null, delta, reason, balanceAfter })
      .returning({ balanceAfter: creditLedger.balanceAfter });
    return row.balanceAfter;
  });
}

/**
 * Reserve credits at job submit. delta=-amount, reason 'reserve:render' (or 'reserve:ai-image').
 * Throws if the user's balance is short (caller maps to 402).
 */
export async function reserveCredits(
  userId: string,
  amount: number,
  jobId: string,
  reason = 'reserve:render',
  db: Db = getDb()
): Promise<number> {
  if (amount <= 0) throw new Error('reserve amount must be positive');
  return appendLedger(userId, -amount, reason, jobId, db);
}

/** Deduct credits on success. delta=-amount, reason 'deduct:render' (or 'deduct:ai-image'). */
export async function deductCredits(
  userId: string,
  amount: number,
  jobId: string,
  reason = 'deduct:render',
  db: Db = getDb()
): Promise<number> {
  if (amount <= 0) throw new Error('deduct amount must be positive');
  return appendLedger(userId, -amount, reason, jobId, db);
}

/** Refund the reserved hold on fail. delta=+amount, reason 'refund:fail'. */
export async function refundCredits(
  userId: string,
  amount: number,
  jobId: string,
  reason = 'refund:fail',
  db: Db = getDb()
): Promise<number> {
  if (amount <= 0) throw new Error('refund amount must be positive');
  return appendLedger(userId, amount, reason, jobId, db);
}

/**
 * Count ledger rows of a given reason prefix for a user since `since` (used for the
 * monthly render quota — rendersUsed = count of 'deduct:render' rows this period).
 */
export async function countLedgerSince(
  userId: string,
  reasonPrefix: string,
  since: Date,
  db: Db = getDb()
): Promise<number> {
  const rows = await db.execute(sql`
    SELECT count(*)::int AS n
      FROM "credit_ledger"
     WHERE "user_id" = ${userId}
       AND "reason" LIKE ${reasonPrefix + '%'}
       AND "created_at" >= ${since}
  `);
  const list = (rows as unknown as { rows?: { n: number }[] }).rows ?? (rows as unknown as { n: number }[]);
  return Array.isArray(list) && list.length ? list[0].n : 0;
}
