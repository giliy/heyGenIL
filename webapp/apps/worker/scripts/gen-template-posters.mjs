// One-off: render frame-0 posters for each launch template into webapp/.storage/templates/<id>/poster.jpg
// so dashboard cards have a thumbnail before any render. Run: node scripts/gen-template-posters.mjs
import { fileURLToPath } from 'url';
import path from 'path';
import { mkdirSync, existsSync, statSync, readFileSync, copyFileSync, readdirSync, lstatSync } from 'fs';
import { bundle } from '@remotion/bundler';
import { selectComposition, renderStill } from '@remotion/renderer';
import { LAUNCH_TEMPLATES } from '@shorts/spec';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..'); // webapp/apps/worker/scripts -> repo root
const remotionRoot = path.join(root, 'remotion');
const mediaRoot = path.join(root, 'media');
const storageDir = process.env.STORAGE_DIR ?? path.join(root, 'webapp', '.storage');
mkdirSync(storageDir, { recursive: true });

const SHELL_REL = ['.remotion', 'chrome-headless-shell', 'win64', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe'];
function resolvePinnedShell() {
  if (process.env.REMOTION_BROWSER_EXECUTABLE) return path.resolve(process.env.REMOTION_BROWSER_EXECUTABLE);
  const c = path.join(root, ...SHELL_REL);
  return existsSync(c) ? c : null;
}
const BROWSER_EXECUTABLE = resolvePinnedShell();

async function main() {
  const entryPoint = path.join(remotionRoot, 'src', 'index.ts');
  console.log('bundling…');
  const serveUrl = await bundle({ entryPoint, publicDir: mediaRoot });

  for (const t of LAUNCH_TEMPLATES) {
    const outKey = path.join(storageDir, 'templates', t.id, 'poster.jpg');
    mkdirSync(path.dirname(outKey), { recursive: true });
    const composition = await selectComposition({
      serveUrl,
      id: t.compositionId,
      inputProps: { spec: t.defaultSpec },
      browserExecutable: BROWSER_EXECUTABLE,
    });
    await renderStill({
      serveUrl,
      composition,
      inputProps: { spec: t.defaultSpec },
      output: outKey,
      frame: 0,
      scale: 1,
      overwrite: true,
      imageFormat: 'jpeg',
      browserExecutable: BROWSER_EXECUTABLE,
    });
    console.log('poster ->', outKey);
  }
  console.log('done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
