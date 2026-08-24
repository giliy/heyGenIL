import { renderSpec } from './render-spec.mjs';
import { readFileSync } from 'fs';
const spec = JSON.parse(readFileSync(process.env.TEMP + '/resize-spec.json', 'utf8'));
const r = await renderSpec('Short16Formy', spec, {
  outputLocation: process.env.TEMP + '/resize-probe.mp4',
  posterLocation: process.env.TEMP + '/resize-probe.jpg',
});
console.log('RENDERED dims:', r.width + 'x' + r.height, 'fps', r.fps, 'dur', r.durationSec);
