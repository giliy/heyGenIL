---
name: make-reading-short
description: Build a HEBREW READING / decoding short (1080×1920, ~30s) that teaches one nikkud (vowel sign) to ages 5–7, SCRIPT-FIRST — the human authors a pointed-Hebrew transcript (script.md) and the engine derives everything else. Use when the user wants to "teach a nikkud", "make a Hebrew reading short", "make a kriya/decoding short", "teach patach/kamatz/etc", or continue the read-N series in this repo. This is the READING track (mode:"reading", language:"he"): the on-screen pointed letter/צירוף highlights in EXACT sync with the spoken unit (one level finer than whole-word). Inherits mode:"kids" (no CTA, calm) but RELAXES the seamless loop (a one-shot lesson; the call-and-response is the payoff). The transcript (script.md) is the SINGLE SOURCE OF TRUTH — beats.json, reading.json, and the comp are all DERIVED, never hand-written. Defers TSX crash rules to vidtsx-2d-generator, the reading tiles to lib/reading.tsx, the ONE generic renderer to lib/reading-render.tsx, SFX taste to suggest-sfx + brand §7 (kids variant). Words come from the AUTHOR'S script.md, validated against tools/nikkud_data.py (a reference/word-bank, not a closed gate).
---

# make-reading-short — transcript-driven Hebrew reading shorts

> **Multi-agent mode:** to run this through the pinned specialist agents with a small
> main-session context, defer orchestration to the **`orchestrate`** skill. The stages below are
> the same work done inline when you are NOT using the router.

The reading track is **SCRIPT-FIRST**. A reading short teaches ONE nikkud (vowel sign) to a
5–7 year old: the child hears a unit, sees the pointed letter (e.g. בַּ) light up **in exact sync**
with its sound, then blends syllables into a whole word. Today each video was hand-built
(`beats.json` + `reading.json` + a bespoke TSX comp). **This skill replaces that**: the author
writes ONE file — `script.md`, a pointed-Hebrew transcript with beat-tagged lines — and
`tools/make_reading.py` DERIVES the unit manifest (`reading.json`), the `beats.json`
(mode:reading + `reading{}` + `vo[]` with planned unit windows), the target letters, and the thin
generated registration wrapper. One generic renderer (`remotion/src/lib/reading-render.tsx`)
consumes ANY `mode:reading` `beats.json` — no per-video hand-built comp. The voice/timing/mux/QA
pipeline is unchanged (gen_voice_reading.py replaces planned windows with REAL trimmed bounds).

**Read the authoritative spec first:** `research/hebrew-reading/transcript-driven-design.md`
(the format + engine + renderer + every DECISION). The reference pilot is
`reading-shorts/read-1-kamatz/` and the transcript-driven proof is `reading-shorts/read-2-patach/`.

Run everything from the **repo root**. `ffmpeg`/`node` on PATH. Voice = edge-tts (free, no key).
API keys in `.env` are NOT needed for a reading short — everything is local + free edge-tts.

## Artifact contract

```
reading-shorts/read-N-<nikkud>/
  script.md       — THE AUTHORED INPUT: front matter + beat-tagged pointed lines (the human gate)
  reading.json    — DERIVED by make_reading.py (unit manifest for gen_voice_reading.py)
  beats.json      — DERIVED by make_reading.py (mode:reading + reading{} + vo[] planned units)
  curriculum.json — the resolved nikkud_data row snapshot (reference metadata; optional)
  voice/          — per-UNIT TTS clips + voice.wav  (gen_voice_reading.py)   [gitignored]
  sfx-plan.json   — cue sheet (kids flavor, library-first)
  output/         — read-N-<nikkud>-sfx.mp4                                  [gitignored]
remotion/src/shots/read-N/
  ReadN<Nikkud>.tsx — GENERATED thin wrapper (never hand-edit; registration only)
  vo.gen.ts         — AUTO-GENERATED VO with per-word AND per-unit times (never hand-edit)
```

Shared kit: `remotion/src/lib/shorts.tsx` (Captions RTL units path, SAFE) + **`lib/reading.tsx`**
(GraphemeTile / SyllableTile / TileMark) + **`lib/reading-render.tsx`** (the ONE generic
`ReadingShort` renderer). Only touch `reading-render.tsx` if a NEW beat KIND is needed (rare).

## Stage 0 — interrogation (the human gate, before any pixels)

**Which nikkud + which words.** Ask, don't assume. Collect, in one pass:

- **the nikkud** (from `tools/nikkud_data.py keys()`: kamatz, patach, tzere-segol, chirik, cholam,
  shuruk, kubutz, shva, dagesh-kal). The current fully-vetted rows are kamatz + patach; the rest
  are introduction-order stubs you may teach from the curriculum's `sign`/`sound`/`name_he`.
