// One-off: render a single comp still as a crisp PNG at frame 0 (QA for nikkud anchoring).
//   node scripts/render-still-png.mjs Read0Test [frame] [scale]
import { bundle } from '@remotion/bundler';
import { selectComposition, renderStill } from '@remotion/renderer';
import { fileURLToPath } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(root, '..');
const id = process.argv[2] || 'Read0Test';
const frame = Number(process.argv[3] || 0);
const scale = Number(process.argv[4] || 1);

const SHELL_REL = ['.remotion', 'chrome-headless-shell', 'win64', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe'];
const shell = path.join(repoRoot, ...SHELL_REL);

const serveUrl = await bundle({ entryPoint: path.join(root, 'src', 'index.ts'), publicDir: path.join(root, '..', 'media') });
const composition = await selectComposition({ serveUrl, id, browserExecutable: shell });
const out = path.join(root, 'out', `${id}-f${frame}-s${scale}.png`);
await renderStill({ serveUrl, composition, output: out, scale, overwrite: true, frame, imageFormat: 'png', browserExecutable: shell });
console.log('still ->', out);
