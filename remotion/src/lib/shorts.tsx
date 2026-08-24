// Vertical Shorts kit (1080x1920) — shared by every shorts/short-N video.
// Word-pop captions driven by a VO line map (estimated timings now; swap for real
// transcript timings later — components retime, nothing rebuilds).
import React from 'react';
import { AbsoluteFill, Easing, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { createTikTokStyleCaptions } from '@remotion/captions';
import type { Caption, TikTokPage } from '@remotion/captions';
import { FONT_BODY, FONT_BODY_H, FONT_DISPLAY, FONT_DISPLAY_H, FONT_HEBREW_CAPTION } from '../fonts';

export const SHORT = { W: 1080, H: 1920, FPS: 30 } as const;
// Zones covered by Shorts/Reels/TikTok UI — keep critical info (esp. captions) OUT.
// bottom is LARGE on YouTube Shorts: the handle + title + description + right-side action
// buttons occupy the lower ~500px — captions must sit ABOVE ~y1420 or they collide (ch-3
// lesson from a real mobile screenshot).
export const SAFE = { top: 150, bottom: 500, right: 160, left: 60 } as const;

export const EASE_OUT = Easing.bezier(0.33, 1, 0.68, 1);
export const EASE_INOUT = Easing.bezier(0.37, 0, 0.63, 1);

// --- Pro-motion easing discipline (research/pro-quality 02 §2.1) ---------------
// The two amateur tells in a flat type-led look are "too linear" and "floaty."
// The research prescribes: ease-out to ENTER (fast start, soft landing), ease-in to
// EXIT (linger, then accelerate out), slight ARCS over straight-line rises, and a
// "settle" micro-motion (tiny overshoot -> lock) on pops so nothing lands mechanically.
// These are the shared curves the track libs (ads/reading) reuse — one definition,
// tuned here, applied everywhere.
export const EASE_IN = Easing.bezier(0.55, 0.06, 0.68, 0.19);   // ease-in (for exits)
export const EASE_POP = Easing.bezier(0.34, 1.3, 0.64, 1);      // pop: overshoot past 1, settle (<= ~6% so kids rule holds)

/**
 * `settle` — the "settle" micro-motion from the research: progress 0..1 with a gentle
 * overshoot PAST 1 that settles back to exactly 1, then holds. Use for pop/scale/stamp
 * entrances so they lock instead of stopping dead. overshoot stays <= ~6% (kids rule:
 * sticker-pop overshoot <= 8%, no bounce).
 *   settleP(t) returns ~1.06 at its crest, 1 at rest. Feed it to scale().
 */
export const settleP = (t: number) => EASE_POP(t);

/**
 * `arcRise` — the x/y of a rise-with-arc: an element rises `risePx` from restY while
 * drifting `arcPx` sideways (the eye tracks curves better than straight lines), easing
 * out on entry. Returns px offsets to add to translate(). arcPx small (~4-8) — subtle.
 * t = entry progress 0..1; curve is a parabola peak at t=0.5 so it reads as one arc.
 */
export const arcRise = (t: number, risePx: number, arcPx = 6) => ({
  x: Math.sin(t * Math.PI) * arcPx,       // 0 at both ends, +arcPx mid-flight
  y: (1 - EASE_OUT(t)) * risePx,          // risePx -> 0, ease-out
});


// brand.md §motion: stagger the i-th item of a group by step frames (default 3).
// Grouped elements enter with a 3–4 frame gap between items — never all at once.
export const stagger = (i: number, base: number, step = 3) => base + i * step;

// brand.md §5: the brand spring — snappy, NO overshoot (damping 200, mass 0.8,
// stiffness 120, overshootClamped). Delay is in frames.
export const brandSpring = (frame: number, fps: number, delay = 0) =>
  spring({
    frame,
    fps,
    delay,
    config: { damping: 200, mass: 0.8, stiffness: 120, overshootClamping: true },
  });

// 0..1 progress of t through [a,b], clamped — degenerate-range-proof.
export const prog = (t: number, a: number, b: number) =>
  Math.max(0, Math.min(1, (t - a) / Math.max(0.0001, b - a)));

// Reading track (mode:"reading"): a per-grapheme highlight window. `g` is the displayed
// unit WITH nikkud (e.g. "בָּ"); start/end are absolute seconds ⊆ the parent word/line span.
// Written by tools/gen_voice_reading.py --emit-ts; consumed by the Captions `units` path.
export type TimedUnit = { g: string; start: number; end: number };
export type TimedWord = { w: string; start: number; end: number; units?: TimedUnit[] };
export type VoLine = { text: string; start: number; end: number; words?: TimedWord[]; units?: TimedUnit[] };

// Word timing for a line: use REAL alignment (from tools/gen_voice.py) when present;
// otherwise estimate by distributing the window weighted by word length.
export const timeWords = (line: VoLine): TimedWord[] => {
  if (line.words && line.words.length > 0) return line.words;
  const words = line.text.split(/\s+/).filter(Boolean);
  const weights = words.map((w) => Math.max(2, w.replace(/[^a-zA-Z0-9]/g, '').length) + 1.6);
  const total = weights.reduce((a, b) => a + b, 0);
  const span = line.end - line.start;
  let t = line.start;
  return words.map((w, i) => {
    const d = (weights[i] / total) * span;
    const out: TimedWord = { w, start: t, end: t + d };
    t += d;
    return out;
  });
};

// Map a spec's captions.preset ('pop'|'pill'|'fade'|'karaoke') to the Captions `mode`.
// 'fade' has no dedicated renderer — it resolves to the 'pop' full-line look (the
// original default), so existing specs keep rendering exactly as before. 'karaoke' is
// opt-in: only specs that set preset:'karaoke' get the animated-word karaoke look.
export type CaptionMode = 'pop' | 'pill' | 'karaoke';
export const captionModeFromPreset = (preset?: string): CaptionMode =>
  preset === 'pill' ? 'pill' : preset === 'karaoke' ? 'karaoke' : 'pop';

// attachUnits: reading track — merge a line's unit schedule (vo[].units[]) into its timed
// words so the Captions units path lights the live grapheme. gen_voice_reading emits units at
// the LINE level (the beat's highlight schedule); the renderer highlights per-WORD, so we map
// each unit onto the word whose text contains that unit's grapheme `g` (a multi-unit line like
// teach-cv "בָּ מָּ קָּ" puts one unit on its own word; a single-unit isolated beat puts it on
// the lone word). Words already carrying word-level units are left untouched. Defensive: a unit
// that matches no word is dropped (never blocks rendering — the word pops whole instead).
export const attachUnits = (line: VoLine): TimedWord[] => {
  const words = timeWords(line);
  const units = line.units;
  if (!units || units.length === 0) return words;
  if (words.some((wd) => wd.units && wd.units.length > 0)) return words; // already word-level
  return words.map((wd) => {
    const mine = units.filter((u) => wd.w.includes(u.g));
    return mine.length ? { ...wd, units: mine } : wd;
  });
};

// =============================================================================
// RTL CAPTION CONTRACT
// - Words are ALWAYS kept in LOGICAL order (spoken order). The JS word/token
//   arrays must NEVER be reversed: with direction:'rtl' on the container the
//   bidi algorithm lays logical order out right-to-left — reversing the array
//   would double-reverse it.
// - direction:'rtl' is set on the caption CONTAINER (both renderers below).
// - Every word <span> sets unicodeBidi:'isolate' so one word's internal
//   direction (numbers, Latin, punctuation inside Hebrew text) can't leak out
//   and drag neighboring words across the line.
// - anchorRtl() (below) suffixes RLM where a token would otherwise let its
//   trailing punctuation or a pure number/Latin run detach from the RTL side.
// =============================================================================
export const RLM = '‏'; // RIGHT-TO-LEFT MARK — zero-width, strong-RTL anchor

// stripNikkud: remove Hebrew vowel points (U+0591–U+05C7) so captions default to
// ktiv maleh. NOTHING else is stripped — letters, punctuation, and bidi marks
// pass through untouched. Applied at every displayed-caption boundary below
// (pop words, pill tokens; kinetic.tsx does the same for its own spans).
export const stripNikkud = (text: string): string => text.replace(/[֑-ׇ]/g, '');

// anchorRtl: bind a token to the RTL side. Returns the token suffixed with RLM
// (U+200F) when it ends in .?!,… or is purely numeric/Latin — i.e. exactly the
// tokens whose trailing chars are weak/neutral or LTR-strong and would flip
// sides inside an RTL line. Everything else returns unchanged.
export const anchorRtl = (token: string): string => {
  if (!token) return token;
  if (/[.?!,…]$/.test(token)) return token + RLM; // trailing punctuation
  if (/^[0-9A-Za-z\s.,!?…:;%$€£+\-/'"@#&()]+$/.test(token)) return token + RLM; // pure numeric/Latin run
  return token;
};

// graphemeSpans: display-side split of a pointed word into graphemes (one HEBREW LETTER
// U+05D0–U+05EA + its following combining marks U+05B0–U+05BF incl. dagesh/shva, plus
// shin/sin dots U+05C1/U+05C2). This MUST match tools/nikkud.py graphemes() — it exists so the
// Captions units path can lay out one span per grapheme. The AUTHORITATIVE split is the one
// nikkud.py baked into vo[].units[].g; here we only re-derive the visual spans and align them
// to the pre-split `g` strings BY INDEX (concatenation must equal the word — else we fall back
// to whole-word and never show a wrong split).
const HEB_LETTER_RE = /[א-ת]/; // Hebrew letters incl. sofits — exactly U+05D0–U+05EA
const COMBINING_RE = /[ְ-ֿׁׂ]/; // nikkud U+05B0–U+05BF (incl. dagesh U+05BC, shva) + shin/sin dots U+05C1/U+05C2
export const graphemeSpans = (word: string): string[] => {
  const out: string[] = [];
  for (const ch of word) {
    if (HEB_LETTER_RE.test(ch)) {
      out.push(ch); // a Hebrew letter starts a new grapheme
    } else if (COMBINING_RE.test(ch)) {
      if (out.length) out[out.length - 1] += ch; // combining mark clings to its letter
    } else {
      out.push(ch); // non-Hebrew char (digit/Latin/punct) — its own span so alignment survives
    }
  }
  return out;
};

type Chunk = { words: TimedWord[]; start: number; end: number; hold: number };

// Split VO lines into caption chunks of <= maxWords; each chunk holds until the next
// chunk in the same line starts, or the line ends (+ a small tail between lines).
export const chunkLines = (lines: VoLine[], maxWords = 4): Chunk[] => {
  const chunks: Chunk[] = [];
  lines.forEach((line) => {
    const words = timeWords(line);
    for (let i = 0; i < words.length; i += maxWords) {
      const ws = words.slice(i, i + maxWords);
      chunks.push({ words: ws, start: ws[0].start, end: ws[ws.length - 1].end, hold: 0 });
    }
  });
  chunks.forEach((c, i) => {
    const next = chunks[i + 1];
    c.hold = next ? Math.min(next.start, c.end + 0.6) : c.end + 0.8;
  });
  return chunks;
};

// =============================================================================
// CAPTIONS — one chunk at a time, active word pops in accent color.
// mode='pop'    (default): the original hand-rolled word-pop pager (chunkLines).
// mode='pill':  TikTok-style karaoke via @remotion/captions createTikTokStyleCaptions,
//               active word sits in an accent pill (see CaptionsPill).
// mode='karaoke': the HeyGen/shorts "karaoke" look — the WHOLE line stays on screen,
//               and the currently-spoken word pops (accent color + slight scale) while
//               the rest stay readable. Driven by the real word times already in the
//               spec (vo.gen). Falls back to full-line pop behavior when words are absent.
// =============================================================================
export const Captions: React.FC<{
  lines: VoLine[];
  y?: number; // vertical center of the caption block
  size?: number;
  accent?: string;
  maxWords?: number;
  plate?: boolean; // dark pill behind the words — for compositions with light scenes
  rtl?: boolean; // right-to-left (Hebrew/Arabic): rtl word order + Hebrew font
  cap?: number; // seconds — hide the whole caption plate once t >= cap (for seamless loops)
  mode?: 'pop' | 'pill' | 'karaoke'; // caption renderer; default 'pop' keeps every existing shot untouched
  frameOverride?: number; // render as-if this frame (pill mode; for seamless loop tails)
  kidsNikkud?: boolean; // mode:"kids" — KEEP nikkud (skip stripNikkud) + lineHeight ~1.5 so vowel points don't clip
}> = (props) => {
  const { mode = 'pop' } = props;
  if (mode === 'pill') return <CaptionsPill {...props} />;
  if (mode === 'karaoke') return <CaptionsKaraoke {...props} />;
  return <CaptionsPop {...props} />;
};

// The original word-pop renderer — kept byte-for-byte so 'pop' mode (and every
// existing shot that omits `mode`) renders identically to before this change.
export const CaptionsPop: React.FC<{
  lines: VoLine[];
  y?: number; // vertical center of the caption block
  size?: number;
  accent?: string;
  maxWords?: number;
  plate?: boolean; // dark pill behind the words — for compositions with light scenes
  rtl?: boolean; // right-to-left (Hebrew/Arabic): rtl word order + Hebrew font
  cap?: number; // seconds — hide the whole caption plate once t >= cap (for seamless loops)
  kidsNikkud?: boolean; // mode:"kids" — KEEP nikkud (skip stripNikkud) + lineHeight ~1.5
}> = ({ lines, y = 1280, size = 58, accent = '#f5d76e', maxWords = 4, plate = false, rtl = false, cap, kidsNikkud = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  if (cap !== undefined && t >= cap) return null;
  // Reading track: fold any line-level vo[].units[] into its timed words BEFORE chunking so
  // the units path lights per-grapheme. Lines without units render exactly as before.
  const chunks = chunkLines(lines.map((l) => ({ ...l, words: attachUnits(l) })), maxWords);
  const active = chunks.find((c) => t >= c.start && t < c.hold);
  if (!active) return null;
  const enter = prog(t, active.start, active.start + 0.14);
  const displayWord = (w: string) => (rtl ? anchorRtl(kidsNikkud ? w : stripNikkud(w)) : w);
  const rise = arcRise(enter, 14, 6); // arc over the straight rise — research 02 §2.1
  return (
    <div
      style={{
        position: 'absolute',
        left: 40,
        right: 40,
        top: y,
        transform: `translate(${rise.x}px, calc(-50% + ${rise.y}px))`,
        opacity: 0.25 + 0.75 * enter,
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'center',
          columnGap: size * 0.28,
          rowGap: size * 0.14,
          maxWidth: '100%',
          direction: rtl ? 'rtl' : 'ltr',
          ...(plate
            ? {
                background: 'rgba(13,17,23,0.86)',
                borderRadius: 22,
                padding: `${size * 0.28}px ${size * 0.5}px`,
                boxShadow: '0 12px 48px rgba(0,0,0,0.35)',
              }
            : {}),
        }}
      >
      {active.words.map((word, i) => {
        const started = prog(t, word.start, word.start + 0.12);
        const isActive = t >= word.start && t < word.end + 0.05;
        const baseStyle: React.CSSProperties = {
          fontFamily: rtl ? FONT_HEBREW_CAPTION : FONT_DISPLAY,
          fontWeight: 700,
          fontSize: size,
          lineHeight: kidsNikkud ? 1.5 : 1.15, // nikkud points need air — mode:"kids"
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          color: isActive ? accent : '#ffffff',
          opacity: 0.3 + 0.7 * started,
          transform: `scale(${0.92 + 0.08 * EASE_OUT(started) + (isActive ? 0.05 : 0)})`,
          textShadow: '0 3px 26px rgba(0,0,0,0.65), 0 1px 4px rgba(0,0,0,0.5)',
          unicodeBidi: 'isolate', // RTL: one word's direction can't leak and drag neighbors
        };

        // READING units path — only when this word carries vo[].units[] (the sub-word
        // highlight schedule from gen_voice_reading.py). Render the word as one span per
        // grapheme and tint+scale-pop the grapheme whose [start,end) window contains now.
        // NEVER color alone (findings §4). Any mismatch between the pre-split unit strings
        // and the visual grapheme split falls back to whole-word (never a wrong split).
        if (word.units && word.units.length > 0) {
          const disp = displayWord(word.w); // nikkud kept (kidsNikkud) on the reading path
          const spans = graphemeSpans(disp);
          const gs = word.units.map((u) => u.g);
          // Alignment: prefer the visual spans; if the unit strings' concatenation differs
          // from the displayed word, trust the units as the span source of truth instead.
          const aligned: string[] =
            spans.join('') === disp && spans.length === gs.length ? spans
            : gs.join('') === disp ? gs
            : [];
          if (aligned.length === gs.length && aligned.length > 0) {
            return (
              <span
                key={i}
                style={{ ...baseStyle, textTransform: 'none', display: 'inline-flex', direction: rtl ? 'rtl' : 'ltr' }}
              >
                {aligned.map((gSpan, gi) => {
                  const u = word.units![gi];
                  const uActive = u ? t >= u.start && t < u.end + 0.04 : false;
                  return (
                    <span
                      key={gi}
                      style={{
                        color: uActive ? accent : '#ffffff',
                        transform: `scale(${uActive ? 1.12 : 1})`,
                        transformOrigin: 'center',
                        unicodeBidi: 'isolate', // one grapheme's marks can't drag neighbors
                        lineHeight: kidsNikkud ? 1.5 : 1.15,
                        textTransform: 'none', // a Latin sound-label must NOT be uppercased
                      }}
                    >
                      {gSpan}
                    </span>
                  );
                })}
              </span>
            );
          }
          // fall through to whole-word on any mismatch (defensive — never a wrong split)
        }

        return (
          <span key={i} style={baseStyle}>
            {displayWord(word.w)}
          </span>
        );
      })}
      </div>
    </div>
  );
};

// =============================================================================
// KARAOKE CAPTIONS — the HeyGen/shorts "animated-word" look.
//
// Unlike CaptionsPop (chunks into ≤4 words and replaces them), this renders the WHOLE
// line at once: every word is on screen and readable, and ONLY the currently-spoken
// word pops (accent color + slight scale) as the voice reaches it. Drives from the
// REAL word times already in the spec (vo.gen[].words from edge-tts WordBoundary).
// When a line carries no word times, timeWords() synthesizes an estimate so the
// caption still highlights word-by-word (full-line fallback — never blank).
//
// RTL contract (same as CaptionsPop): container sets direction rtl, every word span
// is unicodeBidi:'isolate', and anchorRtl() pins trailing punctuation / Latin runs
// to the RTL side so embedded numbers/brands never reorder. Rubik display for the
// caption face (FONT_HEBREW_CAPTION), Heebo fallback.
// =============================================================================
export const CaptionsKaraoke: React.FC<{
  lines: VoLine[];
  y?: number; // vertical center of the caption block
  size?: number;
  accent?: string;
  plate?: boolean; // dark pill behind the words — for compositions with light scenes
  rtl?: boolean; // right-to-left (Hebrew/Arabic): rtl word order + Hebrew font
  cap?: number; // seconds — hide the whole caption plate once t >= cap (for seamless loops)
  kidsNikkud?: boolean; // mode:"kids" — KEEP nikkud (skip stripNikkud) + lineHeight ~1.5
}> = ({ lines, y = 1280, size = 58, accent = '#f5d76e', plate = false, rtl = false, cap, kidsNikkud = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  if (cap !== undefined && t >= cap) return null;
  // Fold any line-level reading units into words (defensive — karaoke highlights whole
  // words only, but attachUnits keeps the timing arrays consistent with timeWords()).
  const timed = lines.map((l) => ({ ...l, words: attachUnits(l) }));
  // The active line: the one whose [start,end] window contains now (holds through its end).
  const active = timed.find((l) => t >= l.start && t < l.end + 0.8);
  if (!active) return null;
  const words = timeWords(active);
  const enter = prog(t, active.start, active.start + 0.14);
  const displayWord = (w: string) => (rtl ? anchorRtl(kidsNikkud ? w : stripNikkud(w)) : w);
  const rise = arcRise(enter, 14, 6); // arc over the straight rise — research 02 §2.1
  return (
    <div
      style={{
        position: 'absolute',
        left: 40,
        right: 40,
        top: y,
        transform: `translate(${rise.x}px, calc(-50% + ${rise.y}px))`,
        opacity: 0.25 + 0.75 * enter,
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'center',
          columnGap: size * 0.28,
          rowGap: size * 0.14,
          maxWidth: '100%',
          direction: rtl ? 'rtl' : 'ltr',
          ...(plate
            ? {
                background: 'rgba(13,17,23,0.86)',
                borderRadius: 22,
                padding: `${size * 0.28}px ${size * 0.5}px`,
                boxShadow: '0 12px 48px rgba(0,0,0,0.35)',
              }
            : {}),
        }}
      >
        {words.map((word, i) => {
          const started = prog(t, word.start, word.start + 0.12);
          const isActive = t >= word.start && t < word.end + 0.05;
          // Karaoke emphasis: active word gets accent color + a settle-pop scale (research
          // §2.1 — crest ~1.06 then lock). Inactive words stay white at base scale/opacity.
          const pop = isActive ? settleP(prog(t, word.start, word.start + 0.18)) : 0;
          return (
            <span
              key={i}
              style={{
                fontFamily: rtl ? FONT_HEBREW_CAPTION : FONT_DISPLAY,
                fontWeight: 700,
                fontSize: size,
                lineHeight: kidsNikkud ? 1.5 : 1.15, // nikkud points need air — mode:"kids"
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                color: isActive ? accent : '#ffffff',
                opacity: 0.55 + 0.45 * started, // unread words sit slightly dimmed, still readable
                transform: `scale(${1 + 0.1 * pop})`,
                transformOrigin: 'center',
                textShadow: isActive
                  ? `0 3px 26px rgba(0,0,0,0.65), 0 1px 4px rgba(0,0,0,0.5), 0 0 24px ${accent}66`
                  : '0 3px 26px rgba(0,0,0,0.65), 0 1px 4px rgba(0,0,0,0.5)',
                unicodeBidi: 'isolate', // RTL: one word's direction can't leak and drag neighbors
              }}
            >
              {displayWord(word.w)}
            </span>
          );
        })}
      </div>
    </div>
  );
};

// =============================================================================
// TIKTOK-STYLE PILL CAPTIONS — karaoke via @remotion/captions.
//
// toCaptionTokens maps a VO line's real word times into the official Caption[]
// shape consumed by createTikTokStyleCaptions. CRITICAL contract gotcha: every
// token carries a LEADING SPACE (' ' + word) so createTikTokStyleCaptions can
// trim page boundaries, and the pill renders with `white-space: pre` — without
// both, adjacent words visually merge into one blob.
// =============================================================================
export const toCaptionTokens = (line: VoLine): Caption[] =>
  timeWords(line).map((w) => ({
    text: ' ' + w.w,
    startMs: Math.round(w.start * 1000),
    endMs: Math.round(w.end * 1000),
    timestampMs: Math.round(w.start * 1000),
    confidence: 1,
  }));

// Page the full VO into TikTok pages. combineTokensWithinMilliseconds keeps a
// phrase on one page up to a generous ceiling; breakOnSilenceAfterMilliseconds
// cuts a page when a real inter-word pause (e.g. between VO lines) is felt, and
// the pager then HOLDS the previous page through that silence (no flicker to
// empty — acceptance #2).
export const pageCaptions = (lines: VoLine[]) =>
  createTikTokStyleCaptions({
    captions: lines.flatMap(toCaptionTokens),
    combineTokensWithinMilliseconds: 2000,
    breakOnSilenceAfterMilliseconds: 200,
  }).pages;

// Deterministic per-word entrance: translateY(~12px) + blur→0 over ~6 frames,
// keyed to useCurrentFrame() vs the word's startMs — no wall-clock, frame-repeat
// safe.
const wordEnter = (frame: number, fps: number, startMs: number, frames = 6) => {
  const p = prog(frame, Math.round((startMs / 1000) * fps), Math.round((startMs / 1000) * fps) + frames);
  const e = EASE_OUT(p);
  return { opacity: e, translateY: (1 - e) * 12, blur: (1 - e) * 2 };
};

// One caption page: tokens laid out as a wrapping row of word-pills. The word
// whose [fromMs,toMs) window contains the current frame is the ACTIVE word and
// is drawn as a brand-accent pill; the rest are base style.
export const CaptionPillPage: React.FC<{
  page: TikTokPage;
  size?: number;
  accent?: string;
  rtl?: boolean;
  frameOverride?: number; // render as-if this frame (for seamless loop tails)
  kidsNikkud?: boolean; // mode:"kids" — KEEP nikkud (skip stripNikkud) + lineHeight ~1.5
}> = ({ page, size = 58, accent = '#6366F1', rtl = false, frameOverride, kidsNikkud = false }) => {
  const frame = frameOverride ?? useCurrentFrame();
  const { fps } = useVideoConfig();
  const tMs = (frame / fps) * 1000;
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        columnGap: size * 0.18,
        rowGap: size * 0.16,
        maxWidth: '100%',
        direction: rtl ? 'rtl' : 'ltr',
        whiteSpace: 'pre', // contract gotcha: keeps the leading spaces so words never merge
      }}
    >
      {page.tokens.map((tok, i) => {
        const isActive = tMs >= tok.fromMs && tMs < tok.toMs;
        const { opacity, translateY, blur } = wordEnter(frame, fps, tok.fromMs);
        return (
          <span
            key={i}
            style={{
              fontFamily: rtl ? FONT_HEBREW_CAPTION : FONT_DISPLAY,
              fontWeight: 700,
              fontSize: size,
              lineHeight: kidsNikkud ? 1.5 : 1.15, // nikkud points need air — mode:"kids"
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              color: isActive ? '#0f1216' : '#ffffff',
              background: isActive ? accent : 'transparent',
              borderRadius: 999,
              padding: isActive ? `${size * 0.12}px ${size * 0.32}px` : 0,
              opacity,
              transform: `translateY(${translateY}px)`,
              filter: `blur(${blur}px)`,
              textShadow: isActive
                ? '0 3px 18px rgba(0,0,0,0.4)'
                : '0 3px 26px rgba(0,0,0,0.65), 0 1px 4px rgba(0,0,0,0.5)',
              unicodeBidi: 'isolate', // RTL: one word's direction can't leak and drag neighbors
            }}
          >
            {rtl ? anchorRtl(kidsNikkud ? tok.text : stripNikkud(tok.text)) : tok.text}
          </span>
        );
      })}
    </div>
  );
};

// Pill pager: pick the page whose window contains the current frame; if none is
// active (e.g. before the first word or after the last) render nothing.
export const CaptionsPill: React.FC<{
  lines: VoLine[];
  y?: number; // vertical CENTER of the caption block
  size?: number;
  accent?: string;
  rtl?: boolean;
  cap?: number; // seconds — hide the whole caption plate once t >= cap (for seamless loops)
  frameOverride?: number; // render as-if this frame (for seamless loop tails)
  kidsNikkud?: boolean; // mode:"kids" — keep nikkud + airy line-height
}> = ({ lines, y = 1280, size = 58, accent = '#6366F1', rtl = false, cap, frameOverride, kidsNikkud = false }) => {
  const frame = frameOverride ?? useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  if (cap !== undefined && t >= cap) return null;
  const pages = pageCaptions(lines);
  const page = pages.find((p) => t >= p.startMs / 1000 && t < (p.startMs + p.durationMs) / 1000);
  if (!page) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: 40,
        right: 40,
        top: y,
        transform: 'translateY(-50%)',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <CaptionPillPage page={page} size={size} accent={accent} rtl={rtl} frameOverride={frameOverride} kidsNikkud={kidsNikkud} />
    </div>
  );
};

// =============================================================================
// PROGRESS BAR — thin top bar over the whole composition.
// =============================================================================
export const ProgressBar: React.FC<{ color?: string; resetAt?: number }> = ({ color = '#f5d76e', resetAt }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const base = frame / Math.max(1, durationInFrames - 1);
  // resetAt: the fill drops smoothly to 0 over [resetAt, last] so the loop's last frame
  // matches frame 0 (empty fill) for a seamless loop.
  const resetP = resetAt === undefined ? 0 : prog(frame, resetAt, durationInFrames - 1);
  const fill = Math.max(0, base * (1 - resetP));
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: 'rgba(255,255,255,0.12)' }}>
      <div style={{ width: `${fill * 100}%`, height: '100%', background: color }} />
    </div>
  );
};

