# Phase 0 Sub-Plan — Reading-Track Foundations (no pixels)

**Scope.** Phase 0 builds the three foundational seams the reading track stands on — the nikkud
text engine, the beats contract validator, and the per-unit voice-timing generator — with **zero
pixels, zero composition, zero paid spend**. Master plan reference: `10-implementation-plan.md` §2
(Tooling) + §7 Phase 0. The WHY for every decision: `00-findings.md` §1 (pedagogy), §2 (timing),
§3 (nikkud tooling). Timing probe evidence: `01-subword-timing.md`.

**Phase 0 gate (both must hold before Phase 1 TSX):**
1. `validate_reading_beats` **validates** a hand-written `read-1-kamatz` beats.json.
2. The RMS energy trim returns **sane `[onset,end]`** on a probe clip (~0.2–0.4 s lead onset,
   tight end — matching `01-subword-timing.md` §Q2 probe table).

**Iron rules for this phase:** stdlib-only for the engine · edge-tts = $0 (free, no key) · run all
voice Python under `.venv-voice312\Scripts\python.exe` (py3.12.10 — edge-tts 7.2.8, soundfile,
numpy confirmed present) · ffmpeg/ffprobe **only** via `tools/ffw.py` (bare ffmpeg can emit a
SILENT track) · run everything from repo root · **do NOT touch remotion TSX, do NOT render, do NOT
spend money.**

---

## Deliverable 1 — `tools/nikkud.py` + `tools/nikkud_data.py` (stdlib-only)

The curated-lexicon + rule-engine decision (findings §3): vocabulary is a closed, teacher-vetted
set; **no live ML nakdan in the product path**. `nikkud_data.py` is the single source of truth —
the engine, the skill, and the validator all read it and never invent vowels.

### Files
- `tools/nikkud.py` — the engine (`unicodedata` only; any Python 3.10+).
- `tools/nikkud_data.py` — the curriculum lexicon (data only; imports nothing from the engine).
- `tools/test_nikkud.py` — the unit test (run, must pass).

### Engine signatures (master plan §2.1, exactly)
```python
NIKKUD     = range(0x05B0, 0x05C0)   # U+05B0–05BF (incl. shva U+05B0, dagesh U+05BC)
SHIN_DOT   = (0x05C1, 0x05C2)        # shin/sin dots stay with the letter
HEB_LETTER = range(0x05D0, 0x05EB)   # U+05D0–05EA incl. sofits

def graphemes(word: str) -> list[str]      # letter + following combining Mn marks; dagesh & shin/sin dots stay INSIDE
def syllabify(word: str) -> list[str]      # greedy-left CV/CVC into צירופים; maqaf/whitespace = hard boundaries
def strip_to_base(g: str) -> str           # grapheme -> bare letter (for grouping)
def nikkud_of(g: str) -> str | None        # grapheme -> vowel-sign name (e.g. "kamatz") or None
def has_dagesh(g: str) -> bool
```

### Segmentation spec (findings §3 — the load-bearing rules)
- Grapheme = one HEBREW LETTER + its following combining marks (`unicodedata.combining(ch) > 0`).
- Nikkud block = U+05B0–05BF + shin/sin U+05C1–05C2. **Dagesh U+05BC stays in the grapheme** (ב vs בּ
  is pedagogically load-bearing). **Holam haser U+05BA = holam.** Kubutz U+05BB vs shuruk (= vav +
  dot) — shuruk is **not** a separate grapheme. Exclude cantillation U+0591–05AF, U+05C4–05C5.
- Syllables: greedy-left CV/CVC. Shva na/nach is the hard case (initial/after-full-vowel → נע;
  identical-consonants/word-final → נח; else lexicon flag). Matres (א ה ו י) resolved from nikkud.
  Maqaf (U+05BE) and whitespace = hard boundaries; geresh/gershayim preserved as punctuation.

