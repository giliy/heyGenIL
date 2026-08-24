import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { Captions, ProgressBar } from '../../lib/shorts';
import { KenBurnsImage, StoryVignette } from '../../lib/story';
import { VO } from './vo.gen';

// =============================================================================
// COMPOSITION CONFIG — "טיול בגן עם אבא: ניקוד קמץ" (a park walk with dad: kamatz).
// mode:"kids" — 8 AI storybook stills (Bu the yellow koala + grown-up koala dad)
// ken-burns over the canonical kamatz STORY script (shorts/short-19-kamatz-gan).
// rtl + kidsNikkud captions keep the vowel points (lineHeight 1.5); every caption
// word pops in YELLOW exactly as spoken (gen_voice_edge WordBoundary timings).
// Scene windows follow the VO line starts with ~0.5s pre-roll so the image lands
// just before the line does; beat 7 (keywords) holds 10s to the end.
// =============================================================================
export const compositionConfig = {
  id: 'Short19KamatzGan',
  durationInSeconds: 48,
  fps: 30,
  width: 1080,
  height: 1920,
};

const YELLOW = '#ffd45e'; // Bu's yellow leads (brand.md §5 kids: character color leads)
const TAIL = 20; // frames each beat under-laps the next so the crossfade never gaps

// beat -> [start, end] frame @30fps. Each scene enters ~15f before its VO line
// (line windows: 0-4.0 / 4.5-8.5 / 9-14 / 14.5-20 / 20.5-27 / 27.5-31.5 / 32-36.5 / 37-45.5s);
// the last scene (keywords recap) runs to the final frame (1440).
const BEATS = [
  { src: 'projects/short-19-kamatz-gan/b0-hook.png',      start: 0,    end: 120,  variant: 0, fadeIn: 0 },
  { src: 'projects/short-19-kamatz-gan/b1-walk.png',      start: 120,  end: 255,  variant: 2 },
  { src: 'projects/short-19-kamatz-gan/b2-rabbit.png',    start: 255,  end: 420,  variant: 1 },
  { src: 'projects/short-19-kamatz-gan/b3-aron.png',      start: 420,  end: 600,  variant: 3 },
  { src: 'projects/short-19-kamatz-gan/b4-watermelon.png',start: 600,  end: 810,  variant: 4 },
  { src: 'projects/short-19-kamatz-gan/b5-red.png',       start: 810,  end: 945,  variant: 1 },
  { src: 'projects/short-19-kamatz-gan/b6-recap.png',     start: 945,  end: 1095, variant: 0 },
  { src: 'projects/short-19-kamatz-gan/b7-keywords.png',  start: 1095, end: 1440, variant: 5 }, // push-in payoff
] as const;

const Short19KamatzGan: React.FC = () => {
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

export default Short19KamatzGan;
