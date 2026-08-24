import React from 'react';
import { AbsoluteFill, Easing, Sequence, useCurrentFrame } from 'remotion';
import type { Spec, OverlayText } from '@shorts/spec';
import {
  Captions,
  PauseCard,
  prog,
} from '../../lib/shorts';
import { Arrow, BoardMove, ChessBoard, Highlight, START_FEN, fenBoard } from '../../lib/chess';
import { FONT_MONO } from '../../fonts';
import { RenderSpecOverlays, getDurationSec } from '../../lib/spec-renderer';
import { specDurationFrames, specDimensions } from '../../lib/template-utils';
import { VO } from './vo.gen';

// =============================================================================
// COMPOSITION CONFIG (legacy fallback for render-all.mjs)
// =============================================================================
export const compositionConfig = {
  id: 'Short1Chess',
  durationInSeconds: 42,
  fps: 30,
  width: 1080,
  height: 1920,
};

// =============================================================================
// STYLE CONSTANTS
// =============================================================================
const GOLD = '#f5d76e';
const RED = '#e8879f';
const GREEN = '#4db8a8';
const GRAY = '#8b949e';
const EASE_INOUT = Easing.bezier(0.37, 0, 0.63, 1);

// Board geometry (shared by hook / main / loop so the loop lands on the hook frame)
const B = { size: 940, x: 70, y: 470 } as const;

// =============================================================================
// defaultProps — Spec from shorts/short-1-chess/beats.json. Scenes from beats;
// user-editable text (hook title, kickers, move tags, stamps, stat chips, pause copy)
// become text overlays. The board + moves stay a niche visual (scene.visual cue).
// =============================================================================
const DUR = { hook: 3.2, trap: 11.2, quiz: 5.4, punish: 10.2, damage: 7.4, loop: 4.6 } as const;

const txt = (
  id: string, content: string, x: number, y: number, w: number, h: number,
  start: number, end: number,
  opts?: Partial<OverlayText['style']> & { animation?: OverlayText['animation'] }
): OverlayText => ({
  id, type: 'text', content, x, y, w, h, start, end,
  animation: opts?.animation ?? 'rise',
  style: { font: 'display', size: 64, color: '#ffffff', weight: 700, align: 'center', ...(opts ?? {}) },
});

export const defaultProps: Spec = {
  id: 'short-1-chess',
  title: 'The 4-Move Checkmate — Punished',
  template: 'Short1Chess',
  engine: 'tsx',
  format: { width: 1080, height: 1920, fps: 30 },
  theme: { accent: GOLD, font: 'display' },
  voice: { engine: 'elevenlabs', voiceId: 'default', lines: VO },
  captions: { preset: 'pop', burnIn: true },
  scenes: [
    {
      id: 'hook', durationSec: DUR.hook, beatId: 'hook', visual: 'hook',
      overlays: [
        txt('hook-1', 'THE 4-MOVE', 40, 190, 1000, 90, 0, DUR.hook, { size: 92, color: '#ffffff', font: 'display' }),
        txt('hook-2', 'CHECKMATE TRAP', 40, 300, 1000, 90, 0, DUR.hook, { size: 92, color: GOLD, font: 'display' }),
        txt('hook-sub', '…and the move that destroys it', 40, 420, 1000, 60, 0, DUR.hook, { size: 40, weight: 500, color: 'rgba(255,255,255,0.82)', font: 'body' }),
      ],
    },
    {
      id: 'trap', durationSec: DUR.trap, beatId: 'trap', visual: 'trap',
      overlays: [
        txt('kicker-trap', 'THE TRAP', 390, 180, 300, 60, 0.2, 7.4, { size: 30, weight: 600, color: GOLD, font: 'body' }),
        txt('stamp-mate', 'CHECKMATE', 380, 900, 320, 110, 6.2, 8.9, { size: 96, color: RED, font: 'display', animation: 'pop' }),
      ],
    },
    {
      id: 'quiz', durationSec: DUR.quiz, beatId: 'quiz', visual: 'quiz',
      overlays: [
        txt('kicker-quiz', 'FIND THE DEFENSE', 290, 180, 500, 60, 0.4, DUR.quiz, { size: 30, weight: 600, color: RED, font: 'body' }),
      ],
    },
    {
      id: 'punish', durationSec: DUR.punish, beatId: 'punish', visual: 'punish',
      overlays: [
        txt('kicker-punish', 'THE PUNISH', 360, 180, 360, 60, 0.2, DUR.punish, { size: 30, weight: 600, color: GREEN, font: 'body' }),
      ],
    },
    {
      id: 'damage', durationSec: DUR.damage, beatId: 'damage', visual: 'damage',
      overlays: [
        txt('kicker-damage', 'COUNT THE DAMAGE', 250, 180, 580, 60, 0.4, 4.0, { size: 30, weight: 600, color: GOLD, font: 'body' }),
        txt('chip-white', 'White — 2 queen moves · 0 threats left', 60, 280, 460, 110, 1.4, DUR.damage, { size: 30, weight: 600, color: RED, font: 'body', align: 'left' }),
        txt('chip-black', 'Black — 3 pieces out · all with tempo', 560, 280, 470, 110, 1.8, DUR.damage, { size: 30, weight: 600, color: GREEN, font: 'body', align: 'left' }),
      ],
    },
    {
      id: 'loop', durationSec: DUR.loop, beatId: 'loop', visual: 'loop',
      overlays: [
        txt('loop-1', 'THE 4-MOVE', 40, 190, 1000, 90, 0, DUR.loop, { size: 92, color: '#ffffff', font: 'display', animation: 'fade' }),
        txt('loop-2', 'CHECKMATE TRAP', 40, 300, 1000, 90, 0, DUR.loop, { size: 92, color: GOLD, font: 'display', animation: 'fade' }),
        txt('loop-sub', 'now you punish it', 40, 420, 1000, 60, 0, DUR.loop, { size: 40, weight: 500, color: 'rgba(255,255,255,0.82)', font: 'body', animation: 'fade' }),
      ],
    },
  ],
  meta: { revision: 0, updatedAt: '2026-08-22' },
};

