# Transcript-Driven Hebrew Reading Track — Design + Implementation Spec

**Goal.** Make the Hebrew reading track **script-first**. Today each video is hand-built:
`beats.json`, `reading.json` (unit manifest), and a per-video TSX comp (`Read1Kamatz.tsx`). This
spec makes the **transcript** (pointed Hebrew script, structured by beat) the *single source of
truth*. From it the engine **derives**: the nikkud (auto-detected), the `units[]` (which
lines/segments get sub-word highlight), the target letters, the `reading.json` unit manifest, the
`beats.json` (mode:reading, `vo[]` with planned unit windows), and a **generic data-driven
composition** (no per-video hand-built comp). The curriculum (`tools/nikkud_data.py`) stays a
**reference/word-bank** — the script supplies the actual words; the engine validates that the
script's words are decodable against the nikkud taught.

**Status:** design + implementation spec only — NO production code. Every function is given a
signature + behavior + worked example. Anything uncertain is marked **[DECISION]** with a
recommended default for the build agent.

**Grounded in:** `10-implementation-plan.md` (§N inline) + `00-findings.md` (§N inline) + the
verified pilot files. Do not re-derive what those already settled; this spec references them.

---

## 0. The one-paragraph architecture shift

The **pipeline today** is: curriculum → (human writes script.md as prose) → (human hand-writes
reading.json + beats.json + a bespoke TSX comp). The **pipeline after this change** is:

```
script.md (front matter + beat-tagged pointed lines)   ← THE human-authored input
   │  tools/make_reading.py  (NEW — the derivation engine)
   ▼
reading.json  (unit manifest — gen_voice_reading consumes)
beats.json    (mode:reading + reading{} + vo[] with PLANNED unit windows)
   │  tools/gen_voice_reading.py  (UNCHANGED — replaces planned windows with REAL trimmed bounds)
   ▼
vo.gen.ts     (per-word + per-unit REAL times)
   │  remotion/src/lib/reading-render.tsx  (NEW — ONE generic comp, data-driven)
   ▼
rendered video
```

The TSX comp is no longer hand-built per video. **One generic renderer** reads any `mode:reading`
`beats.json` and lays out hook → GraphemeTile/SyllableTile from `units` → blend sweep → whole-word
→ call-response. The per-video "composition" collapses to a **thin generated wrapper** that imports
the generic renderer + that video's `vo.gen.ts` and `beats.json` (needed only so gen-registry has a
stable `compositionConfig.id` per video — see §3.4).

The **voice/timing/mux/QA pipeline is untouched.** `gen_voice_reading.py`, the RMS trim, the Captions
`units` path, `validate_reading_beats`, the per-mark pixel gate, and the listening QA all stay
exactly as built. This spec adds an **authoring front-end** (parse + derive) and a **rendering
back-end** (generic comp) around that proven middle.

---

## 1. The transcript format

A minimal, forgiving authoring format for a **non-engineer** (a teacher or content author). The
design principle: **the user writes the LEAST possible; the engine fills the rest.** The format
extends the existing per-video `script.md` (already the human gate) with a machine-readable block.

**File:** `reading-shorts/read-N-<nikkud>/script.md` (same path as today — now machine-parsed).

### 1.1 Structure: front matter + tagged lines

The file is split into two zones by the parser:

1. **Front matter** — an optional YAML-ish key/value block between the first `---` fence and the
   next `---` fence (or, if no fence, every leading `key: value` line before the first role line).
2. **Body** — one VO beat per line, each tagged with a **role keyword** + a colon + the **pointed
   Hebrew**. Blank lines separate beats. `#` starts a comment (full-line or trailing).

```markdown
---
nikkud: kamatz            # OPTIONAL — auto-detected from the pointed units if absent
title: בּוּ מְלַמֵּד קָמָץ   # OPTIONAL — a default is derived from the nikkud
musicBed: kids-play-ukulele  # OPTIONAL — default kids-play-ukulele
loop: false                # OPTIONAL — default false (reading relaxes the seamless loop, plan §5)
---

# One line per VO beat. Role keyword, colon, pointed Hebrew. Blank line between beats.
hook: בּוּ בּוּ! הַיּוֹם לוֹמְדִים קָמָץ!

isolated: בָּ

cv: בָּ מָּ קָּ

blend: בָּבָּא

word: בָּבָּא! כָּל הַכָּבוֹד!

call: אַתֶּם! הִמְהוּם…
```

That is the **entire** authoring surface for the pilot-equivalent video. Everything else —
`reading.json`, `beats.json`, the `reading{}` block, the `vo[]` windows, the target letters, the
TSX comp — is derived.

### 1.2 Front-matter keys (all optional; defaults in bold)

| key | type | default | notes |
|---|---|---|---|
| `nikkud` | str | **auto-detect** (§2.2) | a `nikkud_data.py` key; when present it must match the detected one or the build warns |
| `title` | str | **derived** `"בּוּ מְלַמֵּד <name_he>"` | display title only |
| `musicBed` | str | **`kids-play-ukulele`** | kids bed id (findings §6) |
| `loop` | bool | **`false`** | reading relaxes seamless-loop (plan §5); `true` opts back in |
| `voice` | str | **`he-IL-HilaNeural`** | the locked בּוּ voice; rarely overridden |
| `rate` | str | **`-18%`** | slowed global rate (findings §5) |
| `composition` | str | **derived** `Read<N><PascalNikkud>` | the wrapper comp id (§3.4) |
| `id` | str | **derived** `read-N-<nikkud>` from the folder name | the project id |

### 1.3 Body role keywords

One role keyword per line, case-insensitive ASCII, followed by a colon. The **role set maps 1:1 to
the canonical 6-beat schedule** (plan §1.4 beat grammar). Aliases let a non-engineer use the word
that comes naturally.

| canonical role | accepted keywords | realizes beat | carries units? |
|---|---|---|---|
| `hook` | `hook`, `intro`, `פתיחה` | `hook` | no (whole-word) |
| `isolated` | `isolated`, `letter`, `sound`, `אות` | `teach-isolated` | **yes** (grapheme pop) |
| `cv` | `cv`, `syllables`, `syllable`, `צירוף`, `צירופים` | `teach-cv` | **yes** (one per צירוף) |
| `blend` | `blend`, `מיזוג` | `blend` | **yes** (one per syllable, sweep) |
| `word` | `word`, `read`, `מילה` | `read-word` | no (whole-word pop) |
| `call` | `call`, `response`, `call-response`, `תורכם` | `call-response` | no (pause) |

