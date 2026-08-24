# Hebrew Reading-Instruction Shorts — Implementation Plan

**Hand-off doc for an engineer/agent.** Builds the reading track (teach Hebrew decoding to ages 5–7,
one nikkud per video, sub-word highlight synced to the exact sound) on top of the proven
`short-18-bu-aleph` pilot. The WHY for every decision is in `research/hebrew-reading/00-findings.md`
(sections referenced inline as §N).

**North-star rule (the product's promise):** the on-screen **pointed letter / צירוף (CV cluster)**
lights up **in exact sync** with the sound — one level finer than the pilot's whole-word highlight.
Highlight the **whole pointed letter, never the vowel mark alone** (§1 — the decodable unit is the
cluster; and §2 — the aligner can't time vowels anyway).

---

## 0. The one-paragraph architecture

Pedagogy forces isolated units (a grapheme, a CV syllable) to be **spoken in isolation anyway** (§1).
So make each unit **its own edge-tts clip**; timing becomes **exact by construction** (clip == unit).
The only moving part is trimming edge-tts's per-clip silence pad with an RMS energy trim (§2). No
sub-word forced alignment of one long clip (probed, disqualified — boundaries land in silence), no
edge-tts phoneme events (they don't exist). **Blend** beats stitch per-syllable clips back-to-back at
known offsets (continuous blending, §1). **Word** beats use one continuous clip + the existing
whole-word Captions highlight (already correct, no new code). Display font stays **Heebo/Rubik**
(pointed-safe, §4), gated on a per-mark pixel QA. Voice stays **edge-tts `he-IL-HilaNeural`**, per-clip
with a slowed global rate (§5). Nikkud text is a **curated lexicon + stdlib rule engine** (§3) — the
vocabulary is closed and teacher-vetted; a wrong vowel taught to a5-year-old is the worst-case bug.

---

## 1. NEW SKILL — `/make-reading-short`

**File:** `.claude/skills/make-reading-short/SKILL.md`, modeled byte-for-byte on the structure of
`.claude/skills/make-ad/SKILL.md` (which itself extends `/make-short`). It is a **stage contract**:
each stage emits a narrow artifact that a validator checks, so a bad handoff fails fast at the seam
(the repo's whole architecture — see `tools/contracts.py` docstring).

### 1.1 Skill front-matter + routing

```yaml
---
name: make-reading-short
description: Build a HEBREW READING-INSTRUCTION short (1080x1920, 30-60s) that teaches ONE nikkud to ages 5-7 — the pointed letter/syllable (בָּ) highlights in sync with the exact spoken sound (sub-word, one level finer than whole-word). Per-video ladder isolated -> CV -> blend -> word. Use when the user wants to "teach a nikkud", "make a Hebrew reading/kriya short", "make a decoding short", or continue the reading-N series. mode:"reading" — inherits mode:"kids" (no CTA, calm) but the synthetic-phonics ladder and the seamless loop are relaxed (see Stage 1). Reuses בּוּ (locked character), edge-tts voice, kids music beds. Defers TSX crash rules to vidtsx-2d-generator, the grapheme/tile components to lib/reading.tsx, SFX taste to suggest-sfx + brand §7 (kids variant).
---
```

Routing note to add near the top (mirrors make-ad's "Multi-agent mode" callout): this track is
**curriculum-data-driven** — the nikkud, target letters, CV syllables, and blend words come from
`tools/nikkud_data.py` (§4 of this plan), not from free scripting.

### 1.2 Project layout (new top-level dir, parallel to `shorts/`)

```
reading-shorts/read-N-<nikkud>/      e.g. read-1-kamatz, read-2-patach, read-3-tzere-segol ...
  curriculum.json   — the resolved per-video teaching spec (from nikkud_data.py, see §4)
  script.md         — the beat sheet (teach -> blend -> read -> call-and-response), register 5-7
  beats.json        — mode:"reading" contract (base beats + reading{} block + vo[].units[])
  reading.json      — the unit manifest gen_voice_reading.py consumes (id/grapheme/sound/role)
  voice/            — per-UNIT TTS clips + voice.wav   (gen_voice_reading.py)   [gitignored]
  sfx-plan.json     — cue sheet (kids-flavor, library-first)
  output/           — read-N-<nikkud>-sfx.mp4                                 [gitignored]
remotion/src/shots/read-N/
  ReadN<Nikkud>.tsx — THE composition (registered by npm run gen)
  vo.gen.ts         — AUTO-GENERATED VO with per-word AND per-unit times (never hand-edit)
```

**Why a new top-level dir (not `shorts/`):** the artifact contract differs — a `curriculum.json` +
`reading.json` per video, and the composition is generated **from** the curriculum, not hand-scripted.
Keeps the three existing tracks untouched. (If you'd rather group by sound-pair, `read-N-<sound>`
also works — the validator keys off `mode:"reading"`, not the folder name.)

**gen-registry mapping:** `remotion/scripts/gen-registry.mjs` `typeOfGroup()` has no `read-` prefix —
a `src/shots/read-N/` group currently falls through to `'other'`. That is **fine for rendering**
(rendering doesn't filter by type), but to make the Studio type-filter clean, add one line:

```js
if (/^read-/.test(g)) return 'faceless';   // reading shorts ride with the faceless track
```

(Or a new `'reading'` bucket if you want them separated in Studio.)

### 1.3 beats.json contract extension (additive, non-breaking)

Existing validators ignore unknown keys (confirmed: `validate_beats` only requires `id/title/format/vo`
and validates `beats[]` only if present). The reading shape **extends** the base:

```jsonc
{
  "id": "read-1-kamatz",
  "title": "בּוּ מְלַמֵּד קָמָץ (Bu teaches Kamatz)",
  "mode": "reading",
  "language": "he",
  "series": "bu-koala-reading",
  "characterRef": "ai-shorts/bu-koala/character.jpg",
  "musicBed": "kids-play-ukulele",
  "composition": "Read1Kamatz",
  "format": { "width":1080, "height":1920, "fps":30, "durationSec": 34.5 },

  "reading": {
    "nikkud": "kamatz",                       // key into nikkud_data.py
    "sign": "בָּ",                             // the sign itself (display, stable target color)
    "sound": "a",
    "targetLetters": ["בּ", "מ", "ק", "שׁ"],   // consonants the sound rides on this video
    "progression": ["isolated","cv","blend","word"],  // REQUIRED, in this order
    "anchorWords": ["אַבָּא","מָמָא","בָּבָּא"]   // 2-3 high-frequency imageable kid words
  },

  "vo": [
    {
      "beat": "teach-isolated",
      "text": "בָּ",                          // displayed caption
      "tts": "בָּ",                            // what edge-tts reads (pointed)
      "start": 2.0, "end": 3.6,
      "units": [ { "g": "בָּ", "start": 2.27, "end": 2.51 } ]   // per-grapheme window (gen fills)
    }
    // ... lines WITHOUT units[] fall back to whole-word highlight (blend/word beats)
  ],

  "beats": [
    { "name": "hook",           "start_s": 0.0,  "end_s": 2.0 },
    { "name": "teach-isolated", "start_s": 2.0,  "end_s": 8.0 },
    { "name": "teach-cv",       "start_s": 8.0,  "end_s": 16.0 },
    { "name": "blend",          "start_s": 16.0, "end_s": 26.0 },
    { "name": "read-word",      "start_s": 26.0, "end_s": 32.0 },
    { "name": "call-response",  "start_s": 32.0, "end_s": 34.5 }
  ]
}
```

**Contract rules** (enforced by `validate_reading_beats`, §2.4 / §5):
- `mode:"reading"` + `language:"he"` + a `reading{}` block are **required**.
- `reading.progression` must be the 4 steps in order (or a suffix of them — e.g. a דגש video may
  drop `cv`), but `isolated` is always present and always first.
- The four canonical beats (`teach-isolated`, `teach-cv`, `blend`, `read-word`) must appear in
  `beats[]` in progression order.
- `vo[].units[]` is **optional per line**; when present on an isolated/CV line it's the highlight
  schedule. `g` = displayed unit WITH nikkud; `start`/`end` absolute seconds ⊆ the parent word span;
  units sorted, non-overlapping.
- Lines without `units[]` → existing whole-word Captions highlight (blend/word beats need no new data).

### 1.4 Stage contract (mirror make-ad's stages)

| Stage | make-ad equivalent | reading-track form |
|---|---|---|
| **0 — interrogation** | business/offer/CTA/brand | **Which nikkud** + confirm the resolved `curriculum.json` (letters, CV set, 2-3 anchor words). State cost (edge-tts=$0; image gen only if you want בּוּ illustrations — see §7). |
| **1 — script + beats** | lexicon + beats (mode:"ad") | Pull the curriculum from `nikkud_data.py`; write `script.md` (register **5–7**: short directive prompts + call-and-response, NOT toddler cooing — §7 register flag), `reading.json`, `beats.json` (mode:"reading"). Beat grammar below. |
| **2 — composition** | `ad-N/AdN<Biz>.tsx` + ads.tsx | `read-N/ReadN<Nikkud>.tsx` + `lib/reading.tsx` (GraphemeTile/SyllableTile + Captions `units` path). `compositionConfig` 1080×1920@30. |
| **3 — QA** | qa_frames + timing audit | qa_frames at phone scale **+ the nikkud/bidi/highlight-sync checklist (§5)** + `validate_reading_beats`. |
| **4 — voice** | gen_voice_edge + mux + audio_gate | **gen_voice_reading.py** (per-unit clips + energy trim → `vo[].units[]`) → emit-ts → re-render → mux via `ffw.ffmpeg` → `audio_gate.py`. |
| **5 — SFX** | suggest-sfx, ad flavor | suggest-sfx, **kids flavor** (brand §5 kids: playful boing/pop/sparkle allowed, still under the voice). |
| **6 — music** | mix_music | `kids-*` beds (kids-play-ukulele default, kids-curious-pizzicato for a "discovery" beat, kids-lullaby-musicbox for a calm recap). Hard-ducked. |

**Beat grammar (30–60s, the synthetic ladder §1):** HOOK (frame 0 fully composed — בּוּ + the target
sign already visible) → **TEACH-ISOLATED** (the sound alone; GraphemeTile huge; touch-and-say) →
**TEACH-CV** (sign on 2–3 consonants; SyllableTile per צירוף, each its own clip) → **BLEND** (syllables
stitch into a word, continuous blending /bbbaaa/, highlight sweeps across) → **READ-WORD** (the whole
anchor word, one continuous clip, whole-word pop) → **CALL-AND-RESPONSE** ("your turn", a genuine
2–4s pause — reuse the pilot's engineered-`הִמְהוּם` trick, NOT a bare `...` which edge-tts rejects).

**Register raise (hard note):** `character.json` targets ages 3–5 (motherese, 3–6-word cap). For 5–7
keep the character/voice/catchphrase but write **short directive prompts** ("now you say בָּ") — not
cooing. This is the single content change from the kids track.

### 1.5 Reuse vs build (from findings §7)

| REUSE as-is | BUILD new |
|---|---|
| בּוּ character.jpg + character.json (gen_image `--ref`; never re-derive) | `tools/gen_voice_reading.py` |
| `tools/gen_voice_edge.py` plumbing (WordBoundary → vo[].words[]) | `tools/nikkud.py` + `tools/nikkud_data.py` |
| `shorts.tsx` Captions (rtl/plate/kidsNikkud/anchorRtl/stripNikkud) | Captions `units` path + **GraphemeTile/SyllableTile** (new `lib/reading.tsx`) |
| Fonts Heebo/Rubik + `gen-fontfaces.mjs` | `validate_reading_beats` in `tools/contracts.py` |
| `tools/contracts.py` `validate_ad_beats` (the copy pattern) | (conditional) SBL Hebrew font entry — only if §4 pixel gate fails |
| `short-18-bu-aleph` reference (`<Captions plate rtl kidsNikkud/>`) | (conditional) Azure direct-SSML voice path — only if §5 listening QA bites |
| kids music beds (kids-play-ukulele/-lullaby-musicbox/-curious-pizzicato) | |

---

## 2. TOOLING to build

> **Python constraint (CLAUDE.md hard rule):** anything touching voice runs under
> **`.venv-voice312` (Python 3.12.10), NOT 3.13+** — edge-tts 7.28.6, whisperx, kokoro have no cp313
> wheels. Pure-stdlib tooling (nikkud segmentation) can be any Python 3.10+.
> Run voice work as `.venv-voice312\Scripts\python.exe tools/gen_voice_reading.py ...`.

### 2.1 `tools/nikkud.py` + `tools/nikkud_data.py` — nikkud text module (stdlib-only)

**Decision (findings §3):** curated lexicon + rule engine. NO live ML nakdan in the product path —
the vocabulary is a closed, teacher-vetted set (~20 words/syllables per video). phonikud-onnx is an
**optional authoring-time cross-check only** (never ships unverified).

**`tools/nikkud.py`** (the engine; stdlib — `unicodedata` only):

```python
# --- grapheme segmentation (per findings §3 spec) ---
NIKKUD   = range(0x05B0, 0x05C0)          # U+05B0–05BF (incl. dagesh U+05BC, shva U+05B0)
SHIN_DOT = (0x05C1, 0x05C2)               # shin/sin dots stay with the letter
HEB_LETTER = range(0x05D0, 0x05EB)        # U+05D0–05EA incl. sofits

def graphemes(word: str) -> list[str]:
    """Split a pointed word into graphemes: one HEBREW LETTER + its following combining marks.
    Dagesh (U+05BC) and shin/sin dots stay INSIDE the grapheme (pedagogically load-bearing: ב/בּ).
    Never splits a letter from its nikkud."""

def syllabify(word: str) -> list[str]:
    """Greedy-left CV/CVC split into צירופים. Shva na/nach is the hard case:
    initial or after a full vowel in an open syllable -> נע; between identical consonants or
    word-final -> נח; else consult the lexicon flag. Matres (א ה ו י) resolved from their nikkud.
    Maqaf/whitespace = hard boundaries."""

def strip_to_base(g: str) -> str: ...       # grapheme -> bare letter (for grouping)
def nikkud_of(g: str) -> str | None: ...    # grapheme -> its vowel sign name
def has_dagesh(g: str) -> bool: ...
```

**`tools/nikkud_data.py`** (the lexicon + curriculum — see §4). It holds, per nikkud, the curated
pointed words + CV syllables, each hand-verified. The engine reads it; it never invents vowels.

**pip installs:** none for the engine (stdlib). Optional authoring cross-check:
`.venv-voice312\Scripts\python.exe -m pip install phonikud phonikud-onnx` (one-time 308MB int8 model,
then offline; `>=3.8,<3.13` fits the venv). Keep `dictabert-large-char-menaked` as the accuracy
referee for a contested word. **Human verifies every word before commit.**

### 2.2 `tools/gen_voice_reading.py` — per-unit synth + energy trim (~80 lines, reuses gen_voice_edge plumbing)

This is the heart of the timing guarantee. It **imports and reuses** `gen_voice_edge` (the `_tts`,
`probe_duration`, `ffw` resolution, hash-caching) rather than duplicating it.

```python
# reads reading.json: {"voice":"he-IL-HilaNeural","units":[{"id","grapheme","sound","role"}]}
# role ∈ isolated|cv|blend|word ; letter-naming units may set say:"characters"
def main():
    # for each unit:
    #   1. edge-tts synth the unit's OWN clip (boundary=WordBoundary gives a coarse window)
    #      --rate slowed (e.g. -18%) so the single sound is held/stretched (per-clip global prosody
    #      sidesteps edge-tts's missing per-word SSML — findings §5)
    #   2. energy-trim the clip -> exact [onset,end]   (see _rms_trim below)
    #   3. write vo[].units[] = [{g, start, end}] into beats.json (start = beat_offset + onset)
    # blend beats: synth each syllable as its own clip, trim, schedule back-to-back at known offsets
    #   (NO gaps = continuous blending per §1) -> deterministic unit times, no aligner
    # word beats: one continuous clip + existing whole-word highlight (no units[] written)

def _rms_trim(path: str, thresh: float = 0.15) -> tuple[float, float]:
    """numpy RMS energy trim. edge-tts pads ~0.22-0.40s lead / ~1.05s trail, VARYING per clip
    (findings §2 probe table) — NO fixed global offset is safe, so measure it.
    Returns [onset,end] where RMS first/last exceeds `thresh` * peak.
    torchaudio/soundfile already in .venv-voice312. ~15 lines."""
```

CLI mirrors gen_voice_edge: `--beats <beats.json> --reading <reading.json> --emit-ts
remotion/src/shots/read-N/vo.gen.ts [--mux out.mp4] [--dry-run] [--force] [--rate -18%]`.
Emits a `vo.gen.ts` whose `VoLine[]` now also carries the optional `units` array (extend the
`VoLine`/`TimedWord` types — §3).

**BREAKAGE DRILL (edge-tts is unofficial):** `pip install -U edge-tts` first; if still down,
synthesize the unit clips with any local TTS and recover **whole-clip** bounds via
`tools/align_words.py --lang he` (WhisperX). **Hard rule from findings §2:** if WhisperX is used,
feed it **whole-clip (or silence-trimmed) windows only — NEVER edge-tts WordBoundary windows** (they
over-report and alignment lands on silence). And never attempt a mid-syllable vowel boundary — a
grapheme span runs letter-onset → next-letter-onset.

### 2.3 (conditional) `tools/fonts/manifest.json` SBL entry

Only if the §4 pixel QA gate fails: vendor **SBL Hebrew** (SIL/free, gold-standard mark placement) as
one manifest entry → `gen-fontfaces.mjs` → a new `FONT_NIKKUD_DISPLAY` in `fonts.ts`, used **only**
inside GraphemeTile/SyllableTile. Captions stay Heebo/Rubik for continuity. **Do not vendor on spec.**

---

## 3. TSX LIB additions — per-grapheme highlight

**Decision:** put the reading components in a **new `remotion/src/lib/reading.tsx`** (mirrors how
`lib/ads.tsx` is the ad-mode kit that non-ad shots never import). **Extend `shorts.tsx` Captions with
a `units` path** rather than forking it — the RTL/nikkud/plate machinery is already correct there and
must not drift.

### 3.1 Type extension (shorts.tsx)

```ts
export type TimedUnit = { g: string; start: number; end: number };   // g WITH nikkud
export type TimedWord = { w: string; start: number; end: number; units?: TimedUnit[] };
export type VoLine    = { text: string; start: number; end: number; words?: TimedWord[]; units?: TimedUnit[] };
```

`units` is optional everywhere → every existing shot renders identically (back-compat, same trick as
the `mode='pop'` default that "keeps every existing shot untouched").

### 3.2 Captions `units` path (CaptionsPop — the pilot uses pop)

When the active word (or line) has `units[]`, render the word as **per-grapheme spans** and
tint+pop the grapheme whose `[start,end)` window contains `t`; else whole-word (today's path).

```tsx
// inside the word span, when word.units?.length:
//   split word.w into its grapheme spans (splitting MUST match tools/nikkud.py graphemes() —
//   keep a tiny TS port, or pre-split in vo.gen.ts and ship spans as data)
//   activeG = units.find(u => t >= u.start && t < u.end + 0.04)
//   each grapheme span: color: isActive ? accent : '#fff',
//                       transform: scale(1 + (isActive ? 0.12 : 0))   // pop, redundant w/ color
```

**Highlight treatment (findings §4, PlanetRead/SLS evidence):** color the active grapheme in exact
sync **plus** the scale pop — **never color alone** (redundant cue survives color-vision deficiency
and inattention). One consistent **accent for "sounding now"**; a **separate stable color for the
target nikkud sign itself** across the whole video so the child learns to find the sign.

**RTL/bidi + nikkud handling (already solved in shorts.tsx — keep it):**
- Grapheme spans keep **logical order** (never reversed); container stays `direction:'rtl'`; each
  span keeps `unicodeBidi:'isolate'` so one grapheme's marks can't drag neighbors.
- Keep `kidsNikkud` behavior: nikkud **kept** (skip stripNikkud) + `lineHeight:1.5` so the
  below-letter point never clips. For reading, nikkud is the *content*, so this path is always on.
- **Do NOT** `textTransform:'uppercase'` (no-op for Hebrew, but the reading tile sets it explicitly
  off to avoid any Latin sound-label being uppercased against brand).
- Add `letterSpacing`/tracking on blends so an above-letter חולם or shin-dot doesn't drift onto the
  neighboring letter (findings §2/B).

### 3.3 `lib/reading.tsx` — GraphemeTile / SyllableTile

The big isolated pointed letter (the "hero" of teach beats). Same timing source as Captions.

```tsx
export const GraphemeTile: React.FC<{
  g: string;              // pointed grapheme, e.g. "בָּ"
  at: number;             // seconds (global) when it enters
  soundWindow?: { start: number; end: number };  // from vo[].units[] — the pop/tint window
  nikkudColor?: string;   // stable color for the target sign (default brand accent)
  accent?: string;        // "sounding now" color
  size?: number;          // default as large as SAFE allows — size for the MARK's legibility (§4/B)
  y?: number;
  showSoundLabel?: boolean; // small Latin/phonetic label under the tile
}> = /* huge pointed letter, lineHeight 1.5, optional mark-color overlay, scale-pop on soundWindow */;

export const SyllableTile: React.FC<{ syllable: string; /* a צירוף like בָּ */ ... }> = /* same, CV */;
```

- Font: `FONT_HEBREW_CAPTION` (Rubik→Heebo). If the §4 gate fails, swap the tile's `fontFamily` to a
  new `FONT_NIKKUD_DISPLAY` — **tile only**, captions unchanged.
- **Cholam/shin collision + קמץ קטן** (findings §2/D): the tile must give a pointed שׁ with חולם extra
  room; קמץ קטן is **deferred** from the series entirely (printed identically to קמץ גדול) — note it
  in the curriculum as "not in v1."

**No new font wiring needed** unless the gate fails (then §2.3).

---

## 4. CURRICULUM DATA — `tools/nikkud_data.py`

A single data file drives **every** video in the series (the skill reads it; the validator checks
against it). One entry per nikkud, in the §1 introduction order.

```python
# tools/nikkud_data.py  (stdlib data; the engine + skill + validator all read THIS, never drift)
CURRICULUM = [
  { "order": 1, "key": "kamatz",  "sign": "בָּ", "name_he": "קָמָץ", "sound": "a",
    "targetLetters": ["בּ","מ","ק","שׁ","א"],
    "cv":    ["בָּ","מָּ","קָּ","שָׁ","אָ"],
    "blendWords": [ {"word":"אַבָּא","units":["אַ","בָּא"]},
                    {"word":"מָמָא","units":["מָ","מָא"]},
                    {"word":"בָּבָּא","units":["בָּ","בָּא"]} ],
    "mnemonic": None,              # ⚠ UNVERIFIED — see findings §2/E; source before shipping
    "musicBed": "kids-play-ukulele" },
  { "order": 2, "key": "patach",  "sign": "בַּ", "name_he": "פַּתָּח", "sound": "a", ... },  # same-sound pair w/ kamatz
  { "order": 3, "key": "tzere-segol", "sign": "בֵּ/בֶּ", "sound": "e", ... },
  { "order": 4, "key": "chirik",  "sign": "בִּ", "sound": "i", ... },
  { "order": 5, "key": "cholam",  "sign": "בֹּ", "sound": "o", ... },
  { "order": 6, "key": "shuruk",  "sign": "בוּ", "sound": "u", ... },   # shuruk BEFORE kubutz (§1)
  { "order": 7, "key": "kubutz",  "sign": "בֻּ", "sound": "u", ... },   # "same sound, different look"
  { "order": 8, "key": "shva",    "sign": "בְּ", "sound": "ə/∅", ... }, # LATE, its own video; נח before נע
  { "order": 9, "key": "dagesh-kal","sign": "בּ", "sound": "b/v", ... },# דגש קל only (B/K/P vs V/CH/F)
  # DEFERRED: hataf forms; kamatz katan (printed identically to kamatz gadol — findings §2/D)
]
```

Each `blendWords[].units` is the **per-video closed lexicon** the rule engine + phonikud cross-check
operate on. This is the ~20-words-per-video set the findings call "teacher-vetted." **Mnemonics are
deliberately `None`** — findings §2/E: do NOT fabricate per-sign child mnemonics (Hebrew teacher-blog
search was engine-blocked). Open a to-source task or derive + validate with an Israeli teacher.

A TS mirror (`remotion/src/lib/readingCurriculum.ts`) can be **generated** from this by a tiny
`gen` step so the composition imports typed curriculum without hand-copying (optional; the comp can
also read it via `curriculum.json` in the project dir — pick one and keep a single source of truth:
**`nikkud_data.py` is the source**).

---

## 5. PIPELINE wiring

1. **Registration:** drop `ReadN<Nikkud>.tsx` under `remotion/src/shots/read-N/` with an exported
   `compositionConfig`; run `cd remotion && npm run gen` (gen-registry does NOT run itself from
   frames/render). Add the `read-` prefix line to `typeOfGroup()` (§1.2). Sanity-check the registered
   `durationInSeconds` ≈ last-speech-end + ~2.5s (the truncation/dead-tail lesson from ads).
2. **QA at phone scale (mandatory):**
   ```
   cd remotion && npm run gen
   node scripts/qa_frames.mjs ReadN<Nikkud> 0,<beat-boundaries+each-unit-highlight>,<last> --scale=0.333
   ```
   READ every small JPG. **Reading-specific checklist (on top of the standard one):**
   - **Per-mark pixel gate (findings §4):** render each target mark (קמץ/פתח/…/דגש) on 2–3 base letters
     at real tile size in Heebo-700 and Rubik-900 and READ them. PASS = marks distinguishable at a
     glance — esp. חיריק vs סגול vs צירי; חולם's top-left dot clear of the tile top; דגש centered;
     pointed שׁ+חולם not merged. FAIL → vendor SBL Hebrew (§2.3).
   - **Highlight == sound:** step frames across each `units[]` window; confirm the lit grapheme is the
     one being spoken (the product's promise). Check no two graphemes lit at once, none lit in silence.
   - **Bidi:** Hebrew+any digit/Latin sound-label tokens didn't reorder (anchorRtl/RLM already in lib).
   - **Nikkud legibility:** points don't clip at `lineHeight 1.5`; tile clears SAFE zones
     (bottom 500 / right 160).
   - Frame 0 composed & thumbnail-grade (target sign visible); the loop seam (if used) matches.
3. **Render + mux + audio gate** (always via `ffw`, never bare ffmpeg — the silent-AAC bug):
   ```
   node scripts/render-all.mjs ReadN<Nikkud> --scale=1
   .venv-voice312\Scripts\python.exe tools/gen_voice_reading.py --beats .../beats.json --reading .../reading.json \
       --emit-ts remotion/src/shots/read-N/vo.gen.ts
   # re-render after voice (captions/tiles retimed), then mux via tools/ffw.py and GATE it:
   .venv-voice312\Scripts\python.exe tools/audio_gate.py remotion/out/ReadN<Nikkud>-voiced.mp4
   ```
4. **Contract gate:** add `validate_reading_beats` to `tools/contracts.py` (mirror `validate_ad_beats`:
   wrap `validate_beats` + require mode/language/reading{} + the 4 progression beats in order +
   **conditional units audit** — numeric start<end, sorted, non-overlapping, ⊆ parent word span;
   isolated/CV lines must carry units once voice gen ran). Register `"reading-beats"` in `_VALIDATORS`
   and update the `main()` usage string.

**Seamless-loop consideration:** mode:"kids" requires frame-0==last-frame (brand §5). The reading
track **relaxes** this like ads relax the no-CTA rule — a reading video is a one-shot lesson, and the
"call-and-response" ending is the payoff, not a loop. **Decide per video** (declare `loop:false` in
beats to skip the loop QA check). If you do loop, the call-and-response pause can settle back to the
hook's frame-0 pose. Don't force it.

---

## 6. PILOT plan — **קמץ** (read-1-kamatz)

Why קמץ first: it's first in every sourced sequence (highest frequency, easiest to pronounce — §1),
and its pair patach is the same /a/ sound, so the pilot can teach קמץ and name-drop patach.

**Beat-by-beat (≈34s, register 5–7, בּוּ hosts):**

| beat | t (s) | on screen | VO (edge-tts clips) | highlight |
|---|---|---|---|---|
| hook | 0–2 | בּוּ + huge בָּ tile, frame 0 composed | "בּוּ בּוּ! הַיּוֹם לוֹמְדִים קָמָץ!" (whole-word) | whole-word |
| teach-isolated | 2–8 | GraphemeTile בָּ huge, stable sign color | per-unit clip "בָּ" (slowed) → `units[]` | **grapheme pop in sync** |
| teach-cv | 8–16 | SyllableTiles בָּ מָּ קָּ (one at a time) | 3 per-unit clips, each trimmed | each צירוף pops as spoken |
| blend | 16–26 | tiles slide together → בָּבָּא, highlight sweeps | per-syllable clips stitched back-to-back (continuous) | sweep across syllables |
| read-word | 26–32 | whole word בָּבָּא + בּוּ celebrates | one continuous clip | whole-word pop (existing) |
| call-response | 32–34.5 | "now you!" + engineered 2.5s pause (הִמְהוּם trick) | "אַתֶּם!" + pause | none (settle to frame 0 if looping) |

**Acceptance criteria (all must pass):**
1. `validate_reading_beats` passes (mode/language/reading{}/progression/units audit).
2. Per-mark pixel QA gate **passes in Heebo/Rubik** (else SBL fallback is triggered and re-gated).
3. Frame-stepped QA shows the lit grapheme == the spoken unit for **every** `units[]` window; no
   highlight in silence; no double-lit.
4. **Listening QA (findings §5):** a human confirms edge-tts pronounces each isolated pointed
   syllable correctly (esp. שורוק vs vav+dagesh, שווא נע — not in the pilot, but the pattern). Any
   mispronounced unit → escalate that unit to the Azure SSML path (§2 conditional, needs key + cost
   sign-off).
5. `audio_gate.py` passes on the muxed file (non-silent, cues audible).
6. Registered duration ≈ last-speech-end + ~2.5s (no dead tail, no truncation).
7. Cost reported: edge-tts **$0**; image gen only if בּוּ illustrations are added (state before spend).

---

## 7. PHASES (rough ordering) + costs

> Costs: **edge-tts = $0** (free, no key). Paid spend is **only** gen_image for בּוּ illustrations
> (fal/Gemini, a few cents per still) **if** you want them, and **only if** QA bites: SBL Hebrew is
> free (SIL), but the **Azure SSML** voice path needs a key + has cost — state before spending
> (repo rule). No paid step is required for the pilot.

**Phase 0 — foundations (no pixels yet).**
Build `tools/nikkud.py` + `tools/nikkud_data.py` (graphemes + syllabify + קמץ curriculum row);
`validate_reading_beats` in contracts.py; `tools/gen_voice_reading.py` (per-unit synth + RMS trim,
reusing gen_voice_edge). Unit-test the segmenter on the קמץ lexicon. *Gate: contracts validate a
hand-written read-1 beats.json; energy trim returns sane [onset,end] on a probe clip.* **$0.**

**Phase 1 — TSX reading kit.**
`remotion/src/lib/reading.tsx` (GraphemeTile/SyllableTile) + Captions `units` path in `shorts.tsx` +
type extensions. Build a **standalone test comp** (`read-0-test`) that renders every קמץ mark on 2–3
letters at tile size → run the **per-mark pixel QA gate**. *Gate: marks legible, or trigger SBL
fallback.* **$0.**

**Phase 2 — pilot composition.**
Author `reading-shorts/read-1-kamatz/` (curriculum.json, script.md, reading.json, beats.json);
`Read1Kamatz.tsx`; register + gen; QA frames (highlight==sound, bidi, nikkud, frame-0). *Gate: the
frame-stepped highlight check passes.* **$0** (or a few cents if בּוּ stills are added via
`gen_image.py --ref character.jpg`).

**Phase 3 — voice + finish.**
gen_voice_reading (fills `units[]`) → re-render → mux via ffw → `audio_gate.py` → **listening QA** →
SFX (kids flavor) → music (kids-play-ukulele). *Gate: acceptance criteria §6 all green.* **$0.**

**Phase 4 — series scale-out.**
Add patach → tzere-segol → chirik → cholam → shuruk/kubutz → shva → dagesh-kal rows to
`nikkud_data.py` (one video each, same pipeline). Handle the glyph-identity traps deliberately
(שורוק=vav+dagesh, cholam/shin) as their own teaching moments. Defer חטף + קמץ קטן. **Per video $0.**

**Phase 5 (conditional, only on QA failure) — upgrades.**
- SBL Hebrew vendored (if §4 gate failed in Phase 1) — free.
- Azure direct-SSML voice (if §5 listening QA bites) — needs key + cost sign-off; same voices, IPA
  phoneme control, optional Pronunciation-Assessment QA lever.
- phonikud-onnx authoring cross-check — free, offline, but human-verified only.

---

## UNVERIFIED — resolve before relying (from findings register)

| Item | Resolution before it blocks a phase |
|---|---|
| edge-tts pronunciation of isolated pointed syllables | **Phase 3 listening QA** — escalate to Azure SSML if it bites |
| Heebo/Rubik mark precision at tile size | **Phase 1 per-mark pixel gate** — SBL fallback if it fails |
| Per-sign child mnemonics | keep `mnemonic: None`; to-source where Hebrew search works, or derive + Israeli-teacher review. **Do not fabricate.** |
| Nakdan accuracy on child CVC/CV words | human-verify the closed lexicon; phonikud/dictabert cross-check at authoring time |
| Shva na/nach edge cases | lexicon flag in `nikkud_data.py`; שווא is its own late video (Phase 4) |
| Official state textbook nikkud order | current order is solid-but-secondhand (§1); confirm via Meyda/teacher if a school-aligned claim is made |
