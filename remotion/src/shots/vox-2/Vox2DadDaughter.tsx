import React from 'react';
import { AbsoluteFill, Sequence, staticFile } from 'remotion';
import {
  ArchivalPhoto,
  CollageBoard,
  Cutout,
  Grain,
  LabelChip,
  PaperBG,
  SerifStatement,
  VOX,
} from '../../lib/collage';
import { Captions } from '../../lib/shorts';
import { VO } from '../short-13/vo.gen';

// =============================================================================
// Vox2DadDaughter — layered-collage rebuild of Short13DadDaughter.
// Same story, same Edge-TTS voice (word-exact), same mix; every beat is now a
// painted watercolor collage scene. See vox/vox-2-dad-daughter/script.md.
// =============================================================================
export const compositionConfig = {
  id: 'Vox2DadDaughter',
  durationInSeconds: 38.0,
  fps: 30,
  width: 1080,
  height: 1920,
};

const W = 1080;
const H = 1920;
const asset = (f: string) => staticFile(`projects/vox-2-dad-daughter/layers/${f}`);

// ---- CUES (GLOBAL frames @30) — retimed to Edge-TTS word starts (vo.gen.ts) ----
const CUE = {
  // hook: "One photo hangs in our hallway." (0.4–3.43s)
  hookChip: 26,           // "One photo" lands
  hookTitle: 40,          // hook title fades in over the wall
  setupTitle: 120,        // "Ask my dad what's inside it…" (4.0s) — main title
  // memories — card pops just before the line starts
  newborn: 208,           // 7.2s
  steps: 328,             // 11.2s
  bike: 448,              // 15.2s
  storm: 568,             // 19.2s
  grad: 688,              // 23.2s
  grown: 808,             // 27.2s
  // payoff: "Ask him what's inside? His whole world." (31.4s)
  payoff: 934,            // wall returns; figures + title
  payoffTitle: 950,
  loopSettle: 1139,       // == frame 0
} as const;

// Camera: one gentle narrator. Push on the wall, pull back for the title, hold
// steady center through the memory spread (cards animate, camera breathes only),
// then settle back to the exact frame-0 framing for the seamless loop.
const CAM = [
  { f: 0, x: 540, y: 960, z: 1.0 },
  { f: 130, x: 540, y: 960, z: 1.08 },
  { f: 208, x: 540, y: 960, z: 1.0 },
  { f: 934, x: 540, y: 960, z: 1.0 },
  { f: 1010, x: 540, y: 960, z: 1.04 },
  { f: 1139, x: 540, y: 960, z: 1.0 },
];

const HOOK_WORDS = [{ t: 'ONE' }, { t: 'PHOTO', hl: true }, { t: 'ON' }, { t: 'THE' }, { t: 'WALL' }];

// The framed-photo wall art is SHARED between hook and payoff (the loop hinge).
// Present at frame 0 AND frame 1139 (no entrance), so the seam stays invisible.
const WallArt: React.FC<{ z?: number }> = ({ z }) => (
  <div style={{ position: 'absolute', left: 540, top: 900, width: 920, transform: 'translate(-50%,-50%)', zIndex: z }}>
    <img src={asset('wall.png')} style={{ width: '100%', display: 'block' }} alt="" />
  </div>
);

// Die-cut figures that assemble the payoff: grown daughter + dad hang the photo.
const PayoffFigures: React.FC<{ at: number }> = ({ at }) => (
  <>
    <Cutout src={asset('payoff-daughter.png')} x={400} y={1150} w={360} at={at} enter="slide-l" rotate={1} depth={0.1} sticker={6} shadow={3} />
    <Cutout src={asset('payoff-dad.png')} x={760} y={1180} w={360} at={at + 6} enter="slide-r" rotate={-1} depth={0.1} sticker={6} shadow={3} />
  </>
);

