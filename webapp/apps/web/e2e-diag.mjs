// Diagnostic: does the click reach the stage wrapper onClick, or does the Player consume it?
import { chromium } from 'playwright';

const TOKEN = process.argv[2];
const PROJECT = 'mvvj0p9kqw2i1tzp135q74ef';
const BASE = 'http://localhost:3000';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1700, height: 1050 } });
await ctx.addCookies([{ name: 'authjs.session-token', value: TOKEN, domain: 'localhost', path: '/' }]);
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEEXCEPTION:', e.message));

await page.goto(`${BASE}/editor/${PROJECT}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(5000);
await page.waitForFunction(
  () => Array.from(document.querySelectorAll('div')).some((d) => d.className === '__remotion-player'),
  { timeout: 20000 }
);
await page.waitForTimeout(1500);

// Install CAPTURE listeners at window + stage to trace the event path. React attaches at the
// root container, so a window-level capture fires even if a child stopPropagation's later.
await page.evaluate(() => {
  window.__clickTrace = [];
  window.addEventListener('click', (e) => {
    window.__clickTrace.push('window-capture');
  }, true);
  // bubble listener on the stage wrapper (the one with the React onClick)
  const stage = document.querySelector('.bg-neutral-950');
  if (stage) stage.addEventListener('click', () => window.__clickTrace.push('stage-bubble'));
  // track play state of the <video>-less player: read the time display
});

// Click the hook overlay
const comp = await page.evaluate(() => {
  const d = document.querySelector('.__remotion-player');
  const r = d.getBoundingClientRect();
  const scale = r.width / 1080;
  return { x: r.x, y: r.y, scale, cx: r.x + 540 * scale, cy: r.y + 290 * scale };
});
const timeBefore = await page.evaluate(() => {
  const m = document.body.innerText.match(/(\d+):(\d+)\s*\/\s*(\d+):(\d+)/);
  return m ? m[0] : null;
});
await page.mouse.click(comp.cx, comp.cy);
await page.waitForTimeout(400);
const trace = await page.evaluate(() => window.__clickTrace);
const after = await page.evaluate(() => ({
  dashed: Array.from(document.querySelectorAll('div')).filter((d) => (d.style.border || '').includes('dashed')).length,
  hasDeleteBtn: document.body.innerText.includes('Delete overlay'),
}));
const timeAfter = await page.evaluate(() => {
  const m = document.body.innerText.match(/(\d+):(\d+)\s*\/\s*(\d+):(\d+)/);
  return m ? m[0] : null;
});
console.log('COMP:', JSON.stringify(comp));
console.log('CLICK TRACE:', JSON.stringify(trace));
console.log('TIME before/after (play toggled if differs):', timeBefore, '->', timeAfter);
console.log('AFTER:', JSON.stringify(after));
await browser.close();