// =============================================================================
// KICKER — small beat-label pill, top center.
// =============================================================================
export const Kicker: React.FC<{ text: string; color?: string; y?: number; at?: number; until?: number }> = ({
  text,
  color = '#f5d76e',
  y = 180,
  at = 0,
  until,
}) => {
  const frame = useCurrentFrame();
  const p = prog(frame, at, at + 10);
  // Ease-in the exit (research 02 §2.1) — not a linear fade.
  const out = until === undefined ? 1 : 1 - EASE_IN(prog(frame, until - 8, until));
  const o = EASE_OUT(p) * out;
  if (o <= 0.01) return null;
  return (
    <div
      style={{
        position: 'absolute',
        top: y,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        opacity: o,
        transform: `translateY(${(1 - EASE_OUT(p)) * 12}px)`,
      }}
    >
      <div
        style={{
          fontFamily: FONT_BODY,
          fontWeight: 600,
          fontSize: 30,
          letterSpacing: 6,
          textTransform: 'uppercase',
          color,
          border: `2px solid ${color}55`,
          borderRadius: 999,
          padding: '12px 30px',
          background: 'rgba(0,0,0,0.35)',
        }}
      >
        {text}
      </div>
    </div>
  );
};

// =============================================================================
// BIG TITLE — hook headline, up to two lines + optional subtitle.
// =============================================================================
export const BigTitle: React.FC<{
  lines: { text: string; color?: string }[];
  subtitle?: string;
  y?: number;
  size?: number;
  warm?: boolean; // true = fully composed at frame 0 (hook rule), animations pre-rolled
  subtitleColor?: string; // override subtitle color (e.g. dark ink on light paper)
  subtitleShadow?: string; // override subtitle text-shadow
  rtl?: boolean; // right-to-left (Hebrew): rtl text + Hebrew-capable font
}> = ({ lines, subtitle, y = 190, size = 92, warm = false, subtitleColor, subtitleShadow, rtl = false }) => {
  const frame = useCurrentFrame() + (warm ? 24 : 0);
  return (
    <div style={{ position: 'absolute', top: y, left: 40, right: 40, textAlign: 'center', direction: rtl ? 'rtl' : 'ltr' }}>
      {lines.map((l, i) => {
        const p = EASE_OUT(prog(frame, stagger(i, 0, 4), stagger(i, 0, 4) + 12));
        const rise = arcRise(p, 16, 5); // arc over the straight rise (research 02 §2.1)
        return (
          <div
            key={i}
            style={{
              fontFamily: rtl ? FONT_DISPLAY_H : FONT_DISPLAY,
              fontWeight: 700,
              fontSize: size,
              lineHeight: 1.06,
              textTransform: 'uppercase',
              letterSpacing: 1,
              color: l.color ?? '#ffffff',
              opacity: 0.35 + 0.65 * p,
              transform: `translate(${rise.x}px, ${rise.y}px)`,
              textShadow: '0 4px 30px rgba(0,0,0,0.6)',
            }}
          >
            {l.text}
          </div>
        );
      })}
      {subtitle ? (
        <div
          style={{
            marginTop: 18,
            fontFamily: rtl ? FONT_BODY_H : FONT_BODY,
            fontWeight: 500,
            fontSize: 40,
            color: subtitleColor ?? 'rgba(255,255,255,0.82)',
            opacity: EASE_OUT(prog(frame, 10, 24)),
            textShadow: subtitleShadow ?? '0 4px 30px rgba(0,0,0,0.6)',
          }}
        >
          {subtitle}
        </div>
      ) : null}
    </div>
  );
};

