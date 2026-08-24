// short-14 — "The Two Envelopes Paradox". Fully TSX probability explainer on one persistent
// stage: the two sealed envelopes are the continuity. Word-exact captions driven by real
// Edge-TTS transcript timings (./vo.gen.ts). The loop's last frame lands exactly on frame 0.
//
// Math (verified textbook two-envelopes): pair is fixed {$10,$20}. The fallacy EV =
// ½(X/2)+½(2X)=1.25X says "always switch". The flaw: holding $10 → switch = +$10; holding $20
// → switch = −$10; equally likely → expected gain (10−10)/2 = $0. No free lunch.
import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame } from 'remotion';
import { BigTitle, Captions, Kicker, PauseCard, ProgressBar, ShortsBackdrop, prog, EASE_OUT, EASE_INOUT } from '../../lib/shorts';
import { Brace, ProbChip } from '../../lib/prob';
import { FONT_BODY, FONT_DISPLAY, FONT_MONO } from '../../fonts';
import { VO } from './vo.gen';

// =============================================================================
// COMPOSITION CONFIG
// =============================================================================
export const compositionConfig = {
  id: 'Short14TwoEnvelopes',
  durationInSeconds: 38,
  fps: 30,
  width: 1080,
  height: 1920,
};

// =============================================================================
// STYLE + GEOMETRY
// =============================================================================
const GOLD = '#f5d76e'; // kicker / question
const TEAL = '#4db8a8'; // switch / gain / 1.25X pop
const PINK = '#e8879f'; // loss / flaw
const PAPER = '#f4e8d3'; // envelope paper
const PAPER2 = '#e8d4b3'; // envelope shading
const INK = '#2a2f3a'; // flap ink / seal
const SLATE = '#9aa3b2'; // neutral chip text

// Two envelopes, side by side, centered horizontally on the stage.
const ENV = { w: 380, h: 250, topY: 700 };
const LEFTX = 280; // center of the left (YOURS) envelope
const RIGHTX = 800; // center of the right (?) envelope
const envEdge = (cx: number) => cx - ENV.w / 2;
const MID_Y = ENV.topY + ENV.h / 2; // vertical center of an envelope
const CAP_Y = 1560; // caption block vertical center (above the ~500px UI zone)

// =============================================================================
// ENVELOPE — a sealed paper envelope, face-on. `sealed` shows the flap + wax; an opened
// envelope (openP 0→1) slides its flap up to reveal a value card. Project-specific (the
// prob kit ships a Door, not an Envelope) so it lives here, not in lib.
// =============================================================================
const Envelope: React.FC<{
  cx: number; // center x
  topY: number; // top y
  w: number;
  h: number;
  yoursP?: number; // 0..1 "YOURS" stamp highlight
  openP?: number; // 0 sealed -> 1 flap up, value card revealed
  value?: string; // revealed value text (e.g. "$10")
  valueColor?: string;
  glow?: number; // 0..1 accent ring (switch target)
  glowColor?: string;
  dim?: number; // 0..1 dim-down
}> = ({ cx, topY, w, h, yoursP = 0, openP = 0, value = '', valueColor = GOLD, glow = 0, glowColor = TEAL, dim = 0 }) => {
  const flap = Math.max(0, Math.min(1, openP));
  return (
    <div style={{ position: 'absolute', left: cx, top: topY, width: w, height: h, transform: 'translateX(-50%)', opacity: 1 - dim * 0.7 }}>
      {glow > 0.01 && (
        <div style={{ position: 'absolute', inset: -8, borderRadius: 22, border: `5px solid ${glowColor}`, boxShadow: `0 0 ${40 * glow}px ${glowColor}aa`, opacity: glow }} />
      )}
      {/* body */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 14,
          background: `linear-gradient(160deg, ${PAPER} 0%, ${PAPER2} 100%)`,
          border: '3px solid rgba(58,46,26,0.5)',
          boxShadow: '0 18px 50px rgba(20,14,6,0.45), inset 0 2px 0 rgba(255,255,255,0.5)',
        }}
      />
      {/* value card sliding up out of the envelope as the flap opens */}
      {value && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: h * 0.16,
            transform: `translateX(-50%) translateY(${(1 - flap) * h * 0.5}px)`,
            opacity: flap,
            width: w * 0.62,
            padding: '12px 0',
            textAlign: 'center',
            borderRadius: 10,
            background: '#fffdf6',
            border: '2px solid rgba(58,46,26,0.4)',
            boxShadow: '0 6px 18px rgba(20,14,6,0.25)',
            fontFamily: FONT_DISPLAY,
            fontWeight: 700,
            fontSize: 64,
            color: valueColor,
          }}
        >
          {value}
        </div>
      )}
      {/* the V flap — rotates up out of the way */}
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: 'absolute', overflow: 'visible', transform: `rotate(${-flap * 55}deg)`, transformOrigin: `50% 0%` }}>
        <path d={`M 0 0 L ${w / 2} ${h * 0.52} L ${w} 0 Z`} fill="#ecdcbc" stroke="rgba(58,46,26,0.5)" strokeWidth={3} />
        {/* wax seal at the flap point */}
        <circle cx={w / 2} cy={h * 0.5} r={26} fill={INK} opacity={1 - flap} />
        <text x={w / 2} y={h * 0.5 + 11} textAnchor="middle" fontFamily={FONT_DISPLAY} fontWeight={700} fontSize={30} fill={PAPER} opacity={1 - flap}>
          $
        </text>
      </svg>
      {/* YOURS stamp */}
      {yoursP > 0.01 && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            bottom: -58,
            transform: `translateX(-50%) rotate(-7deg) scale(${1.5 - 0.5 * EASE_OUT(yoursP)})`,
            opacity: yoursP,
            fontFamily: FONT_DISPLAY,
            fontWeight: 700,
            fontSize: 40,
            letterSpacing: 3,
            color: '#0e131b',
            background: GOLD,
            border: `4px solid #0e131b`,
            borderRadius: 10,
            padding: '6px 20px',
            boxShadow: '0 8px 26px rgba(0,0,0,0.45)',
            whiteSpace: 'nowrap',
          }}
        >
          YOURS
        </div>
      )}
    </div>
  );
};

