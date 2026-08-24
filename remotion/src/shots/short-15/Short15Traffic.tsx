import React from 'react';
import { AbsoluteFill, Easing, Sequence, useCurrentFrame } from 'remotion';
import {
  BigTitle,
  Captions,
  Kicker,
  PauseCard,
  ProgressBar,
  StatChip,
  prog,
} from '../../lib/shorts';
import { COLORS } from '../../brand';
import { ShortsBackdrop, GlowReveal } from '../../lib/polish';
import { IDM, RING, TRIGGER, metreToPoint, ringAt, speedColor } from '../../lib/agents';
import { FONT_BODY, FONT_MONO } from '../../fonts';
import { VO } from './vo.gen';

// =============================================================================
// COMPOSITION CONFIG
// =============================================================================
export const compositionConfig = {
  id: 'Short15Traffic',
  durationInSeconds: 42,
  fps: 30,
  width: 1080,
  height: 1920,
};

const F = (s: number) => Math.round(s * compositionConfig.fps);
const EASE_INOUT = Easing.bezier(0.37, 0, 0.63, 1);

// Ring geometry on the canvas (top-down). Centre sits high so captions at y1500 clear it.
const CX = 540;
const CY = 780;
const RR = 340;

// The composition time is dilated: 42 s of screen shows 60 s of traffic so the wave
// actually develops. Sim runs on tSim; all trigger/beat times below are in SIM seconds.
const TIME_SCALE = 60 / 42;

// --- beat windows (SIM seconds; converted to frames) ------------------------------
const HOOK_END = F(4.9);
const SETUP_END = F(13.6);
const QUIZ_END = F(17.4);
const REVEAL_END = F(29.6);
const TWIST_END = F(40.7);

// =============================================================================
// THE RING — one persistent canvas. Reads the sim at the current GLOBAL frame, draws
// every car. Beat overlays (chips, arrows, pause card) sit on top as Sequences; the
// road and the cars never cut away.
// =============================================================================
const Ring: React.FC = () => {
  const frame = useCurrentFrame();
  const tSim = (frame / compositionConfig.fps) * TIME_SCALE;
  const state = ringAt(tSim);

  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
        {/* road: two concentric guide rings */}
        <circle cx={CX} cy={CY} r={RR} fill="none" stroke={COLORS.d600} strokeWidth={46} />
        <circle
          cx={CX}
          cy={CY}
          r={RR}
          fill="none"
          stroke={COLORS.d400}
          strokeWidth={2}
          strokeDasharray="10 14"
          opacity={0.5}
        />
        {/* the cars — dots on the ring, coloured by measured speed */}
        {state.cars.map((car, i) => {
          const p = metreToPoint(car.x, CX, CY, RR);
          const isTrigger = i === TRIGGER.car;
          const col = isTrigger
            ? COLORS.warn
            : speedColor(car.v, COLORS.signal, COLORS.warn, COLORS.danger);
          return (
            <g key={i}>
              {/* brake pulse ring on the trigger car during the tap */}
              {isTrigger && tSim >= TRIGGER.fromS && tSim <= TRIGGER.toS ? (
                <circle cx={p.x} cy={p.y} r={26} fill="none" stroke={COLORS.danger} strokeWidth={4} opacity={0.9} />
              ) : null}
              <circle cx={p.x} cy={p.y} r={isTrigger ? 16 : 13} fill={col} stroke="#0d1117" strokeWidth={3} />
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

// =============================================================================
// BACKWARD-WAVE ARROW — a curved arrow drawn along the ring at the measured jam
// centroid, pointing AGAINST travel. Read off the sim each frame (jamCenterM), so the
// arrow sits where the jam actually is.
// =============================================================================
const BackwardArrow: React.FC<{ from: number; to: number }> = ({ from, to }) => {
  const frame = useCurrentFrame();
  const tSim = (frame / compositionConfig.fps) * TIME_SCALE;
  const state = ringAt(tSim);
  const p = prog(frame, from, to);
  if (p <= 0) return null;
  const c = metreToPoint(state.jamCenterM, CX, CY, RR);
  // draw a short arc backward (counter to travel) around the jam centroid
  const span = 1.15; // radians of arc
  const a0 = c.ang + 0.35;
  const a1 = a0 - span * EASE_INOUT(p); // sweeps backward as it draws
  const pt = (ang: number) => ({
    x: CX + (RR + 70) * Math.cos(ang),
    y: CY + (RR + 70) * Math.sin(ang),
  });
  const s = pt(a0);
  const e = pt(a1);
  const large = span > Math.PI ? 1 : 0;
  return (
    <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
      <path
        d={`M ${s.x} ${s.y} A ${RR + 70} ${RR + 70} 0 ${large} 0 ${e.x} ${e.y}`}
        fill="none"
        stroke={COLORS.danger}
        strokeWidth={8}
        strokeLinecap="round"
        opacity={EASE_INOUT(p)}
      />
      {/* arrowhead at the moving tip */}
      <polygon
        points={`${e.x},${e.y} ${e.x + 22 * Math.cos(a1 + 2.2)},${e.y + 22 * Math.sin(a1 + 2.2)} ${
          e.x + 22 * Math.cos(a1 - 2.2 + Math.PI)
        },${e.y + 22 * Math.sin(a1 - 2.2 + Math.PI)}`}
        fill={COLORS.danger}
        opacity={EASE_INOUT(p)}
      />
    </svg>
  );
};

// =============================================================================
// JAM STAT CHIP — measured live off the sim (jamSize + minV), never asserted.
// =============================================================================
const JamStat: React.FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame();
  const tSim = (frame / compositionConfig.fps) * TIME_SCALE;
  const state = ringAt(tSim);
  if (frame < at) return null;
  const kmh = Math.round(state.minV * 3.6);
  return (
    <StatChip
      label="the jam, measured live"
      value={`${state.jamSize} cars crawling at ${kmh} km/h`}
      color={COLORS.danger}
      x={320}
      y={1180}
      w={440}
      at={at}
    />
  );
};

// =============================================================================
// WAVE CHIP (twist) — "the jam is a wave" with a GlowReveal on the payoff word.
// =============================================================================
const WaveChip: React.FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame();
  const p = prog(frame, at, at + 14);
  if (p <= 0) return null;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 1150, display: 'flex', justifyContent: 'center' }}>
      <GlowReveal progress={p} color={COLORS.signal} glowRadius={30}>
        <div
          style={{
            fontFamily: FONT_MONO,
            fontWeight: 700,
            fontSize: 44,
            color: '#fff',
            background: 'rgba(12,14,20,0.9)',
            border: `2px solid ${COLORS.signal}66`,
            borderRadius: 18,
            padding: '20px 34px',
          }}
        >
          the jam is a <span style={{ color: COLORS.signal }}>wave</span>, not a place
        </div>
      </GlowReveal>
    </div>
  );
};

