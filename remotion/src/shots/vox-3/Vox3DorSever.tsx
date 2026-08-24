import React from 'react';
import { AbsoluteFill, Sequence, staticFile } from 'remotion';
import {
  CollageBoard,
  Cutout,
  Grain,
  LabelChip,
  Layer,
  RubberStamp,
  SerifStatement,
  VOX,
} from '../../lib/collage';
import { Captions } from '../../lib/shorts';
import { VO } from './vo.gen';

// =============================================================================
// Vox3DorSever — layered-collage short from 4 uploaded photos of Dor Sever.
// Hebrew end-to-end: RTL on-screen text (Heebo) + Hebrew voiceover
// (Edge-TTS he-IL-AvriNeural, word-exact). The moral: shortcuts make you a
// "Dor Sever" — קיצורי דרך יהפכו אותך לדור סבר.
// See vox/vox-3-dor-sever/script.md.
// =============================================================================
export const compositionConfig = {
  id: 'Vox3DorSever',
  durationInSeconds: 33.0,
  fps: 30,
  width: 1080,
  height: 1920,
};

const W = 1080;
const H = 1920;
const asset = (f: string) => staticFile(`projects/vox-3-dor-sever/layers/${f}`);

// ---- CUES (GLOBAL frames @30) — synced to real Edge-TTS word starts (vo.gen.ts) ----
const CUE = {
  // hook "דור סבר תמיד חיפש קיצורי דרך." (0.5–4.5s)
  hookChip: 30,            // "דור סבר" chip lands
  hookTitle: 45,           // hook headline over the river
  // meet "זה דור סבר. איש עני..." (4.6–9.9s)
  meet: 142,               // dor-01 portrait drops in
  meetTitle: 170,          // "איש עני" statement
  // gag-1 "במקום להרוויח ביושר? הוא קנה לוטו." (10.0–14.2s)
  g1: 304,                 // dor-03 grin
  g1Chip: 330,             // "הלוטו"
  // gag-2 "במקום ללמוד למבחן? הוא סימן תשובות." (14.3–18.6s)
  g2: 432,                 // dor-04 mustache
  g2Chip: 456,             // "המבחן"
  // gag-3 "במקום לחסוך? הוא לקח הלוואה." (18.7–22.4s)
  g3: 566,                 // dor-03 again
  g3Chip: 590,             // "ההלוואה"
  // moral "כל קיצור דרך הוביל אותו לדרך הארוכה." (22.5–26.6s)
  moral: 682,              // pull back, headline over river
  // punchline "כי בסוף — קיצורי דרך יהפכו אותך לדור סבר." (26.9–31.6s)
  punch: 810,              // rubber stamp slams
  punchTitle: 830,
  loopSettle: 989,         // == frame 0
} as const;

// Camera: push on the river for the hook, settle center for the three sticker gags,
// pull back for the moral, push in for the punchline stamp, then settle to the exact
// frame-0 framing for the seamless loop. dor-02 background is sized to cover the
// board at the widest zoom-out (z=0.92) — DESIGN.md rule #7.
const CAM = [
  { f: 0, x: 540, y: 960, z: 1.0 },
  { f: 130, x: 540, y: 960, z: 1.08 },
  { f: 300, x: 540, y: 940, z: 1.0 },
  { f: 560, x: 540, y: 940, z: 1.0 },
  { f: 682, x: 540, y: 960, z: 0.92 },
  { f: 810, x: 540, y: 960, z: 1.0 },
  { f: 989, x: 540, y: 960, z: 1.0 },
];

