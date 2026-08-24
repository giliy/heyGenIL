# Phase 1 Sub-Plan — TSX Reading Kit

**Scope.** Phase 1 builds the **TSX reading kit**: the per-grapheme highlight path inside the
existing Captions renderer, a new `lib/reading.tsx` (GraphemeTile / SyllableTile hero tiles), and a
standalone **test composition** (`read-0-test`) that renders every קמץ mark + the tricky confusables
at real tile size in both candidate fonts — then runs the **per-mark pixel QA gate**. **Zero paid
spend; edge-tts is never invoked in this phase; no scale-1 render.** Master plan reference:
`10-implementation-plan.md` §3 (TSX LIB) + §5 (pipeline steps 1–2) + §7 Phase 1. The WHY for every
decision: `00-findings.md` §2 (timing), §4 (letterform & highlight UX).

**North-star (findings §4):** highlight the **whole pointed grapheme, never the vowel mark alone**;
color the active grapheme in exact sync **plus** a scale pop — **never color alone** (redundant cue
survives color-vision deficiency). Keep RTL (logical order, `direction:rtl`, `unicodeBidi:isolate`),
keep `kidsNikkud` (nikkud kept, `lineHeight:1.5`), and **do NOT uppercase** on the units path.

**Phase 1 gate (the per-mark pixel QA, findings §4):** render phone-scale frames of each target
mark on 2–3 base letters at real tile size in **Heebo-700 and Rubik-900** and READ them. **PASS** =
marks distinguishable at a glance — esp. **חיריק vs סגול vs צירי**; **חולם's** top-left dot clear of
the tile top; **דגש** centered; pointed **שׁ+חולם** not merged. **FAIL → vendor SBL Hebrew** (the
conditional §2.3 fallback). Verdict recorded explicitly below and in the structured output.