// =============================================================================
// MAIN
// =============================================================================
export const Short15Traffic: React.FC = () => {
  const frame = useCurrentFrame();
  // Hook punch-in settles 1.05 -> 1 over the first ~14 frames; the loop tail eases it
  // back to 1.05 so frame-0 == last-frame exactly (seamless loop).
  const loopRestore = prog(frame, F(40.7), F(42)); // 0 -> 1 over the tail
  const punch = 1.05 - 0.05 * EASE_INOUT(prog(frame, 0, 14)) * (1 - loopRestore);
  // During the tail the captions re-render the first page (frame 0's), so the loop seam
  // shows the same pill as frame 0 rather than a blank plate.
  const captionFrame = loopRestore > 0 ? 0 : frame;

  return (
    <AbsoluteFill style={{ background: COLORS.d900 }}>
      {/* T07 brand mesh backdrop */}
      <ShortsBackdrop base={COLORS.d900} intensity={0.9} grain={0.035} />

      {/* the persistent ring canvas, under a hook punch-in */}
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${punch})`, transformOrigin: '50% 42%' }}>
        <Ring />
      </div>

      {/* HOOK title — warm so frame 0 is fully composed. In the loop tail it fades back
          in (opacity=loopRestore) so the last frame matches frame 0 for a seamless loop. */}
      {frame < HOOK_END + 30 || loopRestore > 0 ? (
        <div style={{ opacity: loopRestore > 0 ? loopRestore : 1 }}>
          <BigTitle
            warm
            lines={[{ text: 'The traffic jam' }, { text: 'with no cause', color: COLORS.danger }]}
            subtitle="22 cars. No crash. No red light."
            y={150}
            size={80}
          />
        </div>
      ) : null}

      {/* SETUP: kicker over the follow behaviour */}
      <Sequence from={F(5.0)} durationInFrames={F(8.4)}>
        <Kicker text="each car just follows the one ahead" color={COLORS.signal} y={170} at={0} until={F(8.4)} />
      </Sequence>

      {/* SETUP: brake-tap callout on the trigger car */}
      <Sequence from={F(10.8)} durationInFrames={F(2.8)}>
        <Kicker text="one tap of the brakes" color={COLORS.danger} y={170} at={0} until={F(2.8)} />
      </Sequence>

      {/* QUIZ */}
      <Sequence from={F(13.6)} durationInFrames={QUIZ_END - F(13.6)}>
        <PauseCard title="PAUSE" subtitle="what happens next?" durSec={(QUIZ_END - F(13.6)) / 30} accent={COLORS.warn} y={1330} />
      </Sequence>

      {/* REVEAL: backward arrow + live jam stat */}
      <Sequence from={F(17.4)} durationInFrames={REVEAL_END - F(17.4)}>
        <BackwardArrow from={F(21.8) - F(17.4)} to={F(24.6) - F(17.4)} />
        <JamStat at={F(26.8) - F(17.4)} />
        <Sequence from={F(24.2) - F(17.4)} durationInFrames={REVEAL_END - F(24.2)}>
          <Kicker text="it travels backward" color={COLORS.danger} y={170} at={0} until={REVEAL_END - F(24.2)} />
        </Sequence>
      </Sequence>

      {/* TWIST: the wave chip */}
      <Sequence from={F(29.6)} durationInFrames={TWIST_END - F(29.6)}>
        <WaveChip at={F(34.5) - F(29.6)} />
        <Kicker text="every driver escapes it" color={COLORS.signal} y={170} at={F(29.8) - F(29.6)} until={F(33.6) - F(29.6)} />
      </Sequence>

      {/* global overlays: pill captions + progress. In the loop tail the captions re-render
          the frame-0 first page (frameOverride) and fade in (opacity=loopRestore) so the
          last frame shows the same pill as frame 0 — a seamless loop, no blank plate. */}
      <div style={{ position: 'absolute', inset: 0, opacity: loopRestore > 0 ? loopRestore : 1 }}>
        <Captions lines={VO} mode="pill" y={1500} accent={COLORS.accent} frameOverride={captionFrame} />
      </div>
      <ProgressBar color={COLORS.accent} resetAt={F(40.7)} />
    </AbsoluteFill>
  );
};

export default Short15Traffic;
