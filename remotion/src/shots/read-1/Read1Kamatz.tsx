import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { Captions, ProgressBar } from '../../lib/shorts';
import { KoalaPuppet, type KoalaMood } from '../../lib/reading-render';
import { LibraryLottie } from '../../lib/lottie';
import { GraphemeTile, SyllableTile } from '../../lib/reading';
import { FONT_HEBREW_CAPTION, FONT_BODY_H } from '../../fonts';
import { COLORS } from '../../brand';
import { VO } from './vo.gen';

// =============================================================================
// READ-1-KAMATZ — the pilot READING short (mode:"reading", language:"he").
// בּוּ (the locked yellow koala, drawn IN-TSX — no AI stills, $0) teaches קָמָץ (/a/)
// to ages 5-7. The product's promise: the on-screen pointed letter / צירוף (בָּ) lights up
// in EXACT sync with the spoken unit (one level finer than whole-word). Timing source = VO
// (vo.gen.ts) — the SAME global clock `t` the Captions units path reads, so a tile and its
// caption pop together. Register 5-7: short directive prompts + call-and-response (NOT cooing).
// Loop relaxed (loop:false) — a one-shot lesson; the call-and-response is the payoff.
// Visual: warm kids bg + in-TSX koala tile + GraphemeTile/SyllableTile heroes. No AI stills.
// =============================================================================
export const compositionConfig = {
  id: 'Read1Kamatz',
  durationInSeconds: 38.0,
  fps: 30,
  width: 1080,
  height: 1920,
};

// (koala body/face colors now live in the shared KoalaPuppet in lib/reading-render)

const inRange = (t: number, a: number, b: number) => t >= a && t < b;

// --- beat windows (global seconds, from beats.json) -------------------------
const BEAT = {
  hook: [0, 4.9],
  teachIsolated: [5, 11],
  teachCv: [11, 19],
  blend: [19, 28],
  readWord: [28, 33],
  callResponse: [33, 38],
};

// --- VO units (the highlight schedule) --------------------------------------
// VO[1] = teach-isolated, VO[2] = teach-cv, VO[3] = blend.
const ISOLATED_UNIT = VO[1].units![0];
const CV_UNITS = VO[2].units!;
const BLEND_UNITS = VO[3].units!;

// =============================================================================
// KoalaTile — בּוּ is now the shared animated KoalaPuppet (P1 #7), imported from
// lib/reading-render. The identity signature (fluffy round EARS + cream inner fluff)
// is preserved; the puppet adds a blink timer, per-mood mouth, squash-and-stretch
// breathe, and a settle celebration bounce on the reward beats. Calm rule holds
// (subtle motion, overshoot ≤6%).
// =============================================================================
const KoalaTile = KoalaPuppet;

// A wrapper that positions a GraphemeTile/SyllableTile at a specific horizontal slot.
// The tile is absolutely centered within its positioned parent (left:60/right:160 within
// parent width), so a wrapper of fixed width + left places the tile at that column.
const Slot: React.FC<{ x: number; w?: number; y?: number; children: React.ReactNode }> = ({ x, w = 300, y = 820, children }) => (
  <div style={{ position: 'absolute', top: 0, left: x, width: w, height: y + 400 }}>
    {children}
  </div>
);