### Curriculum data (master plan §4 — exact kamatz row, rest are stubs for later phases)
`CURRICULUM` is a list; **kamatz is `order:1`** with the full vetted row:
```python
{ "order":1, "key":"kamatz", "sign":"בָּ", "name_he":"קָמָץ", "sound":"a",
  "targetLetters":["בּ","מ","ק","שׁ","א"],
  "cv":["בָּ","מָּ","קָּ","שָׁ","אָ"],
  "blendWords":[ {"word":"אַבָּא","units":["אַ","בָּא"]},
                 {"word":"מָמָא","units":["מָ","מָא"]},
                 {"word":"בָּבָּא","units":["בָּ","בָּא"]} ],
  "mnemonic": None,                 # ⚠ findings §2/E — do NOT fabricate
  "musicBed":"kids-play-ukulele" }
```
Plus the remaining rows as **`order`-only stubs** (patach … dagesh-kal, orders 2–9, marked
`"status":"stub"` / deferred notes for hataf + kamatz-katan) so the validator's key lookup has the
full introduction-order skeleton. **`mnemonic` is `None` everywhere — never fabricated.**
Helper: `def get_nikkud(key) -> dict | None` (validator + engine read through this).

### Acceptance checks (Deliverable 1)
- [ ] `graphemes("בָּבָּא")` == `["בָּ","בָּ","א"]` (dagesh+nikkud kept inside each grapheme).
- [ ] `graphemes` on every kamatz `cv` item returns exactly 1 grapheme.
- [ ] `syllabify` on each kamatz `blendWords[].word` == its `units` list (lexicon agreement).
- [ ] `strip_to_base("בָּ")` == `"ב"`; `nikkud_of("בָּ")` == `"kamatz"`; `has_dagesh("בָּ")` is False, `has_dagesh("בּ")` is True.
- [ ] `python tools/test_nikkud.py` exits 0 and prints PASS for every kamatz-lexicon case.
- [ ] Engine runs under plain `python` (3.10+, no venv needed) — proves stdlib-only.

---

## Deliverable 2 — `tools/contracts.py`: `validate_reading_beats`

Copy-pattern = `validate_ad_beats` (wrap `validate_beats` base + layer the mode-specific block).
Existing validators ignore unknown keys, so this is **additive and non-breaking**.

### Behavior (master plan §1.3 contract rules + §5 step 4)
1. Run base `validate_beats(path)` (id/title/format/vo, beats[] if present).
2. Require `mode == "reading"` and `language == "he"`.
3. Require a `reading{}` block; `reading.nikkud` **must be a key present in `nikkud_data.CURRICULUM`**
   (validator imports `nikkud_data` — the single source of truth, so they cannot drift).
4. `reading.progression` must be the 4 steps `["isolated","cv","blend","word"]` in order, **or a
   suffix** of them (e.g. a דגש video may drop `cv`) — but `isolated` is **always present, always first**.
5. The 4 canonical beats (`teach-isolated`, `teach-cv`, `blend`, `read-word`) must appear in
   `beats[]` **in progression order** (those not in `progression` may be absent — e.g. no `cv` → no
   `teach-cv` beat required; the present ones must still be ordered correctly).
