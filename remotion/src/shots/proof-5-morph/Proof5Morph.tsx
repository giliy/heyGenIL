import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import { COLORS } from '../../brand';
import { Morph, circlePath, useMorphPath } from '../../lib/morph';
import { EASE_INOUT } from '../../lib/shorts';

// =============================================================================
// COMPOSITION CONFIG
// =============================================================================
export const compositionConfig = {
  id: 'Proof5Morph',
  durationInSeconds: 4,
  fps: 30,
  width: 1080,
  height: 1920,
};

// A star and a heart-ish blob to morph between (hand-written, viewBox 0 0 400 400).
const STAR =
  'M 200 40 L 245 160 L 365 160 L 265 235 L 300 355 L 200 285 L 100 355 L 135 235 L 35 160 L 155 160 Z';
const HEART =
  'M 200 320 C 120 260 60 200 60 140 C 60 90 100 60 140 60 C 165 60 190 75 200 95 C 210 75 235 60 260 60 C 300 60 340 90 340 140 C 340 200 280 260 200 320 Z';

const VB = '0 0 400 400';

// =============================================================================
// MAIN COMPONENT
// =============================================================================
const Proof5Morph: React.FC = () => {
  const frame = useCurrentFrame();

  // Star → heart, frames 10..70, eased. Then a separate hook-driven circle→square
  // morph to prove useMorphPath works outside the <Morph> component.
  const circleToSquareT = interpolate(frame, [80, 115], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const SQUARE = 'M 80 80 L 320 80 L 320 320 L 80 320 Z';
  const circleD = useMorphPath(circlePath(200, 200, 120), SQUARE, circleToSquareT, {
    maxSegmentLength: 2,
  });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.d900 }}>
      {/* Title */}
      <div
        style={{
          position: 'absolute',
          top: 120,
          width: '100%',
          textAlign: 'center',
          color: COLORS.paper,
          fontFamily: 'sans-serif',
          fontSize: 54,
          fontWeight: 800,
        }}
      >
        flubber morph (deterministic)
      </div>

      {/* Star → heart morph */}
      <div style={{ position: 'absolute', top: 320, left: 340, width: 400, height: 400 }}>
        <Morph
          from={STAR}
          to={HEART}
          at={10}
          dur={60}
          easing={EASE_INOUT}
          viewBox={VB}
          fill={COLORS.accent}
          stroke={COLORS.paper}
          strokeWidth={4}
          style={{ width: 400, height: 400 }}
        />
      </div>

      {/* Circle → square via the raw hook */}
      <div style={{ position: 'absolute', top: 780, left: 340, width: 400, height: 400 }}>
        <svg viewBox={VB} style={{ width: 400, height: 400 }}>
          <path d={circleD} fill={COLORS.accent2} stroke={COLORS.paper} strokeWidth={4} />
        </svg>
      </div>

      {/* frame readout to eyeball determinism across two renders */}
      <div
        style={{
          position: 'absolute',
          bottom: 200,
          width: '100%',
          textAlign: 'center',
          color: COLORS.muted,
          fontFamily: 'monospace',
          fontSize: 30,
        }}
      >
        frame {frame} · t={Math.min(1, Math.max(0, (frame - 10) / 60)).toFixed(2)}
      </div>
    </AbsoluteFill>
  );
};

export default Proof5Morph;