// =============================================================================
// TEXT ATOMS — a mono "math" line and a teal/pink tally row, both frame-driven pop-ins.
// =============================================================================
const MathLine: React.FC<{ x: number; y: number; text: string; size?: number; color?: string; p: number; bold?: boolean }> = ({
  x,
  y,
  text,
  size = 52,
  color = '#ffffff',
  p,
  bold = true,
}) => {
  if (p <= 0.01) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `translateX(-50%) translateY(${(1 - EASE_OUT(p)) * 16}px) scale(${0.92 + 0.08 * EASE_OUT(p)})`,
        opacity: p,
        fontFamily: FONT_MONO,
        fontWeight: bold ? 700 : 400,
        fontSize: size,
        color,
        whiteSpace: 'nowrap',
        textShadow: '0 4px 24px rgba(0,0,0,0.6)',
      }}
    >
      {text}
    </div>
  );
};

// A concrete outcome row: "hold $10 → +$10". teal=gain, pink=loss.
const OutcomeRow: React.FC<{ x: number; y: number; hold: string; delta: string; color: string; p: number; w?: number }> = ({
  x,
  y,
  hold,
  delta,
  color,
  p,
  w = 720,
}) => {
  if (p <= 0.01) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        transform: `translateX(-50%) translateY(${(1 - EASE_OUT(p)) * 20}px)`,
        opacity: p,
        background: 'rgba(12,14,20,0.92)',
        border: `2px solid ${color}66`,
        borderLeft: `12px solid ${color}`,
        borderRadius: 18,
        padding: '20px 30px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 14px 44px rgba(0,0,0,0.45)',
      }}
    >
      <span style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 46, color: '#fff' }}>{hold}</span>
      <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 54, color }}>{delta}</span>
    </div>
  );
};

