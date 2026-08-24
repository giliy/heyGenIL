// One-shot: fetch Google Fonts CSS (woff2) and download hebrew+latin woff2 files.
// Run from the repo root: node tools/fonts/download-fonts.mjs
// Writes woff2 -> media/library/fonts/  and a manifest -> tools/fonts/manifest.json.
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');           // repo root
const OUT_DIR = path.join(ROOT, 'media', 'library', 'fonts');
const MANIFEST = path.join(__dirname, 'manifest.json');
mkdirSync(OUT_DIR, { recursive: true });
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

const JOBS = [
  { family: 'Rubik', weights: ['700', '900'] },
  { family: 'Heebo', weights: ['500', '600', '700'] },
  // P1 #16: two OFL Hebrew display faces.
  // Frank Ruhl Libre — variable editorial serif for premium ad moments. Google serves static
  // instances per requested weight for css2; we vendor 500/700/900 for editorial range.
  { family: 'Frank Ruhl Libre', weights: ['500', '700', '900'] },
  // Varela Round — rounded geometric sans, single weight, the kids-headline face.
  { family: 'Varela Round', weights: ['400'] },
];
const WANT_SUBSETS = ['hebrew', 'latin'];

async function fetchCss(family, weights) {
  const w = weights.join(';');
  const url = `https://fonts.googleapis.com/css2?family=${family}:wght@${w}&display=swap`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`CSS fetch failed ${res.status} for ${family}`);
  return res.text();
}

// Parse @font-face blocks: capture subset comment, weight, src url, unicode-range.
function parseFaces(css) {
  // Split into blocks that start with an optional /* subset */ comment then @font-face { ... }
  const faces = [];
  const re = /\/\*\s*([a-z0-9-]+)\s*\*\/\s*@font-face\s*\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    const subset = m[1];
    const body = m[2];
    const weight = (body.match(/font-weight:\s*(\d+)/) || [])[1];
    const src = (body.match(/src:\s*url\(([^)]+)\)/) || [])[1];
    const range = (body.match(/unicode-range:\s*([^;]+);/) || [])[1];
    if (weight && src && subset) faces.push({ subset, weight, src, range: range?.trim() ?? '' });
  }
  return faces;
}

async function download(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`woff2 fetch failed ${res.status}: ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

const out = [];
for (const job of JOBS) {
  const css = await fetchCss(job.family, job.weights);
  const faces = parseFaces(css);
  for (const w of job.weights) {
    for (const subset of WANT_SUBSETS) {
      const face = faces.find((f) => f.weight === w && f.subset === subset);
      if (!face) { console.error(`MISSING ${job.family} ${w} ${subset}`); continue; }
      const fname = `${job.family}-${w}-${subset}.woff2`;
      const buf = await download(face.src);
      writeFileSync(path.join(OUT_DIR, fname), buf);
      out.push({ family: job.family, weight: w, subset, file: fname, bytes: buf.length, range: face.range });
      console.log(`OK  ${fname}  ${buf.length} bytes`);
    }
  }
}

// Emit a manifest (used to generate fontFaces.ts deterministically).
writeFileSync(MANIFEST, JSON.stringify(out, null, 2));
console.log('\nWrote tools/fonts/manifest.json with', out.length, 'entries');
