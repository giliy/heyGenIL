// Generate remotion/src/lib/fontFaces.ts from _manifest.json (deterministic; run once).
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));

// Group by family -> list of { weight, subset, file, range }
const byFamily = {};
for (const e of manifest) {
  (byFamily[e.family] ??= []).push({ weight: e.weight, subset: e.subset, file: e.file, range: e.range });
}

function faceBlock(family, f) {
  const localName = `${family}-Local`;
  return `  /* ${family} ${f.weight} ${f.subset} */\n` +
    `  @font-face {\n` +
    `    font-family: '${localName}';\n` +
    `    font-style: normal;\n` +
    `    font-weight: ${f.weight};\n` +
    `    font-display: block;\n` +
    `    src: url(\${staticFile('library/fonts/${f.file}')}) format('woff2');\n` +
    `    unicode-range: ${f.range};\n` +
    `  }`;
}

const blocks = [];
for (const family of Object.keys(byFamily)) {
  for (const f of byFamily[family]) blocks.push(faceBlock(family, f));
}

const template = `// VENDORED HEBREW/LATIN FONTS — offline, deterministic.
// Generated from tools/fonts/manifest.json by tools/fonts/gen-fontfaces.mjs.
// The woff2 files live in media/library/fonts/ (Remotion's public root is media/), referenced
// via staticFile('library/fonts/...'). <FontFaces/> injects the @font-face rules into the
// document head at the composition root, so every shot can use the local families without any
// network fetch at render time (replaces @remotion/google-fonts runtime loading for these).
//
// Local family names: 'Heebo-Local' (500/600/700, hebrew+latin), 'Rubik-Local' (700/900, hebrew+latin).
import React from 'react';
import { staticFile } from 'remotion';

// The @font-face CSS. staticFile() is interpolated per src so Remotion resolves the public-dir URL.
export const FONT_FACES_CSS = \`
${blocks.join('\n')}
\`;

// Render this ONCE at the composition root (see Root.tsx). It injects the @font-face rules
// into the document so the local families resolve during render.
export const FontFaces: React.FC = () => (
  <style dangerouslySetInnerHTML={{ __html: FONT_FACES_CSS }} />
);

export default FontFaces;
`;

const outPath = path.resolve(__dirname, '../../remotion/src/lib/fontFaces.tsx');
writeFileSync(outPath, template);
console.log('Wrote', outPath);
console.log('Families:', Object.keys(byFamily).join(', '), '| faces:', blocks.length);
