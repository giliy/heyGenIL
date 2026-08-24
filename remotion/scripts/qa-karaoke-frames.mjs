// QA: render specific frames of Short20Karaoke at phone scale (scale 1) so we can READ
// the RTL + karaoke highlight timing. Not part of the shipped render pipeline.
//   node scripts/qa-karaoke-frames.mjs
import { bundle } from '@remotion/bundler';
import { selectComposition, renderStill } from '@remotion/renderer';
import { mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(root, '..');

const SHELL_REL = ['.remotion', 'chrome-headless-shell', 'win64', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe'];
function resolvePinnedShell() {
  if (process.env.REMOTION_BROWSER_EXECUTABLE) return path.resolve(process.env.REMOTION_BROWSER_EXECUTABLE);
  const candidates = [path.join(repoRoot, ...SHELL_REL)];
  for (const c of candidates) if (existsSync(c)) return c;
  return null;
}
const BROWSER_EXECUTABLE = resolvePinnedShell();

const FPS = 30;
// [tag, seconds] — chosen so each lands inside a specific word's [start,end) window.
const FRAMES = [
  ['l1-word1', 0.7],   // מתקפת
  ['l1-word4', 1.9],   // העיניים? (trailing ? — RTL punctuation)
  ['l2-word3-email', 4.2], // email (embedded Latin)
  ['l2-word4-slack', 5.0], // ב-Slack
  ['l3-word2-249', 7.4],   // 249 (embedded number)
  ['l4-fallback', 11.0],   // no word times — estimate highlight
];

const serveUrl = await bundle({ entryPoint: path.join(root, 'src', 'index.ts'), publicDir: path.join(root, '..', 'media') });
const composition = await selectComposition({ serveUrl, id: 'Short20Karaoke', browserExecutable: BROWSER_EXECUTABLE });
const outDir = path.join(root, 'out', 'qa-karaoke');
mkdirSync(outDir, { recursive: true });

for (const [tag, sec] of FRAMES) {
  const out = path.join(outDir, `${tag}.png`);
  await renderStill({
    serveUrl, composition, output: out, scale: 1, overwrite: true,
    frame: Math.round(sec * FPS), imageFormat: 'png', browserExecutable: BROWSER_EXECUTABLE,
  });
  console.log('  ->', path.relative(root, out));
}
console.log('done');