6. **Conditional units audit** (mirrors the ad timing-audit's conditional gate): when any `vo[]`
   line carries `units[]`, each unit must be `{g, start, end}` with numeric `start < end`, units
   **sorted, non-overlapping**, and **⊆ the parent line's `[start,end]` span**. Lines whose beat is
   an isolated/CV teach beat **must carry `units[]` once voice data exists** (i.e. if ANY line has
   units, teach-isolated/teach-cv lines may not be unit-less). Lines without `units[]` (blend/word)
   are legal — they fall back to whole-word highlight.

### Registration
- Add `"reading-beats": validate_reading_beats` to `_VALIDATORS`.
- Update the `main()` usage string to include `reading-beats`.

### Acceptance checks (Deliverable 2)
- [ ] A **good** hand-written `read-1-kamatz` beats.json (mode/language/reading{}/progression +
        the 4 beats in order + a teach-isolated line WITH units[]) → `validate_reading_beats` returns None (PASS).
- [ ] A **deliberately-broken** fixture (e.g. wrong mode, missing reading block, progression not
        starting at isolated, beats out of order, or units unsorted/overlapping/out-of-span) → raises
        `ValueError` with a precise message (FAIL). Test at least: bad mode; bad progression order;
        beats out of order; units overlapping.
- [ ] CLI: `python tools/contracts.py reading-beats <good.json>` prints OK; on the broken fixture prints `CONTRACT FAIL [reading-beats]: …`.

---

## Deliverable 3 — `tools/gen_voice_reading.py` (~80 lines, reuses gen_voice_edge plumbing)

The heart of the timing guarantee (findings §2 + master plan §2.2). **Imports and reuses**
`gen_voice_edge` (`_tts`, `probe_duration`, `run`, `emit_ts` shape, hash-caching, ffw resolution) —
does not duplicate it. Runs under `.venv-voice312`.

### Input: `reading.json` (the unit manifest)
```jsonc
{ "voice":"he-IL-HilaNeural",
  "units":[ {"id":"kamatz-bet","grapheme":"בָּ","sound":"ba","role":"isolated"},
            {"id":"word-baba","grapheme":"בָּבָּא","sound":"baba","role":"word"} ] }
```
`role ∈ isolated | cv | blend | word`. (Letter-naming units may set `say:"characters"` — v1 not needed.)

### Per-unit pipeline (master plan §2.2)
For each unit:
1. edge-tts synth the unit's **own clip** (`WordBoundary` gives a coarse window only), at a slowed
   global `--rate` (default `-18%`) so the single sound is held/stretched (per-clip global prosody
   sidesteps edge-tts's missing per-word SSML — findings §5).
2. **Energy-trim** the clip → exact `[onset,end]` via `_rms_trim`.
3. Write `vo[].units[] = [{g, start, end}]` into beats.json — `start = beat_offset + onset` (the
   unit's absolute timeline position = its line's scheduled `start` + the trimmed onset within the clip).

Beat roles:
- **isolated / cv** → one clip per unit → `units[]` with real trimmed windows.
- **blend** → synth each syllable as its own clip, trim, schedule **back-to-back at known offsets
  (NO gaps = continuous blending, findings §1)** → deterministic per-syllable unit times, no aligner.
- **word** → one continuous clip → **no `units[]`** (existing whole-word Captions highlight already correct).

### `_rms_trim` (master plan §2.2, ~15 lines, numpy + soundfile in the venv)
```python
def _rms_trim(path: str, thresh: float = 0.15) -> tuple[float, float]:
    """numpy RMS energy trim. edge-tts pads ~0.22–0.40s lead / ~1.05s trail, VARYING per clip
    (01-subword-timing §Q2 probe table) — NO fixed global offset is safe, so measure it.
    Returns [onset,end] where the RMS envelope first/last exceeds `thresh` * peak."""
```
Edge-tts emits mp3; decode to wav via ffw-resolved ffmpeg, read with soundfile, compute a short-window
RMS envelope, threshold at 15% of peak, take first/last crossing. Returns absolute seconds in the clip.

### CLI (mirrors gen_voice_edge)
```
--beats <beats.json> --reading <reading.json> --emit-ts remotion/src/shots/read-N/vo.gen.ts
   [--mux out.mp4] [--dry-run] [--force] [--rate -18%]
```
`--emit-ts` writes a `vo.gen.ts` whose `VoLine[]` also carries the optional `units: [{g,start,end}]`
array (extend the emitted TS — Phase 1 will extend the `VoLine`/`TimedWord` types in shorts.tsx to
match; here we only emit the data). Library-first: per-unit clips cached by (voice, rate, unit-hash);
`--force` regenerates. `--dry-run` prints the plan only.

### Acceptance checks (Deliverable 3)
- [ ] On a **2-unit probe** (`reading.json` with `בָּ` isolated + `בָּבָּא` word), `_rms_trim` returns
        **sane bounds**: onset ≈ 0.2–0.4 s (lead-silence region per the §Q2 probe table: בָּ onset 0.270,
        בָּבָּא onset 0.220), end tight (no ~1.05 s trailing pad). Print and eyeball against the table.
- [ ] The trimmed window is a strict sub-interval of the clip duration; `0 <= onset < end <= clipDur`.
- [ ] `--emit-ts` produces a `vo.gen.ts` containing `units: [{ g: 'בָּ', start: …, end: … }]` with
        absolute times (line.start + onset).
- [ ] `--dry-run` runs clean without synthesizing (plan only). edge-tts synth = **$0** (free, no key).

---

## Order of work + verification
1. `nikkud.py` + `nikkud_data.py` + `test_nikkud.py` → run test (stdlib python, exits 0).
2. `contracts.py validate_reading_beats` + good/broken fixtures → good passes, broken fails, CLI both ways.
3. `gen_voice_reading.py` → probe trim on the 2-unit manifest under `.venv-voice312` → sane bounds + emit-ts.

**Out of scope (Phase 1+):** any TSX (`lib/reading.tsx`, Captions `units` path, GraphemeTile), the
per-mark pixel QA gate, registration, rendering, muxing a real comp, music/SFX. This phase proves the
three seams in isolation. **$0 total.**
