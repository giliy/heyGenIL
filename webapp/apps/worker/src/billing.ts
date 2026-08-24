// worker billing — atomic deduct-on-done + auto-refund-on-fail for render/generate jobs.
// Both the creditLedger row and the job-status update happen in ONE Postgres transaction so
// there is never a charge without a finished render nor a render marked done without the
// charge. Never double-deduct: the reserve row (at submit) is a HOLD, the single deduct row is
// the actual spend, and refund (+reserved) cancels the hold on fail → net-zero.
import { getDb, creditLedger, type Db } from '@shorts/db';
import { sql } from 'drizzle-orm';

/**
 * Atomically mark a render/generate job DONE and DEDUCT its reserved credits.
 * Returns the new balanceAfter. On any error the transaction rolls back — the job stays
 * running and credits are untouched, so the caller may retry.
 */
export async function completeAndDeduct(
  db: Db,
  jobId: string,
  userId: string,
  reservedCredits: number,
  reason = 'deduct:render'
): Promise<number> {
  return db.transaction(async (tx) => {
    const balanceAfter = await appendWithin(tx, userId, -reservedCredits, reason, jobId);
    await tx.execute(sql`
      UPDATE "jobs"
         SET "status"='done', "stage"='complete', "progress"=1, "finished_at"=now()
       WHERE "id" = ${jobId}
    `);
    return balanceAfter;
  });
}

/**
 * Atomically mark a job FAILED and REFUND its reserved credits (delta=+reserved).
 * Returns the new balanceAfter. On fail there is no deduct — reserve+refund net to zero.
 */
export async function failAndRefund(
  db: Db,
  jobId: string,
  userId: string,
  reservedCredits: number,
  error: string,
  reason = 'refund:fail'
): Promise<number> {
  return db.transaction(async (tx) => {
    const balanceAfter = await appendWithin(tx, userId, reservedCredits, reason, jobId);
    await tx.execute(sql`
      UPDATE "jobs"
         SET "status"='failed', "stage"='render', "error"=${error}, "finished_at"=now()
       WHERE "id" = ${jobId}
    `);
    return balanceAfter;
  });
}

/**
 * Append a signed delta to a user's ledger inside an EXISTING transaction, locking the
 * latest ledger row (or the users row when empty) to serialize concurrent mutations, and
 * materializing balanceAfter. Mirrors packages/db/src/ledger.ts but accepts a transaction.
 */
async function appendWithin(
  tx: Db,
  userId: string,
  delta: number,
  reason: string,
  jobId: string | undefined
): Promise<number> {
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

  // Use the ORM insert (not raw SQL) so the cuid2 $defaultFn generates the PK — the raw-SQL
  // path below it omits `id`, which has no DB-side default and would violate NOT NULL.
  await tx.insert(creditLedger).values({
    userId,
    jobId: jobId ?? null,
    delta,
    reason,
    balanceAfter,
  });
  return balanceAfter;
}