// =============================================================================
const Read1Kamatz: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  const [h0, h1] = BEAT.hook;
  const [i0] = BEAT.teachIsolated;
  const [c0] = BEAT.teachCv;
  const [b0] = BEAT.blend;
  const [r0, r1] = BEAT.readWord;
  const [cr0] = BEAT.callResponse;

  // blend slide: both tiles translate from their start columns toward the center over [16,20].
  const slideP = Math.max(0, Math.min(1, (t - b0) / 4));
  const rightX = 810 + (540 - 810) * slideP; // בָּ (right) slides left to center
  const leftX = 270 + (540 - 270) * slideP; // בָּא (left) slides right to center

  // read-word whole-word pop (existing whole-word highlight — line has NO units[])
  const wordPop = inRange(t, r0, r1) ? 1 + 0.10 * Math.max(0, Math.min(1, (t - r0) / 0.3)) : 1;

  // --- koala puppet: per-beat mood + celebration timing (mirrors reading-render) ---
  const koalaMood: KoalaMood = inRange(t, i0, c0)
    ? 'surprised'
    : inRange(t, r0, r1) || t >= cr0
      ? 'celebrate'
      : 'happy';
  const koalaCelebrateAt: number | undefined = inRange(t, r0, r1) ? r0 : t >= cr0 ? cr0 : undefined;

  return (
    <AbsoluteFill style={{ background: '#3d3560' }}>
      {/* warm kids backdrop — bright indigo/violet glow (brand §5; light enough that the
          yellow koala + white glyph read clearly, unlike a near-black field) */}
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse 100% 62% at 50% 28%, #6b5a9e 0%, #4a3f74 52%, #3d3560 78%)' }} />
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse 72% 46% at 50% 90%, #2f6f7a 0%, transparent 70%)' }} />

      {/* ===== HOOK: frame-0 fully composed — koala + target sign בָּ already visible ===== */}
      {inRange(t, h0, h1) && (
        <>
          <div style={{ position: 'absolute', top: 320, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 60 }}>
            <KoalaTile size={250} mood={koalaMood} celebrateAt={koalaCelebrateAt} />
          </div>
          <GraphemeTile g="בָּ" at={-0.5} size={300} y={900} nikkudColor={COLORS.accent} colorNikkud />
        </>
      )}

      {/* ===== TEACH-ISOLATED: the hero pointed letter בָּ, pop in sync with its sound ===== */}
      {inRange(t, i0, BEAT.teachCv[0]) && (
        <>
          <div style={{ position: 'absolute', top: 470, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
            <KoalaTile size={210} mood={koalaMood} celebrateAt={koalaCelebrateAt} />
          </div>
          <GraphemeTile
            g="בָּ"
            at={i0}
            size={360}
            y={900}
            soundWindow={ISOLATED_UNIT}
            nikkudColor={COLORS.accent}
            accent={COLORS.warn}
            colorNikkud
            showSoundLabel
            label="ba"
          />
          <div style={{ position: 'absolute', top: 1180, left: 0, right: 0, textAlign: 'center', fontFamily: FONT_BODY_H, fontWeight: 600, fontSize: 44, color: 'rgba(255,255,255,0.9)', letterSpacing: 2, textTransform: 'none', direction: 'rtl' }}>
            קָמָץ — אוֹמְרִים "אַא"
          </div>
        </>
      )}

      {/* ===== TEACH-CV: the three צירופים one at a time; each pops as spoken ===== */}
      {inRange(t, c0, BEAT.blend[0]) && (
        <>
          {CV_UNITS.map((u, ui) => {
            const on = inRange(t, u.start - 0.3, u.end + 1.4);
            if (!on) return null;
            const x = [810, 540, 270][ui]; // RTL: בָּ right, then מָּ, then קָּ
            return (
              <Slot key={ui} x={x - 150}>
                <SyllableTile
                  syllable={u.g}
                  at={u.start - 0.3}
                  size={200}
                  y={900}
                  soundWindow={u}
                  nikkudColor={COLORS.accent}
                  accent={COLORS.warn}
                  colorNikkud
                />
              </Slot>
            );
          })}
        </>
      )}

      {/* ===== BLEND: בָּ + בָּא slide together → בָּבָּא; highlight sweeps across syllables ===== */}
      {inRange(t, b0, BEAT.readWord[0]) && (
        <>
          <div style={{ position: 'absolute', top: 470, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
            <KoalaTile size={200} mood={koalaMood} celebrateAt={koalaCelebrateAt} />
          </div>
          <Slot x={rightX - 150}>
            <SyllableTile syllable={BLEND_UNITS[0].g} at={b0} size={220} y={900} soundWindow={BLEND_UNITS[0]} nikkudColor={COLORS.accent} accent={COLORS.warn} colorNikkud />
          </Slot>
          <Slot x={leftX - 150}>
            <SyllableTile syllable={BLEND_UNITS[1].g} at={b0} size={220} y={900} soundWindow={BLEND_UNITS[1]} nikkudColor={COLORS.accent} accent={COLORS.warn} colorNikkud />
          </Slot>
          {t >= 23 && (
            <div style={{ position: 'absolute', top: 1160, left: 0, right: 0, textAlign: 'center', fontFamily: FONT_BODY_H, fontWeight: 600, fontSize: 46, color: 'rgba(255,255,255,0.92)', direction: 'rtl' }}>
              בָּבָּא!
            </div>
          )}
        </>
      )}

      {/* ===== READ-WORD: whole word בָּבָּא (whole-word pop — the existing Captions path), koala celebrates ===== */}
      {inRange(t, r0, r1) && (
        <>
          <div style={{ position: 'absolute', top: 430, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
            <KoalaTile size={230} mood={koalaMood} celebrateAt={koalaCelebrateAt} />
          </div>
          {/* P1 #21: calm confetti + sparkles on the reward beat (single resolved play). */}
          <div style={{ position: 'absolute', top: 250, left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none', opacity: 0.9 }}>
            <LibraryLottie id="confetti-burst" size={520} delay={Math.round(r0 * fps)} playbackRate={1} />
          </div>
          <div style={{ position: 'absolute', top: 220, left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none', opacity: 0.7 }}>
            <LibraryLottie id="sparkles" size={360} delay={Math.round(r0 * fps)} playbackRate={1} />
          </div>
          <div
            style={{
              position: 'absolute', top: 880, left: 0, right: 0, textAlign: 'center',
              fontFamily: FONT_HEBREW_CAPTION, fontWeight: 900, fontSize: 190, lineHeight: 1.5,
              color: '#ffffff', direction: 'rtl', unicodeBidi: 'isolate',
              transform: `scale(${wordPop})`, transformOrigin: 'center',
              textShadow: '0 6px 40px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.4)',
            }}
          >
            בָּבָּא
          </div>
          <div style={{ position: 'absolute', top: 1180, left: 0, right: 0, textAlign: 'center', fontFamily: FONT_BODY_H, fontWeight: 600, fontSize: 44, color: 'rgba(255,255,255,0.9)', direction: 'rtl' }}>
            יוֹפִי! קָרָאתָ מִלָּה!
          </div>
        </>
      )}

      {/* ===== CALL-RESPONSE: "now you!" + engineered hum pause; NO tile highlight in the silence ===== */}
      {inRange(t, cr0, 38.0) && (
        <>
          <div style={{ position: 'absolute', top: 470, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
            <KoalaTile size={230} mood={koalaMood} celebrateAt={koalaCelebrateAt} />
          </div>
          <div style={{ position: 'absolute', top: 900, left: 0, right: 0, textAlign: 'center', fontFamily: FONT_HEBREW_CAPTION, fontWeight: 900, fontSize: 150, lineHeight: 1.4, color: COLORS.warn, direction: 'rtl', unicodeBidi: 'isolate', textShadow: '0 6px 40px rgba(0,0,0,0.5)' }}>
            אַתֶּם!
          </div>
          <div style={{ position: 'absolute', top: 1180, left: 0, right: 0, textAlign: 'center', fontFamily: FONT_BODY_H, fontWeight: 600, fontSize: 46, color: 'rgba(255,255,255,0.92)', direction: 'rtl' }}>
            עַכְשָׁו אַתֶּם אוֹמְרִים!
          </div>
        </>
      )}

      {/* ===== CAPTIONS — the shared reading path; lights per-grapheme in sync (rtl kidsNikkud plate) ===== */}
      <Captions lines={VO} y={1480} size={58} accent={COLORS.warn} maxWords={4} plate rtl kidsNikkud />

      <ProgressBar color={COLORS.warn} />

      {/* SAFE guides note: hero tiles at y900, captions at y1480 — above bottom-500 (1420) + right-160 clear. */}
    </AbsoluteFill>
  );
};

export default Read1Kamatz;