const Vox2DadDaughter: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: VOX.paper }}>
      <CollageBoard cam={CAM}>
        <PaperBG src={asset('paper.png')} w={W} h={H} />

        {/* ---- WALL (persists under everything; frame-0 & loop-1139 anchor) ---- */}
        <WallArt z={0} />

        {/* ---- HOOK (0–4s): title + chip over the wall ---- */}
        <Sequence from={0} durationInFrames={130} layout="none">
          <SerifStatement x={540} y={300} w={980} at={CUE.hookTitle} size={92} backing words={HOOK_WORDS} />
          <LabelChip x={540} y={1500} at={CUE.hookChip} text="hangs in our hallway" kicker="one photo" accent={VOX.red} size={36} />
        </Sequence>

        {/* ---- SETUP (4–7s): the promise line over the wall ---- */}
        <Sequence from={110} durationInFrames={110} layout="none">
          <SerifStatement x={540} y={1330} w={940} at={CUE.setupTitle - 110} size={74} backing
            words={[{ t: 'a' }, { t: 'dad.' }, { t: 'a' }, { t: 'daughter.' }, { t: 'a' }, { t: 'whole', hl: true }, { t: 'childhood.' }]} />
        </Sequence>

        {/* ---- MEMORIES — each a painted card pinned on the spread ---- */}
        <Memory name="newborn" file="newborn.png" at={CUE.newborn} until={CUE.steps} y={760} w={820}
          line={[{ t: 'the' }, { t: 'beginning', hl: true }]} kicker="chapter 1" />
        <Memory name="steps" file="steps.png" at={CUE.steps} until={CUE.bike} y={780} w={820}
          line={[{ t: 'first', hl: true }, { t: 'steps' }]} kicker="chapter 2" />
        <Memory name="bike" file="bike.png" at={CUE.bike} until={CUE.storm} y={760} w={820}
          line={[{ t: 'scraped', hl: true }, { t: 'knees' }]} kicker="chapter 3" />
        <Memory name="storm" file="storm.png" at={CUE.storm} until={CUE.grad} y={780} w={820}
          line={[{ t: 'quietly', hl: true }, { t: 'carried' }]} kicker="chapter 4" />
        <Memory name="grad" file="grad.png" at={CUE.grad} until={CUE.grown} y={760} w={820}
          line={[{ t: 'the sky', hl: true }, { t: 'clapped' }]} kicker="chapter 5" />
        <Memory name="grown" file="grown.png" at={CUE.grown} until={CUE.payoff} y={780} w={820}
          line={[{ t: 'coffee', hl: true }, { t: 'stays hot' }]} kicker="chapter 6" />

        {/* ---- PAYOFF (31–38s): back on the wall, figures hang the photo ---- */}
        <Sequence from={CUE.payoff} layout="none">
          <PayoffFigures at={4} />
          <SerifStatement x={540} y={300} w={980} at={CUE.payoffTitle - CUE.payoff} size={80} backing
            words={[{ t: 'HIS' }, { t: 'WHOLE', hl: true }, { t: 'WORLD' }]} />
        </Sequence>
      </CollageBoard>
      {/* Word-exact narration captions (Edge-TTS timings); dark plate reads over watercolor */}
      <Captions lines={VO} y={1700} accent={VOX.yellow} plate />
      <Grain opacity={0.05} />
    </AbsoluteFill>
  );
};

// A painted memory card pinned to the board for its window, then lifted away.
const Memory: React.FC<{
  name: string;
  file: string;
  at: number;
  until: number;
  y: number;
  w: number;
  line: { t: string; hl?: boolean }[];
  kicker: string;
}> = ({ file, at, until, y, w, line, kicker }) => {
  const dur = until - at;
  return (
    <Sequence from={at} durationInFrames={dur} layout="none">
      <ArchivalPhoto src={asset(file)} x={540} y={y} w={w} at={4} enter="place" rotate={-1.6} depth={0.07} tape />
      <LabelChip x={540} y={1500} at={10} text={kicker} accent={VOX.teal} size={30} />
      <SerifStatement x={540} y={1410} w={900} at={18} size={66} backing words={line} />
    </Sequence>
  );
};

export default Vox2DadDaughter;
