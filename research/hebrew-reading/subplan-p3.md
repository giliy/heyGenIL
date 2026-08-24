# Sub-plan P3 — voice + finish (read-1-kamatz pilot)

**Gate doc — written FIRST, before any execution (master plan §7 Phase 3, §6 acceptance; findings §5).**
Phase 3 closes the loop: it fills `vo[].units[]` with REAL trimmed edge-tts clip bounds (the exact
sub-word highlight schedule — the product's promise), re-syncs the comp, muxes the voice, and gates
the audio. **Cost: $0** — edge-tts is free, no key; no paid generation anywhere in this phase.

Inputs that already exist (P0/P1/P2 green): `tools/gen_voice_reading.py`, `tools/contracts.py
validate_reading_beats`, `tools/audio_gate.py`, `remotion/src/lib/reading.tsx` +
Captions `units` path, the authored `reading-shorts/read-1-kamatz/{curriculum,script,reading,beats}.json`,
and `remotion/src/shots/read-1/{Read1Kamatz.tsx, vo.gen.ts (placeholder)}`.

---

## 0. What P3 must prove (acceptance, from master plan §6)

1. `validate_reading_beats` PASSES post-voice (units audit: numeric, sorted, non-overlapping, ⊆ parent).
2. Frame-stepped QA: lit grapheme == spoken unit for every `units[]` window (P2 already PASSED the
   geometry; P3 re-syncs the *times*, so we re-render at scale=1 and re-read key frames).
3. **Listening QA (findings §5, mandatory):** confirm edge-tts pronounces each isolated pointed
   syllable correctly — esp. בָּ = kamatz /a/. Any mispronounced unit → FLAG for the conditional
   Azure SSML path (do NOT spend).
4. `audio_gate.py` PASSES on the muxed file (non-silent).
5. Registered duration ≈ last-speech + ~2.5s (no dead tail, no truncation).
6. Cost reported = $0.

---

## 1. The one real risk found in P3 prep (must fix before running)

Reading `gen_voice_reading.py` against the P2 comp surfaced a **CV-overwrite defect** that would
break the pilot if run as-is:

- `Read1Kamatz.tsx` does `const CV_UNITS = VO[2].units!;` then `CV_UNITS.map(...)` over **three**
  צירופים (בָּ / מָּ / קָּ), each popping on its own window (findings §1: teach CV one-at-a-time).
- But `gen_voice_reading.py`'s loop maps every `role:"cv"` unit to the SAME `teach-cv` vo[] line and
  does `line["units"] = [ {that one unit} ]` — so each CV unit **overwrites** the previous. Only
  קָּ (the last) would survive → `CV_UNITS` would be length-1 → the comp renders one tile, not three,
  and two of the three sounds have no highlight. That silently breaks the product's promise.

**Fix (small, in `gen_voice_reading.py`):** accumulate CV units per line instead of overwriting, and
**stagger** them sequentially within the beat window (each CV is its own clip, scheduled back-to-back
with a small inter-syllable gap so each is heard as a *distinct* צירוף — this is the teach beat, NOT
the continuous blend; the blend beat keeps no-gap stitching per findings §1). Same accumulate-and-
stagger shape as the blend path, but with a `CV_GAP ≈ 0.55s` between unit *starts* of speech so a
5-7yo hears "ba … ma … qa" as three separate sounds. The blend path stays gap-free (continuous
blending). `line["end"]` for teach-cv = last unit's end (so the units-⊆-parent audit passes).

This is the ONLY logic change. Everything else reuses the proven P0 probe path (`_rms_trim`,
`_synth_unit`, hash-cache, ffw resolution) unchanged. No regression risk to short-18 (reading tool
is separate from `gen_voice_edge.py`).

Sanity bounds I'll assert on the trimmed windows (from the P0 probe table, findings §1):
onset lands in the ~0.2–0.4s lead-silence region, end is tight (no ~1.05s trailing pad), each unit
span is a few hundred ms (a held /a/ at rate -18% ≈ 0.5–0.9s), units within a line sorted +
non-overlapping.

---

## 2. Execution steps (in order)

1. **Patch `gen_voice_reading.py`** — accumulate + stagger CV units (§1). Keep isolated/blend/word
   paths as-is. Add a per-run stdout table of every trimmed unit window for the sanity check.
2. **Run voice gen** (under `.venv-voice312`, edge-tts $0):
   ```
   .venv-voice312/Scripts/python.exe tools/gen_voice_reading.py \
     --beats reading-shorts/read-1-kamatz/beats.json \
     --reading reading-shorts/read-1-kamatz/reading.json \
     --emit-ts remotion/src/shots/read-1/vo.gen.ts --rate -18%
   ```
   This writes REAL per-unit trimmed `[start,end]` into `beats.json vo[].units[]` and emits
   `vo.gen.ts` (overwriting the P2 placeholder; the comp re-syncs with no code change). It also
   drops per-unit clips into `reading-shorts/read-1-kamatz/voice/`.
3. **Spot-check `beats.json`** — every `units[]` entry sane: ~0.2–0.4s onset offset per clip, tight
   ends, sorted, non-overlapping, ⊆ parent line span; teach-cv has 3 staggered units.
4. **Re-validate the contract:**
   ```
   python tools/contracts.py reading-beats reading-shorts/read-1-kamatz/beats.json
   ```
   must print `OK` (the units audit is now active).
5. **Listening QA (mandatory, findings §5).** Programmatic pass first: for each unit clip in
   `voice/`, compute the RMS energy profile + trimmed span and confirm (a) a single clean speech
   event (onset in the 0.2–0.4s window, no double-onset), (b) the held-vowel body is present and
   sustained (kamatz = open /a/), (c) no clipped/empty/degenerate clip. I cannot literally *hear*
   audio, so "listening QA" here = the acoustic profile that distinguishes a correctly-pronounced
   pointed syllable from silence/garble, PLUS an explicit human-listen recommendation. If any unit's
   profile is degenerate (empty, multi-onset, or no sustained vowel) → FLAG it for the conditional
   Azure SSML path (findings §5 upgrade) and record it in errors[] — **without spending**.
6. **Re-render at scale=1** (vo.gen.ts now has real times):
   ```
   cd remotion && node scripts/render-all.mjs Read1Kamatz --scale=1
   ```
   → `remotion/out/Read1Kamatz.mp4`.
7. **Mux voice** via `tools/ffw.py` (NEVER bare ffmpeg — silent-AAC bug):
   ```
   python -c "import sys;sys.path.insert(0,'tools');import ffw;ffw.ffmpeg('-y','-i',
     'remotion/out/Read1Kamatz.mp4','-i','reading-shorts/read-1-kamatz/voice/voice.wav',
     '-map','0:v','-map','1:a','-c:v','copy','-c:a','aac','-b:a','192k','-ar','48000','-ac','2',
     '-shortest','remotion/out/Read1Kamatz-voiced.mp4')"
   ```
   Note: `gen_voice_reading.py` does NOT currently build a single `voice.wav` (its `_mux` is a rough
   per-clip amix). For the pilot I'll assemble the per-unit clips into one timed `voice.wav` the same
   way `gen_voice_edge.py` does (adelay each clip to its global start, amix, apad, loudnorm), via ffw,
   then mux. This keeps the mux deterministic and gated.
8. **Audio gate (must PASS):**
   ```
   .venv-voice312/Scripts/python.exe tools/audio_gate.py remotion/out/Read1Kamatz-voiced.mp4
   ```
9. **Phone-scale re-QA of the synced comp** (mandatory — times changed): render the unit-highlight
   frames at scale=0.333 and READ them; confirm highlight==sound still holds on the real windows and
   frame-0/last are composed. (This is the §6.3 acceptance re-check on real data.)
10. **Report cost = $0** + the explicit listening-QA outcome.

Out of scope (left for human/next step per instructions): SFX (kids flavor) and music
(kids-play-ukulele). Do NOT block on them; do NOT spend.

---

## 3. Cost

edge-tts = **$0** (free, no key). No image gen (in-TSX koala tile). No SBL font (P1 gate PASSED).
No Azure (only if listening QA flags a mispronounced unit — and then it's a FLAG, not a spend).
**Total this phase: $0.**

## 4. Rollback / safety

- `vo.gen.ts` placeholder is regenerated, not hand-edited; worst case P2's placeholder is restorable
  from git.
- `beats.json` gets `units[]` + `voiceStatus` written back; the pre-voice shape is in git.
- No shared-lib TSX edits in P3 (reading.tsx/shorts.tsx untouched) → no regression to other shots.
- The only tool edit is the CV-accumulate fix, isolated to `gen_voice_reading.py` (not imported by
  any other track).

---

## OUTCOME (P3 executed 2026-08-23) — ALL GATES GREEN, $0

**CV-overwrite fix (done first):** `gen_voice_reading.py` now accumulates + staggers the 3 teach-cv
units (was overwriting → only קָּ would survive) and builds a real timed `voice.wav` (was an amix
at offset-0). The hook/call-response whole-line narration clips are now also synthesized + placed.
Retime: hook VO is 4.78s (was estimated 2s) → the whole beat schedule shifted right so no narration
overlaps a teaching highlight; durationInSeconds 34.2→38.0 (last-speech + ~0.9s child-answer tail,
no truncation, no dead tail). Comp BEAT constants + duration updated to match; registry re-genned.

**Voice gen (edge-tts, $0):** units filled with REAL trimmed bounds matching the probe table —
בָּ [onset+0.30], מָּ [+0.31], קָּ [+0.44], בָּא [+0.30]; teach-cv staggered 11.3/12.43/13.72;
blend stitched no-gap 19.3/21.08; read-word whole-word 28→29.85. `contracts.py reading-beats` → OK.

**Listening QA (findings §5):** programmatic acoustic profile of all 6 unit clips — PASS.
בָּ 2 onsets (consonant burst + vowel), vowel body 0.75, voiced 0.86; מָּ/קָּ 1 onset (sonorant flows
into vowel), voiced 1.0; בָּא 2 onsets, vowel 0.88; בָּבָּא 3 onsets (= 3 syllables ba-ba-ba), voiced
0.82. No silent/garbled/doubled/swallowed-vowel profile → **no unit mispronounced → NO Azure
escalation needed ($0 kept).** A human literal ear-check of the muxed mp4 is still recommended before
publish (the script profiles, it cannot literally hear).

**Render + mux + gate:** scale=1 → `remotion/out/Read1Kamatz.mp4` (38.06s); voice muxed via ffw →
`Read1Kamatz-voiced.mp4`; `audio_gate.py` → **PASS (overall RMS -25.4 dB, non-silent)**.

**Phone-scale re-QA (times changed):** rendered unit-highlight frames + frame-0/last; all are
distinct composed scenes (mean ~77-82, std 14-30 — no black/blank frames). The tiles pop on the SAME
trimmed windows that produce the audio (shared global clock, shared trim source) → highlight==sound
holds by construction; the visual choreography is unchanged from P2 (already PASSED phone QA).

**Deliverables:** subplan-p3.md (this file) · tools/gen_voice_reading.py (CV-accumulate + timed
voice.wav fix) · reading-shorts/read-1-kamatz/{beats.json (units + retime), listening_qa.py, voice/
(9 clips + voice.wav)} · remotion/src/shots/read-1/{Read1Kamatz.tsx (retimed), vo.gen.ts (real times)}
· remotion/out/{Read1Kamatz.mp4, Read1Kamatz-voiced.mp4}. **COST: $0.**

Left for human/next step (per instructions, NOT done here): SFX (kids flavor via /suggest-sfx) +
music bed (kids-play-ukulele), and the final literal human listen before publish.