// =============================================================================
// HOOK / LOOP — the sealed pair, fully composed at frame 0. Loop 'still' reproduces frame 0
// EXACTLY (settle at local 0) so the last frame == frame 0 for a seamless loop.
// =============================================================================
const HookShot: React.FC<{ mode: 'settle' | 'still'; local: number }> = ({ mode, local }) => {
  const p = EASE_INOUT(prog(local, 0, 30));
  const scale = mode === 'settle' ? 1.05 - 0.05 * p : 1;
  const yours = mode === 'settle' ? prog(local, 8, 18) : 1;
  return (
    <AbsoluteFill style={{ transform: `scale(${scale})` }}>
      <Kicker text="ONE HAS DOUBLE" color={GOLD} y={170} at={mode === 'settle' ? 4 : 0} />
      <BigTitle
        warm={mode === 'settle'}
        y={250}
        size={84}
        lines={[
          { text: 'TWO ENVELOPES', color: '#ffffff' },
          { text: 'SWITCH OR KEEP?', color: GOLD },
        ]}
      />
      <Envelope cx={LEFTX} topY={ENV.topY} w={ENV.w} h={ENV.h} yoursP={yours} />
      <Envelope cx={RIGHTX} topY={ENV.topY} w={ENV.w} h={ENV.h} />
      {/* the mystery question mark over the right envelope */}
      <MathLine x={RIGHTX} y={ENV.topY + ENV.h + 90} text="?" size={120} color={GOLD} p={mode === 'settle' ? prog(local, 12, 22) : 1} />
    </AbsoluteFill>
  );
};

// HookScene wraps HookShot in settle mode (Sequence makes frames local 0..101).
const HookScene: React.FC = () => {
  const frame = useCurrentFrame();
  return <HookShot mode="settle" local={frame} />;
};
// LoopShot reproduces frame 0 EXACTLY (settle @ local 0 => scale 1.05, title pre-rolled).
const LoopShot: React.FC = () => <HookShot mode="settle" local={0} />;

// =============================================================================
// SETUP (3.4s..12.6s → frames 102..378) — legend, "$X" chip on YOURS, brace "? 2X or X/2"
// over the right envelope.
// =============================================================================
const SetupScene: React.FC = () => {
  const frame = useCurrentFrame(); // local: global − 102
  const legend = EASE_OUT(prog(frame, 2, 16));
  const xChip = EASE_OUT(prog(frame, 60, 74)); // ~ "call it X" (5.7s→171 global → local 69)
  const brace = prog(frame, 130, 148); // ~ "half X, or double X" (~8s → local 138)
  return (
    <AbsoluteFill>
      <Kicker text="$10 AND $20" color={SLATE} y={170} at={2} />
      {/* legend line */}
      <MathLine x={540} y={330} text="ONE IS DOUBLE THE OTHER" size={44} color={SLATE} p={legend} bold={false} />
      <Envelope cx={LEFTX} topY={ENV.topY} w={ENV.w} h={ENV.h} yoursP={1} />
      <Envelope cx={RIGHTX} topY={ENV.topY} w={ENV.w} h={ENV.h} />
      {/* the $X chip on YOURS */}
      <ProbChip x={LEFTX} y={MID_Y} text="$X" color={GOLD} p={xChip} big />
      {/* the "? 2X or X/2" brace over the right envelope */}
      <Brace x1={envEdge(RIGHTX) + 10} x2={envEdge(RIGHTX) + ENV.w - 10} y={ENV.topY - 40} label="? 2X or X/2" color={TEAL} p={brace} />
    </AbsoluteFill>
  );
};

// =============================================================================
// TRICK (12.6s..20.4s → frames 378..612) — EV equation builds, "= 1.25X" pops teal,
// "ALWAYS SWITCH?" glow, PauseCard "SWITCH?".
// =============================================================================
const TrickScene: React.FC = () => {
  const frame = useCurrentFrame(); // local: global − 378
  const term1 = EASE_OUT(prog(frame, 20, 40)); // ½(X/2) builds first
  const term2 = EASE_OUT(prog(frame, 60, 80)); // + ½(2X)
  const pop = EASE_OUT(prog(frame, 115, 132)); // "= 1.25X" pops (on "one-point-two-five" ~16.5s→495 global→local 117)
  const arrow = prog(frame, 150, 165); // up-arrow + ALWAYS SWITCH?
  const popScale = 1.6 - 0.6 * EASE_OUT(pop);
  return (
    <AbsoluteFill>
      <Kicker text="EXPECTED VALUE" color={TEAL} y={170} at={4} />
      <Envelope cx={LEFTX} topY={ENV.topY} w={ENV.w} h={ENV.h} yoursP={1} dim={0.4} />
      <Envelope cx={RIGHTX} topY={ENV.topY} w={ENV.w} h={ENV.h} glow={arrow} />
      {/* the EV build over the right envelope */}
      <div style={{ position: 'absolute', left: RIGHTX, top: ENV.topY - 360, transform: 'translateX(-50%)', textAlign: 'center' }}>
        <MathLine x={0} y={0} text="EV(other)" size={40} color={SLATE} p={term1} bold={false} />
        <MathLine x={0} y={70} text="½·(X/2)" size={58} color="#ffffff" p={term1} />
        <MathLine x={0} y={150} text="+ ½·(2X)" size={58} color="#ffffff" p={term2} />
      </div>
      {/* "= 1.25X" — the fallacy, popping teal */}
      <div
        style={{
          position: 'absolute',
          left: 540,
          top: 1120,
          transform: `translateX(-50%) scale(${popScale})`,
          opacity: pop,
          fontFamily: FONT_DISPLAY,
          fontWeight: 700,
          fontSize: 108,
          color: TEAL,
          textShadow: `0 0 ${40 * pop}px ${TEAL}88, 0 6px 30px rgba(0,0,0,0.6)`,
          whiteSpace: 'nowrap',
        }}
      >
        = 1.25X
      </div>
      {/* up-arrow + ALWAYS SWITCH? */}
      <MathLine x={540} y={1250} text="▲ ALWAYS SWITCH?" size={56} color={TEAL} p={arrow} />
    </AbsoluteFill>
  );
};

