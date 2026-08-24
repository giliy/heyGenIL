// reading-render.tsx — the ONE generic data-driven renderer for the reading track
// (mode:"reading"). Consumes any mode:reading beats.json (from tools/make_reading.py) and
// renders the 6-beat schedule without any per-video hand-built comp.
//
// Per design research/hebrew-reading/transcript-driven-design.md §3: the per-video "composition"
// collapses to a thin generated wrapper (registration only); this file is the actual renderer.
//
// What it renders per beat (mapping the data to lib/reading.tsx tiles + lib/shorts.tsx Captions):
//   hook          — koala + the huge target reading.sign as a GraphemeTile (frame-0 composed)
//   teach-isolated— one GraphemeTile for the isolated unit, soundWindow = its real [start,end)
//   teach-cv      — the line's units[] as SyllableTiles, RTL columns, each pops as spoken
//   blend         — the blend units slide together toward center, soundWindow sweeps across
//   read-word     — the whole anchor word as one big pointed caption pop (no units[])
//   call-response — "now you!" + the engineered hum pause, NOTHING lit in the silence
//
// Timing source: the global clock t = frame/fps, exactly like the pilot. The windows and tile
// content come from props (beats.json reading{} + beats[] + vo[].units[]), NOT constants.
// Brand accent/warn for the whole series (sign-recognition continuity, design decision 13).
// CV tiles capped at ≤4/row, min size ~140 for mark legibility (design decision 14).
//
// Registration: each video = one generated wrapper with a unique id (see tools/make_reading.py
// write_wrapper). This file is NEVER registered itself.
import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { Captions, ProgressBar, prog, settleP, EASE_OUT, SAFE } from './shorts';
import { GraphemeTile, SyllableTile } from './reading';
import { LibraryLottie } from './lottie';
import { FONT_HEBREW_CAPTION, FONT_BODY_H, FONT_KIDS_ROUND } from '../fonts';
import { COLORS } from '../brand';
import type { VoLine, TimedUnit } from './shorts';

