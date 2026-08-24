import React, { useMemo } from 'react';
import { AbsoluteFill } from 'remotion';
import { COLORS } from '../../brand';
import { FONT_BODY } from '../../fonts';
import { useCaptionPagesFromWords, useWordStates } from '../../lib/captions-kit';
import type { TimedWord } from '../../lib/shorts';

// =============================================================================
// COMPOSITION CONFIG
// =============================================================================
export const compositionConfig = {
  id: 'Proof3Captions',
  durationInSeconds: 4,
  fps: 30,
  width: 1080,
  height: 1920,
};

// Synthetic word timings (the .words.json contract: seconds, logical order).
const WORDS: TimedWord[] = [
  { w: 'This', start: 0.2, end: 0.5 },
  { w: 'is', start: 0.5, end: 0.7 },
  { w: 'per-word', start: 0.7, end: 1.2 },
  { w: 'timing,', start: 1.2, end: 1.6 },
  { w: 'unified', start: 1.8, end: 2.2 },
  { w: 'across', start: 2.2, end: 2.5 },
  { w: 'every', start: 2.5, end: 2.8 },
  { w: 'caption.', start: 2.8, end: 3.3 },
];

/** One page's words, lit up via the unified useTokenStates-derived state. */
const CaptionBlock: React.FC<{ page: ReturnType<typeof useCaptionPagesFromWords>[number] }> = ({ page }) => {
  const states = useWordStates(page);
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        columnGap: 24,
        maxWidth: '100%',
      }}
    >
      {states.map((s, i) => (
        <span
          key={i}
          style={{
            display: 'inline-block',
            fontFamily: FONT_BODY,
            fontWeight: 700,
            fontSize: 64,
            color: s.isActive ? COLORS.warn : '#ffffff',
            opacity: s.hasAppeared ? 1 : 0.25,
            transform: `translateY(${(1 - Math.min(1, s.progress)) * -6}px) scale(${s.isActive ? 1.06 : 1})`,
            textShadow: '0 3px 26px rgba(0,0,0,0.6)',
          }}
        >
          {s.text}
        </span>
      ))}
    </div>
  );
};

const Proof3Captions: React.FC = () => {
  const pages = useCaptionPagesFromWords(WORDS, 5);
  return (
    <AbsoluteFill style={{ background: COLORS.ink, justifyContent: 'center', alignItems: 'center', padding: 60 }}>
      {pages.map((p, i) => (
        <CaptionBlock key={i} page={p} />
      ))}
    </AbsoluteFill>
  );
};

export default Proof3Captions;