**[DECISION] Accept Hebrew role keywords?** Recommended: **yes, but optional.** The author is a
Hebrew-speaking teacher; allowing `אות:`/`צירוף:`/`מילה:` lowers the barrier. The parser maps both
ASCII and the Hebrew aliases to the canonical role. Default the docs/examples to ASCII so the file
stays diff-friendly; the aliases are a convenience, not the primary form.

### 1.4 Parsing rules (exact)

The parser (`parse_script`, §2.1) follows these rules **exactly**:

- **Line classification.** After stripping, a non-empty line is one of:
  - a **fence line** (`---`) toggling front-matter mode;
  - a **comment** (first non-space char `#`) → ignored;
  - a **front-matter entry** (`key: value`, only while in front-matter mode or before the first
    role line);
  - a **role line** (`<keyword> : <text>`), matched against the alias table;
  - **anything else → a hard parse error** naming the line number (fail fast — a malformed beat is
    worse than no beat; mirrors contracts.py's "fail fast at the seam" philosophy).
- **Role keyword match.** Split on the **first** colon. The left token (trimmed, lowercased) must be
  a known alias → its canonical role. If the left token is not a known alias, the line is **not** a
  role line (→ error, unless it is front matter). This prevents a pointed-Hebrew line containing a
  colon from being misread.
- **Text.** Everything after the first colon, stripped. It is the **displayed caption** AND the
  **TTS input** (`text` == `tts`, pointed). Trailing punctuation (`! …`) is preserved (it anchors
  bidi via the existing `anchorRtl`/`RLM` machinery in shorts.tsx).
- **Blank lines** are pure separators — they never create a beat. Multiple consecutive blank lines
  collapse. **[DECISION]** Blank lines are **cosmetic only**, not beat boundaries: a beat is exactly
  one role line. Recommended default: ignore blank lines entirely (do not infer structure from them)
  so a teacher can space the file freely.
- **Duplicate roles.** Repeating a unit-carrying role (`isolated`, `cv`, `blend`) across multiple
  lines is allowed and means "multiple teaching moments" — each becomes its own `vo[]` line and its
  own beat in `beats[]` (see §2.5 on how `beats[]` handles repeats). Repeating `hook`/`word`/`call`
  more than once is allowed too but unusual; the scheduler places them in encounter order. **No
  error** — the 6-beat *shape* is a default, not a straitjacket (see §2.5).
- **The engineered pause (הִמְהוּם).** The call-response beat's genuine 2–4s pause is realized as the
  warm hum word `הִמְהוּם` followed by real silence (the short-18 pilot trick — edge-tts rejects a
  bare `...`). The parser does **not** special-case it; it is just text on the `call:` line. The
  `beats.json` builder marks that line `"pause": true` (so the generic renderer knows to show "now
  you!" and light **nothing** during the hum). Detection: a `call` line whose text contains
  `הִמְהוּם` sets `pause: true`. **[DECISION]** Should the hum be auto-injected if the author writes a
  bare `call: אַתֶּם!`? Recommended: **no auto-injection** — surface a gentle *warning* ("call beat has
  no הִמְהוּם hum; the response pause will be abrupt — add הִמְהוּם… if you want the engineered
  pause") and let the human decide. Silent auto-injection of spoken text violates the
  "script is the source of truth" principle.

### 1.5 Minimal-worked-example guarantee

The **least** a user can write for a valid video is **four lines** (the progression floor —
`isolated` is always required, plan §1.3):

```markdown
isolated: בָּ
cv: בָּ מָּ קָּ
blend: בָּבָּא
word: בָּבָּא!
```

From this the engine derives: nikkud=`kamatz` (auto), a default hook (`בּוּ בּוּ! הַיּוֹם לוֹמְדִים
קָמָץ!`), a default call (`אַתֶּם! הִמְהוּם…`), the full `reading{}` block, all `units[]`, the manifest,
and the comp. Hook and call get **sensible defaults when omitted** so the floor stays low; the
author overrides them by simply writing the line. **[DECISION]** Auto-generate a missing hook/call?
Recommended: **yes** — generate the default hook/call from the nikkud row (`name_he`) and note it in
the build log ("no hook: line — using default"). This keeps the 4-line floor genuinely shippable.

---

## 2. The derivation engine — `tools/make_reading.py`

A **new** stdlib-only tool (Python 3.10+; it does NOT touch voice, so it does **not** need the
`.venv-voice312` venv — it imports `nikkud.py` and `nikkud_data.py`, both stdlib). It reads
`script.md`, writes `reading.json` + `beats.json`, and validates against `validate_reading_beats`.

**CLI (mirrors the other tools, run from repo root):**

```
python tools/make_reading.py reading-shorts/read-2-patach/script.md \
    [--out-dir reading-shorts/read-2-patach] \   # default: the script's own dir
    [--nikkud patach] \                           # override front-matter/auto-detect
    [--force] \                                   # overwrite existing reading.json/beats.json
    [--dry-run]                                   # print the derived JSON, write nothing
```

Exit 0 + `OK` on success; non-zero with a precise message on any parse/validation failure (same
contract style as `tools/contracts.py`). **Idempotent**: re-running on an unchanged script
regenerates byte-identical `reading.json` and the *planned* `beats.json`. **[DECISION]** Re-running
**after voice gen** would clobber the REAL trimmed `units[]` with PLANNED windows — guard: if
`beats.json` already has `voiceStatus` set, `make_reading.py` refuses without `--force` (protects
the voice-gen output; mirrors gen_voice_reading's hash-cache conservatism).

### 2.1 `parse_script(path) -> {"meta": dict, "beats": [{"role": str, "text": str}]}`

**Behavior.** Reads the file, applies the §1.4 parsing rules, returns the front matter as `meta`
(with defaults NOT yet applied — defaults are applied later so the build log can distinguish
"author wrote it" from "engine defaulted it") and the body as an ordered list of `{role, text}`.

```python
def parse_script(path: str) -> dict:
    """Parse a transcript script.md -> {"meta": {...}, "beats": [{"role","text"}, ...]}.

    Raises ValueError (with line number) on any unrecognized non-empty line.
    Roles are canonicalized through the alias table (§1.3). Blank lines and
    comments are dropped. Front matter is collected but defaults are NOT applied here.
    """
```

**Worked example.** The §1.1 file parses to:

```python
{
  "meta": {"nikkud": "kamatz", "title": "בּוּ מְלַמֵּד קָמָץ",
           "musicBed": "kids-play-ukulele", "loop": False},
  "beats": [
    {"role": "hook",     "text": "בּוּ בּוּ! הַיּוֹם לוֹמְדִים קָמָץ!"},
    {"role": "isolated", "text": "בָּ"},
    {"role": "cv",       "text": "בָּ מָּ קָּ"},
    {"role": "blend",    "text": "בָּבָּא"},
    {"role": "word",     "text": "בָּבָּא! כָּל הַכָּבוֹד!"},
    {"role": "call",     "text": "אַתֶּם! הִמְהוּם…"},
  ],
}
```

### 2.2 `detect_nikkud(beats) -> str`

**Behavior.** Auto-detect the taught nikkud from the **unit-carrying beats** (`isolated`, `cv`,
`blend`), using `nikkud.py`'s `nikkud_of()` on each grapheme. The taught nikkud is the **most
common true vowel sign** across those beats' graphemes. This works because the whole video teaches
one nikkud, so it dominates the isolated/cv units by construction.

```python
def detect_nikkud(beats: list[dict]) -> str:
    """Return the nikkud_data key the script teaches, auto-detected from the pointed units.

    For each isolated/cv/blend beat, split into graphemes (nikkud.graphemes) and tally
    nikkud_of(g) over the TRUE vowel signs (shva/dagesh/shin-dot are modifiers, skipped).
    The mode wins. Ties/empty -> 'kamatz' (the §1 first-taught, highest-frequency default).
    The result MUST be a key in nikkud_data.keys(); an unknown tally (e.g. only hataf signs,
    which are deferred) raises ValueError telling the author that sign isn't in v1.
    """
```

**Why a tally over isolated+cv+blend (not just isolated):** `isolated` is a single grapheme (one
sample), so a stray dagesh or a mater could skew it; pooling the CV beat (3–5 צירופים) makes the
detection robust. `word` is **excluded** — a whole word carries many vowels (e.g. `כָּל הַכָּבוֹד`
has patach + kamatz + cholam), which would pollute the tally.

**Worked example.** `isolated: בָּ`, `cv: בָּ מָּ קָּ`, `blend: בָּבָּא` → graphemes
`[בָּ]` + `[בָּ,מָּ,קָּ]` + `[בָּ,בָּ,א]` → vowel tally `{kamatz: 6}` → `"kamatz"`.

**[DECISION] Conflict with explicit front matter.** If `meta.nikkud` is present AND differs from
the detected key (e.g. author wrote `nikkud: patach` but the units are all kamatz), that is a real
authoring bug (the sign name and the pointed letters disagree). Recommended: **hard error**, not a
warning — teaching the wrong sign name to a 5-year-old is the worst-case bug (findings §3), and the
two disagreeing means one of them is wrong. Message shows both values + the tally.

### 2.3 `derive_units(beats, nikkudRow) -> list[dict]` (per-line units with roles)

**Behavior.** For each **unit-carrying** beat, produce the `units[]` (the highlight schedule's
*content*, not yet timed — timing is §2.5). This is where `nikkud.py`'s `graphemes()`/`syllabify()`
do the work, and where the script's words are **validated against the curriculum**.

```python
def derive_units(beats: list[dict], nikkud_row: dict) -> list[dict]:
    """Return one entry per unit-carrying beat:
        {"role": "isolated"|"cv"|"blend", "text": <beat text>, "units": [{"g":...}, ...]}

    isolated: units = [the single pointed grapheme]   (nikkud.graphemes(text) must be len 1)
    cv:       units = one entry per whitespace-separated צירוף token, each re-validated to be
              a single syllable (nikkud.syllabify(token) == [token])
    blend:    units = nikkud.syllabify(text)  — the word split into its צירופים for the sweep.
              If the word is a curriculum blendWords[] entry, the VETTED units win over the
              structural syllabify (nikkud_data is authoritative — nikkud.py docstring).

    VALIDATION (the 'decodable against the nikkud taught' gate):
      - every unit's nikkud_of() must equal the taught key OR be a mater/silent letter
        (a blend/word legitimately contains the unpointed final א in בָּבָּא);
      - if nikkud_row has a vetted cv/blendWords list, a unit NOT in it -> WARN (not error):
        the curriculum is a word-BANK now, not a closed gate (see note). Print the unit so the
        author can confirm the pointing.
    """
```

**Key design point — the curriculum becomes a reference, not a gate.** Today `nikkud_data.py` is the
*source* of the words. In the transcript-driven flow the **script supplies the words** and the
curriculum only (a) provides `sign`/`name_he`/`sound`/`musicBed`/`targetLetters` for the `reading{}`
block and (b) **cross-checks** the pointing. A script word that syllabifies cleanly and carries the
taught nikkud is accepted even if not in the vetted list — but it is **warned** so a human verifies
the pointing (the "human verifies every word" rule from findings §3 survives as a build warning +
the listening QA, not as a hard block). **[DECISION]** Hard-block non-vetted words? Recommended:
**no — warn.** Blocking would re-impose the closed-lexicon ceiling the user is trying to escape;
the safeguard against a wrong vowel is (1) the nikkud-tally detection, (2) the warning, (3) the
mandatory listening QA. The vetted `blendWords[].units` still **override** the structural split when
the word IS in the bank (authoritative split wins where it exists).

**Worked example (kamatz).** Inputs: the §1.1 beats + the kamatz row.

```python
[
  {"role": "isolated", "text": "בָּ", "units": [{"g": "בָּ"}]},
  {"role": "cv", "text": "בָּ מָּ קָּ",
   "units": [{"g": "בָּ"}, {"g": "מָּ"}, {"g": "קָּ"}]},
  {"role": "blend", "text": "בָּבָּא",
   "units": [{"g": "בָּ"}, {"g": "בָּא"}]},   # vetted blendWords split wins (בָּבָּא -> [בָּ, בָּא])
]
```

### 2.4 `build_reading(beats, units, nikkudRow, meta) -> dict` (reading.json)

**Behavior.** Produce the exact `reading.json` manifest `gen_voice_reading.py` consumes (id /
grapheme / sound / role, `syllables` on blend). This is a **mechanical reshaping** of `derive_units`
output into the manifest shape — one entry per unit, ids slugged, `voice`/`rate` from meta (or
defaults), and the blend entry carrying its `syllables` array.

```python
def build_reading(beats, units, nikkud_row, meta) -> dict:
    """Assemble reading.json:
      {"voice":..., "rate":..., "note": <provenance>, "units":[{id,grapheme,sound,role,...}]}
    ids: f"{role}-{slugify(strip_to_base(g))}-{i}" (unique, stable). sound = a latin
    transliteration label for the tile's showSoundLabel (see DECISION). blend entries carry
    "syllables": [the blend units' g strings]. word beats contribute a role:"word" entry with
    NO syllables (one continuous clip -> whole-word highlight, no units[]).
    """
```

**Manifest output for the §1.1 script** (matches today's hand-written `reading.json` shape):

```json
{
  "voice": "he-IL-HilaNeural",
  "rate": "-18%",
  "note": "AUTO-DERIVED by tools/make_reading.py from script.md. role in isolated|cv|blend|word. ...",
  "units": [
    { "id": "isolated-bet-0", "grapheme": "בָּ", "sound": "ba", "role": "isolated" },
    { "id": "cv-bet-0", "grapheme": "בָּ", "sound": "ba", "role": "cv" },
    { "id": "cv-mem-1", "grapheme": "מָּ", "sound": "ma", "role": "cv" },
    { "id": "cv-qof-2", "grapheme": "קָּ", "sound": "qa", "role": "cv" },
    { "id": "blend-baba-0", "grapheme": "בָּבָּא", "sound": "ba-ba", "role": "blend",
      "syllables": ["בָּ", "בָּא"] },
    { "id": "word-baba-0", "grapheme": "בָּבָּא", "sound": "baba", "role": "word" }
  ]
}
```

**[DECISION] The Latin `sound` label (for `showSoundLabel`).** Today `sound` is hand-written
(`"ba"`). Auto-transliterating pointed Hebrew → Latin is error-prone and off-brand for a Hebrew
product. Recommended: **derive a simple CV transliteration** (consonant letter → a fixed Latin
table, vowel → the nikkud's `sound`) for the *sound label only*, and let the author override any
label in front matter (`sounds: בָּ=ba, מָּ=ma`) if it reads wrong. Default: a small static map for
the common consonants; unknown letters fall back to the nikkud `sound` alone. The label is a
*pedagogic nicety*, never load-bearing — the pointed glyph is the content.

### 2.5 `build_beats(meta, beats, units, nikkudRow) -> dict` (beats.json)

**Behavior.** Assemble the full `beats.json` (mode:reading) — the top-level metadata, the
`reading{}` block, the `vo[]` lines with **PLANNED unit windows**, and the `beats[]` 6-beat
schedule. This is the piece that replaces the hand-written file.

```python
def build_beats(meta, beats, units, nikkud_row) -> dict:
    """Assemble beats.json:
      id/title/mode/language/series/composition/characterRef/musicBed/format/loop/notes
      reading{} = {nikkud, sign, sound, targetLetters, progression, anchorWords}
      vo[]      = one line per script beat, with PLANNED units[] on unit-carrying lines
      beats[]   = the visual beat schedule (name/start_s/end_s) in progression order
    Then run the internal scheduler (§2.6) to assign every start/end, and VALIDATE the
    result with contracts.validate_reading_beats before returning.
    """
```

**`reading{}` block** — pulled from the curriculum row + derived data:

```json
{
  "nikkud": "kamatz",
  "sign": "בָּ",
  "sound": "a",
  "targetLetters": ["בּ", "מ", "ק", "שׁ", "א"],
  "progression": ["isolated", "cv", "blend", "word"],
  "anchorWords": ["בָּבָּא"]
}
```

- `sign`/`sound`/`targetLetters` come from the **curriculum row** (the reference data that stays in
  `nikkud_data.py`). `targetLetters` is the row's vetted list (it drives nothing structural — it's
  display/QA metadata), but **[DECISION]** it could instead be *derived* from the script's CV units
  (the base letters actually taught). Recommended: **derive from the script's CV/isolated units**
  (`strip_to_base` each), falling back to the row's list when the script is minimal — the script is
  the source of truth, so the letters it teaches are the ones it uses. The row's list is the default
  word-bank hint, not authoritative here.
- `progression` is **derived from which unit-roles are present**, always starting at `isolated`, in
  the canonical order, validated as a suffix-or-full by the contract. A script with only
  `isolated`+`word` yields `["isolated","word"]` (the validator allows dropping middle steps).
- `anchorWords` = the `word` beats' text with trailing punctuation/`!` stripped (the words actually
  read whole).

**`vo[]` lines.** One per script beat, in encounter order, each `{beat, text, tts, start, end}` plus
`units[]` on the unit-carrying ones. `beat` = the canonical beat name (`hook`, `teach-isolated`,
`teach-cv`, `blend`, `read-word`, `call-response`). `text == tts == ` the pointed line. The
`call` line with `הִמְהוּם` gets `"pause": true` + the explanatory `note`.

### 2.6 The timing / scheduler

The scheduler assigns every `vo[].start/end` and `beats[].start_s/end_s`. These are **PLANNED
windows** — `gen_voice_reading.py` later **replaces** them with REAL trimmed bounds (planned windows
are scheduling targets seeded from the P0 probe trim table; the real windows are exact by
construction). This mirrors exactly how today's hand-written `beats.json` notes describe its units.

**Ordering (fixed):** `hook → teach-isolated → teach-cv → blend → read-word → call-response`. Where
a role repeats, its instances stay in encounter order within their beat group.

**Window model.** Each beat gets a window sized to its content plus a gap to the next beat:

| beat | planned content duration | gap after | rationale |
|---|---|---|---|
| `hook` | `est_tts(hook_text)` | ~0.3s | whole-line clip; estimated at ~2.7 words/s + slack (make-ad timing rule) |
| `teach-isolated` | onset(~0.3) + unit(~0.3) ≈ 0.6s + hold | to next beat | one unit, huge tile, let it breathe |
| `teach-cv` | `Σ(unit ≈0.3 + CV_GAP 0.55)` over the צירופים | to blend | matches gen_voice_reading's CV_GAP=0.55 staggering |
| `blend` | `Σ(syllable clip durations, back-to-back)` ≈ 0.6–1.2s + sweep hold | to read-word | back-to-back (no gaps = continuous blending, findings §1) |
| `read-word` | `est_tts(word_text)` | ~0.5s | one continuous clip |
| `call-response` | `est_tts(call_text)` + engineered pause ~2.5s | to end | the hum + real silence (short-18 trick) |

**Planned unit windows.** Within a unit-carrying line, each unit gets a planned `[start,end)`:
`start = line.start + cumulative_offset + PLANNED_ONSET`, `end = start + PLANNED_DUR`, seeded from
the P0 probe trim table (**onset ≈ 0.2–0.4s**, tight end ≈ 0.25–0.35s for a held single sound at
rate −18%). For `teach-cv`, offsets stagger by `prev_clip_dur + CV_GAP` (matching
`_place_cv`). For `blend`, offsets stack back-to-back by `probe_duration` (matching `_place_blend`).
These constants (`PLANNED_ONSET=0.3`, `PLANNED_UNIT_DUR=0.3`, `CV_GAP=0.55`) live at the top of
`make_reading.py` and **must stay in sync with `gen_voice_reading.py`'s `CV_GAP`** — **[DECISION]**
share the constant by importing it (`from gen_voice_reading import CV_GAP`)? Recommended: **yes,
import it** so the planned windows and the real placer never drift (single source for the gap).

**Total duration.** `format.durationSec = last_planned_speech_end + ~2.5s` (the dead-tail rule —
no round number). **[DECISION]** The planned duration is an estimate; after voice gen the REAL
last-speech-end is known and the duration should be re-derived. Recommended: `make_reading.py` sets
the planned duration, and `gen_voice_reading.py` already writes the real line `end`s back into
`beats.json` — but it does **not** today re-derive `format.durationSec` or `beats[]`. **Build task:
extend `gen_voice_reading.py`** to also re-derive `format.durationSec = last_speech_end + 2.5` and
stretch the final `call-response` beat's `end_s` to match (so the registered duration clears the
voice with no dead tail). This is the one small change to the existing voice tool the
transcript-driven flow needs. Default tail: **2.5s**.

**Validation.** `build_beats` ends by calling `contracts.validate_reading_beats` on the assembled
dict (written to a temp path or via a dict-accepting overload — **[DECISION]** add a
`validate_reading_beats_dict(d)` that the path-based wrapper delegates to, so the engine validates
in-memory without a temp file. Recommended: **add the dict overload**; keeps the path CLI for
humans). If validation fails the build fails with the contract message.

---

## 3. The generic data-driven composition

The goal: render **any** `mode:reading` `beats.json` without a hand-built comp. This replaces
`Read1Kamatz.tsx`'s bespoke beat-by-beat JSX with a renderer that walks `beats[]` + `vo[].units[]` +
the `reading{}` block.

### 3.1 ONE generic comp vs generated-per-video — the decision

**[DECISION] One generic renderer, or a generated comp per video?** Recommended: **ONE generic
renderer** (`remotion/src/lib/reading-render.tsx`) that takes the parsed `beats.json` + `vo.gen.ts`
as **props**, plus a **thin per-video wrapper** (§3.4) only because gen-registry needs a stable
`compositionConfig.id` and `durationInSeconds` per video.

**Justification (grounded in the plan/repo):**
- The pilot comp's beat structure is **already fully determined by the data**: which beats exist
  comes from `beats[]`; which tiles show comes from `vo[].units[]`; the look comes from
  `reading{sign,targetLetters}` + brand colors. `Read1Kamatz.tsx` contains **zero** data that isn't
  in `beats.json` except layout coordinates and the koala SVG — both of which are generic. So a
  single renderer loses nothing.
- A **generated-per-video** comp (gen a bespoke `.tsx` from the data) would re-introduce exactly the
  per-video hand-built surface this project is eliminating, and would put generated TSX under
  version control (drift, crash-rule violations). The repo's whole arc (the shared `shorts.tsx`
  Captions, the shared `reading.tsx` tiles) is *data drives a shared renderer*.
- The registry constraint is real but thin: gen-registry (`gen-registry.mjs`) scans
  `src/shots/**/*.tsx` for an exported `compositionConfig` with a unique `id` and a numeric
  `durationInSeconds`. A prop-driven generic comp still needs a per-video **file** to export that
  config — but that file is ~15 lines of pure wiring, **generated**, not hand-authored. That is the
  right trade: one generic renderer (the logic) + one generated stub (the registration).

### 3.2 `remotion/src/lib/reading-render.tsx` — the renderer

**Signature:**

```tsx
export const ReadingShort: React.FC<{
  beats: BeatsFile;   // the parsed beats.json (mode:reading) — reading{} + beats[] + vo[] + format
  vo: VoLine[];       // vo.gen.ts (per-word + per-unit REAL times; falls back to planned pre-voice)
}> = ...
```

**What it renders, per beat** (mapping the data to the existing `reading.tsx` tiles + `shorts.tsx`
Captions). It reads the global clock `t = frame/fps` once and switches on which beat window contains
`t`, exactly like the pilot — but the windows and tile content come from props, not constants.

- **Backdrop** — the warm kids radial gradient (same as pilot: indigo/violet + a teal pool). This is
  generic brand, not per-video. **[DECISION]** Per-nikkud accent color? Recommended: **keep the
  brand `COLORS.accent`/`COLORS.warn` for every video** (the sign's stable color and the "sounding
  now" pop are brand-consistent across the series; a per-nikkud hue would break the child's
  sign-recognition continuity). The `reading.sign` is drawn in `COLORS.accent`, the sounding pop in
  `COLORS.warn` — same as the pilot.
- **hook** — KoalaTile + the huge target `reading.sign` as a `GraphemeTile`, frame-0 fully composed
  (plan §1.4: frame 0 must be thumbnail-grade with the target sign visible). Reads `sign` from
  `reading{}`.
- **teach-isolated** — one `GraphemeTile` for the isolated unit's `g`, `soundWindow` = that unit's
  `[start,end)`, `showSoundLabel` with the derived label. Pops in exact sync with the sound (the
  product's promise).
- **teach-cv** — the line's `units[]` mapped to `SyllableTile`s, one per צירוף, laid out RTL
  (right-to-left columns), each with `soundWindow` = its own `[start,end)`. Tile positions derived
  from the unit count (`_cvSlots(n)` returns evenly-spaced x columns across the SAFE width). Each
  pops as spoken (touch-and-say, findings §1).
- **blend** — the blend units as `SyllableTile`s that **slide together** toward center over the beat
  window (the pilot's `slideP` interpolation, generalized to N syllables), `soundWindow` per unit so
  the highlight **sweeps** across as the stitched clips play back-to-back (continuous blending).
  When `t` passes the sweep, the assembled word appears below.
- **read-word** — the whole anchor word as one big pointed caption with the **whole-word pop**
  (existing Captions path — the line carries no `units[]`), plus the koala celebrating.
- **call-response** — "now you!" text, the engineered hum pause, **no tile highlight in the
  silence** (nothing lit while the child answers). If `loop:true`, settle back to the hook's frame-0
  pose; else just hold.
- **`<Captions lines={vo} ... plate rtl kidsNikkud />` + `<ProgressBar/>` at the ROOT** — the shared
  captions path (which already lights per-grapheme via the `units` folding in `attachUnits` /
  `graphemeSpans`) rides the whole video, exactly as the pilot does. **This is unchanged** — the
  generic renderer feeds it the same `vo` the hand-built comp did.

**Role → tile mapping (the core data→visual rule):**

| `vo[]` line beat | `units[]` present? | renderer shows |
|---|---|---|
| `hook` | no | koala + target sign tile (from `reading.sign`) |
| `teach-isolated` | yes (1) | `GraphemeTile(units[0].g, soundWindow=units[0])` |
| `teach-cv` | yes (N) | N `SyllableTile`s at `_cvSlots(N)`, each `soundWindow=units[i]` |
| `blend` | yes (N) | N `SyllableTile`s sliding together, `soundWindow=units[i]` (sweep) |
| `read-word` | no | whole-word caption pop |
| `call-response` | no | "now you!" + hum pause, nothing lit |

The renderer is **defensive**: if a `teach-*` line has no `units[]` yet (pre-voice, planned only),
it falls back to showing the tiles on the *planned* windows from `beats.json vo[].units[]` (which
`make_reading.py` wrote), so the comp renders correctly even before voice gen — and the Captions
units path already falls back to whole-word on any split mismatch (shorts.tsx §253, never a wrong
split).

### 3.3 Layout generalization (the only non-trivial new logic)

The pilot hardcodes 3 CV columns (`[810,540,270]`) and a 2-syllable blend slide. The generic
renderer must handle **N** צירופים and **M** blend syllables:

```ts
// _cvSlots(n, safeWidth) -> x-centers for n tiles, RTL (first unit rightmost), evenly spaced.
// _blendSlots(m, slideP, centerX) -> the m syllable x-positions interpolated from spread -> merged.
```

**[DECISION] Cap on N tiles?** A teach-cv beat with 5+ צירופים (the kamatz row has 5) crowds a
1080-wide canvas at tile size ~200. Recommended: **cap the on-screen tiles at 4 per row**; if the
line has more units, split into rows of ≤4 (tiles shrink to fit, min size ~140 for mark legibility —
findings §4/B sizes for the *mark's* legibility). Default max-per-row **4**. The blend sweep is
almost always 2–3 syllables (decodable CVC/CV words), so `_blendSlots` handles up to 4 without
crowding.

### 3.4 The thin per-video wrapper + registration

gen-registry requires a `.tsx` under `src/shots/<group>/` exporting a `compositionConfig` with a
unique `id` + numeric `durationInSeconds`. So `make_reading.py` **also emits a tiny wrapper**:

```
remotion/src/shots/read-N/ReadN<PascalNikkud>.tsx   (GENERATED — never hand-edited)
remotion/src/shots/read-N/vo.gen.ts                  (gen_voice_reading --emit-ts)
```

**Wrapper content (generated, ~18 lines):**

```tsx
import React from 'react';
import { ReadingShort } from '../../lib/reading-render';
import beats from '../../../reading-shorts/read-N-patach/beats.json';   // or a copied beats snapshot
import { VO } from './vo.gen';

export const compositionConfig = {
  id: 'Read2Patach',
  durationInSeconds: 38.0,   // from beats.json format.durationSec (re-derived after voice gen)
  fps: 30, width: 1080, height: 1920,
};
const Read2Patach: React.FC = () => <ReadingShort beats={beats} vo={VO} />;
export default Read2Patach;
```

**[DECISION] How does the wrapper import `beats.json`?** Two options:
(a) **relative import of the project `beats.json`** (shown above) — single source of truth, but the
    registered `durationInSeconds` is a *literal* in the generated file (gen-registry parses it by
    regex — `parseConfig` only reads literals), so the wrapper must be **regenerated** whenever
    `durationSec` changes (after voice gen re-derives it).
(b) **snapshot copy** of beats.json into the shots dir — drifts from the project file.
Recommended: **(a) relative import + regenerate the wrapper after voice gen.** `make_reading.py`
writes the wrapper with the *planned* duration; `gen_voice_reading.py` (extended per §2.6) rewrites
just the `durationInSeconds` literal (or re-invokes the wrapper-writer). Add a npm `gen` step note:
after any reading video's voice gen, re-run `npm run gen`. The `compositionConfig.durationInSeconds`
must stay ≈ last-speech-end + 2.5 (the registered-duration sanity check, plan §5).

**Registration across many videos.** Each video = one generated wrapper with a unique `id`, picked
up by `npm run gen` (gen-registry already maps `read-` → `faceless`, confirmed in
`gen-registry.mjs`). The **generic renderer is never registered itself** (it has no
`compositionConfig`); only the per-video wrappers are. No registry change needed. The
`shots/read-0-test/` pixel-gate fixture (`TileMark` grid) stays a separate hand-maintained comp —
it's a QA fixture, not a reading video, and is out of scope for the generic renderer.

---

## 4. Skill update — `.claude/skills/make-reading-short/SKILL.md`

The skill does not exist yet (confirmed absent). Write it modeled **byte-for-byte on
`make-ad/SKILL.md`'s stage structure**, but with the transcript as Stage 1's human gate. The full
skill text is a build task; this section is the authoritative outline + the exact stage contract.

**Front matter** (mirror make-ad's YAML): `name: make-reading-short`, a `description` covering
"teach a nikkud / Hebrew reading / kriya / decoding short, continue the read-N series",
`mode:"reading"` inheriting `mode:"kids"` (no CTA, calm) but relaxing the seamless loop, deferring
TSX crash rules to vidtsx-2d-generator, tiles to `lib/reading.tsx`, the renderer to
`lib/reading-render.tsx`, SFX to suggest-sfx + brand §7 kids variant. **Update the routing note**:
the track is now **transcript-driven** — the words come from the author's `script.md`, validated
against `tools/nikkud_data.py` (a reference/word-bank), not pulled from it.

**Artifact contract** (per video, parallel to make-ad's):

```
reading-shorts/read-N-<nikkud>/
  script.md      — THE AUTHORED INPUT: front matter + beat-tagged pointed lines (the human gate)
  reading.json   — DERIVED by make_reading.py (unit manifest for gen_voice_reading.py)
  beats.json     — DERIVED by make_reading.py (mode:reading + reading{} + vo[] planned units)
  curriculum.json— the resolved nikkud_data row snapshot (reference metadata; optional)
  voice/         — per-UNIT TTS clips + voice.wav  (gen_voice_reading.py)   [gitignored]
  sfx-plan.json  — cue sheet (kids flavor, library-first)
  output/        — read-N-<nikkud>-sfx.mp4                                 [gitignored]
remotion/src/shots/read-N/
  ReadN<Nikkud>.tsx — GENERATED thin wrapper (never hand-edit; registration only)
  vo.gen.ts         — AUTO-GENERATED VO with per-word AND per-unit times (never hand-edit)
```

**Stage contract** (the columns mirror make-ad's):

| Stage | reading-track form |
|---|---|
| **0 — interrogation** | **Which nikkud** + gather the **words the author wants to teach** (isolated sound, the CV set, 1–3 anchor/blend words). Confirm against the `nikkud_data.py` row (the reference word-bank) and flag any word the author wants that isn't vetted. State cost (edge-tts = $0; image gen only if בּוּ stills are wanted). |
| **1 — author the transcript** *(the human gate)* | Author `script.md`: front matter (`nikkud` optional — auto-detect) + one beat-tagged pointed line per beat (`hook:`/`isolated:`/`cv:`/`blend:`/`word:`/`call:`). **Register 5–7**: short directive prompts + call-and-response, NOT toddler cooing (findings §7). The pointed Hebrew must be correct — a wrong vowel is the worst-case bug. **This is the ONLY hand-authored content.** |
| **2 — derive** | Run `python tools/make_reading.py <script.md>` → derives `reading.json` + `beats.json` + the generated wrapper comp; validates against `validate_reading_beats`. Read the warnings (non-vetted words, missing hook/call defaults). No pixels yet. |
| **3 — composition** | Nothing to hand-build — the generic `ReadingShort` renderer reads the derived data. `cd remotion && npm run gen` registers the wrapper. (Only touch `lib/reading-render.tsx` if a *new* beat *kind* is needed — rare.) |
| **4 — QA** | `node scripts/qa_frames.mjs ReadN<Nikkud> 0,<beat-boundaries+each-unit-highlight>,<last> --scale=0.333`. READ every JPG. **Per-mark pixel gate** (findings §4) + highlight==sound frame-step + bidi + nikkud legibility + frame-0 composed. `validate_reading_beats` already gated Stage 2. |
| **5 — voice** | `.venv-voice312\Scripts\python.exe tools/gen_voice_reading.py --beats .../beats.json --reading .../reading.json --emit-ts remotion/src/shots/read-N/vo.gen.ts` → REAL trimmed unit windows replace the planned ones; wrapper duration re-derived; re-run `npm run gen`; re-render; mux via `ffw.ffmpeg`; `audio_gate.py`. **Listening QA** (findings §5) on the unit set. |
| **6 — SFX / music** | suggest-sfx kids flavor (playful boing/pop/sparkle under the voice); `kids-play-ukulele` bed (or the front-matter `musicBed`), hard-ducked. |

**Gates kept (non-negotiable):** the **per-mark pixel gate** (Stage 4) and the **listening QA**
(Stage 5) remain hard gates — auto-derivation does not waive them. The transcript makes authoring
fast; it does not make the marks or the pronunciation self-certifying.

**Done =** `script.md` authored (human-approved pointed Hebrew) · `make_reading.py` ran clean
(`reading.json`+`beats.json` derived, `validate_reading_beats` passes) · wrapper registered at the
right duration · QA frames read (marks legible, highlight==sound, bidi safe) · voice generated +
muxed + audio-gated + listening QA · SFX/music auditioned · cost stated ($0 unless בּוּ stills added).

---

## 5. Migration — the existing hand-built `read-1-kamatz`

**Can it be regenerated from a transcript?** Yes — almost fully. The §1.1 transcript *is* the
regeneration input; it is derived directly from the existing hand-built files (script.md's beat
table → the tagged lines). Running `make_reading.py` on it should reproduce:

- `reading.json` — **byte-comparable** to the committed one (same units, same roles). The ids will
  differ (slugged vs hand-named) — cosmetic.
- `beats.json` — **structurally identical** (same `reading{}`, same `vo[]` beats/texts, same
  `beats[]` schedule). The **planned unit windows will differ** from the committed file's — but the
  committed file's windows are *post-voice-gen REAL trimmed* values, while `make_reading.py` emits
  *planned* windows. After re-running `gen_voice_reading.py` on the derived manifest, the real
  windows come back (they're a deterministic function of the TTS clips + RMS trim).

**What is lossy / what the generic renderer does NOT reproduce from the hand-built comp:**

1. **Bespoke layout coordinates.** `Read1Kamatz.tsx` hardcodes exact pixel slots (`[810,540,270]`,
   `rightX/leftX` slide targets, per-beat `y` offsets, koala sizes per beat). The generic renderer
   computes equivalent slots via `_cvSlots`/`_blendSlots`. **Lossy in exact pixels, equivalent in
   layout.** The migrated video will look *slightly* different in spacing (evenly-computed vs
   hand-tuned) but pedagogically identical.
2. **Hand-written caption/sub-line texts.** The pilot has bespoke Hebrew sub-lines (`קָמָץ —
   אוֹמְרִים "אַא"`, `יוֹפִי! קָרָאתָ מִלָּה!`, `עַכְשָׁו אַתֶּם אוֹמְרִים!`) that are *not* in the
   transcript format. These are decorative reinforcement captions, not VO beats. **[DECISION]**
   Support optional per-beat `sub:` lines in the transcript? Recommended: **yes, add an optional
   `sub:` modifier** — a line `sub: <pointed text>` immediately following a role line attaches a
   static sub-caption to that beat (rendered under the tile, no highlight). This recovers the
   pilot's sub-lines without hand-TSX. Default: omit → no sub-caption.
3. **The koala's per-beat size changes** (250 hook / 210 isolated / 200 blend / 230 word). The
   generic renderer uses **one** koala size (recommend 220) for all beats — a deliberate
   simplification; the per-beat resizing was polish, not pedagogy.
4. **The two-layer nikkud-color overlay and the QA-gate font A/B** are **preserved** — they live in
   `lib/reading.tsx` (GraphemeTile/TileMark), which the generic renderer reuses unchanged.

**Migration verdict:** the *content and timing* migrate losslessly; the *exact hand-tuned pixels and
decorative sub-lines* migrate only if the `sub:` modifier is added. **Recommendation: add `sub:`,
then regenerate read-1-kamatz from the transcript as the engine's first acceptance test** (it
doubles as proof the engine reproduces a known-good video). Keep the original hand-built comp as
`read-1-legacy` only if a side-by-side pixel diff is wanted; otherwise delete it once the
regenerated version passes QA — a hand-built comp that the engine can reproduce is dead weight.

---

## 6. Acceptance checks

### 6.1 Engine (`tools/make_reading.py`)

1. **Parse floor:** the 4-line minimal script (§1.5) parses and derives a valid `beats.json` +
   `reading.json`; `validate_reading_beats` passes. Missing hook/call get defaults + a logged note.
2. **Auto-detect correctness:** the §1.1 script detects `kamatz`. A patach script (units בַּ מַּ קַּ,
   blend בַּבָּא→ wait, patach blend words differ — e.g. `אַבָּא` no; use a real patach word) detects
   `patach`. A script whose only vowels are a deferred sign (hataf) raises the "not in v1" error.
3. **Conflict hard-error:** `nikkud: patach` in front matter + kamatz-pointed units → non-zero exit
   naming both.
4. **Non-vetted word warning:** a script word not in the row's `blendWords` (but carrying the taught
   nikkud) → accepted + a printed warning, not an error.
5. **Idempotence:** re-run on unchanged script → byte-identical `reading.json` and planned
   `beats.json`. Re-run on a `beats.json` with `voiceStatus` set → refused without `--force`.
6. **Vetted blend split wins:** `blend: בָּבָּא` yields units `[בָּ, בָּא]` (the vetted split), and a
   structural-but-different syllabify does not override it.
7. **Contract gate:** a deliberately broken script (e.g. `cv` before `isolated`, or no `isolated`)
   fails validation with a precise message.

### 6.2 Generic comp (`lib/reading-render.tsx` + wrapper)

8. **Renders the pilot data:** fed the regenerated read-1 `beats.json` + `vo.gen.ts`, it produces
   the 6 beats with tiles popping in sync (frame-stepped QA: lit grapheme == spoken unit for every
   `units[]` window; no double-lit; nothing lit in the call-response silence).
9. **N-tile generalization:** a teach-cv beat with 2, 3, 4, and 5 צירופים lays out without overlap
   (≤4 per row, min size honored); a blend of 2 and 3 syllables sweeps correctly.
10. **Pre-voice render:** with only *planned* windows (no voice gen yet), the comp still renders the
    tiles on the planned schedule (no crash, no blank beat) — so QA can check layout before spending
    the (free) voice pass.
11. **Registration:** each wrapper registers with a unique id and a `durationInSeconds` ≈
    last-speech + 2.5s; `npm run gen` picks up N wrappers cleanly; the `read-` → `faceless` mapping
    holds.
12. **Back-compat:** every existing non-reading shot renders identically (the renderer is a new lib
    file; `shorts.tsx` and `reading.tsx` are not modified by this change).

### 6.3 Patach pilot (read-2-patach)

13. **Author-only-script:** a non-engineer writes `reading-shorts/read-2-patach/script.md`
    (front matter + ~6 tagged lines teaching פַּתָּח /a/ as kamatz's same-sound pair, per the §1
    order). No JSON, no TSX touched by hand.
14. **Full pipeline:** `make_reading.py` → `gen_voice_reading.py` → `npm run gen` → render → mux →
    `audio_gate.py` all run clean; the derived `beats.json` passes `validate_reading_beats`.
15. **Pixel + listening gates pass:** the patach mark (a horizontal bar under the letter) is legible
    at tile size in Heebo/Rubik (distinct from kamatz's "┴-like" shape — the per-mark gate, findings
    §4); edge-tts pronounces each isolated patach צירוף correctly (listening QA, findings §5). If
    the patach/kamatz marks are confusable at a glance, that is a *finding to surface*, not to
    silently ship.
16. **Same-sound pair framing:** since kamatz and patach are both /a/ (findings §1), the patach
    video should name-drop kamatz ("same sound, different sign") — check the authored hook/call
    carries this. (Content check, not engine.)

---

## 7. Build order + cost

> **Cost: $0.** No paid generation anywhere in this spec — the transcript, the engine, and the
> generic renderer are all local code; voice stays free edge-tts. State this before each build
> phase per repo rule. The only conceivable spend is optional בּוּ illustration stills (gen_image
> `--ref`), which this spec does not require.

**Phase A — the engine (no pixels).** `tools/make_reading.py` (parse_script, detect_nikkud,
derive_units, build_reading, build_beats, scheduler, validate) + the `validate_reading_beats_dict`
overload in contracts.py + the optional `sub:` modifier. *Gate: acceptance 1–7.* **$0.**

**Phase B — the generic renderer.** `remotion/src/lib/reading-render.tsx` (`ReadingShort`,
`_cvSlots`, `_blendSlots`, `sub:` support) + the wrapper-writer in `make_reading.py`. *Gate:
acceptance 8–12 against the regenerated read-1 data.* **$0.**

**Phase C — migrate the pilot.** Write the read-1 transcript (§1.1), run the engine, regenerate,
QA against the original. *Gate: the regenerated video passes the same QA the hand-built one did.*
**$0.**

**Phase D — the skill + patach pilot.** Write `.claude/skills/make-reading-short/SKILL.md` (§4),
then author read-2-patach via the new transcript-only flow. *Gate: acceptance 13–16.* **$0.**

**Sequencing note (the barrier):** A → B is sequential (the renderer needs the engine's wrapper +
data shape locked). C can start once A+B are green. D after C. **Max 2 parallel:** A and the
`sub:`/renderer-lib scaffolding can be drafted concurrently (different files), but the renderer's
data contract depends on the engine's emitted `beats.json` shape — so treat A's schema as the
barrier B builds against.

---

## 8. Consolidated DECISIONS for the build agent

| # | Decision | Recommended default |
|---|---|---|
| 1 | Accept Hebrew role keywords (`אות:`/`צירוף:`)? | Yes, optional aliases; docs default to ASCII |
| 2 | Blank lines = beat boundaries? | No — cosmetic only; a beat is one role line |
| 3 | Auto-inject `הִמְהוּם` hum if `call:` lacks it? | No — warn, let the human decide |
| 4 | Auto-generate missing hook/call? | Yes — default from the nikkud row, log it |
| 5 | Front-matter/auto-detect nikkud conflict | Hard error (never teach a wrong sign name) |
| 6 | Hard-block non-vetted script words? | No — warn; safeguards are detection + listening QA |
| 7 | `targetLetters` source | Derive from the script's CV/isolated units; fall back to the row |
| 8 | Latin `sound` label | Static CV transliteration map; author-overridable in front matter |
| 9 | Share `CV_GAP` between make_reading + gen_voice_reading | Yes — import it (single source) |
| 10 | Re-derive `durationSec` + `beats[]` tail after voice gen | Yes — extend gen_voice_reading (the one existing-tool change) |
| 11 | Validate in-memory | Add `validate_reading_beats_dict(d)`; keep the path CLI |
| 12 | One generic comp vs generated-per-video | ONE generic renderer + thin generated registration wrapper |
| 13 | Per-nikkud accent color? | No — brand accent/warn for the whole series (sign-recognition continuity) |
| 14 | Cap on-screen CV tiles | ≤4 per row, min size ~140 (mark legibility) |
| 15 | Wrapper imports beats.json how? | Relative import; regenerate the wrapper (duration literal) after voice gen |
| 16 | Per-beat decorative sub-captions | Add optional `sub:` transcript modifier |
| 17 | Koala per-beat resizing | Drop — one koala size (~220) for all beats |
| 18 | Keep hand-built read-1 comp? | Delete once the regenerated version passes QA (engine reproduces it) |

---

*Design grounded in `research/hebrew-reading/10-implementation-plan.md` + `00-findings.md` and the
verified pilot files (`reading-shorts/read-1-kamatz/*`, `remotion/src/shots/read-1/Read1Kamatz.tsx`,
`tools/{nikkud,nikkud_data,gen_voice_reading,contracts}.py`, `remotion/src/lib/{shorts,reading}.tsx`,
`remotion/scripts/gen-registry.mjs`). Compiled 2026-08-23.*