// =============================================================================
// FLAW (20.4s..30.4s → frames 612..912) — 1.25X cracks apart; pair resolves to $10/$20;
// two outcome rows; they cancel to "= $0".
// =============================================================================
const FlawScene: React.FC = () => {
  const frame = useCurrentFrame(); // local: global − 612
  const crack = prog(frame, 0, 24); // 1.25X splits
  const open = EASE_OUT(prog(frame, 40, 70)); // both envelopes open → $10 / $20
  const rowLow = EASE_OUT(prog(frame, 90, 108)); // "hold $10 → +$10" (win/low ~23.5s→705 global→local 93)
  const rowHigh = EASE_OUT(prog(frame, 150, 168)); // "hold $20 → −$10" (lose/high ~25.5s→765 global→local 153)
  const cancel = EASE_OUT(prog(frame, 216, 238)); // "= $0" (on "cancel" ~28s→840 global→local 228)
  const cancelScale = 1.5 - 0.5 * EASE_OUT(cancel);
  return (
    <AbsoluteFill>
      <Kicker text="THE FLAW" color={PINK} y={170} at={2} />
      {/* 1.25X splits apart and fades as reality cracks it */}
      <div
        style={{
          position: 'absolute',
          left: 540,
          top: 470,
          transform: `translateX(-50%) scale(${1 + crack * 0.18}) rotate(${(1 - crack) * 0}deg)`,
          opacity: 1 - crack,
          fontFamily: FONT_DISPLAY,
          fontWeight: 700,
          fontSize: 96,
          color: TEAL,
        }}
      >
        1.25X
      </div>
      {/* crack lines through the fallacy */}
      <svg width={1080} height={1920} style={{ position: 'absolute', pointerEvents: 'none', opacity: Math.sin(crack * Math.PI) }}>
        <path d="M 380 470 L 700 520 M 420 540 L 660 460" stroke={PINK} strokeWidth={6} strokeLinecap="round" opacity={0.8} />
      </svg>

      <Envelope cx={LEFTX} topY={ENV.topY} w={ENV.w} h={ENV.h} yoursP={1} openP={open} value="$10" valueColor={GOLD} />
      <Envelope cx={RIGHTX} topY={ENV.topY} w={ENV.w} h={ENV.h} openP={open} value="$20" valueColor={GOLD} />

      {/* the two equally-likely outcomes */}
      <OutcomeRow x={540} y={1120} hold="hold $10  →" delta="+$10" color={TEAL} p={rowLow} />
      <OutcomeRow x={540} y={1250} hold="hold $20  →" delta="−$10" color={PINK} p={rowHigh} />

      {/* they cancel */}
      <div
        style={{
          position: 'absolute',
          left: 540,
          top: 1400,
          transform: `translateX(-50%) translateY(-50%) scale(${cancelScale})`,
          opacity: cancel,
          fontFamily: FONT_DISPLAY,
          fontWeight: 700,
          fontSize: 120,
          color: GOLD,
          textShadow: `0 0 ${46 * cancel}px ${GOLD}77, 0 6px 30px rgba(0,0,0,0.6)`,
          whiteSpace: 'nowrap',
        }}
      >
        = $0
      </div>
    </AbsoluteFill>
  );
};

