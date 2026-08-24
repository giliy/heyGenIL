// Phase 2 interaction e2e (v2 — geometry-aware).
import { chromium } from 'playwright';

const TOKEN = process.argv[2];
const PROJECT = 'mvvj0p9kqw2i1tzp135q74ef';
const BASE = 'http://localhost:3000';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1700, height: 1050 } });
await ctx.addCookies([{ name: 'authjs.session-token', value: TOKEN, domain: 'localhost', path: '/' }]);
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[PAGEEXCEPTION] ${e.message}`));
page.on('requestfailed', (r) => logs.push(`[REQFAIL] ${r.url()} :: ${r.failure()?.errorText}`));

const results = {};
const pass = (k, v) => { results[k] = { ok: true, v }; console.log(`PASS ${k}: ${JSON.stringify(v)}`); };
const fail = (k, msg) => { results[k] = { ok: false, v: msg }; console.log(`FAIL ${k}: ${msg}`); };

// Helpers
const compBox = () => page.evaluate(() => {
  const d = document.querySelector('.__remotion-player');
  if (!d) return null;
  const r = d.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height, scale: r.width / 1080 };
});
// Screen point for a comp-space point
const toScreen = (box, cx, cy) => ({ sx: box.x + cx * box.scale, sy: box.y + cy * box.scale });
const dashedBox = () => page.evaluate(() => {
  const t = Array.from(document.querySelectorAll('div')).find((d) => (d.style.border || '').includes('dashed'));
  if (!t) return null;
  const r = t.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});

await page.goto(`${BASE}/editor/${PROJECT}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(5000);
await page.waitForFunction(() => !!document.querySelector('.__remotion-player'), { timeout: 20000 });
await page.waitForTimeout(1500);

// --- T6: select + drag hook-title-1 (comp x40..1040 y240..340) ---
try {
  let box = await compBox();
  const { sx, sy } = toScreen(box, 540, 290);
  await page.mouse.click(sx, sy);
  await page.waitForTimeout(900);
  const d0 = await dashedBox();
  pass('T6a-select', { clicked: [Math.round(sx), Math.round(sy)], dashed: !!d0 });

  if (d0) {
    // Drag the dashed target by +40/+30 screen px -> +dx/scale comp px
    await page.mouse.move(d0.x + d0.w / 2, d0.y + d0.h / 2);
    await page.mouse.down();
    await page.mouse.move(d0.x + d0.w / 2 + 40, d0.y + d0.h / 2 + 30, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(900);
    const d1 = await dashedBox();
    const moved = d1 && (Math.round(d1.x) !== Math.round(d0.x) || Math.round(d1.y) !== Math.round(d0.y));
    pass('T6b-drag', { from: d0, to: d1, moved });
  }
} catch (e) { fail('T6', e.message); }

// --- T5: scenes add/duplicate/delete/undo (scope buttons to the SELECTED scene card) ---
try {
  const sceneCount = async () => page.evaluate(() =>
    Array.from(document.querySelectorAll('li')).filter((li) => li.innerText.includes('Scene ')).length);
  const selectedCard = page.locator('li.border-signal').first();
  const n0 = await sceneCount();
  await page.getByRole('button', { name: '+ Add' }).click();
  await page.waitForTimeout(600);
  const n1 = await sceneCount();
  await selectedCard.locator('button[title="Duplicate"]').click();
  await page.waitForTimeout(600);
  const n2 = await sceneCount();
  await selectedCard.locator('button[title="Delete scene"]').click();
  await page.waitForTimeout(600);
  const n3 = await sceneCount();
  pass('T5-scenes', { n0, n1, n2, n3, ok: n1 === n0 + 1 && n2 === n1 + 1 && n3 === n2 - 1 });
  for (let i = 0; i < 3; i++) await page.keyboard.press('Control+z');
  await page.waitForTimeout(600);
  const n4 = await sceneCount();
  pass('T5d-undo', { n4, restored: n4 === n0 });
} catch (e) { fail('T5', e.message); }

// --- T7: captions display-only + banner + undo ---
try {
  await page.getByRole('button', { name: 'Captions', exact: true }).click();
  await page.waitForTimeout(600);
  const ta = page.locator('textarea[aria-label^="Caption line"]');
  const count = await ta.count();
  const original = await ta.nth(0).inputValue();
  await ta.nth(0).click();
  await ta.nth(0).press('End');
  await ta.nth(0).pressSequentially(' ZZ', { delay: 10 });
  await page.waitForTimeout(500);
  const banner = await page.evaluate(() => document.body.innerText.includes('Captions preview-only'));
  pass('T7-edit-banner', { count, edited: (await ta.nth(0).inputValue()).endsWith(' ZZ'), banner });
  // We typed 3 chars (space,Z,Z) = 3 undo entries; undo 3x to restore original.
  for (let i = 0; i < 3; i++) await page.keyboard.press('Control+z');
  await page.waitForTimeout(500);
  const restored = await ta.nth(0).inputValue();
  pass('T7-undo', { restored, ok: restored === original });
} catch (e) { fail('T7', e.message); }

// --- T4: title PATCH + autosave ---
try {
  await page.getByRole('button', { name: 'Scenes', exact: true }).click();
  await page.waitForTimeout(400);
  const title = 'Formy — e2e ' + Date.now().toString().slice(-5);
  const ti = page.getByRole('textbox', { name: 'Project title' });
  await ti.click();
  await ti.pressSequentially(title, { delay: 5 });
  // clear original then type: simpler to fill via select-all
  await ti.press('Control+a');
  await ti.pressSequentially(title, { delay: 5 });
  await page.waitForFunction(() =>
    /Saved|Saving/.test(document.querySelector('[role="status"]')?.innerText || ''), { timeout: 9000 });
  await page.waitForTimeout(1200);
  const status = await page.evaluate(() => document.querySelector('[role="status"]')?.innerText);
  pass('T4-title', { status });
} catch (e) { fail('T4', e.message); }

await page.screenshot({ path: 'interact-final.png' });
const hardErrors = logs.filter((l) => l.startsWith('[PAGEEXCEPTION]') || l.startsWith('[REQFAIL]'));
console.log(`--- HARD ERRORS: ${hardErrors.length} ---`);
hardErrors.slice(0, 15).forEach((l) => console.log(l));
const fails = Object.values(results).filter((r) => !r.ok).length;
console.log(`=== SUMMARY: ${Object.keys(results).length} checks, ${fails} failed ===`);
process.exit(fails ? 1 : 0);