// =============================================================================
// STAMP — rotated impact label (CHECKMATE / WRONG / SOLVED).
// =============================================================================
export const Stamp: React.FC<{
  text: string;
  at?: number;
  until?: number;
  color?: string;
  x?: number;
  y?: number;
  size?: number;
  rotate?: number;
}> = ({ text, at = 0, until, color = '#e8879f', x = 540, y = 940, size = 96, rotate = -8 }) => {
  const frame = useCurrentFrame();
  const p = prog(frame, at, at + 9);
  // Ease-in the exit (research 02 §2.1) — not a linear fade.
  const out = until === undefined ? 1 : 1 - EASE_IN(prog(frame, until - 10, until));
  const o = p * out;
  if (o <= 0.01) return null;
  // Settle: scale in 1.7 -> 1.0 with a gentle overshoot-then-lock (settleP crests ~1.06),
  // so the stamp SLAMS and settles instead of landing dead-center mechanically.
  const scale = 1.7 - 0.7 * settleP(p);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `translate(-50%, -50%) rotate(${rotate}deg) scale(${scale})`,
        opacity: o,
        fontFamily: FONT_DISPLAY,
        fontWeight: 700,
        fontSize: size,
        letterSpacing: 6,
        textTransform: 'uppercase',
        color,
        border: `7px solid ${color}`,
        borderRadius: 18,
        padding: '10px 34px',
        background: 'rgba(10,10,14,0.72)',
        boxShadow: '0 10px 60px rgba(0,0,0,0.55)',
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </div>
  );
};

