# 01 — Sub-word (letter/syllable) audio timing for Hebrew reading shorts

Decision: **one edge-tts clip per teaching unit** (letter+nikkud / CV syllable / blended
word), driven by a manifest that maps each clip to its on-screen grapheme span. No
sub-word forced alignment. Reasoning + probe evidence below.

## The requirement
Each video teaches ONE nikkud. The on-screen grapheme must highlight in sync with the exact
spoken sound — one level finer than the current whole-WORD highlight. Progression:
isolated letter+nikkud sound -> CV syllable -> blend -> whole word.

## Q1 — Does edge-tts expose PHONEME / sub-word boundaries?  NO.
Probe: hand-crafted speech.config against the live endpoint (`.venv-voice312`, edge-tts 7.2.8,
voice he-IL-HilaNeural, text "בָּבָּא").
- `wordBoundaryEnabled:"true"`              -> `[WordBoundary "בָּבָּא"]`
- `phonemeBoundaryEnabled:"true"` (+word)   -> `[WordBoundary "בָּבָּא"]`  (phoneme flag IGNORED — no Phoneme events)
- `visemeEnabled:"true"` (+phoneme)         -> `[Viseme×6, text=""]`  (visemes fire but carry NO phoneme/grapheme identity)

Confirms the library source (`communicate.py`): `boundary` is `Literal["WordBoundary","SentenceBoundary"]`,
and `__parse_metadata` raises `UnknownResponse` on any other type. The metadataoptions JSON only
has sentence/word toggles. There is no SSML `<phoneme>` output-boundary path. => edge-tts CANNOT
give per-letter/per-syllable times within a word.

## Q3 — Can WhisperX (wav2vec2-xls-r-300m-hebrew) forced-align SUB-word?  Technically yes, NOT reliably.
whisperx.alignment is char-level at the acoustic trellis, so forcing the transcript to be a
syllable sequence makes it emit per-syllable times. On "בָּבָּא" (baba):
- single-token  "בָּבָּא"      -> 0.323–0.827   (whole word)
- two-syllable  "בָּ בָּא"     -> בָּ 0.061–0.424 · בָּא 0.505–0.827
- three-token   "בָּ בָּ א"    -> בָּ 0.061–0.424 · בָּ 0.505–0.666 · א 0.807–0.827

Ground-truth RMS profile of the SAME clip: actual speech = 0.34s→0.46s, clean silence after 0.48s.
So the aligned start 0.061 sits IN SILENCE and the aligned end 0.827 sits IN SILENCE — the
sub-word boundaries are measurably wrong on the most careful, isolated input. For a product whose
core promise is "highlight == sound", this error rate is disqualifying. (wav2vec2-xls-r-300m
reports ~20–40ms CTC-frame jitter even in-domain; on tiny CV syllables it's worse.)

## Q2 + Q4 — Per-clip isolation is the reliable path (probe on isolated clips).
Synthesized each unit as its own clip and measured speech bounds + edge WordBoundary:
```
unit        clipDur  edgeWB        acousticOnset acousticEnd  leadSil trailSil
בָּ  len3    1.56    (0.1,0.658)   0.270        0.510         0.270   1.050
בָּבָּ len6  1.63    (0.117,0.728) 0.220        0.580         0.220   1.052
קָם  len3    1.78    (0.1,0.791)   0.340        0.670         0.340   1.106
כֶּלֶב len6  1.75    (0.1,0.858)   0.400        0.660         0.400   1.092
שָׁלוֹם len7  1.85    (0.1,0.939)   0.330        0.800         0.330   1.048
```
- edge-tts pads EVERY clip with ~0.22–0.40s leading and ~1.05s trailing silence (varies per clip),
  and the edge WordBoundary end drifts well past acoustic end. So you can NOT assume a fixed
  global offset — but you CAN detect the true onset/end per clip with a trivial energy trim
  (numpy RMS, ~15 lines, already have torchaudio in the venv), giving exact per-unit highlight windows.
- Each grapheme's clip start/end is then EXACT by construction (the clip IS the unit), with the
  small deterministic trim removing the TTS pad. This is the "highlight MUST match sound" guarantee.

## Recommended architecture
**Manifest-driven, one clip per unit, with a per-clip energy trim.** A `reading.json` per short:
```json
{ "voice":"he-IL-HilaNeural",
  "units":[
    {"id":"kamatz-bet","grapheme":"בָּ","sound":"ba","role":"syllable"},
    {"id":"kamatz-bet-aleph","grapheme":"בָּא","sound":"ba","role":"syllable"},
    {"id":"word-baba","grapheme":"בָּבָּא","sound":"baba","role":"word"} ] }
```
Pipeline (`tools/gen_voice_reading.py`, new, ~80 lines, reuses gen_voice_edge plumbing):
1. For each unit: edge-tts synth (its own clip) + WordBoundary (gives a coarse window).
2. Energy-trim each clip (numpy RMS > 15% peak) -> exact [onset,end]; write per-clip
   `{"unit_id, grapheme, file, trim_onset, trim_end}` into beats.json `vo[].subwords[]`.
3. Remotion Captions gets a `subword` prop: render the grapheme, pop it for the clip's trimmed
   window (offset by the beat's global start). Blended-word step = one clip, whole-word pop
   (existing Captions path, no new code).

Teaching design note: for reading instruction each grapheme is normally spoken in ISOLATION first
anyway, so per-unit clips are not a hack — they are the natural audio the pedagogy wants, and they
make the timing exact for free. Only the final blended word is a single continuous clip (where the
existing whole-word highlight is already correct and sufficient).

## What to build (and what NOT to)
- BUILD: per-clip synth + energy trim + manifest -> beats.json subwords + a `subword` Captions prop.
- DO NOT: sub-word forced alignment of one long clip (Q3 proves it unreliable); edge-tts phoneme
  SSML (Q1 proves it doesn't exist); visemes (no grapheme identity).