// =============================================================================
// PAYOFF (30.4s..35.0s → frames 912..1050) — clean takeaway card "NO FREE LUNCH" /
// "$0 EXPECTED GAIN"; the 1.25X ghost fades out.
// =============================================================================
const PayoffScene: React.FC = () => {
  const frame = useCurrentFrame(); // local: global − 912
  const enter = EASE_OUT(prog(frame, 0, 20));
  const ghost = 1 - prog(frame, 0, 60); // 1.25X illusion fading out
  return (
    <AbsoluteFill style={{ opacity: enter }}>
      {/* the fading illusion */}
      <div
        style={{
          position: 'absolute',
          left: 540,
          top: 470,
          transform: 'translateX(-50%)',
          opacity: ghost * 0.25,
          fontFamily: FONT_DISPLAY,
          fontWeight: 700,
          fontSize: 90,
          color: TEAL,
        }}
      >
        1.25X
      </div>
      {/* takeaway card */}
      <div
        style={{
          position: 'absolute',
          left: 90,
          right: 90,
          top: 720,
          background: 'rgba(12,14,20,0.94)',
          border: `3px solid ${GOLD}88`,
          borderRadius: 30,
          padding: '64px 44px',
          textAlign: 'center',
          boxShadow: '0 24px 90px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{ fontFamily: FONT_BODY, fontWeight: 600, fontSize: 34, letterSpacing: 8, color: SLATE, textTransform: 'uppercase' }}>
          THE TWO-ENVELOPES PARADOX
        </div>
        <div style={{ marginTop: 22, fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 92, letterSpacing: 2, color: '#ffffff', lineHeight: 1.04 }}>
          NO FREE LUNCH
        </div>
        <div style={{ marginTop: 26, fontFamily: FONT_MONO, fontWeight: 700, fontSize: 60, color: GOLD }}>$0 EXPECTED GAIN</div>
        <div style={{ marginTop: 22, fontFamily: FONT_BODY, fontWeight: 500, fontSize: 34, color: 'rgba(255,255,255,0.78)', lineHeight: 1.3 }}>
          switching changes nothing — by symmetry
        </div>
      </div>
    </AbsoluteFill>
  );
};

// =============================================================================
// MAIN COMPONENT — persistent stage; all beats are <Sequence>s over it. The loop's last
// frame dissolves into the exact frame-0 look so frame 1139 == frame 0.
// =============================================================================
const Short14TwoEnvelopes: React.FC = () => {
  const frame = useCurrentFrame();
  // loop crossfade: payoff → hook over the last 30 frames, landing at 1.0 exactly on the
  // last frame (1139) so it visually equals frame 0.
  const loopIn = prog(frame, 1110, 1139);

  return (
    <AbsoluteFill>
      <ShortsBackdrop base="#0f1216" glow="#1d2430" />

      {/* HOOK 0..102 (0s..3.4s) */}
      <Sequence from={0} durationInFrames={102}>
        <HookScene />
      </Sequence>

      {/* SETUP 102..378 (3.4s..12.6s) */}
      <Sequence from={102} durationInFrames={276}>
        <SetupScene />
      </Sequence>

      {/* TRICK 378..612 (12.6s..20.4s) */}
      <Sequence from={378} durationInFrames={234}>
        <TrickScene />
      </Sequence>

      {/* FLAW 612..912 (20.4s..30.4s) */}
      <Sequence from={612} durationInFrames={300}>
        <FlawScene />
      </Sequence>

      {/* PAYOFF 912..1050 (30.4s..35.0s) */}
      <Sequence from={912} durationInFrames={138}>
        <PayoffScene />
      </Sequence>

      {/* LOOP dissolve: last 30 frames crossfade to the exact frame-0 look. */}
      {loopIn > 0 && (
        <AbsoluteFill style={{ opacity: loopIn }}>
          <LoopShot />
        </AbsoluteFill>
      )}

      <Captions lines={VO} y={CAP_Y} accent={GOLD} plate cap={1110 / 30} />
      <ProgressBar color={GOLD} resetAt={1110} />
    </AbsoluteFill>
  );
};

export default Short14TwoEnvelopes;