const Vox3DorSever: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: VOX.paper }}>
      <CollageBoard cam={CAM}>
        {/* ---- FULL-BLEED BACKGROUND — the river where Dor stands (persists, frame-0 loop anchor) ---- */}
        <Layer x={540} y={960} w={1400} at={0} dur={1} enter="none" depth={-0.08} drift={0} z={0}>
          <img src={asset('dor-02.png')} style={{ width: '100%', display: 'block' }} alt="" />
        </Layer>

        {/* ---- HOOK (0–4.5s): headline + chip over the river ---- */}
        <Sequence from={0} durationInFrames={142} layout="none">
          <SerifStatement x={540} y={300} w={980} at={CUE.hookTitle} size={84} backing
            words={[{ t: 'דור' }, { t: 'סבר', hl: true }, { t: 'חיפש' }, { t: 'קיצורי' }, { t: 'דרך' }]} rtl />
          <LabelChip x={540} y={1560} at={CUE.hookChip} text="תמיד בדרך הקצרה" kicker="הסיפור" accent={VOX.red} size={34} rtl />
        </Sequence>

        {/* ---- MEET (4.6–9.9s): dor-01 portrait drops in ---- */}
        <Sequence from={CUE.meet} layout="none">
          <Cutout src={asset('dor-01-cut.png')} x={380} y={1080} w={340} at={2} enter="place" rotate={-2.5} depth={0.1} sticker={6} shadow={3} z={2} />
          <LabelChip x={820} y={950} at={16} text="דור סבר" accent={VOX.teal} size={36} rotate={1.5} rtl />
          <SerifStatement x={760} y={1360} w={520} at={24} size={58} backing
            words={[{ t: 'איש' }, { t: 'עני', hl: true }]} align="center" rtl />
        </Sequence>

        {/* ---- GAG-1 (10.0–14.2s): the lottery, dor-03 grin ---- */}
        <Sequence from={CUE.g1} layout="none">
          <Cutout src={asset('dor-03-cut.png')} x={720} y={1060} w={380} at={2} enter="slide-r" rotate={2} depth={0.11} sticker={6} shadow={3} z={3} />
          <LabelChip x={300} y={940} at={14} text="הלוטו" kicker="קיצור דרך #1" accent={VOX.yellow} size={32} rotate={-1.5} rtl />
        </Sequence>

        {/* ---- GAG-2 (14.3–18.6s): the exam cheat, dor-04 mustache ---- */}
        <Sequence from={CUE.g2} layout="none">
          <Cutout src={asset('dor-04-cut.png')} x={540} y={1000} w={520} at={2} enter="place" rotate={-1.5} depth={0.09} sticker={6} shadow={3} z={3} />
          <LabelChip x={820} y={1420} at={14} text="המבחן" kicker="קיצור דרך #2" accent={VOX.yellow} size={32} rotate={1.5} rtl />
        </Sequence>

        {/* ---- GAG-3 (18.7–22.4s): the loan, dor-03 again (different pose slot) ---- */}
        <Sequence from={CUE.g3} layout="none">
          <Cutout src={asset('dor-03-cut.png')} x={540} y={1150} w={330} at={2} enter="rise" rotate={-1} depth={0.12} sticker={6} shadow={3} z={3} />
          <LabelChip x={820} y={1000} at={14} text="ההלוואה" kicker="קיצור דרך #3" accent={VOX.yellow} size={32} rotate={1} rtl />
        </Sequence>

        {/* ---- MORAL (22.5–26.6s): pull back, headline over the river ---- */}
        <Sequence from={CUE.moral} layout="none">
          <SerifStatement x={540} y={760} w={1000} at={2} size={80} backing
            words={[{ t: 'כל' }, { t: 'קיצור' }, { t: 'דרך', hl: true }, { t: '—' }, { t: 'הדרך' }, { t: 'הארוכה' }]} rtl />
        </Sequence>

        {/* ---- PUNCHLINE (26.9–31.6s): rubber stamp slams, headline lands ---- */}
        <Sequence from={CUE.punch} layout="none">
          <RubberStamp text="קיצור דרך" x={540} y={1120} at={2} size={64} rotate={-9} depth={0.06} z={4} />
          <SerifStatement x={540} y={720} w={980} at={CUE.punchTitle - CUE.punch} size={66} backing
            words={[{ t: 'יהפכו' }, { t: 'אותך', hl: true }, { t: 'לדור' }, { t: 'סבר' }]} rtl />
        </Sequence>
      </CollageBoard>
      {/* Word-exact Hebrew narration captions (Edge-TTS timings); dark plate reads over the photos */}
      <Captions lines={VO} y={1720} accent={VOX.yellow} plate rtl />
      <Grain opacity={0.05} />
    </AbsoluteFill>
  );
};

export default Vox3DorSever;