// =============================================================================
// PAUSE CARD — quiz gate with countdown ring. Mount inside its own <Sequence>.
// =============================================================================
export const PauseCard: React.FC<{ title?: string; subtitle?: string; durSec: number; accent?: string; y?: number; rtl?: boolean }> = ({
  title = 'PAUSE',
  subtitle = 'can you find it?',
  durSec,
  accent = '#f5d76e',
  y = 900,
  rtl = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const total = durSec * fps;
  const enter = EASE_OUT(prog(frame, 0, 10));
  // Ease-in the exit (research 02 §2.1): linger, then accelerate out — not a linear fade.
  const exit = 1 - EASE_IN(prog(frame, total - 8, total));
  const ring = prog(frame, 6, total - 6);
  const R = 46;
  const C = 2 * Math.PI * R;
  return (
    <div
      style={{
        position: 'absolute',
        left: 90,
        right: 90,
        top: y,
        transform: `translateY(-50%) scale(${0.94 + 0.06 * enter})`,
        opacity: enter * exit,
        background: 'rgba(12,14,20,0.92)',
        border: `2px solid ${accent}66`,
        borderRadius: 28,
        padding: '38px 44px',
        display: 'flex',
        alignItems: 'center',
        gap: 36,
        boxShadow: '0 20px 80px rgba(0,0,0,0.6)',
      }}
    >
      <svg width={110} height={110} viewBox="0 0 110 110">
        <circle cx={55} cy={55} r={R} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={9} />
        <circle
          cx={55}
          cy={55}
          r={R}
          fill="none"
          stroke={accent}
          strokeWidth={9}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * ring}
          transform="rotate(-90 55 55)"
        />
        <polygon points="46,38 46,72 76,55" fill={accent} />
      </svg>
      <div style={{ direction: rtl ? 'rtl' : 'ltr' }}>
        <div style={{ fontFamily: rtl ? FONT_DISPLAY_H : FONT_DISPLAY, fontWeight: 700, fontSize: 64, letterSpacing: 4, color: '#fff' }}>{title}</div>
        <div style={{ fontFamily: rtl ? FONT_BODY_H : FONT_BODY, fontWeight: 500, fontSize: 38, color: accent, marginTop: 6 }}>{subtitle}</div>
      </div>
    </div>
  );
};

