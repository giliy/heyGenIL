# Hebrew Reading (Nikkud) Shorts — Research Findings

**Feature:** short videos that teach HEBREW READING (decoding) to ages 5–7 — one nikkud per
video, with the pointed letter/syllable highlighted in sync with the exact sound (sub-word
highlight, one level finer than the pilot's whole-word highlight).

**Status of this doc:** consolidated synthesis of the repo scout (4 areas) + 6 external research
briefs. Underlying briefs: `research/hebrew-reading/01-subword-timing.md`,
`research/hebrew-reading/02-pointed-hebrew-typography.md`,
`research/hebrew-reading-decoding/01-nikkud-decoding-pedagogy.md`,
`research/hebrew-kids/09-reading-decoding.md`, plus the nakdan-library, forced-alignment, and
TTS-voice briefs. Conflicts between agents are adjudicated inline (see §2, §3, §4).

**Legend:** ✅ source-grounded or empirically verified on this machine · ⚠️ UNVERIFIED (research
blocked or inference) — collected in the register at the bottom.

---

## Decision summary (TL;DR)

| # | Decision | Choice |
|---|---|---|
| 1 | Pedagogy | Synthetic phonics on pointed script; order /a/→/e/→/i/→/o/→/u/, קמץ+פתח first; per-video ladder isolated → CV → blend → word |
| 2 | Sub-word timing | **Per-clip isolation + energy trim** (exact by construction). Fallback: WhisperX char onsets, whole-clip windows only |
| 3 | Nikkud tooling | **Curated lexicon + stdlib rule engine** (`tools/nikkud.py` + `nikkud_data.py`); phonikud-onnx as optional authoring-time cross-check only |
| 4 | Display font | **Keep Heebo/Rubik** (pointed-safe per evidence); per-mark pixel QA gate; SBL Hebrew only if gate fails |
| 5 | Voice | **Keep edge-tts he-IL-HilaNeural** per-clip with slowed rate; upgrade path = direct Azure SSML (same voices, IPA phoneme control) |
| 6 | Curriculum | One nikkud per 30–60s Short, בּוּ-hosted, 2–3 anchor words each; gap is real — no synced sub-word highlight exists anywhere |
| 7 | Build new | `gen_voice_reading.py`, `nikkud.py(+_data)`, Captions `units` prop + GraphemeTile, `validate_reading_beats` |

---

## 1. Pedagogy — order and method ✅

Israeli grade-1 reading **is synthetic phonics on pointed script** (Ministry of Education
framework, rooted in the Shimron Committee): children map grapheme→phoneme and
**"מצרפים"** — blend the units into words. The decodable unit is the **צירוף (CV cluster:
consonant + vowel sign, e.g. בָּ = "ba")** — exactly the unit we want to highlight.

### Nikkud introduction order (one per video, this sequence)

1. **קמץ + פתח (/a/)** — first: highest frequency, easiest to pronounce. Taught as a same-sound pair.
2. **צירי + סגול (/e/)** — same-sound pair.
3. **חיריק (/i/)**.
4. **חולם (/o/)**.
5. **שורוק first, then קובוץ (/u/)** — same sound, different spelling; a confusion point flagged
   by the Ministry itself. Teach שורוק as the canonical /u/, flag קובוץ as "same sound, different look."
6. **שווא — late, its own video.** שווא נח (silent, closes syllable) before שווא נע (the /ə/
   "whisper," often via וְ/לְ). Frame as "the resting dot" → "the whisper."
7. **דגש — separate video, דגש קל only** (בּ/כּ/פּ sound-change story: B/K/P vs V/CH/F). דגש חזק later.
8. **חטף forms last.** Defer **קמץ קטן** entirely — it is printed identically to קמץ גדול and even
   adults conflate them.

### Per-video structure (the synthetic ladder — maps 1:1 to beats)

**hear the syllable → isolate the letter+nikkud → highlight the pointed letter (בָּ) as its sound
plays → blend across syllables → whole word.**

- **Highlight the whole pointed letter, never the vowel mark alone** — the decodable unit is the
  cluster. (Doubly forced on us: the aligner can't time vowels — see §2.)
- **Continuous blending**: stretch continuous sounds "as long as breath permits," no gaps between
  sounds (/bbbbaaaatttt/, not /b/…/a/…/t/). Gaps lose sound order (Gonzalez-Frey & Ehri 2021).
- **Touch-and-say**: point at each letter, say its sound, sweep under the whole word — literally
  our highlight choreography.
- **Pacing**: one new vowel sound per lesson/video; ~3–6 sounds/week; 95–98% first-attempt
  accuracy before advancing. Validates the one-nikkud-per-video unit.
- **Anchor each nikkud to 2–3 high-frequency, imageable kid words.**
- Phonological-awareness ladder to mirror in structure: syllable → צירוף → single phoneme.

---

## 2. Sub-word highlighting architecture ✅ (empirically decided on this machine)

### PRIMARY: manifest-driven per-clip isolation + energy trim

Each teaching unit (isolated grapheme, CV syllable) is spoken **in isolation anyway** — that's the
pedagogy — so make each unit **its own edge-tts clip**. Timing becomes exact by construction:
clip == unit. The only moving part is trimming the TTS silence pad.

- **Why not sub-word forced alignment of one long clip:** probed and disqualified. WhisperX
  syllable-token alignment on בָּבָּא put boundaries in pure silence (claimed start 0.061s where
  audio is silent after 0.48s); CTC jitter 20–40ms+. Fatal for a feature whose promise is
  highlight == sound.
- **Why not edge-tts phoneme events:** they don't exist. `phonemeBoundaryEnabled` is silently
  ignored (only WordBoundary returns); `visemeEnabled` fires but carries no grapheme identity.
  Installed source confirms metadata = WordBoundary | SentenceBoundary only. No SSML `<phoneme>`
  output path.
- **The mechanism:** edge-tts pads every clip with ~0.22–0.40s leading and ~1.05s trailing silence
  (varies per clip — **no fixed global offset is safe**). A ~15-line numpy RMS energy trim
  (>15% peak; torchaudio already in `.venv-voice312`) recovers exact [onset, end] per clip. That
  trimmed window **is** the highlight window.
- **Blends:** synthesize each syllable as its own clip, trim, schedule back-to-back at known
  offsets in the composition (no gaps = continuous blending per §1) — deterministic unit times, no
  aligner involved.
- **Whole word:** one continuous clip + the existing whole-word Captions highlight (already correct).

### FALLBACK: WhisperX char-level alignment — whole-clip windows ONLY

For connected-speech beats where per-clip stitching is undesirable:

- WhisperX hard-maps `he` → `imvladikon/wav2vec2-xls-r-300m-hebrew` (**already cached** on this
  machine); `return_char_alignments=True` yields per-codepoint times. Verified live: letter onsets
  land ~10–30ms off true acoustic onset when given the **whole clip**.
- **Hard ceiling — design around it:** the model vocab is 27 unpointed letters + space. **No
  nikkud.** It times *letters*, not vowel sounds; it cannot locate /a/ vs /e/. Contract: a grapheme
  span runs **letter onset → next letter onset** (or word end). Never attempt a mid-syllable vowel
  boundary. QA rule: "highlight lands on the letter's onset," not "splits the vowel."
- **Operational rule (empirically the sharpest finding): NEVER feed edge-tts WordBoundary windows
  to WhisperX as segment bounds** — edge-tts hugely over-reports (1.0s offset / 5.25s duration for
  a 0.2s syllable) and alignment lands on silence. Whole-clip (or silence-trimmed) windows only.
- Graceful degradation: if whisperx fails to import (ctranslate2 pin → Python <3.13), the feature
  degrades per-letter → per-word, same as today's pilot. Non-breaking.
- MFA: dead end (no maintained Hebrew pretrained model). ctc-forced-aligner: default model is
  CC-BY-NC — not usable for commercial shorts.

### Data contract (additive, non-breaking — existing validators ignore unknown keys)

```
mode: "reading", language: "he"
reading: { nikkud: "kamatz"|"patach"|…, targetLetters: [...],
           progression: ["isolated","cv","blend","word"] }
vo[i].units[] = [ { g: "בָּ", start: 5.104, end: 5.35 }, … ]   // OPTIONAL per line
```

- `g` = displayed unit WITH nikkud (letter+nikkud, CV syllable, or blend cluster); `start`/`end`
  absolute seconds, ⊆ parent word span; units sorted, non-overlapping.
- Lines without `units[]` fall back to whole-word highlight (today's behavior) — blend/word beats
  need no new data.

---

## 3. Nikkud text tooling — lexicon-first, ML as authoring assist ⚠️→✅

**Agent conflict, adjudicated.** Scout: "no pip-installable Hebrew nakdan exists → rule+lexicon."
nikkudLib research found what the scout's PyPI full-text search missed: **phonikud /
phonikud-onnx (thewh1teagle)** — real, offline, `>=3.8,<3.13` (fits `.venv-voice312`), code
CC BY 4.0 / model MIT. The scout's *conclusion* still wins on product grounds; the research's
*find* becomes an assist tool.

### DECISION — primary: curated lexicon + stdlib rule engine

`tools/nikkud.py` (engine) + `tools/nikkud_data.py` (lexicon). Rationale: the vocabulary is a
**closed, teacher-vetted set** (~20 words/syllables per video, ~1–3k total). For a teaching
product a hand-checked lexicon beats any model on correctness, is offline/reproducible, zero new
deps. **A wrong vowel taught to a 5-year-old is the worst-case bug** — no model ships unverified.

**Segmentation spec (from scout edge-case analysis — needed regardless of nakdan choice):**
- Grapheme = one HEBREW LETTER (U+05D0–05EA incl. sofits) + its following combining marks (Mn).
  `unicodedata.combining(ch) > 0` cleanly separates nikkud from letters.
- Nikkud block = U+05B0–05BF + shin/sin U+05C1–05C2. Exclude cantillation U+0591–05AF,
  U+05C4–05C5 (never in decodables). **Dagesh U+05BC stays in the grapheme** — pedagogically
  load-bearing (ב/בּ). Holam haser U+05BA = holam. Kubutz U+05BB vs shuruk (וּ, same dot inside
  vav) — shuruk is not a separate grapheme.
- Syllables: greedy-left CV/CVC. **Shva na/nach is the hard case** — initial or after full vowel
  in open syllable → נע; between identical consonants / word-final → נח; else lexicon flag.
- Matres lectionis (א ה ו י): resolve the letter's role from its nikkud (וּ+holam = the /o/,
  not a syllable; word-final ה = /a/). Hataf forms = full vowel graphemes. Maqaf/whitespace =
  syllable boundaries; geresh/gershayim preserved as punctuation.

### DECISION — assist (authoring-time only, optional): phonikud-onnx

`pip install phonikud phonikud-onnx` into `.venv-voice312`; one-time 308MB int8 model download,
then fully offline. Use to **draft/cross-check** the lexicon at authoring time — bonus: it emits a
phoneme stream, stress marks (ˈ), and disambiguates vocal shva (U+05BD), useful metadata. Keep
**dictabert-large-char-menaked** (dicta-il, CC BY 4.0, 1.22GB, SOTA claim, modern Hebrew only) as
the accuracy referee if a word is contested. Human verifies every word before commit.
⚠️ No published accuracy (DER) exists for child-level CVC/CV text on ANY option — "validate on our
list," never trust blind.

**Ruled out:** unikud (pins torch 1.11 — breaks on 3.12, unmaintained) · `mishkal` on PyPI
(Arabic tashkeel, wrong language; thewh1teagle/mishkal == phonikud) · Dicta Nakdan/NakdanPro
(web-only, network-gated) · ha-nakdan (online Home Assistant integration).

---

## 4. Letterform & highlight UX — keep our fonts, gate on pixels ✅

**Agent conflict, adjudicated.** Scout: Heebo/Rubik "not safe" for pointed display → vendor SBL
Hebrew. Letterform research: vendored fonts are **pointed-safe** — Rubik has explicit OpenType
mark-positioning for nikkud (added 2015, revised by native reader Meir Sadan; only biblical
cantillation excluded — irrelevant here; zero nikkud bug reports on the tracker), Heebo is
Hebrew-primary (`primary_script: "Hebr"`, Oded Ezer). The classic pointed faces (SBL Hebrew,
Frank-Rühl) are *print* faces for dense vocalized prose; for one huge on-screen grapheme a clean
heavy rounded sans is more legible and already on-brand.

### DECISION

1. **Default: Heebo/Rubik. No new font vendored on spec.** The unicode-range (U+0590–05FF +
   U+25CC + U+FB1D–FB4F) already covers every mark — no tofu risk; the open question is anchor
   *precision* at tile size, which only pixels can answer.
2. **QA GATE (mandatory, before any tile ships):** render phone-scale frames of each target mark —
   קמץ/פתח/צירי/סגול/חיריק/חולם/קובוץ/שורוק/שווא/דגש — on 2–3 base letters at real tile size in
   Heebo-700 and Rubik-900, and READ them. Pass = marks distinguishable at a glance (esp.
   חיריק vs סגול vs צירי; חולמ's top-left dot clear of tile top; דגש centered).
3. **If the gate fails:** vendor **SBL Hebrew** (SIL/free, gold-standard mark placement) as one
   `tools/fonts/manifest.json` entry → gen-fontfaces.mjs → `FONT_NIKKUD_DISPLAY` in fonts.ts,
   used ONLY inside GraphemeTile/SyllableTile. Captions stay Heebo/Rubik for continuity.

### Highlight treatment ✅

- **Color the active grapheme in exact sync + the existing scale pop** — redundant cue, never
  color alone. Evidence: PlanetRead / Same-Language Subtitling ("change color in perfect timing
  with the song") shows replicated child literacy gains (70% vs 34% functional readers; strongest
  effect grades 2–3 = our demographic).
- Grapheme as large as the safe area allows; `lineHeight ≈ 1.5` (existing kidsNikkud rule); extra
  tracking on blends; teach isolated before blending.
- ⚠️ **Per-sign visual mnemonics for kids: deliberately NOT fabricated** — Hebrew teacher-blog
  search was blocked in this environment. Open to-source task (run where Hebrew search works, or
  derive from sign names + validate with an Israeli early-grades teacher).

---

## 5. Voice — same voice, more control ✅/⚠️

**No ready-made "Hebrew motherese" TTS voice exists.** The lever is not which voice but whether
you can isolate, hold, and stretch one sound with exact timing.

### DECISION — pilot: keep edge-tts `he-IL-HilaNeural` (the locked בּוּ voice), one clip per unit, slowed global rate

- The per-clip architecture (§2) **sidesteps edge-tts's limitation** (custom SSML removed; single
  global prosody per utterance): each clip IS one unit, so a global slow `rate` on the clip gives
  the stretch without needing per-word SSML spans. Free, no key, already proven in short-18.
- Pointed text drives pronunciation (edge-tts reads nikkud fine — confirmed in the pilot), which
  neutralizes the "unpointed Hebrew TTS guesses" problem for our closed lexicon.
- ⚠️ **Listening QA required:** verify edge-tts pronounces each isolated pointed syllable
  correctly (especially שורוק vs vav+dagesh, שווא נע). Any mispronounced unit → escalate that unit
  to the upgrade path below.

### UPGRADE PATH (if pilot QA bites): direct Azure Speech SSML — same voices

`he-IL-HilaNeural`/`he-IL-AvriNeural` are the same two voices edge-tts wraps, but direct Azure
restores what edge-tts strips: **`phoneme` element with the full he-IL IPA set** (vowels
i e a o u + 23 consonants) to force exact articulation (`<phoneme alphabet="ipa" ph="kɔ">קָ</phoneme>`),
word-level `prosody rate` (contour does NOT work on single words — stretch via rate), `break`,
`say-as="characters"` for letter-naming. Bonus QA lever: **Azure Pronunciation Assessment** can
score our rendered syllable against `referenceText` — machine-check that the audio says what we
teach. ⚠️ Requires an Azure Speech key + has cost — state cost before spending (repo rule); not
needed for the pilot decision.

### Ruled out / backup

- **ElevenLabs**: Hebrew requires `eleven_v3` (v2 has no Hebrew). v3 audio tags ([whispers],
  [curious]…) could warm up the "teacher" delivery but are ⚠️ **not documented as reliable in
  Hebrew** — must pass a 5-line Hebrew tag bakeoff before any reliance. Costs money. Enhancement,
  never the deterministic core.
- **Google Chirp 3 HD**: he-IL supported but **excluded from pause-control and
  custom-pronunciation** — weak exactly where we need control. Skip.
- **kokoro**: no Hebrew (already excluded repo-wide).

---

## 6. Curriculum & differentiation ✅/⚠️

### Market reality (✅, via bing.com/videos — see UNVERIFIED register for what couldn't be watched)

- The category is **YouTube-native**: Hop! Channel and Kan Educational carry no
  alphabet/reading/nikkud series (math + entertainment only).
- The curriculum is settled and matches §1: Kriakala (live Israeli phonics app) publishes the same
  ladder (letter sounds → nikkud one-at-a-time → C+V → blend → books) and calls nikkud **"the most
  commonly skipped step that causes reading to stall."**
- What wins views today: 2–4 min **name-recitation songs** (aleph-bet song 29.7M; EZToddler
  all-vowels nikkud song 1.2M) and 4–10 min per-vowel "הכנה לכיתה א" long-form (Hebrew KidTV;
  EZToddler kamatz/patach 494K).
- The parent pain point, verbatim: **"My child can sing the whole Aleph Bet perfectly but can't
  read a single word."** That is the thesis.

### The gap this feature owns

1. **Sub-word highlight synced to the exact phoneme exists nowhere** — in any market, any format.
2. **No calm 30–60s per-nikkud Shorts** — everything is long-form or song.
3. **None of it is character-led** — בּוּ hosts (locked character = instant continuity with
   short-18).

### Series map

One video per row of the §1 order (קמץ+פתח → צירי+סגול → חיריק → חולם → שורוק/קובוץ → שווא →
דגש קל; חטף + קמץ קטן deferred). Each: 30–60s, mode `"reading"`, the four progression beats
(isolated → CV → blend → word), 2–3 anchor words, kids music bed, no CTA. Pilot = **קמץ** (first
in every sourced sequence).

---

## 7. Reuse inventory & build list

### REUSE as-is ✅

| Asset | Where | Note |
|---|---|---|
| בּוּ koala character (LOCKED) | `ai-shorts/bu-koala/character.json` + `.jpg` | gen_image.py --ref; media → `media/projects/bu-koala-<ep>/`. Never re-derive from text |
| Voice + word timings | `tools/gen_voice_edge.py` (he-IL-HilaNeural, WordBoundary → `vo[].words[]`) | fallback `align_words.py --lang he` (`.venv-voice312`, py3.12 NOT 3.13+) |
| Captions renderer | `remotion/src/lib/shorts.tsx` | rtl / plate / kidsNikkud / anchorRtl() / stripNikkud() all present; granularity = word |
| Fonts + pipeline | `media/library/fonts/` Heebo 500/600/700, Rubik 700/900; `tools/fonts/gen-fontfaces.mjs` | ranges already cover all nikkud |
| Contract scaffold | `tools/contracts.py` `validate_ad_beats` | the copyable extension pattern (wrap validate_beats + mode/block + conditional timing audit) |
| Working kids example | `shorts/short-18-bu-aleph/` | `<Captions … plate rtl kidsNikkud />` reference |
| Kids music beds | library: kids-play-ukulele, kids-lullaby-musicbox, kids-curious-pizzicato | per-beat choice |
| brand.md §5 `mode:"kids"` override | bouncy motion, nikkud, playful SFX permitted | reading track inherits; add `mode:"reading"` |

**Register flag (from scout):** character.json targets ages 3–5 (motherese, 3–6-word cap). Reuse
character/voice/catchphrase, but **raise the script register to 5–7**: short directive prompts,
call-and-response "your turn" — not toddler cooing.

### BUILD new

| # | Deliverable | Spec |
|---|---|---|
| 1 | `tools/gen_voice_reading.py` (~80 lines, reuses gen_voice_edge plumbing) | Reads `reading.json` units `[{id, grapheme, sound, role}]`; per unit: synth own clip (WordBoundary), RMS energy trim (>15% peak) → exact [onset,end]; writes `vo[].units[] = [{g,start,end}]` into beats.json |
| 2 | `tools/nikkud.py` + `tools/nikkud_data.py` | Grapheme + syllable segmentation per §3 spec; curated pointed lexicon; rule engine (default nikkud, shva na/nach, matres, dagesh). Optional phonikud cross-check hook |
| 3 | Captions `units` path + **GraphemeTile/SyllableTile** (reading kit) | When active word has `units[]`: render graphemes as spans, tint+pop the one containing now; else whole-word fallback. Tile = big isolated pointed letter, same timing source |
| 4 | `validate_reading_beats` in `tools/contracts.py` | Mirror validate_ad_beats: require mode `"reading"` + language `"he"` + `reading{}` block; require the 4 progression beats in order; conditional units audit (numeric start<end, sorted, ⊆ word span; isolated/CV beats must carry units); register `"reading-beats"` in `_VALIDATORS` |
| 5 | (conditional) SBL Hebrew font entry | ONLY if §4 pixel gate fails |
| 6 | (later) Azure direct SSML voice path | ONLY if §5 listening QA bites; needs key + cost sign-off |

---

## UNVERIFIED register (research blocked / inference — verify before relying)

| Item | Why unverified | Resolution path |
|---|---|---|
| Nakdan accuracy on child CVC/CV words (any tool) | No published DER for this input class | Human-verify the closed lexicon; phonikud/dictabert cross-check at authoring time |
| Heebo/Rubik mark precision at tile size | Not yet rendered | §4 pixel QA gate — decide SBL on pixels |
| edge-tts pronunciation of isolated pointed syllables | Not yet listened | §5 listening QA on the pilot's unit set |
| ElevenLabs v3 audio-tag reliability in Hebrew | Docs don't promise non-English behavior | 5-line Hebrew tag bakeoff (only if considered) |
| Per-sign child mnemonics (קמץ = "mouth open" etc.) | Hebrew teacher-blog search blocked (Brave 429, Seznam/Bing/Yahoo fail Hebrew) | To-source task where Hebrew search works, or derive from sign names + Israeli teacher review |
| Internal pacing of competitor per-vowel videos | YouTube pages JS-gated to WebFetch | Human watches 2–3 Hebrew KidTV / EZToddler vowel videos in a browser |
| Official state textbook nikkud order | Ministry PDFs 404'd | Meyda site browse or teacher confirmation; current order rests on ezed.co.il + worksheet sequencing + Ministry framework (solid but secondhand) |
| Google Hebrew voice inventory beyond Chirp 3 HD | Doc page truncates; API 403 | Moot — Google not chosen |
| Azure he-IL phoneme edge cases (dagesh gemination, shva in running speech) | Not documented | Test only if the Azure upgrade path is taken |

## Source dossier

Grounded in: Israeli Ministry of Education *מבדק קריאה וכתיבה לכיתה א'* (meyda.education.gov.il) ·
ezed.co.il סימני ניקוד · Synthetic phonics (Wikipedia/NRP 2000) · Reading Rockets phonics practice
(touch-and-say, one-vowel-per-lesson) · Phonic Books (continuous blending; Gonzalez-Frey & Ehri
2021) · PlanetRead/billionreaders.org SLS evidence · googlefonts/rubik repo + issues · google/fonts
heebo metadata · he.wiki ניקוד / Kamatz katan / Frank-Rühl · github.com/thewh1teagle/phonikud +
PyPI/HF metadata · HF dicta-il/dictabert-large-char-menaked · github.com/m-bain/whisperX +
installed whisperx/alignment.py + cached imvladikon model vocab.json · installed edge_tts package
+ 3 live probes (`research/hebrew-reading/probe/`) · Microsoft Learn (language-support,
speech-ssml-phonetic-sets, synthesis-markup-voice, pronunciation-assessment) · ElevenLabs
docs/blog/help · Google Chirp3-HD docs · Kriakala · IvriTalk · bing.com/videos result metadata.

*Compiled 2026-08-23. Where agents disagreed (WhisperX reliability, nakdan existence, font safety),
the adjudication and its reasoning are recorded inline in §2, §3, §4.*
