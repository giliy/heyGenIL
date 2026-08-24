import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Captions, ShortsBackdrop } from '../../lib/shorts';
import type { VoLine } from '../../lib/shorts';
import { COLORS } from '../../brand';

// =============================================================================
// QA SHOT — Short20Karaoke. Exercises the karaoke caption preset on Hebrew RTL text
// (NOT part of any shipped video — a QA harness). Four beats:
//   1. pure Hebrew with trailing ?        — RTL punctuation stays on the right side
//   2. code-switch: Hebrew + Latin "email" + "Slack" — embedded Latin must not reorder
//   3. embedded number "249"               — numbers anchor to the RTL side
//   4. a line with NO word times           — fallback estimate still highlights word-by-word
// Word times are hand-authored in the exact edge-tts WordBoundary shape (vo.gen format).
// =============================================================================
export const compositionConfig = {
  id: 'Short20Karaoke',
  durationInSeconds: 13,
  fps: 30,
  width: 1080,
  height: 1920,
};

const ACCENT = '#f5d76e';

const VO: VoLine[] = [
  { text: 'מתקפת בקמטוטים סביב העיניים?', start: 0.4, end: 3.0, words: [
    { w: 'מתקפת', start: 0.5, end: 0.9 }, { w: 'בקמטוטים', start: 0.9, end: 1.45 },
    { w: 'סביב', start: 1.45, end: 1.71 }, { w: 'העיניים?', start: 1.71, end: 2.3 }] },
  { text: 'תשלחו לי email ב-Slack עכשיו', start: 3.2, end: 6.4, words: [
    { w: 'תשלחו', start: 3.3, end: 3.7 }, { w: 'לי', start: 3.7, end: 4.0 },
    { w: 'email', start: 4.0, end: 4.6 }, { w: 'ב-Slack', start: 4.6, end: 5.3 }, { w: 'עכשיו', start: 5.3, end: 5.9 }] },
  { text: 'המחיר 249 שקל בלבד היום', start: 6.6, end: 9.4, words: [
    { w: 'המחיר', start: 6.7, end: 7.1 }, { w: '249', start: 7.1, end: 7.9 },
    { w: 'שקל', start: 7.9, end: 8.3 }, { w: 'בלבד', start: 8.3, end: 8.7 }, { w: 'היום', start: 8.7, end: 9.2 }] },
  { text: 'וזה משפט בלי זמני מילים בכלל', start: 9.6, end: 12.4 }, // fallback: no `words` — estimate
];

const Short20Karaoke: React.FC = () => {
  return (
    <AbsoluteFill>
      <ShortsBackdrop base={COLORS.d900} glow={COLORS.d800} />
      {/* Karaoke captions, RTL, driven by the real word times. */}
      <Captions lines={VO} mode="karaoke" rtl y={1300} size={64} accent={ACCENT} />
    </AbsoluteFill>
  );
};

export default Short20Karaoke;
