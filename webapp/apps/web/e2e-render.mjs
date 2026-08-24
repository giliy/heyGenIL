// T11 — Render dialog -> enqueue real job -> poll to done -> capture the download URL.
// The worker (apps/worker, :3100) actually renders via @remotion/renderer.
import { chromium } from 'playwright';

const TOKEN = process.argv[2];
const PROJECT = 'mvvj0p9kqw2i1tzp135q74ef';
const BASE = 'http://localhost:3000';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1700, height: 1050 } });
await ctx.addCookies([{ name: 'authjs.session-token', value: TOKEN, domain: 'localhost', path: '/' }]);
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEEXCEPTION:', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE[error]:', m.text().slice(0, 200)); });

// Capture the jobs POST response (to get jobId) and poll responses.
let jobId = null;
let lastJob = null;
page.on('response', async (res) => {
  const url = res.url();
  if (url.endsWith('/api/jobs') && res.request().method() === 'POST') {
    try { const b = await res.json(); jobId = b.jobId; console.log('ENQUEUED jobId:', jobId, 'status', res.status()); } catch {}
  }
  if (jobId && url.endsWith(`/api/jobs/${jobId}`)) {
    try { lastJob = await res.json(); } catch {}
  }
});

await page.goto(`${BASE}/editor/${PROJECT}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(4000);

// Open Render dialog and start the render.
await page.getByRole('button', { name: 'Render', exact: true }).click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: 'Start render' }).click();
console.log('render started; polling…');

// Poll until done/error (max ~12 min for a 36s render on this box).
const deadline = Date.now() + 12 * 60 * 1000;
let final = null;
while (Date.now() < deadline) {
  await page.waitForTimeout(3000);
  const state = await page.evaluate(() => {
    const t = document.body.innerText;
    if (t.includes('Render complete.')) return 'done';
    if (t.includes('Render failed.')) return 'error';
    const m = t.match(/(\d+)%/);
    return m ? `rendering ${m[1]}%` : 'rendering';
  });
  if (state === 'done') {
    const url = await page.evaluate(() => {
      const a = Array.from(document.querySelectorAll('a')).find((x) => x.textContent.includes('Download mp4'));
      return a ? a.getAttribute('href') : null;
    });
    final = { state, url, lastJob };
    break;
  }
  if (state === 'error') {
    const err = await page.evaluate(() => document.body.innerText.slice(0, 300));
    final = { state, err, lastJob };
    break;
  }
  process.stdout.write(`  ${state}  (job.progress=${lastJob?.progress ?? '?'})\n`);
}
console.log('FINAL:', JSON.stringify(final, null, 2));
await browser.close();
process.exit(final && final.state === 'done' ? 0 : 1);
