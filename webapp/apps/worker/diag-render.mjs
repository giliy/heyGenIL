// Temp render repro under tsx (worker's runtime).
import { renderSpec } from './render-spec.mjs';
import { readFileSync } from 'fs';

const spec = JSON.parse(readFileSync('../web/spec-dump.json', 'utf8'));
console.log('START render');
try {
  const r = await renderSpec('Short16Formy', spec, {
    outputLocation: 'out/diag.mp4',
    onProgress: (p) => process.stdout.write(Math.round(p.progress * 100) + '% '),
  });
  console.log('\nDONE', JSON.stringify(r));
} catch (e) {
  console.log('\nCAUGHT:', e && e.message);
  console.log('STACK:', e && e.stack ? e.stack.split('\n').slice(0, 10).join('\n') : '');
}