- **the words the author wants to teach**: the isolated sound (one pointed grapheme), the CV set
  (3–5 צירופים, e.g. בַּ מַּ גַּ דַּ), and 1–3 anchor/blend words.
- Confirm against the `nikkud_data.py` row (the reference word-bank) and **flag any word the
  author wants that isn't vetted** — it ships (with a build warning + the mandatory listening QA),
  it does not block. The curriculum is a reference, not a closed gate.

**State cost before building: $0.** edge-tts = free; no ElevenLabs/FAL/Gemini/Azure; in-TSX koala
(no AI stills). The only conceivable spend is optional בּוּ illustration stills (gen_image
`--ref`), which this skill does not require.

**Same-sound pair framing (patach/kamatz both /a/):** when teaching a sign that shares a sound
with one already taught (patach after kamatz), the hook/call should name-drop the pair
("אוֹתוֹ צְלִיל כְּמוֹ קָמָץ" — same sound, different sign). Content check, not engine.

## Stage 1 — author the transcript (the human gate, the ONLY hand-authored content)

Author `reading-shorts/read-N-<nikkud>/script.md`: optional front matter + ONE beat-tagged pointed
Hebrew line per beat. This is the **only** hand-written content; everything else is derived.

**Front matter** (all optional, defaults in bold — see design §1.2):
`nikkud:` (auto-detected from the pointed units if absent) · `title:` (default derived from the
nikkud) · `musicBed:` (**kids-play-ukulele**) · `loop:` (**false** — reading relaxes the seamless
loop) · `voice:` (**he-IL-HilaNeural**) · `rate:` (**-18%**) · `sounds:` (override a Latin
sound-label, e.g. `בַּ=ba`) · `composition:` / `id:` (derived).

**Body — one line per beat, role keyword + colon + pointed Hebrew.** Blank lines are cosmetic.
`#` starts a comment. The canonical 6-beat ladder (design §1.3):

| role | aliases | realized beat | carries units? |
|---|---|---|---|
| `hook` | intro, פתיחה | hook | no (whole-word) |
| `isolated` | letter, sound, אות | teach-isolated | yes (1 grapheme) |
| `cv` | syllables, syllable, צירוף, צירופים | teach-cv | yes (1 per צירוף) |
| `blend` | מיזוג | blend | yes (1 per syllable, sweep) |
| `word` | read, מילה | read-word | no (whole-word pop) |
| `call` | response, call-response, תורכם | call-response | no (pause) |

Plus an optional **`sub:`** line immediately after a role line — a decorative reinforcement
sub-caption (no highlight), recovering the pilot's sub-lines (design §5 decision 16).

**The 4-line floor is fully shippable** (missing `hook`/`call` get engine defaults + a logged note):
```
isolated: בַּ
cv: בַּ מַּ גַּ דַּ
blend: דַּדַּ
word: גַּם!
```

**Register 5–7**: short directive prompts + call-and-response, NOT toddler cooing (findings §7).
**The pointed Hebrew MUST be correct — a wrong vowel is the worst-case bug** (findings §3). The
engine's per-phoneme cross-check warns on a genuinely different vowel sound, but the human gate is
you + the listening QA.

**Blend-word caveat (patach):** in real Hebrew almost every 2-syllable patach word ends in kamatz
(אַבָּא, דַּדָּא, גַּמָּא). The blend sweep MUST model the taught sign (it is the highlight-sync
payoff), so use a patach CV+CV cluster (דַּדַּ → `[דַּ, דַּ]`, or גַּמַּ) for the blend, and a REAL
single patach word (גַּם / דַּג / בַּר) for the read-word anchor. The engine's vetted
`blendWords[].units` split wins where the word is in the bank.

## Stage 2 — derive (no pixels)

Run the derivation engine on the transcript:
```
python tools/make_reading.py reading-shorts/read-N-<nikkud>/script.md
    [--out-dir reading-shorts/read-N-<nikkud>] [--nikkud <key>] [--force] [--dry-run]
```
It writes `reading.json` + `beats.json` (mode:reading, `reading{}` block, `vo[]` with **planned**
unit windows) + `curriculum.json` + the thin generated wrapper comp, and validates against
`validate_reading_beats_dict` (in-memory) before writing. **Read the warnings** (non-vetted words,
missing hook/call defaults). Exit 0 + `OK` = contracts pass. `--force` is needed to re-run after
voice gen (the real-timing guard).

**The nikkud is auto-detected** by tallying the true vowel signs over the isolated/cv/blend units
(word beat excluded — it mixes vowels). A front-matter `nikkud:` that disagrees with the detected
units is a **HARD error** (never teach a wrong sign name).

## Stage 3 — composition (nothing to hand-build)

The generic `ReadingShort` renderer reads the derived data — no per-video comp to write.
Register the generated wrapper:
```
cd remotion && npm run gen
```
gen-registry picks up the wrapper's `compositionConfig.id` (`ReadN<Nikkud>`) + numeric
`durationInSeconds`. (Only touch `lib/reading-render.tsx` if a NEW beat kind is needed — rare.)

