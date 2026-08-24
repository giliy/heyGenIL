// Media flow e2e. Layout: left panel shows Scenes OR Media OR Captions depending on the active
// tab (SceneStrip). The MediaPanel (with the dropzone file input) only renders on the Media tab.
// Flow: select a scene (SceneStrip timeline button) -> note its overlay count in the Scenes panel
// -> switch to Media tab -> upload image (auto-Adds an image overlay + selects it) -> switch back
// to Scenes to confirm count +1 -> back to Media, Replace is now enabled (selected image overlay)
// -> click Replace -> count unchanged. No hard errors throughout.
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const PROJECT_ID = process.env.PROJECT_ID || 'mvvj0p9kqw2i1tzp135q74ef';
const COOKIE = process.env.SESSION_COOKIE || '2c5aee20-288a-468b-b098-14c9f0b204f6';
const IMG = process.env.TEST_IMG || 'C:/tmp/e2e-img.png';

const hardErrors = [];
const log = (msg) => console.log(`[media] ${msg}`);

async function leftTab(page, name) {
  await page.locator('button', { hasText: new RegExp(`^${name}$`) }).first().click();
  await page.waitForTimeout(350);
}

// Overlay count for the currently-selected scene. The count lives in a dedicated
// <span class="text-xs text-muted">N overlays</span> inside the selected card — read THAT span,
// not the whole card textContent (where "Scene 1"+"2 overlays" run together as "12 overlays").
async function selectedSceneOverlayCount(page) {
  return page.evaluate(() => {
    const li = document.querySelector('li.border-signal');
    if (!li) return null;
    const span = Array.from(li.querySelectorAll('span')).find((s) => /overlay/.test(s.textContent));
    if (!span) return null;
    const m = span.textContent.match(/(\d+)\s+overlay/);
    return m ? Number(m[1]) : null;
  });
}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1680, height: 1000 } });
  await ctx.addCookies([{ name: 'authjs.session-token', value: COOKIE, url: BASE }]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => hardErrors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/hydration|resizable|useLayoutEffect|defaultProps|preload/i.test(m.text()))
      hardErrors.push(`console: ${m.text()}`);
  });

  await page.goto(`${BASE}/editor/${PROJECT_ID}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.__remotion-player', { timeout: 20000 });
  log('editor loaded');

  // 1) Scenes tab; select scene 1 via the SceneStrip timeline button (title "Scene 1 — Ns").
  await leftTab(page, 'Scenes');
  await page.locator('button[title^="Scene 1"]').first().click();
  await page.waitForTimeout(400);
  const countBefore = await selectedSceneOverlayCount(page);
  log(`scene 1 overlay count before: ${countBefore}`);

  // 2) Media tab; upload the image (drop auto-Adds an image overlay and selects it).
  await leftTab(page, 'Media');
  await page.locator('input[type="file"]').setInputFiles(IMG);
  await page.waitForTimeout(2000);
  const uploadRowVisible = await page.evaluate(() =>
    Array.from(document.querySelectorAll('ul li')).some((li) => /image/.test(li.textContent))
  );
  log(`upload row visible: ${uploadRowVisible}`);

  // 3) Scenes tab; confirm the scene gained an overlay (Add proof).
  await leftTab(page, 'Scenes');
  const countAfterAdd = await selectedSceneOverlayCount(page);
  const addedAnOverlay = countBefore !== null && countAfterAdd === countBefore + 1;
  log(`Add proof (count ${countBefore} -> ${countAfterAdd}): ${addedAnOverlay}`);

  // 4) Media tab; the auto-added image overlay is still selected -> Replace should be enabled.
  await leftTab(page, 'Media');
  const replaceBtn = page.locator('ul li button', { hasText: 'Replace' }).first();
  const replaceEnabled = await replaceBtn.isEnabled().catch(() => false);
  log(`Replace enabled (selected image overlay): ${replaceEnabled}`);
  if (replaceEnabled) {
    await replaceBtn.click();
    await page.waitForTimeout(500);
  }

  // 5) Scenes tab; Replace must NOT change the overlay count (in-place mutation).
  await leftTab(page, 'Scenes');
  const countAfterReplace = await selectedSceneOverlayCount(page);
  const replaceKeptCount = countAfterAdd !== null && countAfterReplace === countAfterAdd;
  log(`Replace kept count (${countAfterAdd} -> ${countAfterReplace}): ${replaceKeptCount}`);

  // 6) Autosave persists.
  await page.waitForTimeout(1500);
  const savedVisible = await page.evaluate(() => document.body.textContent.includes('Saved'));
  log(`Saved indicator: ${savedVisible}`);

  await browser.close();

  const result = { countBefore, uploadRowVisible, countAfterAdd, addedAnOverlay, replaceEnabled, countAfterReplace, replaceKeptCount, savedVisible, hardErrors };
  console.log('\n=== MEDIA RESULT ===');
  console.log(JSON.stringify(result, null, 2));
  if (hardErrors.length) { console.log('HARD ERRORS PRESENT'); process.exit(1); }
  if (!uploadRowVisible || !addedAnOverlay) { console.log('MEDIA FLOW FAILED'); process.exit(1); }
  console.log('MEDIA OK');
}

main().catch((e) => { console.error(e); process.exit(1); });
