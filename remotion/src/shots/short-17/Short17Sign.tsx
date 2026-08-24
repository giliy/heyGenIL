import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { BigTitle, Kicker, ProgressBar, prog } from '../../lib/shorts';
import { COLORS } from '../../brand';
import { ShortsBackdrop } from '../../lib/polish';
import { FONT_DISPLAY_H } from '../../fonts';
import { KineticCaptions } from '../../lib/kinetic';
import { LibraryLottie } from '../../lib/lottie';
import { DrawOn, moveAlongPath } from '../../lib/motion';
import { Icon } from '../../lib/icons';
import { VO } from './vo.gen';

// =============================================================================
// COMPOSITION CONFIG — 15s, 1080x1920@30 (phone scale), registered via npm run gen
// =============================================================================
export const compositionConfig = {
  id: 'Short17Sign',
  durationInSeconds: 15,
  fps: 30,
  width: 1080,
  height: 1920,
};

const F = (s: number) => Math.round(s * compositionConfig.fps);
const EASE_OUT = Easing.bezier(0.33, 1, 0.68, 1);

// --- beat windows (seconds -> frames) driven by the REAL vo.gen timings ---
const HOOK_END = F(4.0);
const PAIN_END = F(9.6);
const PAYOFF_END = F(14.4);
const LOOP_START = F(14.4);

// The signature ink-stroke drawn across the middle of the stage, with a pen tip
// travelling along the path (moveAlongPath — the new motion helper).
// NOTE: rendered INSIDE the pain <Sequence from={F(4.0)}>, so `frame` here is the
// SEQUENCE-LOCAL frame (starts at 0). All delays below are relative to the beat start.
const SIGN_PATH = 'M 200 640 C 330 560, 480 720, 620 600 S 850 720, 880 640';
const SignStroke: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const at = F(0.3); // local: 0.3s after the pain beat starts
  const dur = F(2.4);
  // pen tip position at the same progress the stroke has drawn
  const p = interpolate(frame, [at, at + dur], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const tip = moveAlongPath(SIGN_PATH, p * dur * fps, dur * fps);
  const tipIn = EASE_OUT(prog(frame, at, at + 10));
  return (
    <svg
      width={1080}
      height={1920}
      viewBox="0 0 1080 1920"
      style={{ position: 'absolute', inset: 0 }}
    >
      <DrawOn
        d={SIGN_PATH}
        durationInFrames={dur}
        delay={at}
        stroke={COLORS.signal}
        strokeWidth={10}
        strokeLinecap="round"
      />
      {/* pen tip dot that travels along the path */}
      {tipIn > 0.01 ? (
        <circle
          cx={tip.x}
          cy={tip.y}
          r={16}
          fill={COLORS.warn}
          opacity={tipIn * (frame < at + dur + 8 ? 1 : 0)}
        />
      ) : null}
    </svg>
  );
};

// =============================================================================
// MAIN
// =============================================================================
const Short17Sign: React.FC = () => {
  const frame = useCurrentFrame();

  // Seamless loop: ease every overlay back to its frame-0 state over the tail.
  const loopRestore = prog(frame, LOOP_START, F(15));
  const captionFrame = loopRestore > 0 ? 0 : frame;

  return (
    <AbsoluteFill>
      <ShortsBackdrop base={COLORS.d900} intensity={1} grain={0.04} grid />

      {/* ============ HOOK: pain headline + paper glyph + red X ============ */}
      {frame < HOOK_END || loopRestore > 0 ? (
        <div style={{ opacity: loopRestore > 0 ? loopRestore : 1 }}>
          <BigTitle
            warm
            rtl
            y={250}
            size={92}
            lines={[{ text: 'צריך לחתום' }, { text: 'על מסמך דחוף?', color: COLORS.warn }]}
            subtitle="בלי מדפסת, בלי סריקה"
          />
          {/* paper/printer glyph + red X */}
          <div
            style={{
              position: 'absolute',
              top: 980,
              left: 0,
              right: 0,
              display: 'flex',
              justifyContent: 'center',
              opacity: 0.5,
            }}
          >
            <Icon name="Rocket" size={240} color={COLORS.d400} />
          </div>
          <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
            <g stroke={COLORS.danger} strokeWidth={14} strokeLinecap="round" opacity={0.9}>
              <line x1={360} y1={1040} x2={720} y2={1120} />
              <line x1={720} y1={1040} x2={360} y2={1120} />
            </g>
          </svg>
          {/* sparkles Lottie accent under the hook */}
          <LibraryLottie id="sparkles" size={420} delay={12} playbackRate={0.8} style={{ position: 'absolute', top: 820, left: 130, opacity: 0.5 }} />
        </div>
      ) : null}

      {/* ============ PAIN: signature draws itself + kinetic captions ============ */}
      <Sequence from={F(4.0)} durationInFrames={PAIN_END - F(4.0)}>
        <SignStroke />
        <Kicker text="חתימה דיגיטלית" color={COLORS.signal} y={520} at={F(0.2)} until={PAIN_END - F(4.0)} />
      </Sequence>

      {/* ============ PAYOFF: checkmark Lottie stamps + final line ============ */}
      <Sequence from={F(9.6)} durationInFrames={PAYOFF_END - F(9.6)}>
        <div
          style={{
            position: 'absolute',
            top: 430,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            opacity: EASE_OUT(prog(frame, 0, 12)),
          }}
        >
          <LibraryLottie id="checkmark-circle" size={520} delay={4} playbackRate={1.6} />
        </div>
        <div
          style={{
            position: 'absolute',
            top: 1080,
            left: 0,
            right: 0,
            textAlign: 'center',
            fontFamily: FONT_DISPLAY_H,
            fontWeight: 700,
            fontSize: 120,
            color: COLORS.signal,
            opacity: EASE_OUT(prog(frame, 8, 22)),
            textShadow: '0 6px 40px rgba(0,0,0,0.6)',
          }}
        >
          נחתם!
        </div>
      </Sequence>

      {/* global progress */}
      <ProgressBar color={COLORS.accent} resetAt={LOOP_START} />

      {/* ============ kinetic RTL captions — at ROOT, reading GLOBAL VO times ============ */}
      {frame < HOOK_END || loopRestore > 0 ? (
        <KineticCaptions words={VO[0].words ?? []} y={1560} size={70} accent={COLORS.warn} rtl plate />
      ) : null}
      {frame >= F(4.0) && frame < PAIN_END ? (
        <KineticCaptions words={VO[1].words ?? []} y={1250} size={64} accent={COLORS.warn} rtl plate />
      ) : null}
      {frame >= F(9.6) && frame < PAYOFF_END ? (
        <KineticCaptions words={VO[2].words ?? []} y={1360} size={62} accent={COLORS.signal} rtl plate />
      ) : null}
    </AbsoluteFill>
  );
};

export default Short17Sign;
