// Hand-timed caption lines for short-13 (NO voice track — no ElevenLabs key).
// Same VoLine shape as the generated vo.gen.ts files, so Captions + timeWords work
// unchanged: word-pop sync is estimated within each hand-set window.
import type { VoLine } from '../../lib/shorts';

export const LINES: VoLine[] = [
  { text: 'One photo hangs in our hallway.', start: 0.4, end: 3.2 },
  { text: "Ask my dad what's inside it…", start: 4.0, end: 6.6 },
  { text: "…and he'll start at the beginning.", start: 7.2, end: 10.4 },
  { text: 'The day she walked to him.', start: 11.2, end: 14.4 },
  { text: 'The summer of scraped knees.', start: 15.2, end: 18.4 },
  { text: 'Every storm he quietly carried.', start: 19.2, end: 22.4 },
  { text: 'The day the whole sky clapped.', start: 23.2, end: 26.4 },
  { text: 'Now the coffee stays hot a little longer.', start: 27.2, end: 30.6 },
  { text: "Ask him what's inside? His whole world.", start: 31.4, end: 35.6 },
];
