import React, { useEffect, useMemo, useState } from 'react';
import { AbsoluteFill, continueRender, delayRender, staticFile, useCurrentFrame } from 'remotion';
import { Lottie, getLottieMetadata } from '@remotion/lottie';
import type { LottieAnimationData } from '@remotion/lottie';
import { ShortsBackdrop, Kicker, prog, EASE_OUT } from '../../lib/shorts';
import { COLORS } from '../../brand';
import { FONT_BODY } from '../../fonts';

// =============================================================================
// COMPOSITION CONFIG
// =============================================================================
export const compositionConfig = {
  id: 'Proof1Lottie',
  durationInSeconds: 5,
  fps: 30,
  width: 1080,
  height: 1920,
};

// The Lottie is 60fps / 90 frames = 1.5s native. The comp runs at 30fps, so
// playbackRate=2 makes the animation play in real time (1.5s) inside this comp.
const LOTTIE_URL = staticFile('projects/proof-1-lottie/checkmark.json');

// =============================================================================
// LOTTIE LAYER — frame-exact. animationData is memoized (object identity re-inits
// the animation), fetched via staticFile, driven from useCurrentFrame by the
// @remotion/lottie component (goToAndStop under the hood). NO text lives inside the
// Lottie layer — the caption is 100% TSX below (lottie-web has open RTL bugs).
// =============================================================================
const CheckmarkLottie: React.FC = () => {
  const [animationData, setAnimationData] = useState<LottieAnimationData | null>(null);
  const [handle] = useState(() => delayRender('Loading Lottie checkmark'));

  useEffect(() => {
    fetch(LOTTIE_URL)
      .then((r) => r.json())
      .then((data) => {
        setAnimationData(data);
        continueRender(handle);
      })
      .catch((err) => {
        continueRender(handle);
        throw err;
      });
  }, [handle]);

  const playbackRate = useMemo(() => {
    if (!animationData) return 1;
    const meta = getLottieMetadata(animationData);
    if (!meta) return 1;
    // scale native fps -> comp fps so the 1.5s clip plays in real time
    return meta.fps / compositionConfig.fps;
  }, [animationData]);

  if (!animationData) return null;
  return (
    <Lottie
      animationData={animationData}
      playbackRate={playbackRate}
      loop={false}
      style={{ width: 560, height: 560 }}
    />
  );
};

// =============================================================================
// MAIN
// =============================================================================
const Proof1Lottie: React.FC = () => {
  const frame = useCurrentFrame();

  // Caption pops in right as the checkmark lands (~frame 40 of the 1.5s sweep).
  const capAt = 40;
  const capP = EASE_OUT(prog(frame, capAt, capAt + 12));

  return (
    <AbsoluteFill>
      <ShortsBackdrop />

      <Kicker text="Lottie POC" color={COLORS.signal} y={200} />

      {/* The Lottie, centered in the upper-mid frame. */}
      <div
        style={{
          position: 'absolute',
          top: 520,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <CheckmarkLottie />
      </div>

      {/* 100% TSX caption — no text inside the Lottie layer. */}
      <div
        style={{
          position: 'absolute',
          top: 1150,
          left: 40,
          right: 40,
          textAlign: 'center',
          opacity: capP,
          transform: `translateY(${(1 - capP) * 24}px)`,
        }}
      >
        <div
          style={{
            fontFamily: FONT_BODY,
            fontWeight: 600,
            fontSize: 64,
            lineHeight: 1.15,
            color: '#ffffff',
            textShadow: '0 4px 30px rgba(0,0,0,0.6)',
          }}
        >
          Frame-exact Lottie
        </div>
        <div
          style={{
            marginTop: 18,
            fontFamily: FONT_BODY,
            fontWeight: 500,
            fontSize: 40,
            color: COLORS.signal,
            textShadow: '0 4px 30px rgba(0,0,0,0.6)',
          }}
        >
          driven by useCurrentFrame
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default Proof1Lottie;