**Iron rules this phase:** run everything from repo root · no paid generation ($0) · do NOT build the
pilot composition (that's P2) · do NOT render scale-1 (phone scale only, `--scale=0.333`) · the
grapheme split MUST match `tools/nikkud.py graphemes()` — **ship pre-split spans as data in
`vo.gen.ts`, never re-split in TSX** (single source of truth, no drift).

---

## Deliverable 0 — this sub-plan
`research/hebrew-reading/subplan-p1.md` (this file). Written first, before any TSX.

---

## Deliverable 1 — `shorts.tsx`: `TimedUnit` type + Captions `units` path (back-compat)

**Goal:** extend — never fork — the proven Captions renderer so an active word (or line) that
carries `units[]` renders as **per-grapheme spans** with the live grapheme tinted + popped in sync;
lines/words without `units[]` render identically to today (whole-word pop).

### Type extensions (additive; `units` optional everywhere → zero behavior change for existing shots)
```ts
export type TimedUnit = { g: string; start: number; end: number };        // g WITH nikkud
export type TimedWord = { w: string; start: number; end: number; units?: TimedUnit[] };
export type VoLine    = { text: string; start: number; end: number;
                          words?: TimedWord[]; units?: TimedUnit[] };
```
This mirrors what `gen_voice_reading.py --emit-ts` already writes (`vo.gen.ts` lines carry an
optional `units: [{g,start,end}]`), so the generated data typechecks against the extended `VoLine`.

### A tiny TS grapheme splitter that MATCHES `nikkud.py graphemes()`
Ship a `graphemeSpans(word: string): string[]` helper in `reading.tsx` that reproduces the engine's
rule for the **closed vetted set**: one HEBREW LETTER (U+05D0–U+05EA) starts a span; any following
combining mark (U+05B0–U+05BF incl. dagesh/shva, plus shin/sin dots U+05C1/U+05C2) attaches to the
current span. This is a **display-side fallback** only; the authoritative split is the one
`nikkud.py` baked into `vo[].units[].g`. When `word.units[]` is present we align the pre-split `g`
strings to the visual spans **by index** and assert-by-construction that their concatenation equals
the word — if lengths mismatch we fall back to whole-word (never a wrong split). This keeps the TSX
and Python in lockstep without shipping a second nakdan.

### The `units` path inside `CaptionsPop` (the pilot uses pop)
- `chunkLines` already turns each line into timed `TimedWord[]` chunks. Add: a word whose
  `units?.length` (or a line-level `units` distributed to its single word) renders **inside its
  `<span>`** as one child `<span>` per grapheme.
- For each grapheme span: `active = units[i]` is live when `t >= u.start && t < u.end + 0.04` (the
  +0.04s tail matches the existing whole-word grace). Style: `color: active ? accent : '#fff'` AND
  `transform: scale(1 + (active ? 0.12 : 0))` — color + pop together, never color alone.
- Keep the existing container contract: `direction:'rtl'`, grapheme spans in **logical order**
  (never reversed), each span `unicodeBidi:'isolate'`, `lineHeight:1.5`, and
  `textTransform:'none'` on this path (a Latin sound-label must not be uppercased against brand).
- Else-branch unchanged → whole-word pop (today's behavior) for blend/word beats and every existing
  shot. **No regression:** `units` absent ⇒ byte-identical render path.

### Acceptance checks (Deliverable 1)
- [ ] `TimedUnit`, `TimedWord.units?`, `VoLine.units?` exported from `shorts.tsx`.
- [ ] `CaptionsPop` renders a unit-ed word as per-grapheme spans; the live grapheme is tinted accent
        AND scale-popped; non-live graphemes stay white.
- [ ] A word/line without `units[]` renders exactly as before (whole-word pop path untouched).
- [ ] `graphemeSpans` agrees with `nikkud.py graphemes()` on every קמץ `cv` item and the three
        `blendWords[].word` (checked in the test comp by construction + eyeballed in QA).
- [ ] `cd remotion && npx tsc --noEmit` → exit 0 (baseline was clean at phase start).

---

## Deliverable 2 — `remotion/src/lib/reading.tsx`: GraphemeTile / SyllableTile

**Goal:** the big isolated pointed letter — the "hero" of teach beats. Same timing source as
Captions. Mirrors how `lib/ads.tsx` is the ad-mode kit non-ad shots never import.

```tsx
export const GraphemeTile: React.FC<{
  g: string;                              // pointed grapheme, e.g. "בָּ"
  at: number;                             // seconds (global) when it enters
  soundWindow?: { start: number; end: number };  // from vo[].units[] — the pop/tint window
  nikkudColor?: string;                   // stable color for the target sign (default brand accent)
  accent?: string;                        // "sounding now" color
  size?: number;                          // default sized for the MARK's legibility (findings §4/B)
  y?: number;                             // vertical center; default SAFE-clear
  showSoundLabel?: boolean;               // small Latin/phonetic label under the tile
  font?: 'rubik' | 'heebo';               // display face override (QA gate A/B)
}> = /* huge pointed letter, lineHeight 1.5, stable mark-color overlay, scale-pop on soundWindow */;

export const SyllableTile: React.FC<{ syllable: string; /* a צירוף like בָּ */ ...same extras }>;
```

Behavior:
- Font `FONT_HEBREW_CAPTION` (Rubik→Heebo vendored). `font` prop lets the QA gate flip to the Heebo
  stack for the A/B comparison without forking. **No new font wiring** unless the gate fails (then §2.3).
- `lineHeight:1.5` so the below-letter point never clips (the kidsNikkud rule, always on here).
- Optional **nikkud mark overlay** in a stable accent so the child learns to find the sign
  (rendered as the same grapheme re-drawn with only its combining marks in `nikkudColor`, letter
  transparent — pure-CSS overlay, no font hack). Deferred to "nice" if it risks the legibility gate;
  the base requirement is the whole pointed letter reads clearly.
- `scale-pop` on the `soundWindow` (spring up on onset, settle on end) — same timing source as the
  captions, so tile and caption pop together. `showSoundLabel` draws a small lower-case Latin
  phonetic under the tile (`textTransform:'none'`, never uppercased).
- Cholam/shin + kamatz-katan notes (findings §2/D): the tile gives pointed שׁ+חולם extra room
  (letter-spacing / padding); kamatz-katan is out of v1 (not rendered here).

### Acceptance checks (Deliverable 2)
- [ ] `reading.tsx` exports `GraphemeTile`, `SyllableTile`, and `graphemeSpans`.
- [ ] A tile at default size renders the pointed letter with the mark clearly visible at lineHeight 1.5.
- [ ] `soundWindow` drives a visible scale-pop synced to the same `t` the captions use.
- [ ] Typechecks clean (`tsc --noEmit` exit 0).

---

## Deliverable 3 — test comp `read-0-test` (registered + gen'd)

**Goal:** one standalone composition that exercises every mark the pixel gate must judge, at real
tile size, in BOTH fonts. 1080x1920@30, ~10s. **Not** the pilot — a rendering fixture only.

`remotion/src/shots/read-0-test/Read0Test.tsx`:
- A labeled grid (labels small, muted, top or beside each cell) of tiles:
  - **Kamatz family** (the pilot): בָּ מָּ קָּ שָׁ אָ (the full `cv` row) + the sign בָּ alone huge.
  - **The tricky confusables** (findings §4): **חיריק בִּ vs סגול בֶּ vs צירי בֵּ** side-by-side;
    **חולם בֹּ** (top-left dot must clear the tile top); **דגש בּ** (centered dot);
    **שׁ + חולם שֹׁ** (must NOT merge into one blob).
- Each mark rendered twice: once in the Rubik-900 stack, once in the Heebo-700 stack (the two gate
  candidates), so the gate reads both.
- `compositionConfig` 1080x1920@30, durationInSeconds ~10.

**Registration:** add the `read-` prefix to `typeOfGroup()` in `scripts/gen-registry.mjs`
(`if (/^read-/.test(g)) return 'faceless';`) so the Studio type-filter is clean; then
`cd remotion && npm run gen` (gen-registry does NOT run itself from frames/render).

### Acceptance checks (Deliverable 3)
- [ ] `read-0-test` dir + comp exist with `compositionConfig` (id `Read0Test`).
- [ ] `typeOfGroup()` maps `read-` → `'faceless'`.
- [ ] `npm run gen` lists `Read0Test 1080x1920@30` with no "skip (no compositionConfig)" warning.
- [ ] `tsc --noEmit` still exit 0 with the new comp.

---

## Deliverable 4 — per-mark pixel QA gate (THE GATE)

Render phone-scale frames and **READ every JPG**:
```
cd remotion && npm run gen
node scripts/qa_frames.mjs Read0Test 0,150,299 --scale=0.333
```
(~10s@30fps ⇒ 300 frames; sample the head/middle/tail — frame 0 composed, a mid frame, the last.)

**PASS criteria (findings §4, verbatim):** marks distinguishable at a glance — esp.
**חיריק vs סגול vs צירי**; **חולם** top-left dot clear of the tile top; **דגש** centered;
pointed **שׁ+חולם** not merged. Also: marks don't clip at `lineHeight 1.5`; tiles clear SAFE zones
(bottom 500 / right 160).

**FAIL** → record which mark failed and trigger the SBL-Hebrew fallback (§2.3, conditional; not
built here on spec). The verdict goes in `gateVerdict` in the structured output.

### Acceptance checks (Deliverable 4)
- [ ] qa_frames renders without error at scale 0.333; JPGs land in `remotion/out/qa/small/`.
- [ ] Every rendered frame is actually READ (visual inspection), not just produced.
- [ ] Verdict recorded: PASS, or FAIL + the specific mark(s) that clip/merge/are indistinguishable.

---

## Order of work + verification
1. Write this sub-plan. (Gate.)
2. Extend `shorts.tsx` (types + CaptionsPop units path). → `tsc --noEmit` exit 0 (no regression).
3. Write `lib/reading.tsx`. → typechecks.
4. Build `read-0-test`, edit `gen-registry.mjs`, `npm run gen`. → `Read0Test` registered.
5. Pixel QA gate: `qa_frames.mjs` at 0.333 → READ frames → record PASS/FAIL + any failing mark.

**Out of scope (P2+):** the pilot composition `Read1Kamatz.tsx`, `reading.json`/`curriculum.json`,
`--emit-ts` against a real project, muxing, music/SFX, the SBL fallback build, mnemonics. **$0 total.**
