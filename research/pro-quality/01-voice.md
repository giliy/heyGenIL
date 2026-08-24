# 01 — Hebrew voice / TTS quality (pro-quality track)

**Scope:** raise the voice layer of the video factory from "clean but flat" to "indistinguishable
from a professionally-produced Israeli social ad / high-end kids read." Covers the current edge-tts
implementation audit, the free/self-host Hebrew TTS frontier, datasets + fine-tuning cost, voice
cloning, alignment fallbacks, and post-processing. Ends in a ranked proposal list.

**Status legend:** ✅ verified on this machine or via a primary source · ⚠️ UNVERIFIED (inference,
blocked page, or not-yet-listened) — collected in the UNVERIFIED register at the bottom.

**Compiled:** 2026-08-23. Environment: `.venv-voice312` (Python 3.12.10), edge-tts 7.2.8 (live, working).

---

## Part A — Audit of what we already have

### A1. The pipeline (verified by reading the tools)

The voice layer is two parallel engines sharing one contract (`{w,start,end}` word maps written
back into `beats.json`, consumed by the TSX `Captions`):

| Track | Tool | Engine | Voice | Rate | Word times |
|---|---|---|---|---|---|
| Ads (make-ad) | `tools/gen_voice_edge.py` | edge-tts `boundary="WordBoundary"` | `he-IL-AvriNeural` / `he-IL-HilaNeural` (from lexicon) | per-line | **native WordBoundary** ✅ |
| Reading (make-reading-short) | `tools/gen_voice_reading.py` | edge-tts per-UNIT clip + numpy RMS trim | `he-IL-HilaNeural` (locked בּוּ voice) | `-18%` | **exact-by-construction** per-unit ✅ |
| Shorts (paid path) | `tools/gen_voice.py` | ElevenLabs `/with-timestamps` OR kokoro | EL premade "Liam" / kokoro | per-line | EL char-level → collapsed to words; kokoro native token times |
| Fallback aligner | `tools/align_words.py` | whisperX forced alignment | `imvladikon/wav2vec2-xls-r-300m-hebrew` (auto-resolves for `--lang he`) | — | word-level (~10–30ms jitter) |

**What edge-tts gives us (verified live, this machine):**
- Two Hebrew voices exist and ONLY two: `he-IL-AvriNeural` (male) and `he-IL-HilaNeural` (female),
  both tagged `VoicePersonalities: ["Friendly","Positive"]`, `TailoredScenarios: None`. ✅
- Real per-word `WordBoundary` events with sub-millisecond offsets. The ads track rides these
  directly; they are the trustworthy caption-timing source. ✅
