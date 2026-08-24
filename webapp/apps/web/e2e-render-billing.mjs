// T14 part 2 — REAL render through the worker, verifying the Phase-4 deduct-on-done path.
// Uses the paid user (creator sub, 500 credits). Submits a render, polls the job to done, then
// checks the ledger: grant + reserve + deduct (net = grant - cost), job status done.
import { execSync } from 'node:child_process';
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://shorts:shorts@localhost:5434/shorts';
const BASE = 'http://localhost:3000';
function sql(q) {
  return execSync(`docker exec webapp-postgres-1 psql -U shorts -d shorts -t -A -c "${q.replace(/"/g, '\\"')}"`).toString().trim();
}
async function api(path, { method = 'GET', body, token } = {}) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h['Cookie'] = `authjs.session-token=${token}`;
  const res = await fetch(`${BASE}${path}`, { method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined });
  let json = null; try { json = await res.json(); } catch {}
  return { status: res.status, json };
}
function mint(userId) {
  const t = `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  sql(`INSERT INTO sessions (session_token, user_id, expires) VALUES ('${t}', '${userId}', '${new Date(Date.now()+864e5).toISOString()}')`);
  return t;
}

const paidUser = sql(`SELECT id FROM users WHERE email='e2e-paid@local'`);
const paidProject = sql(`SELECT id FROM projects WHERE user_id='${paidUser}' LIMIT 1`);
sql(`UPDATE projects SET template='form-card' WHERE id='${paidProject}'`);
const tok = mint(paidUser);
// Reset ledger to deterministic (this test user is e2e-only).
sql(`DELETE FROM credit_ledger WHERE user_id='${paidUser}'`);
// Ensure 500 credit grant for the render (it was granted via webhook, but re-assert deterministically).
const bal0 = Number(sql(`SELECT COALESCE(MAX(balance_after),0) FROM credit_ledger WHERE user_id='${paidUser}'`)) || 0;
if (bal0 < 500) sql(`INSERT INTO credit_ledger (id, user_id, delta, reason, balance_after) VALUES (gen_random_uuid()::text, '${paidUser}', ${500 - bal0}, 'grant:test', 500)`);

const spec = {
  id: 'e2e-render-spec', title: 'e2e render', template: 'form-card', engine: 'tsx',
  format: { width: 1080, height: 1920, fps: 30 }, theme: { accent: '#6366F1' },
  voice: { engine: 'kokoro', voiceId: 'af_heart', lines: [{ text: 'hi', start: 0, end: 1 }] },
  scenes: [{ id: 's1', durationSec: 3, overlays: [], background: '#6366F1' }],
  captions: { preset: 'pill', burnIn: true },
  meta: { revision: 0, updatedAt: new Date().toISOString() },
};
console.log('submitting render (paid, expect 1080p clean)...');
const startBal = Number(await (async () => { const r = await api('/api/billing/me', { token: tok }); return r.json.creditsBalance; })());
console.log('  balance before:', startBal);
const sub = await api('/api/jobs', { method: 'POST', token: tok, body: { projectId: paidProject, inputSpec: spec, resolution: '1080p' } });
console.log('  submit status:', sub.status, JSON.stringify(sub.json ?? null));
if (sub.status !== 201) { console.log('  E2E ABORT (submit failed)'); process.exit(1); }
const jobId = sub.json.jobId;
const cost = sub.json.credits;

// Poll job until terminal (worker renders + deducts). Remotion render can take minutes.
const deadline = Date.now() + 8 * 60 * 1000;
let final = null;
while (Date.now() < deadline) {
  await new Promise(r => setTimeout(r, 4000));
  const jr = await api(`/api/jobs/${jobId}`);
  const j = jr.json ?? {};
  process.stdout.write(`  status=${j.status} progress=${Math.round((j.progress ?? 0) * 100)}%\n`);
  if (j.status === 'done') { final = j; break; }
  if (j.status === 'error' || j.status === 'failed') { final = j; break; }
}
if (!final) { console.log('  E2E ABORT (render did not finish in time)'); process.exit(1); }
console.log('  final status:', final.status, 'error:', final.error ?? '(none)');
console.log('  resultJson:', JSON.stringify(final.resultJson ?? null));

const endBal = Number((await api('/api/billing/me', { token: tok })).json.creditsBalance);
const rows = sql(`SELECT reason||':'||delta||'->'||balance_after FROM credit_ledger WHERE user_id='${paidUser}' ORDER BY created_at`);
console.log('  ledger rows:', rows || '(none)');
// Read resolution/watermark from the DB (jobs GET returns outputKey, not the full resultJson).
const rj = sql(`SELECT result_json::text FROM jobs WHERE id='${jobId}'`);
const resultJson = rj ? JSON.parse(rj) : null;
console.log('  resultJson:', JSON.stringify(resultJson));
// Paid render deducts the quoted cost ON TOP of the reserve: grant + reserve(-cost) + deduct(-cost).
const ok =
  final.status === 'done' &&
  endBal === startBal - 2 * cost &&
  resultJson?.resolution === '1080p' &&
  resultJson?.watermark === false &&
  resultJson?.width === 1080 && resultJson?.height === 1920;
console.log('  balance after:', endBal, 'expect', startBal - 2 * cost, '(grant - reserve - deduct)');
console.log('  resolution:', resultJson?.resolution, 'watermark:', resultJson?.watermark, 'dims:', resultJson?.width + 'x' + resultJson?.height);
console.log(ok ? 'RENDER-BILLING PASS' : 'RENDER-BILLING FAIL');
process.exit(ok ? 0 : 1);
