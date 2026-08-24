// Editor smoke test: load with a session cookie, verify shell + Player mount, capture console.
import { chromium } from 'playwright';

const TOKEN = process.argv[2];
const PROJECT = 'mvvj0p9kqw2i1tzp135q74ef';
const BASE = 'http://localhost:3000';

if (!TOKEN) {
  console.error('usage: node e2e-editor.mjs <sessionToken>');
  process.exit(1);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await ctx.addCookies([
  { name: 'authjs.session-token', value: TOKEN, domain: 'localhost', path: '/' },
]);
const page = await ctx.newPage();

const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[PAGEEXCEPTION] ${e.message}\n${e.stack}`));
page.on('requestfailed', (r) => logs.push(`[REQFAIL] ${r.url()} :: ${r.failure()?.errorText}`));

await page.goto(`${BASE}/editor/${PROJECT}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(5000);
await page.screenshot({ path: 'editor.png', fullPage: false });

const info = await page.evaluate(() => {
  const comp = Array.from(document.querySelectorAll('div')).find((d) => d.style.width === '1080px');
  const text = document.body.innerText;
  return {
    compMounted: !!comp,
    compText: comp ? comp.innerText.slice(0, 120) : '(none)',
    playerTimeVisible: /0:00\s*\/\s*0:36/.test(text),
    topBar: text.includes('Undo') && text.includes('Render'),
    scenesPanel: text.includes('Scenes'),
    captionsPanel: text.includes('Captions'),
    mediaPanel: text.includes('Media'),
    inspectorPanel: text.includes('Style') || text.includes('Timing'),
    hookText: text.includes('צריך להחתים'),
  };
});
console.log('EDITOR:', JSON.stringify(info, null, 2));

// Count React-Player internal crash markers + hydration noise separately.
const hardErrors = logs.filter(
  (l) =>
    l.startsWith('[PAGEEXCEPTION]') ||
    l.startsWith('[REQFAIL]') ||
    (l.startsWith('[error]') && !l.includes('hydrated but some attributes'))
);
console.log(`--- HARD ERRORS: ${hardErrors.length} ---`);
for (const l of hardErrors.slice(0, 20)) console.log(l);

await browser.close();