// ---------------------------------------------------------------------------
// Types — the shape of the mode:reading beats.json (from tools/make_reading.py)
// ---------------------------------------------------------------------------
export interface ReadingBeats {
  id: string;
  title: string;
  mode: string;
  language: string;
  series?: string;
  composition: string;
  musicBed?: string;
  format: { width: number; height: number; fps: number; durationSec: number };
  loop: boolean;
  reading: {
    nikkud: string;
    sign: string;
    sound: string;
    targetLetters: string[];
    progression: string[];
    anchorWords: string[];
  };
  // vo lines carry the canonical beat name + optional decorative `sub` caption (design §5).
  // VoLine doesn't declare beat/sub, so widen it here.
  vo: (VoLine & { beat?: string; sub?: string })[];
  beats: { name: string; start_s: number; end_s: number }[];
  voiceStatus?: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Brand-consistent colors (design decision 13: same accent/warn for the whole series)
// ---------------------------------------------------------------------------
const KOALA = '#ffd45e';
const KOALA_DARK = '#e6b63f';
const CREAM = '#fff2cf';
const INK = '#1a1a2e';

// ---------------------------------------------------------------------------
// KoalaPuppet — the locked yellow koala, drawn IN-TSX (no AI stills, $0), now a
// multi-layer useCurrentFrame-driven puppet (P1 #7). The static tile was the weakest
// pixel against the repo's "a character kids LOVE" bar; this animates it WITHOUT
// breaking determinism or the kids calm rule (subtle motion, overshoot ≤6%).
//
// Layers (each independently animatable):
//   body   — squash-and-stretch (idle breathe + a settle bounce on reward beats)
//   ears   — the silhouette signature; a gentle per-ear wiggle on celebration
//   eyes   — huge low-set glossy; a deterministic BLINK timer collapses scaleY
//   mouth  — per-mood: happy (smile) / surprised (open O) / celebrate (big grin)
//
// Motion sources (all deterministic functions of `frame`, no state, no randomness):
//   idle breathe  — slow sine scaleY/scaleX (±1.2%), period ~2.4s
//   blink         — every ~2.8s the eyes squash to a slit for ~0.12s (phase-offset)
//   celebrate     — settleP(progress) overshoot→lock bounce + ear wiggle + grin
//
// `mood` and `celebrateAt` come from the active beat; defaults keep it calm.
// ---------------------------------------------------------------------------
export type KoalaMood = 'happy' | 'surprised' | 'celebrate';

export const KoalaPuppet: React.FC<{
  size?: number;
  mood?: KoalaMood;
  celebrateAt?: number; // seconds — when the celebration bounce starts (reward beat)
  breathePhase?: number; // seconds offset so two on-screen koalas don't sync
}> = ({ size = 220, mood = 'happy', celebrateAt, breathePhase = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  // --- idle breathe (always on, very subtle) ---------------------------------
  const breathe = Math.sin(((t + breathePhase) / 2.4) * Math.PI * 2);
  const breatheScaleY = 1 + 0.012 * breathe;
  const breatheScaleX = 1 - 0.008 * breathe;

  // --- celebration bounce (settle overshoot → lock), only when celebrateAt set ---
  const celebP = celebrateAt === undefined ? 0 : prog(t, celebrateAt, celebrateAt + 0.6);
  const celebBounce = settleP(celebP); // 0 -> ~1.06 crest -> 1 lock
  const celebLift = celebrateAt === undefined ? 0 : -14 * Math.sin(celebP * Math.PI); // small hop, 0 at both ends
  const scaleY = breatheScaleY * (celebrateAt === undefined ? 1 : celebBounce);
  const scaleX = breatheScaleX * (celebrateAt === undefined ? 1 : 2 - celebBounce); // squash-opposite

  // --- blink timer: every 2.8s, eyes squash for ~0.12s (deterministic) ---------
  const blinkCycle = (t + breathePhase) % 2.8;
  const blink = blinkCycle < 0.12 ? Math.sin((blinkCycle / 0.12) * Math.PI) : 0; // 0→1→0 over the blink
  const eyeScaleY = 1 - 0.92 * blink; // collapse to a slit at the blink peak

  // --- ear wiggle on celebration (±3°, alternate) ------------------------------
  const wig = celebrateAt === undefined ? 0 : Math.sin(celebP * Math.PI * 2) * 3;

  // --- mouth per mood ----------------------------------------------------------
  const mouth =
    mood === 'surprised' ? (
      // open "o" of wonder
      <ellipse cx={100} cy={134} rx={9} ry={11} fill={INK} />
    ) : mood === 'celebrate' ? (
      // big open grin
      <path d="M84 130 Q100 152 116 130 Q100 140 84 130 Z" fill={INK} />
    ) : (
      // default gentle smile (unchanged from the static tile)
      <path d="M88 132 Q100 144 112 132" stroke={INK} strokeWidth={5} fill="none" strokeLinecap="round" />
    );

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      style={{ filter: 'drop-shadow(0 10px 30px rgba(0,0,0,0.28))', overflow: 'visible' }}
    >
      <g
        transform={`translate(100 150) scale(${scaleX} ${scaleY}) translate(-100 -150) translate(0 ${celebLift})`}
      >
        {/* ears — the silhouette signature, cream inner fluff; wiggle on celebrate */}
        <g transform={`rotate(${-wig} 52 52)`}>
          <circle cx={52} cy={52} r={42} fill={KOALA} />
          <circle cx={52} cy={52} r={22} fill={CREAM} />
        </g>
        <g transform={`rotate(${wig} 148 52)`}>
          <circle cx={148} cy={52} r={42} fill={KOALA} />
          <circle cx={148} cy={52} r={22} fill={CREAM} />
        </g>
        {/* head */}
        <circle cx={100} cy={104} r={62} fill={KOALA} />
        {/* face */}
        <circle cx={100} cy={118} r={34} fill={CREAM} />
        {/* eyes — huge, low-set, dark glossy; blink collapses scaleY around the eye line */}
        <g transform={`translate(0 ${104 * (1 - eyeScaleY)}) scale(1 ${eyeScaleY})`}>
          <circle cx={80} cy={104} r={13} fill={INK} />
          <circle cx={120} cy={104} r={13} fill={INK} />
          <circle cx={84} cy={100} r={4} fill="#fff" opacity={0.85} />
          <circle cx={124} cy={100} r={4} fill="#fff" opacity={0.85} />
        </g>
        {/* nose */}
        <ellipse cx={100} cy={122} rx={9} ry={7} fill={INK} />
        {/* mouth — per mood */}
        {mouth}
        {/* chubby cheeks */}
        <circle cx={70} cy={122} r={8} fill="#f7a" opacity={0.4} />
        <circle cx={130} cy={122} r={8} fill="#f7a" opacity={0.4} />
      </g>
    </svg>
  );
};

// Back-compat alias — the shared renderer + pilot both import `KoalaTile`.
const KoalaTile = KoalaPuppet;

// ---------------------------------------------------------------------------
// Layout helpers — the only non-trivial new logic (design §3.3)
// ---------------------------------------------------------------------------
// _cvSlots(n, safeWidth) -> x-centers for n tiles, RTL (first unit rightmost), evenly spaced.
function _cvSlots(n: number, safeWidth: number): number[] {
  const centers: number[] = [];
  const maxPerRow = 4; // design decision 14
  const perRow = Math.min(n, maxPerRow);
  const spacing = perRow > 1 ? safeWidth / (perRow - 1) : 0;
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / maxPerRow);
    const col = i % maxPerRow;
    // RTL: first unit rightmost
    const x = SAFE.left + safeWidth - col * spacing;
    centers.push(x);
  }
  return centers;
}