// =============================================================================
// STAT CHIP — labeled stat pill for comparison beats.
// =============================================================================
export const StatChip: React.FC<{
  label: string;
  value: string;
  color?: string;
  x: number;
  y: number;
  w?: number;
  at?: number;
}> = ({ label, value, color = '#f5d76e', x, y, w = 440, at = 0 }) => {
  const frame = useCurrentFrame();
  const p = EASE_OUT(prog(frame, at, at + 12));
  if (p <= 0.01) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        opacity: p,
        transform: `translateY(${(1 - p) * 18}px)`,
        background: 'rgba(12,14,20,0.9)',
        border: `2px solid ${color}66`,
        borderLeft: `10px solid ${color}`,
        borderRadius: 18,
        padding: '20px 26px',
      }}
    >
      <div style={{ fontFamily: FONT_BODY, fontWeight: 600, fontSize: 27, letterSpacing: 3, color, textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 34, color: '#fff', marginTop: 8, lineHeight: 1.25 }}>
        {value}
      </div>
    </div>
  );
};

// =============================================================================
// BACKDROP — dark stage + vignette, shared look for shorts (per-niche theme later).
// =============================================================================
export const ShortsBackdrop: React.FC<{ base?: string; glow?: string }> = ({ base = '#0f1216', glow = '#1d2430' }) => (
  <AbsoluteFill>
    <AbsoluteFill style={{ background: base }} />
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse 90% 55% at 50% 42%, ${glow} 0%, transparent 70%)`,
      }}
    />
    <AbsoluteFill
      style={{
        background: 'radial-gradient(ellipse 120% 90% at 50% 50%, transparent 55%, rgba(0,0,0,0.55) 100%)',
      }}
    />
  </AbsoluteFill>
);

// Dev-only safe-area guides — never mount in a final render.
export const SafeAreaGuides: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: 'none' }}>
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: SAFE.top, background: 'rgba(255,0,0,0.12)' }} />
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: SAFE.bottom, background: 'rgba(255,0,0,0.12)' }} />
    <div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: SAFE.right, background: 'rgba(255,165,0,0.12)' }} />
  </AbsoluteFill>
);