## Stage 4 — QA (do not skip)

```
cd remotion && node scripts/qa_frames.mjs ReadN<Nikkud> 0,<beat-boundaries+each-unit-highlight>,<last> --scale=0.333
```
READ every small JPG (phone scale). **Per-mark pixel gate** (findings §4): the nikkud mark is
legible at tile size in Heebo/Rubik and distinct from the other signs (patach = a horizontal bar
under the letter; kamatz = a "┴-like" T). **Highlight==sound frame-step**: the lit grapheme is the
spoken unit for every `units[]` window (the isolated pop, each CV touch-and-say, the blend sweep)
· no double-lit · RTL order (first unit rightmost) · frame-0 composed (hook = koala + target sign
visible) · nothing lit in the call-response silence. `validate_reading_beats` already gated Stage 2.

**Release gate (P1 #19 — the human "would a parent trust this / does it teach correctly" review):**
```
python tools/release_gate.py reading reading-shorts/read-N-<nikkud>/beats.json
```
Prints the reading-track rubric (FATAL: taught sound correct + highlight==phoneme word-exact + calm;
CRITICAL: genuine 2-4s pause, correct nikkud, one-nikkud ladder, parent-safe, warm) and runs the
objective sub-checks (pause, audio gate when `--audio` given). Answer the rubric honestly before the
full render; any NO = fix first. This institutionalizes the "is it good" judgment — the machine
gates (validate_reading_beats, pause validator, per-mark pixel gate) handle mechanics; this is craft.

## Stage 5 — voice + render + mux + audio gate

```
.venv-voice312\Scripts\python.exe tools/gen_voice_reading.py --beats reading-shorts/read-N-<nikkud>/beats.json \
    --reading reading-shorts/read-N-<nikkud>/reading.json --emit-ts remotion/src/shots/read-N/vo.gen.ts --rate -18%
```
It synthesizes each unit with edge-tts, trims it by numpy RMS energy → REAL per-unit highlight
windows written back into `beats.json` + `vo.gen.ts`, re-derives `format.durationSec` = last speech
+ 2.5s (kills the dead tail), re-stamps the wrapper's duration literal. **Re-run `npm run gen`**,
then render + mux + gate:
```
cd remotion && node scripts/render-all.mjs ReadN<Nikkud> --scale=1
python -c "import sys,os;sys.path.insert(0,'tools');import ffw;ffw.ffmpeg('-y','-i','remotion/out/<Id>.mp4','-i','reading-shorts/.../voice/voice.wav','-map','0:v','-map','1:a','-c:v','copy','-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-shortest','remotion/out/<Id>-voiced.mp4')"
python tools/audio_gate.py remotion/out/<Id>-voiced.mp4      # must PASS
```
Then **master for delivery** (after the SFX/music pass in Stage 6 — always the last audio step).
`tools/master.py` normalizes the speech band to ~−13 LUFS and brickwall-limits the true peak to
−1 dBTP (kids videos land a touch quieter on integrated LUFS because the call-and-response gaps
are meant to be quiet — that is correct). `python tools/master.py <final-mix.mp4>` then gate:
`python tools/audio_gate.py --delivery-report <final-mix>-master.mp4` (must PASS, no clip).
Ship the `-master.mp4`.
**Listening QA** (findings §5) on the unit set: edge-tts pronounces each isolated patach/kamatz
צירוף correctly. If the patach/kamatz marks are confusable at a glance, that is a **finding to
surface**, not to silently ship.

## Stage 6 — SFX / music (optional, kids flavor)

Library-first. Author `reading-shorts/read-N-<nikkud>/sfx-plan.json` (kids flavor: playful
sparkle/pop/chime under the voice, cue times from the REAL unit onsets in `vo.gen.ts`), then:
```
PYTHONIOENCODING=utf-8 python tools/mix_sfx.py reading-shorts/read-N-<nikkud>/sfx-plan.json --print
PYTHONIOENCODING=utf-8 python tools/mix_sfx.py reading-shorts/read-N-<nikkud>/sfx-plan.json
```
Music: `python tools/mix_music.py --bed kids-play-ukulele --base remotion/out/<Id>-sfx.mp4 --out remotion/out/<Id>-final.mp4`
(the front-matter `musicBed`, hard-ducked under the voice). Re-run `audio_gate.py` on the final.

## Done =

`script.md` authored (human-approved pointed Hebrew) · `make_reading.py` ran clean (`reading.json` +
`beats.json` derived, `validate_reading_beats` passes) · wrapper registered at the right duration ·
QA frames read (marks legible, highlight==sound, bidi safe, frame-0 composed) · voice generated +
muxed + audio-gated + listening QA · SFX/music auditioned · cost stated (**$0** unless בּוּ stills
added).