- Only three delivery controls: `--rate` (±N%), `--pitch` (±NHz), `--volume` (±N%).
  **No SSML, no `style`/`styledegree`, no phoneme control, no per-word prosody.** (Confirmed in the
  edge-tts README: custom SSML removed; "the service only permits a single `<voice>` tag with a
  single `<prosody>` tag inside it.") ✅

**What the reading track's per-unit trim does (`gen_voice_reading.py`):** ✅ — each isolated
grapheme / CV syllable is synthesized as its OWN clip (pedagogically natural — the child hears each
unit in isolation first), then a numpy RMS energy trim (20ms window, >15% peak) recovers the exact
`[onset,end]` inside the clip, BECAUSE edge-tts pads every clip with a varying ~0.22–0.40s lead /
~1.05s trail. The trimmed window **is** the highlight window — exact by construction, no aligner.
CV units are staggered with `CV_GAP=0.55s`; blends stitch syllable clips back-to-back (continuous
blending). A re-flow pass pushes any overlapping line forward so real speech never collides.

**What motherese / warm-up we already apply:** ads default `-6%/-2Hz` ("soft & intimate"); reading
runs `-18%` global rate (stretch the single sound). Both are blunt global prosody only.

**Audio mastering chain (`gen_voice.py`)** already does: highpass 80Hz → deesser → compand →
two-pass LINEAR loudnorm to `-14 LUFS / -1.0 dBTP` + alimiter, with a pyloudnorm `--verify`.
`gen_voice_edge.py`/`gen_voice_reading.py` assemble with a simpler single-pass `loudnorm=I=-16`.

### A2. The gap (why this research exists)

The flat delivery ceiling is the real problem, not intelligibility:
- **Ads:** the he-IL voices read every line at one "Friendly, Positive" energy. A punchy sales read
  (hook → urgency → CTA) needs dynamic range edge-tts can't express. We compensate with atempo +
  SFX, but the *voice itself* never gets excited.
- **Kids/reading:** motherese (higher pitch, exaggerated melody, lengthened vowels, rising
  sentence-ends — per `research/hebrew-kids/07-hebrew-language-kids.md` §1) needs prosodic control
  beyond a global `-18%` rate. Per `07` the register *should* rise on encouragement lines and drop
  on gentle "stop" lines — edge-tts can't do either per-line.

The open question: can a free/self-host model beat the flat he-IL neural pair, or is expressive
Hebrew only available paid? The rest of this file answers that.

---

## Part B — The Hebrew TTS landscape, mapped

### B1. The Hebrew TTS Arena (ivrit-ai) — the current quality ranking ✅

ivrit-ai (the main Hebrew open-source ASR/TTS org) runs **TTS-Arena-Hebrew**, a human-preference
arena. Pulled live from its public `/api/leaderboard` (2026-08-23):

| rank | model | voice | Elo | win rate | votes | tier |
|---|---|---|---|---|---|---|
| 1 | **Deepdub dd-etts-3.3** (Israeli) | Emma | 1575 | 79% | 165 | **S** |
| 2 | **Gemini 3.1 Flash TTS** | Puck | 1571 | 75% | 166 | **S** |
| 3 | **ElevenLabs v3** | Aria | 1545 | 68% | 164 | A |
| 4 | **Soniox v1** | Maya | 1536 | 66% | 151 | A |
| 5 | OpenAI Realtime 1.5 | coral | 1503 | 59% | 22 | B |
| 6 | Inworld TTS-2 | Yael (Hebrew voice) | 1491 | 44% | 90 | B |
| 7 | Inworld TTS v1 | Yael | 1491 | 24% | 17 | B |
| 8 | Inworld TTS v1.5 MAX | Yael | 1480 | 43% | 168 | — |
| 9 | Blue V2 | Female1 | 1473 | 36% | 118 | — |
| 10 | OpenAI GPT-4o Mini TTS | nova | 1456 | 34% | 167 | — |
| 11 | OpenAI TTS-1 HD | nova | 1446 | 26% | 147 | — |
| 12 | OpenAI TTS-1 | nova | 1427 | 21% | 161 | — |

**Read this table hard:** **not a single edge-tts/Azure `he-IL` voice, and not a single open-source
model, is even on the board.** The best Hebrew voices Israeli listeners prefer are all paid cloud
services. That is the honest ceiling: for *expressive* Hebrew the free/self-host frontier is behind.

The two tier-S leaders deserve a closer look because both are reachable:
- **Gemini 3.1 Flash TTS** — supports Hebrew ✅, **and natural-language delivery control**
  ("Say cheerfully: …", audio tags `[whispers]`, `[shouting]`) ✅. **But exposes NO word-level
  timestamps** (audio-only output) ⚠️ for our caption contract — would need forced alignment after
  the fact (see Part D).
- **ElevenLabs v3 (Aria)** — already our paid path; supports Hebrew on `eleven_v3` ONLY (v2/flash
  have no Hebrew — verified in `hebrew-ads-deep-dive.md` §11). Audio tags steer delivery; Hebrew
  tag reliability is UNVERIFIED (existing findings §5 flag a required 5-line bakeoff).

### B2. Open-source models with real Hebrew support ✅/⚠️

| Model | Hebrew? | License | Word/phoneme timestamps | Verdict |
|---|---|---|---|---|
| **Chatterbox Multilingual (V3)** — ResembleAI | ✅ **Hebrew explicitly listed** (23 langs incl. `he`) | **MIT** ✅ commercial | ⚠️ none native (autoregressive) | **best free/self-host expressive option**; has `exaggeration` + CFG controls; existing `thewh1teagle/phonikud-chatterbox` wrapper proves Hebrew + phonikud G2P works |
| **Kokoro-82M** (base) | ❌ NO Hebrew | Apache-2.0 | native token times | base excluded repo-wide (correct) |
| **kokoro-hebrew** — `avri-schneider` fine-tune on SASPEECH | ✅ ~3% WER round-trip | code MIT; **weights+data NON-COMMERCIAL (IPBC)** ⛔ | (inherited kokoro token path) | pipeline is reusable MIT; the checkpoint is unusable commercially |
| **XTTS-v2** — Coqui | ❌ **NO Hebrew** (17 langs, he not among them) ✅ | CPML (Coqui Public Model License — not plain commercial) | none native | out for Hebrew |
| **F5-TTS** — SWivid | base: EN+ZH only; `asaelbarilan/f5-tts-hebrew` fine-tune pipeline exists | code MIT; **base weights CC-BY-NC** ⛔ | none native | non-commercial base; pipeline reusable on our own data |
| **Piper** — rhasspy | ❌ **NO Hebrew voice** (no `he`/`he_IL` in VOICES.md) ✅ | voices: mixed/open | none | out for Hebrew |
| **OpenVoice v2** — MyShell | ❌ natively EN/ES/FR/ZH/JA/KO only (claims unseen-language cloning) ✅ | MIT | none | Hebrew not first-class |
| **MeloTTS** — MyShell | ❌ EN/ES/FR/ZH/JA/KO ✅ | MIT | — | out |
| **MMS** — Meta (facebook) | ✅ has `heb` (Bible-read register) | CC-BY-NC ⛔ | none | non-commercial + wrong register (liturgical, not conversational) |
| **Mamre-TTS** — maxmelichov | ✅ purpose-built Hebrew (DiffMamba), streaming, zero-shot cloning | code **Apache-2.0** ✅; **weights NON-COMMERCIAL** ⛔ | none native | code reusable; checkpoint unusable commercially |
| **israwave** — thewh1teagle | ✅ WaveNet-class Hebrew on SASPEECH-gold, CPU <1ms | license unstated ⚠️ | none | SASPEECH-derived ⇒ almost certainly non-commercial |
| **Parler-TTS** | ⚠️ EN-centric; no listed Hebrew | Apache-2.0 | none | would need full Hebrew training |
| **HebTTS** — slp-rl (HUJI) | ✅ diacritic-free LM approach, academic | unstated ⚠️ | none | research artifact, SASPEECH-trained |

**The pattern that matters:** every *good-sounding* ready Hebrew checkpoint (kokoro-hebrew, Mamre,
israwave, HebTTS) derives from **SASPEECH — the 30h single-speaker (Shaul Amsterdamski) corpus,
"Custom non-commercial" license (IPBC/Kan, openslr.org/134)** ✅. Code is open; the *weights* are
not. For a **commercial** product, none of these checkpoints are usable as-is.

**Chatterbox is the exception that clears the bar:** MIT license, Hebrew in the official 23-language
multilingual V3, 0.5B params, zero-shot voice cloning, `exaggeration` + `cfg` expressiveness knobs,
and a working Hebrew G2P integration (`phonikud-chatterbox`). It is the only free/self-host model
that is simultaneously (a) commercial-legal and (b) actually does expressive Hebrew. It is in **no
way** yet proven to *sound* better than edge-tts to Israeli ears (it isn't in the arena) — that is
the open empirical question (Part F, proposal 1).

### B3. Free cloud Hebrew voices beyond edge-tts

- **Azure Speech (direct, not the edge wrapper)** — ✅ same two voices (`he-IL-AvriNeural`,
  `he-IL-HilaNeural`, Standard type). **F0 free tier = 0.5M chars/month free neural TTS** ✅ —
  far more than this factory needs. What direct Azure REST **restores** that edge-tts strips:
  SSML `<phoneme alphabet="ipa" ph="kɔ">קָ</phoneme>` (full he-IL IPA set: vowels i/e/a/o/u + 23
  consonants — verified) ✅, `<break>`, `say-as`, per-sentence prosody, and Pronunciation
  Assessment. **What it does NOT add: `mstts:express-as` styles — the he-IL voices list NO
  styles/roles** ✅ (corrects an implicit hope in existing research §5). So Azure = same flat voices,
  but with **exact-articulation control** — the reading-track lever, NOT an expressiveness upgrade.
- **Google Cloud TTS** — ✅ Hebrew supported (incl. Chirp 3 HD). Existing research already excluded
  it: Hebrew is cut from pause-control and custom-pronunciation, and its expressive control is weak.
  Has a free tier but no advantage over Azure for our control needs. Lower priority.
- **gTTS / free web scrapers** — no Hebrew neural quality, no timestamps. Out.

---

## Part C — Hebrew datasets & the fine-tune path

### C1. Datasets

| Dataset | Hours | Speakers | License | Commercial? |
|---|---|---|---|---|
| **ivrit-ai/crowd-recital** | **50.4h** (2,398 sessions, 325k words, 85 recorders, cutoff 2025-02) | multi (crowd, browser-mic) | **ivrit.ai License — "designed to allow training AI models, including for commercial purposes"** ✅ | ✅ **YES (the only one)** |
| **ivrit-ai** broader corpus (knesset-plenums ~4,700h, crowd-transcribe-v5 ~300h, audio-v2 …) | **"over 22,000 hours" total offered free** | many | ivrit.ai License ✅ | ✅ YES (ASR-grade; usable as TTS source with work) |
| **SASPEECH** (openslr 134) | 30h (4h gold + 26h auto) | single (Shaul Amsterdamski, studio 44.1kHz) | Custom **non-commercial** (IPBC) ⛔ | ❌ NO |
| **imvladikon/hebrew_speech_kan** (+_campus, _coursera, _news) | ~8.7h (kan) | scraped Kan TV | **no license declared** ⚠️ | ❌ NO (scraped, unlicensed) |
| **micsell/hebrew_speech_kan_nikud** | — | Kan, with nikkud labels | inherits Kan ⚠️ | ❌ NO |
| **MMS-heb / FLEURS-he** | small | — | CC-BY-NC ⛔ | ❌ NO |

**Bottom line:** the only **commercially-usable** Hebrew speech corpus at usable scale is
**ivrit-ai's** (crowd-recital 50h + the 22k-hour ASR corpus). Everything else is non-commercial or
unlicensed. This single fact drives the whole fine-tune strategy: **if we fine-tune, we fine-tune
on ivrit-ai data.**

Caveat: crowd-recital is **crowdsourced browser-mic audio, multi-speaker** — great for ASR and for
multi-speaker TTS, weaker than a single-studio-voice corpus for a clean brand-voice clone. For a
*single consistent brand voice* you'd either (a) zero-shot clone from a consented reference via
Chatterbox, or (b) filter crowd-recital to one good speaker subset, or (c) record a small consented
studio set.

### C2. What fine-tuning actually costs (⚠️ partially UNVERIFIED — no published Hebrew recipe)

| Path | Data | GPU | Time | Output |
|---|---|---|---|---|
| **kokoro-hebrew recipe** (StyleTTS2 fine-tune, `training/` is MIT and reusable) | SASPEECH-scale (~hours of one voice) | single consumer GPU (WSL2) | hours–days per stage | a single-speaker voice, ~3% WER reported ✅ (but on non-commercial data) |
| **F5-TTS Hebrew** (`asaelbarilan/f5-tts-hebrew` — full pipeline incl. arrow prep, sanity tests) | CrowdRecital example in its README | consumer GPU | days | flow-matching voice |
| **Chatterbox fine-tune** | would need Hebrew data + recipe | — | — | ⚠️ no published Hebrew fine-tune recipe |

**With unlimited compute/tokens on the table, the realistic self-host move is: take Chatterbox's MIT
multilingual base (already does Hebrew) and either use it zero-shot (no training) or fine-tune it on
ivrit-ai crowd-recital.** Do NOT retrain Kokoro/F5 from SASPEECH — the output would inherit the
non-commercial license and be unusable.

---

## Part D — Alignment fallback quality (word + sub-unit)

Verified on this machine (existing `research/hebrew-reading/00-findings.md` §2 + my read of
`align_words.py`):

- **whisperX word-level alignment for Hebrew** resolves `--lang he` → `imvladikon/wav2vec2-xls-r-300m-hebrew`
  (a wav2vec2-xls-r-300m CTC aligner). Letter onsets land ~10–30ms off true acoustic onset when fed
  a **whole clip** ✅. Word-level timing is **usable as a fallback** (ads captions), within ~one
  frame at 30fps.
- **Sub-word / per-UNIT (syllable/vowel) timing from forced alignment is NOT reliable** ✅: probed
  on בָּבָּא — whisperX char/CTC alignment put boundaries in pure silence (claimed start 0.061s where
  the clip is silent after 0.48s); CTC jitter 20–40ms is fatal for "highlight == sound."
  **Verdict: per-UNIT timing must keep coming from edge-tts per-clip isolation + RMS trim (exact by
  construction). Never try to align a single long clip to sub-units.** The reading track is locked to
  an engine that gives clean isolated-unit clips — which edge-tts does and (critically) Gemini /
  Chatterbox / EL give you only via separate per-unit API calls.
- **A better Hebrew aligner exists:** whisperX's default Hebrew aligner is the imvladikon wav2vec2,
  but **ivrit-ai ships Apache-2.0 Hebrew whisper fine-tunes** (`ivrit-ai/whisper-large-v3-turbo`,
  trained on ~5,000h incl. knesset + crowd-recital) ✅. These are *transcription* models (whisper,
  not wav2vec2-CTC), so they don't drop into whisperX's `load_align_model` slot directly — but they
  are the better basis for a custom Hebrew aligner or for WER-scoring a self-hosted voice's output
  (the kokoro-hebrew quality loop does exactly this: WER + ECAPA speaker-similarity per checkpoint).

---

## Part E — Voice cloning / voice design (one brand voice per track)

- **What we need:** a *consented* reference. Chatterbox zero-shot clones from a short reference clip
  (seconds); XTTS needs ~6s; F5 needs 5–15s (from earlier scans) ✅. For a durable brand voice, a
  few minutes of clean consented audio is the safe working set.
- **Ethics/consent (hard rule, and the repos enforce it):** only clone a voice you have **express,
  informed consent** to clone. The Mamre-TTS README states it plainly: no impersonation, no use of a
  person's voice without express informed consent; user bears legal/ethical responsibility ✅. For
  this product that means: **record or license a real Israeli voice actor** (one warm female for
  kids/reading motherese, one energetic voice for ads) OR use a synthetic/stock voice we own. Never
  scrape a real person (e.g. do not clone Shaul Amsterdamski / Kan talent — that is exactly what the
  SASPEECH non-commercial license forbids).
- **Practical recommendation:** Chatterbox zero-shot cloning of a consented actor is the
  cheapest path to a stable, expressive, commercial-legal brand voice. It also gives the
  `exaggeration` knob for motherese warmth (kids) vs. sales punch (ads) from the *same* voice.

---

## Part F — Audio post-processing to make any TTS sound pro

Already in place and correct:
- `gen_voice.py` mastering: highpass 80Hz → deesser(i=0.3) → compand → two-pass LINEAR loudnorm
  → alimiter, targeting **-14 LUFS / -1.0 dBTP** (the 2026 social norm) ✅, with pyloudnorm `--verify`.
- `audio_gate.py` catches the silent-AAC bug class and verifies cue audibility vs the voice ✅.

Gaps worth closing:
1. **The ads/reading edge-tts engines use a weaker single-pass `loudnorm=I=-16`** and NO
   deesser/compand front. **Port the `-14 LUFS` cleanup chain into `gen_voice_edge.py` /
   `gen_voice_reading.py`** so all three tracks master identically. (Cheap, pure win.)
2. **edge-tts output does benefit from cleanup:** neural voices have a slightly hyped top end and
   sub-100Hz rumble from the codec; the existing highpass+deesser+compand front is exactly right —
   it just isn't applied on the free tracks yet.
3. **A per-track EQ tilt** (optional): ads get a slight presence boost (~+1–2dB @ 3–5kHz) for
   cut-through on phones; kids/reading get a gentler top (de-ess harder) since motherese already
   sits bright. Tunable in the existing chain.
4. pyloudnorm `-14 LUFS` acceptance should be wired into `audio_gate.py` as a hard gate for every
   final `-voiced.mp4`, not just the paid path.

---

## Recommendation (free-vs-paid axis)

**(a) Ads voice.** Today: edge-tts `he-IL-AvriNeural/HilaNeural`, flat. **Recommend: keep edge-tts
as the $0 default, and add ElevenLabs v3 (`eleven_v3`, `--lang he`) as the per-ad opt-in upgrade for
the punchy read** — it is arena tier-A (#3, 68% win) in Hebrew, ~$0.03–0.10/ad, gives char-level
word times our captions already consume, and its audio tags ([excited], [fast]) are the only
delivery-steering that exists for Hebrew. Gate it behind a 5-line Hebrew tag bakeoff first (UNVERIFIED).
Free alternative to evaluate: Chatterbox zero-shot on a consented voice (see proposals).

**(b) Kids motherese voice.** Today: edge-tts `he-IL-HilaNeural` at `-18%`, globally. **Recommend:
keep edge-tts per-unit (the exact-timing architecture is the product's moat), and push motherese
through the *post* chain (presence EQ + rate/pitch shaping per line) since the voices can't do it
prosodically.** The genuinely warmer option is **Chatterbox with `exaggeration` tuned up on a
consented warm voice** — evaluate in the bakeoff. Do not pay for kids voice until free fails the
ear test.

**(c) Reading-track per-unit voice.** **Recommend: stay on edge-tts per-unit + RMS trim — it is the
only path that is exact-by-construction, free, and proven.** The one real risk is *pronunciation of
isolated pointed syllables* (existing §5 listening-QA flag, still UNVERIFIED). The fix for any
mispronounced unit is **direct Azure Speech (`<phoneme alphabet="ipa">`)** — same voice family,
F0 free tier (0.5M chars/mo = $0 at our volume), full he-IL IPA set to force exact articulation.
That is the targeted upgrade; not a wholesale engine swap.

---

## Proposals (ranked)

1. **Chatterbox Hebrew bakeoff + brand-voice clone** · MIT-licensed multilingual TTS (Hebrew in V3), zero-shot clone of a *consented* Israeli voice, `exaggeration`/`cfg` expressiveness knobs · **Effort M** (install, wire phonikud G2P via existing `phonikud-chatterbox`, record a consented reference, A/B against edge-tts) · **$0** · **Quality payoff: ads HIGH (the only free path to expressive/punchy Hebrew), kids HIGH (motherese via exaggeration)** · Ranks #1 because it is the *only* commercial-legal free model that does expressive Hebrew at all — everything else either can't do Hebrew (XTTS/Piper/OpenVoice/MeloTTS) or is non-commercial (all SASPEECH checkpoints). Caveat: not in the arena, so the sound-quality-vs-edge-tts question is open — hence a bakeoff, not a switch. ⚠️ native word timestamps absent → pair with whisperX `--lang he` for ads captions; NOT for the per-unit reading track.

2. **Port the -14 LUFS mastering chain onto the free tracks** · apply `gen_voice.py`'s highpass+deesser+compand+linear-loudnorm+verify to `gen_voice_edge.py` / `gen_voice_reading.py` (they currently single-pass -16 with no cleanup) · **Effort S** · **$0** · **Payoff: ads MEDIUM-HIGH, kids MEDIUM** (presence/de-essing is exactly what makes TTS sound "produced"; zero risk, immediate) · Ranks #2 because it is the cheapest guaranteed audible improvement and is pure engineering, no research risk.

3. **ElevenLabs v3 Hebrew opt-in for ads** · paid, char-level word times (drops into existing caption contract), audio tags for delivery · **Effort S** (engine already exists in `gen_voice.py`; add a 5-line Hebrew tag bakeoff + a per-ad flag) · **paid ~$0.03–0.10/ad** · **Payoff: ads HIGH (arena tier-A #3), kids n/a** · Ranks #3 because it is proven-good Hebrew with expressiveness but costs money and the audio-tag reliability in Hebrew is UNVERIFIED — so it's the *upgrade*, not the default.

4. **Azure direct SSML as the reading-track pronunciation fix** · same he-IL voices, F0 free (0.5M chars/mo), `<phoneme alphabet="ipa">` to force exact pointed-syllable articulation, word boundaries kept · **Effort S-M** (only for units that fail listening QA) · **$0 at our volume** · **Payoff: reading HIGH (correctness of taught sound = the whole product), ads/kids none** · Ranks #4 because it is a *targeted correctness fix* (high value, narrow scope), and it is contingent on the still-UNVERIFIED listening QA biting.

5. **ivrit-ai crowd-recital fine-tune of a commercial-legal base** · fine-tune Chatterbox (or the MIT kokoro-hebrew/F5 *pipeline* on ivrit-ai data, NOT SASPEECH) for a durable single-speaker brand voice · **Effort L** (data filtering, multi-speaker crowdsourced audio, days of GPU, a quality loop) · **$0 compute, but real engineering** · **Payoff: ads MEDIUM, kids MEDIUM-HIGH** · Ranks #5 (not higher) because Chatterbox zero-shot (proposal 1) likely gets most of the benefit with no training, and the only commercial Hebrew corpus is ASR-grade crowdsourced audio, so the ceiling on a clean brand clone is uncertain. Do this only if proposal 1's zero-shot clone isn't stable enough across videos.

6. **Better Hebrew aligner (ivrit-ai whisper fine-tune) for the fallback path** · replace/augment `imvladikon/wav2vec2-xls-r-300m-hebrew` alignment with an ivrit-ai Apache-2.0 Hebrew model, improving whisperX `--lang he` accuracy · **Effort M** (whisper fine-tunes are transcription models, not wav2vec2-CTC — needs a custom aligner or a WER-scorer harness) · **$0** · **Payoff: ads LOW-MEDIUM (only matters when edge-tts is down), kids/reading none** · Ranks #6 as a robustness improvement, not a quality driver — word-level Hebrew alignment is already ~10–30ms, adequate for captions.

**Explicitly NOT proposed (verified dead-ends for Hebrew):** XTTS-v2 (no Hebrew, CPML) · Piper (no Hebrew voice) · OpenVoice/MeloTTS (no Hebrew) · MMS (non-commercial + liturgical register) · any SASPEECH-derived checkpoint as-is (non-commercial) · Google Chirp 3 HD Hebrew (no pause/pronunciation control) · sub-word forced alignment of long clips (proven unreliable on this machine).

---

## UNVERIFIED register

| Item | Why unverified | Resolution |
|---|---|---|
| Chatterbox Hebrew sound quality vs edge-tts / Israeli-ear preference | Not in the arena; I could not listen to samples here | Proposal 1 bakeoff — render 5 lines in both, human A/B |
| ElevenLabs v3 audio-tag reliability in Hebrew | Existing findings §5 flag it; no doc promise | 5-line Hebrew tag bakeoff before relying |
| edge-tts pronunciation of isolated pointed syllables | §5 listening QA; needs a human ear | Run the §5 listening QA on the unit set |
| Azure Pronunciation Assessment Hebrew support | The phonetic-sets page didn't cover PA | Check PA language-support doc only if proposal 4 is taken |
| Gemini 3.1 Flash TTS word-timestamp availability | Docs show audio-only; no timestamps confirmed | If Gemini is ever used, assume forced-alignment is required |
| Chatterbox fine-tune recipe for Hebrew | No published Hebrew fine-tune | Only pursue under proposal 5 with ivrit-ai data |
| Fine-tune cost numbers (hours/GPU-days) for a *commercial* Hebrew voice | No published recipe on commercial-licensed data | Estimate only after proposal 1 lands |
| israwave / HebTTS / Mamre license text | israwave license unstated; SASPEECH-derivation implies non-commercial | Treat as non-commercial unless a permissive license is confirmed |

---

## Sources

- **Repo audit (this machine):** `tools/gen_voice_edge.py`, `tools/gen_voice_reading.py`, `tools/align_words.py`, `tools/gen_voice.py`, `tools/audio_gate.py`, `.claude/skills/make-ad/SKILL.md`, `.claude/skills/make-reading-short/SKILL.md`, `tools/lexicons.json`, `shorts/short-16-formy/beats.json`; live `edge_tts.list_voices()` (he-IL pair, personalities).
- **Existing research:** `research/hebrew-reading/00-findings.md` (§2 alignment, §5 voice), `research/hebrew-reading/01-subword-timing.md`, `research/hebrew-ads/hebrew-ads-deep-dive.md` (§11 tech audit), `research/hebrew-kids/07-hebrew-language-kids.md` (§1 motherese).
- **Hebrew TTS arena (live):** `https://huggingface.co/spaces/ivrit-ai/TTS-Arena-Hebrew` + `https://ivrit-ai-tts-arena-hebrew.hf.space/api/leaderboard` + provider sources (`tts.py`, `tts_providers/{deepdub,elevenlabs,gemini,inworld,openai,soniox,bluev2}.py`).
- **Open-source Hebrew TTS (GitHub API):** `avri-schneider/kokoro-hebrew` (README), `thewh1teagle/israwave` (README), `maxmelichov/Mamre-TTS` (Readme + LICENSE), `thewh1teagle/phonikud-chatterbox` (README), `asaelbarilan/f5-tts-hebrew` (README_HEBREW + LICENSE), `slp-rl/HebTTS`, `myshell-ai/OpenVoice` + `myshell-ai/MeloTTS` (README language lists).
- **Model cards / licenses:** `https://huggingface.co/coqui/XTTS-v2` (17 langs, no he, CPML) · `https://github.com/rhasspy/piper/blob/master/VOICES.md` (no he voice) · `https://huggingface.co/ResembleAI/chatterbox` (MIT, 23 langs incl. he) · `https://github.com/rany2/edge-tts` (no SSML/styles) · SASPEECH `https://www.openslr.org/134/` (30h, custom non-commercial).
- **Datasets:** `https://huggingface.co/datasets/ivrit-ai/crowd-recital` (50.4h, ivrit.ai commercial license) · `https://ivrit.ai/` (license allows commercial AI training; 22k hours) · `https://huggingface.co/ivrit-ai/whisper-large-v3-turbo` (Apache-2.0, ~5,000h Hebrew) · `https://huggingface.co/datasets/imvladikon/hebrew_speech_kan` (no license).
- **Cloud TTS:** Azure language support `https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts` (he-IL voices, **no styles**) · Azure phonetic sets `https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-ssml-phonetic-sets` (he-IL IPA set) · Azure pricing `https://azure.microsoft.com/en-us/pricing/details/cognitive-services/speech-services/` (F0 = 0.5M chars/mo free) · Gemini speech generation `https://ai.google.dev/gemini-api/docs/speech-generation` (Hebrew + style prompts, no timestamps).