// _blendSlots(m, slideP, centerX) -> the m syllable x-positions interpolated spread -> merged.
function _blendSlots(m: number, slideP: number, centerX: number): number[] {
  if (m === 1) return [centerX];
  const spacing = 220; // ~tile width + air
  const startSpread = (m - 1) * spacing;
  const positions: number[] = [];
  for (let i = 0; i < m; i++) {
    // RTL: first unit rightmost (mirrors _cvSlots) — arrays are never reversed,
    // positions do the RTL work. Negating the per-index offset puts unit 0 on the right.
    const spreadX = centerX + startSpread / 2 - i * spacing;
    const mergedX = centerX + (m - 1) * spacing / 2 - i * spacing;
    positions.push(spreadX + (mergedX - spreadX) * slideP);
  }
  return positions;
}

// ---------------------------------------------------------------------------
// ReadingShort — the generic renderer
// ---------------------------------------------------------------------------
export const ReadingShort: React.FC<{
  beats: ReadingBeats;
  vo: VoLine[];
}> = ({ beats, vo }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;
  const total = durationInFrames / fps;

  const inRange = (a: number, b: number) => t >= a && t < b;

  // --- resolve beat windows from beats[] (the schedule) -----------------------
  // A beat name may REPEAT (e.g. 5 blend + 5 read-word lines). Keying by name collapses to ONE
  // window/line, so resolve the ACTIVE line by current time instead: the vo[] line of that beat
  // whose [start,end) contains t (falling back to the first of that name pre-voice).
  const beatWindows: Record<string, { start: number; end: number }> = {};
  for (const b of beats.beats) {
    // keep the EARLIEST window per name for the "what beat are we in" switch; the per-line content
    // is resolved by time below.
    if (!beatWindows[b.name]) beatWindows[b.name] = { start: b.start_s, end: b.end_s };
  }

  // All vo[] lines for a beat name, in time order.
  const linesFor = (beatName: string): (VoLine & { sub?: string })[] => {
    const planned = beats.vo.filter((bv) => bv.beat === beatName);
    // prefer real voiced lines (match by text) when vo.gen.ts is present
    const real = planned.map((bv) => vo.find((l) => l.text === bv.text) || bv);
    return (real.length ? real : planned).slice().sort((a, b) => a.start - b.start) as (VoLine & { sub?: string })[];
  };

  // The ACTIVE line for a beat: the one whose [start,end) (from beats[] schedule) contains t.
  // beats[] windows are positional (i-th window <-> i-th line of that name).
  const activeLine = (beatName: string): (VoLine & { sub?: string }) | undefined => {
    const lines = linesFor(beatName);
    if (!lines.length) return undefined;
    const wins = beats.beats.filter((b) => b.name === beatName).sort((a, b) => a.start_s - b.start_s);
    for (let i = 0; i < wins.length; i++) {
      if (t >= wins[i].start_s && t < wins[i].end_s) return lines[Math.min(i, lines.length - 1)];
    }
    return lines[0];
  };
  const timedLine = activeLine;

  // The ACTIVE beats[] window for a (possibly repeated) beat name: the one containing t.
  // Falls back to the name's full span when t is between instances.
  const activeWindow = (beatName: string): { start: number; end: number } => {
    const wins = beats.beats.filter((b) => b.name === beatName).sort((a, b) => a.start_s - b.start_s);
    for (const w of wins) if (t >= w.start_s && t < w.end_s) return { start: w.start_s, end: w.end_s };
    if (wins.length) return { start: wins[0].start_s, end: wins[wins.length - 1].end_s };
    return beatWindows[beatName] || { start: 0, end: 0 };
  };

  // Decorative sub-captions come from the ACTIVE beats.json vo[] line's `sub` field (design §5).
  const subOf = (beatName: string): string | undefined => {
    const wins = beats.beats.filter((b) => b.name === beatName).sort((a, b) => a.start_s - b.start_s);
    const lines = beats.vo.filter((bv) => bv.beat === beatName).sort((a, b) => a.start - b.start);
    for (let i = 0; i < wins.length; i++) {
      if (t >= wins[i].start_s && t < wins[i].end_s) return lines[Math.min(i, lines.length - 1)]?.sub;
    }
    return lines[0]?.sub;
  };

  // --- beat windows (with fallbacks for missing beats) -----------------------
  const hook = beatWindows.hook || { start: 0, end: 3 };
  const teachIsolated = beatWindows['teach-isolated'] || { start: hook.end, end: hook.end + 6 };
  const teachCv = beatWindows['teach-cv'] || { start: teachIsolated.end, end: teachIsolated.end + 8 };
  // repeated beats resolve to the ACTIVE instance's window (single-instance beats get their only one)
  const blend = activeWindow('blend');
  const readWord = activeWindow('read-word');
  const blendSpan = beatWindows.blend || blend;               // full blend span (for boundaries)
  const readWordSpan = beatWindows['read-word'] || readWord;  // full read-word span
  const callResponse = beatWindows['call-response'] || { start: readWordSpan.end, end: readWordSpan.end + 5 };

  // --- extract units per beat -------------------------------------------------
  const isolatedLine = timedLine('teach-isolated');
  const isolatedUnit = isolatedLine?.units?.[0];
  const cvLine = timedLine('teach-cv');
  const cvUnits = cvLine?.units || [];
  const blendLine = timedLine('blend');
  const blendUnits = blendLine?.units || [];
  const wordLine = timedLine('read-word');

  // A small static sub-caption (decorative reinforcement, no highlight) under the tile.
  const SubCaption: React.FC<{ text?: string; y?: number }> = ({ text, y = 1180 }) =>
    text ? (
      <div style={{ position: 'absolute', top: y, left: 0, right: 0, textAlign: 'center', fontFamily: FONT_BODY_H, fontWeight: 600, fontSize: 44, color: 'rgba(255,255,255,0.9)', letterSpacing: 2, direction: 'rtl' }}>
        {text}
      </div>
    ) : null;

  // --- blend slide progress (over the blend beat window) -----------------------
  const slideP = prog(t, blend.start, blend.start + 4);

  // --- read-word whole-word pop ------------------------------------------------
  const wordPop = inRange(readWord.start, readWord.end)
    ? 1 + 0.10 * prog(t, readWord.start, readWord.start + 0.3)
    : 1;

  // --- layout ------------------------------------------------------------------
  const safeWidth = 1080 - SAFE.left - SAFE.right; // 860
  const cvSlots = _cvSlots(cvUnits.length, safeWidth);
  const blendSlots = _blendSlots(blendUnits.length, slideP, 540);
  const blendWordY = 1160;

  // --- koala puppet: per-beat mood + celebration timing -------------------------
  // teach-isolated -> surprised (wonder at the new sound); read-word -> celebrate
  // (the reward pop); call-response -> celebrate (the "now YOU!" payoff). Everything
  // else stays calm/happy. Celebration bounce starts at the beat's own start.
  const koalaMood: KoalaMood = inRange(teachIsolated.start, teachCv.start)
    ? 'surprised'
    : inRange(readWord.start, readWord.end) || t >= callResponse.start
      ? 'celebrate'
      : 'happy';
  const koalaCelebrateAt: number | undefined = inRange(readWord.start, readWord.end)
    ? readWord.start
    : t >= callResponse.start
      ? callResponse.start
      : undefined;

  // --- frame-0 composition: hook must be fully composed (target sign visible) ---
  const hookComposed = inRange(hook.start, hook.end);

  return (
    <AbsoluteFill style={{ background: '#3d3560' }}>
      {/* warm kids backdrop — bright indigo/violet glow + teal pool */}
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse 100% 62% at 50% 28%, #6b5a9e 0%, #4a3f74 52%, #3d3560 78%)' }} />
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse 72% 46% at 50% 90%, #2f6f7a 0%, transparent 70%)' }} />

      {/* ===== HOOK: frame-0 fully composed — koala + target sign already visible ===== */}
      {hookComposed && (
        <>
          <div style={{ position: 'absolute', top: 320, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
            <KoalaTile size={250} mood={koalaMood} celebrateAt={koalaCelebrateAt} />
          </div>
          <GraphemeTile g={beats.reading.sign} at={-0.5} size={300} y={900} nikkudColor={COLORS.accent} colorNikkud />
        </>
      )}

      {/* ===== TEACH-ISOLATED: the hero pointed letter, pop in sync with its sound ===== */}
      {inRange(teachIsolated.start, teachCv.start) && isolatedUnit && (
        <>
          <div style={{ position: 'absolute', top: 470, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
            <KoalaTile size={210} mood={koalaMood} celebrateAt={koalaCelebrateAt} />
          </div>
          <GraphemeTile
            g={isolatedUnit.g}
            at={teachIsolated.start}
            size={360}
            y={900}
            soundWindow={{ start: isolatedUnit.start, end: isolatedUnit.end }}
            nikkudColor={COLORS.accent}
            accent={COLORS.warn}
            colorNikkud
            showSoundLabel
            label={_soundLabel(isolatedUnit.g, beats)}
          />
          <SubCaption text={subOf('teach-isolated') ?? `${beats.reading.sign} — אוֹמְרִים "${_soundLabel(beats.reading.sign, beats)}"`} />
        </>
      )}

      {/* ===== TEACH-CV: the צירופים one at a time; each pops as spoken ===== */}
      {inRange(teachCv.start, blend.start) && cvUnits.length > 0 && (
        <>
          {cvUnits.map((u, ui) => {
            const x = cvSlots[ui] || 540;
            return (
              <div key={ui} style={{ position: 'absolute', top: 0, left: x - 150, width: 300 }}>
                <SyllableTile
                  syllable={u.g}
                  at={u.start - 0.3}
                  size={200}
                  y={900}
                  soundWindow={{ start: u.start, end: u.end }}
                  nikkudColor={COLORS.accent}
                  accent={COLORS.warn}
                  colorNikkud
                />
              </div>
            );
          })}
        </>
      )}

      {/* ===== BLEND: syllables slide together → whole word; highlight sweeps across ===== */}
      {/* visible during the ACTIVE blend window (repeats resolve per-instance by time) */}
      {inRange(blend.start, blend.end) && blendUnits.length > 0 && (
        <>
          <div style={{ position: 'absolute', top: 470, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
            <KoalaTile size={200} mood={koalaMood} celebrateAt={koalaCelebrateAt} />
          </div>
          {blendUnits.map((u, i) => (
            <div key={i} style={{ position: 'absolute', top: 0, left: blendSlots[i] - 150, width: 300 }}>
              <SyllableTile
                syllable={u.g}
                at={blend.start}
                size={220}
                y={900}
                soundWindow={{ start: u.start, end: u.end }}
                nikkudColor={COLORS.accent}
                accent={COLORS.warn}
                colorNikkud
              />
            </div>
          ))}
          {t >= blend.end - 0.5 && (
            <div style={{ position: 'absolute', top: blendWordY, left: 0, right: 0, textAlign: 'center', fontFamily: FONT_BODY_H, fontWeight: 600, fontSize: 46, color: 'rgba(255,255,255,0.92)', direction: 'rtl' }}>
              {_stripPunct(blendLine?.text || blendUnits.map((u) => u.g).join(''))}!
            </div>
          )}
        </>
      )}

      {/* ===== READ-WORD: whole word pop (no units[]), koala celebrates ===== */}
      {/* visible during the ACTIVE read-word window (repeats resolve per-instance by time) */}
      {inRange(readWord.start, readWord.end) && wordLine && (
        <>
          <div style={{ position: 'absolute', top: 430, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
            <KoalaTile size={230} mood={koalaMood} celebrateAt={koalaCelebrateAt} />
          </div>
          {/* P1 #21: a calm confetti-burst + sparkles on the reward beat, behind the koala.
              The koala's celebration bounce starts at readWord.start; the Lotties play once
              from the same moment. Calm clips only (brand §5), single resolved play, no loop. */}
          <div style={{ position: 'absolute', top: 250, left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none', opacity: 0.9 }}>
            <LibraryLottie id="confetti-burst" size={520} delay={Math.round(readWord.start * fps)} playbackRate={1} />
          </div>
          <div style={{ position: 'absolute', top: 220, left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none', opacity: 0.7 }}>
            <LibraryLottie id="sparkles" size={360} delay={Math.round(readWord.start * fps)} playbackRate={1} />
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
            {_stripPunct(wordLine.text)}
          </div>
          <SubCaption text={subOf('read-word') ?? 'יוֹפִי! קָרָאתָ מִלָּה!'} />
        </>
      )}

      {/* ===== CALL-RESPONSE: "now you!" + engineered hum pause; NO tile highlight ===== */}
      {inRange(callResponse.start, total) && (
        <>
          <div style={{ position: 'absolute', top: 470, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
            <KoalaTile size={230} mood={koalaMood} celebrateAt={koalaCelebrateAt} />
          </div>
          {/* P1 #16: Varela Round for the kids "now you!" headline prompt — soft rounded face
              (a headline, not a reading tile, so nikkud-tile Rubik isn't required). Single
              weight 400; bump to a heavy presence via size + textShadow instead. */}
          <div style={{ position: 'absolute', top: 900, left: 0, right: 0, textAlign: 'center', fontFamily: FONT_KIDS_ROUND, fontWeight: 400, fontSize: 158, lineHeight: 1.4, color: COLORS.warn, direction: 'rtl', unicodeBidi: 'isolate', textShadow: '0 6px 40px rgba(0,0,0,0.5), 0 0 2px rgba(0,0,0,0.6)' }}>
            אַתֶּם!
          </div>
          <SubCaption text={subOf('call-response') ?? 'עַכְשָׁו אַתֶּם אוֹמְרִים!'} y={1180} />
        </>
      )}

      {/* ===== CAPTIONS — the shared reading path; lights per-grapheme in sync ===== */}
      <Captions lines={vo} y={1480} size={58} accent={COLORS.warn} maxWords={4} plate rtl kidsNikkud />

      <ProgressBar color={COLORS.warn} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function _stripPunct(s: string): string {
  return s.replace(/[!.…,]\s*$/, '');
}

// A simple Latin sound label for a pointed grapheme (display only; never load-bearing).
function _soundLabel(g: string, beats: ReadingBeats): string {
  const map: Record<string, string> = {
    'ב': 'b', 'ג': 'g', 'ד': 'd', 'ה': 'h', 'ו': 'v', 'ז': 'z', 'ח': 'ch',
    'ט': 't', 'י': 'y', 'כ': 'k', 'ך': 'k', 'ל': 'l', 'מ': 'm', 'ם': 'm',
    'נ': 'n', 'ן': 'n', 'ס': 's', 'ע': '', 'פ': 'p', 'ף': 'p', 'צ': 'ts',
    'ץ': 'ts', 'ק': 'k', 'ר': 'r', 'ש': 'sh', 'ת': 't',
  };
  // base letter = first Hebrew char
  const base = g.match(/[א-ת]/)?.[0] || '';
  const cons = map[base] || '';
  const vowel = beats.reading.sound || 'a';
  return cons + vowel;
}
