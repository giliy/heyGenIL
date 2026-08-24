// learn-render.tsx — the generic data-driven renderer for the LEARN track
// (mode:"letter", and later "number" / "wordclass"). Consumes any mode:letter beats.json
// (from tools/make_learn.py --type letter) and renders the beat schedule without any
// per-video hand-built comp.
//
// This is the sibling of reading-render.tsx: the reading track teaches a VOWEL SIGN via a
// CV/blend ladder; the learn track teaches a NON-vowel concept (a letter, a number, a
// word-class) via a glyph -> example-words ladder. Same koala puppet, captions, brand,
// progress bar — the beat visuals differ because the taught object differs.
//
// What it renders per beat (mode:"letter"):
//   hook          — koala + the huge bare target letter (frame-0 composed, like reading)
//   teach-isolated— the bare letter BIG as a GraphemeTile, its POINTED NAME below it
//                   (e.g. אָלֶף) + a Latin sound label; the letter pops with its spoken sound
//   read-word     — each example word as a whole-word pop, with the TAUGHT LETTER emphasized
//                   at the word's start (RTL = rightmost grapheme = the leading letter)
//   call-response — "now you!" + the engineered hum pause, nothing lit in the silence
//
// Timing source: the global clock t = frame/fps, exactly like reading. Windows and content
// come from beats.json (letter{} + beats[] + vo[].units[]), NOT constants.
import React from 'react';
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Captions, ProgressBar, prog, settleP, SAFE } from './shorts';
import { GraphemeTile } from './reading';
import { KoalaPuppet } from './reading-render';
import { LibraryLottie } from './lottie';
import { FONT_HEBREW_CAPTION, FONT_BODY_H, FONT_KIDS_ROUND } from '../fonts';
import { COLORS } from '../brand';
import type { VoLine } from './shorts';

const SAFE_WIDTH = 1080 - SAFE.left - SAFE.right; // 860