// =============================================================================
// NICHE VISUAL DATA — board move timeline (local frames within the MAIN era, which
// spans trap+quiz+punish+damage back-to-back). Not user-editable text; stays TSX.
// =============================================================================
const MATE_FEN = 'r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR';

const MOVES: BoardMove[] = [
  { from: 'e2', to: 'e4', at: 39, dur: 12 },
  { from: 'e7', to: 'e5', at: 66, dur: 12 },
  { from: 'f1', to: 'c4', at: 93 },
  { from: 'b8', to: 'c6', at: 159 },
  { from: 'd1', to: 'h5', at: 183 },
  { from: 'g8', to: 'f6', at: 234 },
  { from: 'h5', to: 'f7', at: 267 },
  { from: 'f7', to: 'h5', at: 360, dur: 20, restore: { sq: 'f7', code: 'bP' } },
  { from: 'f6', to: 'g8', at: 360, dur: 20 },
  { from: 'g7', to: 'g6', at: 510, dur: 12 },
  { from: 'h5', to: 'f3', at: 588 },
  { from: 'g8', to: 'f6', at: 702 },
];

const HIGHLIGHTS: Highlight[] = [
  { sq: 'f7', color: RED, at: 132, until: 350 },
  { sq: 'f6', color: GOLD, at: 237, until: 330 },
  { sq: 'e8', color: RED, at: 279, until: 352 },
  { sq: 'g6', color: GREEN, at: 516, until: 585 },
  { sq: 'f7', color: GOLD, at: 660, until: 706 },
  { sq: 'f6', color: GREEN, at: 714, until: 800 },
  { sq: 'f7', color: GREEN, at: 765, until: 900 },
  { sq: 'c6', color: GREEN, at: 933, until: 1010 },
  { sq: 'f6', color: GREEN, at: 942, until: 1010 },
  { sq: 'g6', color: GREEN, at: 951, until: 1010 },
];

const ARROWS: Arrow[] = [
  { from: 'c4', to: 'f7', color: RED, at: 117, until: 300 },
  { from: 'h5', to: 'f7', color: RED, at: 204, until: 300 },
  { from: 'g6', to: 'h5', color: GREEN, at: 534, until: 585 },
  { from: 'f3', to: 'f7', color: GOLD, at: 645, until: 712 },
  { from: 'd1', to: 'h5', color: GRAY, at: 879, until: 1010, dashed: true },
  { from: 'h5', to: 'f3', color: GRAY, at: 891, until: 1010, dashed: true },
];

// Shared hook/loop board — the loop's last frame lands on the hook's look.
const HookBoard: React.FC<{ mode: 'settle' | 'grow' }> = ({ mode }) => {
  const frame = useCurrentFrame();
  const scale =
    mode === 'settle'
      ? 1.06 - 0.06 * EASE_INOUT(prog(frame, 0, 28))
      : 1.0 + 0.06 * EASE_INOUT(prog(frame, 0, 132));
  return (
    <AbsoluteFill style={{ transform: `scale(${scale})` }}>
      <ChessBoard
        size={B.size}
        x={B.x}
        y={B.y}
        board={fenBoard(MATE_FEN)}
        highlights={[
          { sq: 'f7', color: RED, at: -8 },
          { sq: 'e8', color: RED, at: -8 },
        ]}
      />
    </AbsoluteFill>
  );
};

