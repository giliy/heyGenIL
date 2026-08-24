import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { Captions, ProgressBar } from '../../lib/shorts';
import { KenBurnsImage, StoryVignette } from '../../lib/story';
import { VO } from './vo.gen';

// =============================================================================
// COMPOSITION CONFIG — "בּוּ וְהָאוֹת א" (Bu and the letter Aleph), series bu-koala.
// mode:"kids" — 8 AI storybook stills (Bu the yellow koala) ken-burns over a 9-line
// Hebrew edge-tts VO. rtl + kidsNikkud captions keep the vowel points (lineHeight
// 1.5) for early-readers. Beats align to the VO line starts (0,5,9,12,14.5,18.5,23,28,32s);
// the mystery image b3 holds across the engineered "הִמְהוּם…" pause (beat 4).
// =============================================================================
export const compositionConfig = {
  id: 'Short18BuAleph',
  durationInSeconds: 36,
  fps: 30,
  width: 1080,
  height: 1920,
};

const YELLOW = '#ffd45e'; // Bu's yellow leads (brand.md §5 kids: character color leads)
const TAIL = 20; // frames each beat under-laps the next so the crossfade never gaps

// beat -> [start, end] frame @30. The pause line (beat idx 3, 12.0-14.5s) has NO new
// image: b3-mystery (beat idx 2) runs 270->435 so it covers the hum; b4 enters at 435.
const BEATS = [
  { src: 'projects/short-18-bu-aleph/b1-hook.png',          start: 0,   end: 150,  variant: 0, fadeIn: 0 },
  { src: 'projects/short-18-bu-aleph/b2-intro-letter.png',  start: 150, end: 270,  variant: 2 },
  { src: 'projects/short-18-bu-aleph/b3-mystery.png',       start: 270, end: 435,  variant: 1 }, // holds through the pause
  { src: 'projects/short-18-bu-aleph/b4-first-answer.png',  start: 435, end: 555,  variant: 3 },
  { src: 'projects/short-18-bu-aleph/b5-second-answer.png', start: 555, end: 690,  variant: 4 },
  { src: 'projects/short-18-bu-aleph/b6-repetition.png',    start: 690, end: 840,  variant: 1 },
  { src: 'projects/short-18-bu-aleph/b7-the-big-one.png',   start: 840, end: 960,  variant: 0 },
  { src: 'projects/short-18-bu-aleph/b8-payoff.png',        start: 960, end: 1080, variant: 5 }, // push-in payoff
] as const;

const Short18BuAleph: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: '#f7ecd7' }}>
      {BEATS.map((b, i) => {
        const isLast = i === BEATS.length - 1;
        const dur = b.end - b.start + (isLast ? 0 : TAIL);
        return (
          <Sequence key={i} from={b.start} durationInFrames={dur}>
            <KenBurnsImage src={b.src} dur={dur} variant={b.variant} fadeIn={'fadeIn' in b ? b.fadeIn : 16} />
          </Sequence>
        );
      })}
      <StoryVignette />
      <Captions lines={VO} y={1330} size={54} accent={YELLOW} maxWords={4} plate rtl kidsNikkud />
      <ProgressBar color={YELLOW} />
    </AbsoluteFill>
  );
};

export default Short18BuAleph;
