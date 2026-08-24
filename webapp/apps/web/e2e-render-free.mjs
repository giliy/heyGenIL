// T14 — FREE tier render through the real worker: asserts 720p + watermark + exact credit deduct.
import { execSync } from 'node:child_process';
const BASE = 'http://localhost:3000';
function sql(q) { return execSync(`docker exec webapp-postgres-1 psql -U shorts -d shorts -t -A -c "${q.replace(/"/g, '\\"')}"`).toString().trim(); }
async function api(path, { method = 'GET', body, token } = {}) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h['Cookie'] = `authjs.session-token=${token}`;
  const res = await fetch(`${BASE}${path}`, { method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined });
  let json = null; try { json = await res.json(); } catch {}
  return { status: res.status, json };
}
function mint(userId) {
  const t = `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  sql(`INSERT INTO sessions (session_token,user_id,expires) VALUES ('${t}','${userId}','${new Date(Date.now()+864e5).toISOString()}')`);
  return t;
}
const freeUser = sql(`SELECT id FROM users WHERE email='e2e-free@local'`);
const freeProject = sql(`SELECT id FROM projects WHERE user_id='${freeUser}' LIMIT 1`);
sql(`UPDATE projects SET template='form-card' WHERE id='${freeProject}'`);
const tok = mint(freeUser);
sql(`DELETE FROM credit_ledger WHERE user_id='${freeUser}'`);
sql(`INSERT INTO credit_ledger (id,user_id,delta,reason,balance_after) VALUES (gen_random_uuid()::text,'${freeUser}',10,'grant:test',10)`);
const spec = {
  id: 'e2e-free-spec', title: 'e2e free', template: 'form-card', engine: 'tsx',
  format: { width: 1080, height: 1920, fps: 30 }, theme: { accent: '#6366F1' },
  voice: { engine: 'kokoro', voiceId: 'af_heart', lines: [{ text: 'hi', start: 0, end: 1 }] },
  scenes: [{ id: 's1', durationSec: 3, overlays: [], background: '#6366F1' }],
  captions: { preset: 'pill', burnIn: true },
  meta: { revision: 0, updatedAt: new Date().toISOString() },
};
const startBal = (await api('/api/billing/me', { token: tok })).json.creditsBalance;
const sub = await api('/api/jobs', { method: 'POST', token: tok, body: { projectId: freeProject, inputSpec: spec, resolution: '1080p' } });
console.log('submit (free, client asks 1080p):', sub.status, JSON.stringify(sub.json ?? null));
if (sub.status !== 201) { console.log('ABORT'); process.exit(1); }
// FREE tier must be forced to 720p + watermark server-side even though client asked 1080p.
const forced720 = sub.json.resolution === '720p' && sub.json.watermark === true;
console.log('  server forced 720p+watermark:', forced720 ? 'PASS' : 'FAIL', '(', sub.json.resolution, '/', sub.json.watermark, ')');
const jobId = sub.json.jobId; const cost = sub.json.credits;
const deadline = Date.now() + 8 * 60 * 1000; let final = null;
while (Date.now() < deadline) {
  await new Promise(r => setTimeout(r, 4000));
  const j = (await api(`/api/jobs/${jobId}`)).json ?? {};
  process.stdout.write(`  status=${j.status} progress=${Math.round((j.progress ?? 0)*100)}%\n`);
  if (j.status === 'done' || j.status === 'error' || j.status === 'failed') { final = j; break; }
}
if (!final) { console.log('ABORT timeout'); process.exit(1); }
const rj = sql(`SELECT result_json::text FROM jobs WHERE id='${jobId}'`);
const resultJson = rj ? JSON.parse(rj) : null;
const endBal = (await api('/api/billing/me', { token: tok })).json.creditsBalance;
console.log('  final status:', final.status);
console.log('  resultJson:', JSON.stringify(resultJson));
console.log('  ledger:', sql(`SELECT reason||':'||delta||'->'||balance_after FROM credit_ledger WHERE user_id='${freeUser}' ORDER BY created_at`) || '(none)');
const ok = forced720 && final.status === 'done' && resultJson?.resolution === '720p' && resultJson?.watermark === true && resultJson?.width === 720 && resultJson?.height === 1280 && endBal === startBal - 2 * cost;
console.log('  balance after:', endBal, 'expect', startBal - 2 * cost, '(grant - reserve - deduct)');
console.log('  resolution:', resultJson?.resolution, 'watermark:', resultJson?.watermark, 'dims:', resultJson?.width + 'x' + resultJson?.height);
console.log(ok ? 'FREE-RENDER PASS (720p + watermark + charged)' : 'FREE-RENDER FAIL');
process.exit(ok ? 0 : 1);