// The persistent board era: trap → rewind → quiz → punish → damage, one timeline.
const MainBoard: React.FC = () => {
  const frame = useCurrentFrame();
  const fadeOut = 1 - prog(frame, 1002, 1030);
  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      <ChessBoard size={B.size} x={B.x} y={B.y} board={fenBoard(START_FEN)} moves={MOVES} highlights={HIGHLIGHTS} arrows={ARROWS} />
      {/* local frames: global 17.6–19.8s */}
      <Sequence from={432} durationInFrames={66}>
        <PauseCard durSec={2.2} title="PAUSE" subtitle="Black to move — find it" />
      </Sequence>
    </AbsoluteFill>
  );
};

// =============================================================================
// MAIN — spec-driven. The board era is a niche visual keyed to scene boundaries;
// user-editable text renders via the generic overlay renderer.
// =============================================================================
const Short1Chess: React.FC<{ spec?: Spec }> = ({ spec = defaultProps }) => {
  const totalSec = getDurationSec(spec);
  const F = (s: number) => Math.round(s * spec.format.fps);

  // Scene boundaries (back-to-back).
  const sceneStart: Record<string, number> = {};
  {
    let acc = 0;
    for (const s of spec.scenes) {
      sceneStart[s.beatId ?? s.id] = acc;
      acc += F(s.durationSec);
    }
  }
  const hookStart = sceneStart['hook'] ?? 0;
  const trapStart = sceneStart['trap'] ?? F(3.2);
  const hookFrames = F(spec.scenes.find((s) => (s.beatId ?? s.id) === 'hook')?.durationSec ?? DUR.hook);
  const loopStartSec = totalSec - (spec.scenes[spec.scenes.length - 1]?.durationSec ?? DUR.loop);
  const loopStart = F(loopStartSec);
  const loopFrames = F(spec.scenes[spec.scenes.length - 1]?.durationSec ?? DUR.loop);

  const captionY = spec.format.height - 420;

  return (
    <AbsoluteFill style={{ background: '#0f1216' }}>
      <Sequence from={hookStart} durationInFrames={hookFrames}>
        <HookBoard mode="settle" />
      </Sequence>
      <Sequence from={trapStart} durationInFrames={Math.max(1, loopStart - trapStart)}>
        <MainBoard />
      </Sequence>
      <Sequence from={loopStart} durationInFrames={loopFrames}>
        <AbsoluteFill style={{ opacity: prog(0, 0, 1) }}>
          <LoopFade frames={loopFrames} />
        </AbsoluteFill>
      </Sequence>

      {/* User-editable text overlays (titles, kickers, stamps, chips) */}
      <RenderSpecOverlays spec={spec} />

      <Captions lines={spec.voice?.lines ?? []} y={captionY} accent={spec.theme.accent ?? GOLD} />
      <ProgressBarLocal color={spec.theme.accent ?? GOLD} resetAt={loopStart} totalSec={totalSec} fps={spec.format.fps} />
    </AbsoluteFill>
  );
};

// Fades the loop scene in over its first ~12 frames so the last frame ≈ frame 0.
const LoopFade: React.FC<{ frames: number }> = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ opacity: prog(frame, 0, 12) }}>
      <HookBoard mode="grow" />
    </AbsoluteFill>
  );
};

const ProgressBarLocal: React.FC<{ color?: string; resetAt: number; totalSec: number; fps: number }> = ({ color = GOLD, resetAt, totalSec, fps }) => {
  const frame = useCurrentFrame();
  const durationInFrames = Math.max(1, Math.round(totalSec * fps));
  const base = frame / Math.max(1, durationInFrames - 1);
  const resetP = prog(frame, resetAt, durationInFrames - 1);
  const fill = Math.max(0, base * (1 - resetP));
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: 'rgba(255,255,255,0.12)' }}>
      <div style={{ width: `${fill * 100}%`, height: '100%', background: color }} />
    </div>
  );
};

// =============================================================================
// calculateMetadata — duration/fps/size from spec scenes + format.
// =============================================================================
export const calculateMetadata = async ({ props }: { props: { spec?: Spec } }) => {
  const spec = props.spec ?? defaultProps;
  return {
    durationInFrames: specDurationFrames(spec),
    fps: spec.format.fps,
    ...specDimensions(spec),
  };
};

export default Short1Chess;
