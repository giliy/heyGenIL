// ledger.test.ts — reserve/deduct/refund transitions against a live Postgres.
// Skips cleanly when DATABASE_URL is unset (CI without a DB); otherwise exercises the
// real transactional append-only ledger, incl. the net-zero-on-fail invariant.
import { describe, it, expect, beforeAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { createDb, users, projects, jobs, creditLedger } from './index';
import { balanceOf, reserveCredits, deductCredits, refundCredits, countLedgerSince } from './ledger';
import type { Db } from './client';

const HAS_DB = !!process.env.DATABASE_URL;
const d = HAS_DB ? describe : describe.skip;

let db: Db;
let userId: string;
let projectId: string;

async function clean() {
  await db.delete(creditLedger).where(sql`true`);
  await db.delete(jobs).where(sql`true`);
  await db.delete(projects).where(sql`true`);
  await db.delete(users).where(sql`true`);
}

d('ledger (live DB)', () => {
  beforeAll(async () => {
    db = createDb(process.env.DATABASE_URL!);
    await clean();
    const [u] = await db.insert(users).values({ email: `ledger-${Date.now()}@test.local` }).returning();
    userId = u.id;
    const [p] = await db
      .insert(projects)
      .values({ userId, title: 'Ledger test', template: 'Short16Formy' })
      .returning();
    projectId = p.id;
  });

  async function newJob(): Promise<string> {
    const [j] = await db
      .insert(jobs)
      .values({ projectId, type: 'render', status: 'queued', stage: 'queued' })
      .returning();
    return j.id;
  }

  it('starts at balance 0 with no rows', async () => {
    expect(await balanceOf(userId, db)).toBe(0);
  });

  it('reserve then deduct leaves balance -spend (the charge)', async () => {
    const jobId = await newJob();
    const after1 = await reserveCredits(userId, 3, jobId, 'reserve:render', db);
    expect(after1).toBe(-3);
    const after2 = await deductCredits(userId, 3, jobId, 'deduct:render', db);
    expect(after2).toBe(-6); // reserve hold + actual spend
    expect(await balanceOf(userId, db)).toBe(-6);
  });

  it('reserve then refund returns to start (net-zero on fail)', async () => {
    // reset balance to a known point by reading current
    const before = await balanceOf(userId, db);
    const jobId = await newJob();
    await reserveCredits(userId, 4, jobId, 'reserve:render', db);
    await refundCredits(userId, 4, jobId, 'refund:fail', db);
    expect(await balanceOf(userId, db)).toBe(before); // unchanged after reserve+refund
  });

  it('materialized balanceAfter chains monotonically', async () => {
    const rows = await db
      .select()
      .from(creditLedger)
      .where(sql`"user_id" = ${userId}`)
      .orderBy(creditLedger.createdAt, creditLedger.id);
    // each row's balanceAfter == previous balanceAfter + delta
    let prev = 0;
    for (const r of rows) {
      expect(r.balanceAfter).toBe(prev + r.delta);
      prev = r.balanceAfter;
    }
  });

  it('countLedgerSince counts deduct:render rows for the quota', async () => {
    const n = await countLedgerSince(userId, 'deduct:render', new Date(Date.now() - 3600_000), db);
    expect(n).toBe(1); // one deduct:render above
  });

  it('rejects non-positive amounts', async () => {
    await expect(reserveCredits(userId, 0, await newJob(), 'reserve:render', db)).rejects.toThrow();
    await expect(deductCredits(userId, -1, await newJob(), 'deduct:render', db)).rejects.toThrow();
  });
});