// ---------------------------------------------------------------------------
// Types — the shape of a mode:letter beats.json (from tools/make_learn.py --type letter)
// ---------------------------------------------------------------------------
export interface LetterBeats {
  id: string;
  title: string;
  mode: string;
  language: string;
  series?: string;
  composition: string;
  musicBed?: string;
  format: { width: number; height: number; fps: number; durationSec: number };
  loop: boolean;
  letter?: {
    letter: string;      // the bare taught glyph, e.g. "א"
    name_he: string;     // the pointed Hebrew name, e.g. "אָלֶף"
    sound: string;       // Latin sound label, display only, e.g. "(א)" or "b"
    sofit?: boolean;     // final-form letter
    targetLetters: string[];
    progression: string[];
    anchorWords: string[];
  };
  number?: {
    numeral: number | null;  // the digit; null for a simple sum
    word: string;            // the Hebrew counting word, e.g. "שְׁלוֹשָׁה"
    count: number;           // how many objects the count-along places (COMPUTED)
    add?: { a: number; b: number } | null;
    progression: string[];
  };
  wordclass?: {
    name_he: string;     // the class name, e.g. "שֵׁם עֶצֶם"
    class: string;       // noun | verb | mixed
    words: string[];     // example words
    wordClasses: string[]; // per-word class (parallel to words)
    progression: string[];
  };
  vo: (VoLine & { beat?: string; sub?: string })[];
  beats: { name: string; start_s: number; end_s: number }[];
  voiceStatus?: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// LearnShort — the generic letter (and future number/wordclass) renderer
// ---------------------------------------------------------------------------
export const LearnShort: React.FC<{
  beats: LetterBeats;
  vo: VoLine[];
}> = ({ beats, vo }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;
  const total = durationInFrames / fps;

  const inRange = (a: number, b: number) => t >= a && t < b;
  const mode = beats.mode;
  const letterBlock = beats.letter;
  const numberBlock = beats.number;
  const letter = letterBlock?.letter || 'א';
  const nameHe = letterBlock?.name_he || '';
  const sound = letterBlock?.sound || '';
  const numeral = numberBlock?.numeral;
  const count = numberBlock?.count || 0;
  const wcBlock = beats.wordclass;
  const wcName = wcBlock?.name_he || '';
  const wcClass = wcBlock?.class || 'noun';
  const wcWords: string[] = wcBlock?.words || [];
  const wcClasses: string[] = wcBlock?.wordClasses || [];

  // --- resolve beat windows from beats[] (the schedule) -----------------------
  const beatWindows: Record<string, { start: number; end: number }> = {};
  for (const b of beats.beats) {
    if (!beatWindows[b.name]) beatWindows[b.name] = { start: b.start_s, end: b.end_s };
  }

  const linesFor = (beatName: string): (VoLine & { sub?: string })[] => {
    const planned = beats.vo.filter((bv) => bv.beat === beatName);
    const real = planned.map((bv) => vo.find((l) => l.text === bv.text) || bv);
    return (real.length ? real : planned).slice().sort((a, b) => a.start - b.start);
  };

  const activeLine = (beatName: string): (VoLine & { sub?: string }) | undefined => {
    const lines = linesFor(beatName);
    if (!lines.length) return undefined;
    const wins = beats.beats.filter((b) => b.name === beatName).sort((a, b) => a.start_s - b.start_s);
    for (let i = 0; i < wins.length; i++) {
      if (t >= wins[i].start_s && t < wins[i].end_s) return lines[Math.min(i, lines.length - 1)];
    }
    return lines[0];
  };

  const activeWindow = (beatName: string): { start: number; end: number } => {
    const wins = beats.beats.filter((b) => b.name === beatName).sort((a, b) => a.start_s - b.start_s);
    for (const w of wins) if (t >= w.start_s && t < w.end_s) return { start: w.start_s, end: w.end_s };
    if (wins.length) return { start: wins[0].start_s, end: wins[wins.length - 1].end_s };
    return beatWindows[beatName] || { start: 0, end: 0 };
  };

  const subOf = (beatName: string): string | undefined => {
    const wins = beats.beats.filter((b) => b.name === beatName).sort((a, b) => a.start_s - b.start_s);
    const lines = beats.vo.filter((bv) => bv.beat === beatName).sort((a, b) => a.start - b.start);
    for (let i = 0; i < wins.length; i++) {
      if (t >= wins[i].start_s && t < wins[i].end_s) return lines[Math.min(i, lines.length - 1)]?.sub;
    }
    return lines[0]?.sub;
  };

  const hook = beatWindows.hook || { start: 0, end: 3 };
  const teachIsolated = beatWindows['teach-isolated'] || { start: hook.end, end: hook.end + 6 };
  const readWord = activeWindow('read-word');
  const readWordSpan = beatWindows['read-word'] || readWord;
  const callResponse = beatWindows['call-response'] || { start: readWordSpan.end, end: readWordSpan.end + 5 };

  const isolatedLine = activeLine('teach-isolated');
  const isolatedUnit = isolatedLine?.units?.[0];
  const wordLine = activeLine('read-word');
  // For number count-along: which read-word line (index) is active = which object lights.
  const wordWindows = beats.beats.filter((b) => b.name === 'read-word').sort((a, b) => a.start_s - b.start_s);
  let activeWordIndex = -1;
  for (let i = 0; i < wordWindows.length; i++) {
    if (t >= wordWindows[i].start_s && t < wordWindows[i].end_s) { activeWordIndex = i; break; }
  }
  // After the count-along ends, keep ALL objects lit (the reward holds). activeCount = how many lit now.
  const activeCount = activeWordIndex >= 0 ? activeWordIndex + 1 : (t >= readWordSpan.end && count > 0 ? count : 0);

  const SubCaption: React.FC<{ text?: string; y?: number }> = ({ text, y = 1180 }) =>
    text ? (
      <div style={{ position: 'absolute', top: y, left: 0, right: 0, textAlign: 'center', fontFamily: FONT_BODY_H, fontWeight: 600, fontSize: 44, color: 'rgba(255,255,255,0.9)', letterSpacing: 2, direction: 'rtl' }}>
        {text}
      </div>
    ) : null;

  // --- whole-word pop for read-word (same as reading) -------------------------
  const wordPop = inRange(readWord.start, readWord.end)
    ? 1 + 0.10 * prog(t, readWord.start, readWord.start + 0.3)
    : 1;

  // --- koala puppet: surprised on the letter teach, celebrate on word reward ---
  const koalaMood = inRange(teachIsolated.start, readWordSpan.start)
    ? 'surprised'
    : inRange(readWord.start, readWord.end) || t >= callResponse.start
      ? 'celebrate'
      : 'happy';
  const koalaCelebrateAt: number | undefined = inRange(readWord.start, readWord.end)
    ? readWord.start
    : t >= callResponse.start
      ? callResponse.start
      : undefined;

  const hookComposed = inRange(hook.start, hook.end);

  // Highlight the taught letter at the START of an example word (RTL = the rightmost grapheme).
  // Renders the whole word, then an overlay tinting the leading grapheme accent-colored.
  const LetterWord: React.FC<{ word: string }> = ({ word }) => {
    // split into leading grapheme + rest using the same logic as the display splitter
    const hebrew = word.match(/[א-תְ-ׇֽֿ]+/g)?.[0] || word;
    const base = hebrew.match(/[א-ת]/g) || [];
    const leading = base[0] || '';
    const startIdx = hebrew.indexOf(leading);
    const head = hebrew.slice(0, startIdx + 1);
    const tail = hebrew.slice(startIdx + 1);
    return (
      <span style={{ direction: 'rtl', unicodeBidi: 'isolate' }}>
        <span style={{ color: COLORS.warn }}>{head}</span>
        <span>{tail}</span>
      </span>
    );
  };

  // Count-along objects: N simple shapes laid out in a grid, lit one-by-one in sync with
  // the spoken count. Each object is a soft rounded shape; lit = bright + slightly larger,
  // dim = waiting to be counted. RTL grid (first object rightmost).
  const CountObjects: React.FC<{ n: number; lit: number }> = ({ n, lit }) => {
    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    const size = Math.min(150, Math.floor((SAFE_WIDTH) / cols) - 24);
    const W = cols * (size + 24);
    const items: React.ReactNode[] = [];
    for (let i = 0; i < n; i++) {
      const isLit = i < lit;
      const justLit = lit === i + 1 && activeWordIndex === i; // currently sounding
      const scale = justLit ? 1 + 0.18 * prog(t, wordWindows[i].start_s, wordWindows[i].start_s + 0.2) : 1;
      items.push(
        <div
          key={i}
          style={{
            width: size, height: size, borderRadius: size * 0.28,
            background: isLit ? COLORS.warn : 'rgba(255,255,255,0.16)',
            boxShadow: isLit ? '0 8px 30px rgba(245,215,110,0.5)' : 'inset 0 2px 8px rgba(0,0,0,0.25)',
            transform: `scale(${scale})`, transition: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: FONT_HEBREW_CAPTION, fontWeight: 900, fontSize: size * 0.5,
            color: '#1a1a2e',
          }}
        >
          {isLit ? i + 1 : ''}
        </div>
      );
    }
    return (
      <div style={{ position: 'absolute', top: 620, left: 0, right: 0, display: 'flex', justifyContent: 'center', direction: 'rtl' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, ${size}px)`, gap: 24 }}>
          {items}
        </div>
      </div>
    );
  };

  return (
    <AbsoluteFill style={{ background: '#3d3560' }}>
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse 100% 62% at 50% 28%, #6b5a9e 0%, #4a3f74 52%, #3d3560 78%)' }} />
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse 72% 46% at 50% 90%, #2f6f7a 0%, transparent 70%)' }} />

      {/* ===== HOOK: frame-0 fully composed — koala + the bare target visible ===== */}
      {hookComposed && (
        <>
          <div style={{ position: 'absolute', top: 320, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
            <KoalaPuppet size={250} mood={koalaMood} celebrateAt={koalaCelebrateAt} />
          </div>
          <div style={{ position: 'absolute', top: 760, left: 0, right: 0, textAlign: 'center', fontFamily: FONT_HEBREW_CAPTION, fontWeight: 900, fontSize: mode === 'number' ? 300 : mode === 'wordclass' ? 150 : 340, lineHeight: 1.4, color: '#ffffff', direction: 'rtl', unicodeBidi: 'isolate', transform: 'translateY(-50%)', textShadow: '0 6px 40px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.4)' }}>
            {mode === 'number' ? (numeral ?? '') : mode === 'wordclass' ? wcName : letter}
          </div>
          <SubCaption text={mode === 'number' ? 'מִסְפָּר — בּוֹאוּ נִסְפּוֹר!' : mode === 'wordclass' ? 'מָה זֶה? בּוֹאוּ נִלְמַד!' : `הָאוֹת ${nameHe || ''}`} y={1180} />
        </>
      )}

      {/* ===== TEACH-ISOLATED (LETTER): the hero letter + its pointed NAME + sound ===== */}
      {mode === 'letter' && inRange(teachIsolated.start, readWordSpan.start) && isolatedUnit && (
        <>
          <div style={{ position: 'absolute', top: 430, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
            <KoalaPuppet size={210} mood={koalaMood} celebrateAt={koalaCelebrateAt} />
          </div>
          <GraphemeTile
            g={letter}
            at={teachIsolated.start}
            size={360}
            y={860}
            soundWindow={{ start: isolatedUnit.start, end: isolatedUnit.end }}
            accent={COLORS.warn}
            colorNikkud={false}
          />
          {/* the pointed NAME of the letter sits right under the glyph, teaching the shape's name */}
          {nameHe && (
            <div style={{ position: 'absolute', top: 1080, left: 0, right: 0, textAlign: 'center', fontFamily: FONT_HEBREW_CAPTION, fontWeight: 800, fontSize: 96, lineHeight: 1.3, color: COLORS.accent, direction: 'rtl', unicodeBidi: 'isolate', textShadow: '0 4px 26px rgba(0,0,0,0.5)' }}>
              {nameHe}
            </div>
          )}
          <SubCaption text={subOf('teach-isolated') ?? `${nameHe} — כָּךְ נִרְאֵית הָאוֹת`} y={1280} />
        </>
      )}

      {/* ===== TEACH-ISOLATED (NUMBER): the numeral + the Hebrew counting word ===== */}
      {mode === 'number' && inRange(teachIsolated.start, readWordSpan.start) && (
        <>
          <div style={{ position: 'absolute', top: 380, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
            <KoalaPuppet size={210} mood={koalaMood} celebrateAt={koalaCelebrateAt} />
          </div>
          <div style={{ position: 'absolute', top: 720, left: 0, right: 0, textAlign: 'center', fontFamily: FONT_HEBREW_CAPTION, fontWeight: 900, fontSize: 340, lineHeight: 1.3, color: '#ffffff', direction: 'rtl', unicodeBidi: 'isolate', textShadow: '0 6px 40px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.4)' }}>
            {numeral ?? ''}
          </div>
          {numberBlock?.word && (
            <div style={{ position: 'absolute', top: 1020, left: 0, right: 0, textAlign: 'center', fontFamily: FONT_HEBREW_CAPTION, fontWeight: 800, fontSize: 110, lineHeight: 1.3, color: COLORS.accent, direction: 'rtl', unicodeBidi: 'isolate', textShadow: '0 4px 26px rgba(0,0,0,0.5)' }}>
              {numberBlock.word}
            </div>
          )}
          <SubCaption text={subOf('teach-isolated') ?? 'מִסְפָּר — כָּךְ סוֹפְרִים!'} y={1240} />
        </>
      )}

      {/* ===== TEACH-ISOLATED (WORDCLASS): the class name + what it means ===== */}
      {mode === 'wordclass' && inRange(teachIsolated.start, readWordSpan.start) && (
        <>
          <div style={{ position: 'absolute', top: 430, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
            <KoalaPuppet size={210} mood={koalaMood} celebrateAt={koalaCelebrateAt} />
          </div>
          <div style={{ position: 'absolute', top: 780, left: 0, right: 0, textAlign: 'center', fontFamily: FONT_HEBREW_CAPTION, fontWeight: 900, fontSize: 200, lineHeight: 1.3, color: '#ffffff', direction: 'rtl', unicodeBidi: 'isolate', textShadow: '0 6px 40px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.4)' }}>
            {wcName}
          </div>
          <div style={{ position: 'absolute', top: 1080, left: 0, right: 0, textAlign: 'center', fontFamily: FONT_BODY_H, fontWeight: 600, fontSize: 52, lineHeight: 1.3, color: COLORS.accent, direction: 'rtl', unicodeBidi: 'isolate', textShadow: '0 4px 26px rgba(0,0,0,0.5)' }}>
            {wcClass === 'verb' ? 'מִלַּת פְּעֻלָּה — מַה שֶּׁמַּעֲשִׂים' : wcClass === 'mixed' ? 'שֵׁם עֶצֶם אוֹ פּוֹעַל?' : 'מִלָּה שֶׁנּוֹתֶנֶת שֵׁם לְדָבָר'}
          </div>
          <SubCaption text={subOf('teach-isolated') ?? 'בּוֹאוּ נִלְמַד!'} y={1240} />
        </>
      )}

      {/* ===== READ-WORD (LETTER): each example word pops; the taught letter highlighted at its start ===== */}
      {mode === 'letter' && inRange(readWord.start, readWord.end) && wordLine && (
        <>
          <div style={{ position: 'absolute', top: 430, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
            <KoalaPuppet size={230} mood={koalaMood} celebrateAt={koalaCelebrateAt} />
          </div>
          <div style={{ position: 'absolute', top: 250, left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none', opacity: 0.9 }}>
            <LibraryLottie id="confetti-burst" size={520} delay={Math.round(readWord.start * fps)} playbackRate={1} />
          </div>
          <div style={{ position: 'absolute', top: 220, left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none', opacity: 0.7 }}>
            <LibraryLottie id="sparkles" size={360} delay={Math.round(readWord.start * fps)} playbackRate={1} />
          </div>
          <div
            style={{
              position: 'absolute', top: 880, left: 0, right: 0, textAlign: 'center',
              fontFamily: FONT_HEBREW_CAPTION, fontWeight: 900, fontSize: 170, lineHeight: 1.5,
              color: '#ffffff', direction: 'rtl', unicodeBidi: 'isolate',
              transform: `scale(${wordPop})`, transformOrigin: 'center',
              textShadow: '0 6px 40px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.4)',
            }}
          >
            <LetterWord word={wordLine.text.replace(/[!.…,]\s*$/, '')} />
          </div>
          <SubCaption text={subOf('read-word') ?? 'יוֹפִי! מִלָּה עִם הָאוֹת!'} />
        </>
      )}

      {/* ===== READ-WORD (WORDCLASS): each example word pops + its class badge ===== */}
      {mode === 'wordclass' && activeWordIndex >= 0 && wcWords.length > 0 && (inRange(readWordSpan.start, readWordSpan.end) || t >= readWordSpan.end) && (() => {
        const wi = Math.min(Math.max(0, activeWordIndex), wcWords.length - 1);
        const word = wcWords[wi];
        const wClass = wcClasses[wi] ?? wcClass; // fall back to the lesson's class
        const badge = wClass === 'verb' ? 'פּוֹעַל' : 'שֵׁם עֶצֶם';
        const badgeBg = wClass === 'verb' ? COLORS.accent : COLORS.warn;
        // Progress within the CURRENT word line (for pop-in).
        const lineStart = wordWindows[wi]?.start_s ?? readWordSpan.start;
        const lineEnd = wordWindows[wi]?.end_s ?? readWordSpan.end;
        const lineP = Math.max(0, Math.min(1, (t - lineStart) / Math.max(1e-6, lineEnd - lineStart)));
        const pop = spring({ frame: Math.max(0, lineP * fps), fps, config: { damping: 13, mass: 0.6 } });
        return (
          <>
            <div style={{
              position: 'absolute', top: 620, left: 0, right: 0, display: 'flex',
              justifyContent: 'center', alignItems: 'baseline', textAlign: 'center', padding: '0 60px',
            }}>
              <div style={{
                fontFamily: FONT_HEBREW_CAPTION, fontWeight: 900, fontSize: 180, lineHeight: 1.5,
                color: '#ffffff', direction: 'rtl', unicodeBidi: 'isolate',
                transform: `scale(${pop})`, transformOrigin: 'center',
                textShadow: '0 6px 40px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.4)',
              }}>
                {String(word).replace(/[!.…,]\s*$/, '')}
              </div>
            </div>
            <div style={{
              position: 'absolute', top: 940, left: 0, right: 0, display: 'flex', justifyContent: 'center',
            }}>
              <span style={{
                fontFamily: FONT_HEBREW_CAPTION, fontWeight: 800, fontSize: 58,
                color: '#1a1c22', background: badgeBg, padding: '10px 28px', borderRadius: 999,
                direction: 'rtl', unicodeBidi: 'isolate',
                transform: `scale(${pop})`, transformOrigin: 'center',
                boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
              }}>
                {badge}
              </span>
            </div>
            <SubCaption text={subOf('read-word') ?? 'מִי יוֹדֵעַ?'} y={1240} />
          </>
        );
      })()}

      {/* ===== COUNT-ALONG (NUMBER): the objects light one-by-one in sync with the count ===== */}
      {mode === 'number' && count > 0 && (inRange(readWordSpan.start, readWordSpan.end) || t >= readWordSpan.end) && (
        <>
          <div style={{ position: 'absolute', top: 320, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
            <KoalaPuppet size={200} mood={koalaMood} celebrateAt={koalaCelebrateAt} />
          </div>
          <CountObjects n={count} lit={activeCount} />
          {/* the numeral grows as the count progresses (COMPUTED, never asserted) */}
          <div style={{ position: 'absolute', top: 1180, left: 0, right: 0, textAlign: 'center', fontFamily: FONT_HEBREW_CAPTION, fontWeight: 900, fontSize: 200, lineHeight: 1.2, color: COLORS.warn, direction: 'rtl', unicodeBidi: 'isolate', textShadow: '0 6px 40px rgba(0,0,0,0.5)' }}>
            {numeral ?? ''}
          </div>
          <SubCaption text={subOf('read-word') ?? 'סוֹפְרִים בַּיַּחַד!'} y={1420} />
        </>
      )}

      {/* ===== CALL-RESPONSE: "now you!" + engineered hum pause ===== */}
      {inRange(callResponse.start, total) && (
        <>
          <div style={{ position: 'absolute', top: 470, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
            <KoalaPuppet size={230} mood={koalaMood} celebrateAt={koalaCelebrateAt} />
          </div>
          <div style={{ position: 'absolute', top: 900, left: 0, right: 0, textAlign: 'center', fontFamily: FONT_KIDS_ROUND, fontWeight: 400, fontSize: 158, lineHeight: 1.4, color: COLORS.warn, direction: 'rtl', unicodeBidi: 'isolate', textShadow: '0 6px 40px rgba(0,0,0,0.5), 0 0 2px rgba(0,0,0,0.6)' }}>
            אַתֶּם!
          </div>
          <SubCaption text={subOf('call-response') ?? 'עַכְשָׁו אַתֶּם אוֹמְרִים!'} y={1180} />
        </>
      )}

      <Captions lines={vo} y={1480} size={58} accent={COLORS.warn} maxWords={4} plate rtl kidsNikkud />
      <ProgressBar color={COLORS.warn} />
    </AbsoluteFill>
  );
};
