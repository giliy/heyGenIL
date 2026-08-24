# 03 — Hebrew TTS landscape 2026 (HeyGen-like product, Israeli audience)

**Compiled:** 2026-08-24. **Method:** WebFetch against Brave/Seznam ladders + direct vendor docs + the prior verified repo research (`research/pro-quality/01-voice.md`, compiled 2026-08-23 — live edge-tts + arena pulls on this machine). Every claim carries a source; anything not confirmed against a primary source is tagged **UNVERIFIED**.

**Current pipeline default:** edge-tts (`he-IL-AvriNeural` / `he-IL-HilaNeural`) free · ElevenLabs `eleven_multilingual_v3` paid fallback · kokoro excluded for Hebrew (confirmed correct — see §2).

---

## 1. Ranked engine table

Ranked by *naturalness for Israeli listeners*, per the ivrit-ai **TTS-Arena-Hebrew** human-preference leaderboard (live pull 2026-08-23) and 2026 round-ups. Elo figures are from that arena where present.

| Rank | Engine | Hebrew voices | Price (as found, dated) | Hebrew quality notes | Word-boundary support | Link |
|---|---|---|---|---|---|---|
| 1 | **Deepdub dd-etts-3.3** (Israeli) | Emma (arena) | Commercial, pricing not public — UNVERIFIED | **Arena #1 — Elo 1575, 79% win, tier S.** Purpose-built Israeli voice. Best-sounding Hebrew per Israeli listeners. | UNVERIFIED | https://huggingface.co/spaces/ivrit-ai/TTS-Arena-Hebrew |
| 2 | **Google Gemini 3.1 Flash TTS** | Puck, Zephyr + ~28 more Chirp3-HD names | Google AI Studio free tier; Cloud = pay-per-char | **Arena #2 — Elo 1571, 75% win, tier S.** "Most mature Hebrew voice set; Chirp 3 added noticeably better prosody; safer bet for customer-facing." Natural-language delivery control ("Say cheerfully…", `[whispers]`). | **NO word-level timestamps (audio-only)** → needs forced alignment | https://ai.google.dev/gemini-api/docs/speech-generation |
| 3 | **ElevenLabs `eleven_v3`** | Aria, Rachel, Adam, Bella (multilingual) | Free 10k cr; Starter $6/30k cr; Creator $22/121k; Pro $99/600k; Business $990/6M → **~$165–200 / 1M chars** (page undated, fetched 2026-08-24) | **Arena #3 — Elo 1545, 68% win, tier A.** "Decent but not native-grade; intelligible, reasonably natural for narration; multi-syllable stress occasionally lands wrong." **Requires `language_code:"he"` — v2/flash are "unintelligible" for Hebrew.** Audio tags steer delivery (Hebrew reliability UNVERIFIED). | **Char-level timestamps via `/with-timestamps`** (existing paid path consumes these) | https://elevenlabs.io/pricing · https://elevenlabs.io/docs |
| 4 | **Soniox v1** | Maya (arena) | UNVERIFIED | Arena #4 — Elo 1536, 66% win, tier A. | UNVERIFIED | (arena) |
| 5 | **Cartesia Sonic 3.5** | `he` among 42 langs | Free 20k cr; Pro $5/100k cr; Startup $49/1.25M cr; Scale $299/8M cr; voice-agent calls $0.06/min; ~750 cr ≈ 1 TTS-min (fetched 2026-08-24) | Hebrew listed "at native quality" (vendor claim, UNVERIFIED by arena — Cartesia is **not** on the Hebrew arena board). Sub-90ms latency. | Timestamps not on pricing page — UNVERIFIED | https://docs.cartesia.ai/build-with-cartesia/tts-models/latest · https://cartesia.ai/pricing |
| 6 | **Inworld TTS-2 / v1.5 MAX** | **Yael (dedicated Hebrew voice)** | UNVERIFIED (docs paywalled/redirect) | Arena #6 — Elo 1491 (TTS-2); #8 v1.5 MAX Elo 1480. Mid-tier. | UNVERIFIED | (arena) |
| 7 | **OpenAI Realtime 1.5** | coral | UNVERIFIED | Arena #5 — Elo 1503, 59% win, only 22 votes (low confidence). | UNVERIFIED | (arena) |
| 8 | **OpenAI gpt-4o-mini-tts / tts-1** | alloy, nova, etc. — **none Hebrew-optimized** | ~$0.015/min (round-up figure, 2026-07) | Arena #10–12 (nova): mini Elo 1456, tts-1-HD 1446, tts-1 1427 — **bottom of the board.** OpenAI docs: voices "currently optimized for English"; Hebrew supported via Whisper language set but quality is the weakest of the tested majors. | No word-level timestamps documented | https://developers.openai.com/api/docs/guides/text-to-speech |
| 9 | **edge-tts (Microsoft Edge free service)** | `he-IL-AvriNeural` (M), `he-IL-HilaNeural` (F) — **the ONLY two** | **$0** | **Not on the arena at all** (as are no Azure he-IL voices) — the honest read: free he-IL neural is intelligible but flat, single "Friendly/Positive" energy, no styles. Adequate for clean narration; cannot do punchy/motherese prosody. | **Native per-word `WordBoundary` events, sub-ms offsets (verified live)** — the trustworthy caption-timing source | https://github.com/rany2/edge-tts |
| 10 | **Azure Speech (direct REST)** | same `he-IL-AvriNeural`/`HilaNeural` (Standard neural) | **F0 free tier = 0.5M chars/month free neural**; pay-per-char beyond (rates render as "$-" placeholders on page — UNVERIFIED numerically) | Same flat voices as edge-tts (same models). **But restores full SSML:** `<phoneme alphabet="ipa">` (full he-IL IPA set: 5 vowels + 23 consonants), `<break>`, `say-as`, per-sentence prosody. **No `mstts:express-as` styles — he-IL voices list none.** Word/viseme boundary events supported on neural voices generally. | Word-boundary + viseme events via SSML/SDK | https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts |
| 11 | **Google Cloud TTS (Chirp 3 HD)** | `he-IL` supported | Free tier; pay-per-char (tier not priced on page) | Hebrew supported incl. Chirp 3 HD. **Cut from pause-control AND custom-pronunciation for `he-IL`**; expressive control weak. No advantage over Azure for pronunciation control. | UNVERIFIED | https://docs.cloud.google.com/text-to-speech/docs/chirp3-hd |
| 12 | **MiniMax Speech 2.8** | UNVERIFIED (announcement lists no full language list) | UNVERIFIED | Clone-from-10s; sound tags (`[laughs]`,`[breath]`). danielrosehill repo (2025-03) rated MiniMax T2A v2.6 Turbo **"Best"** with "Hebrew boost enabled" — cloned voices natural in Hebrew. Current 2.8 Hebrew support UNVERIFIED. | UNVERIFIED | https://www.minimax.io/news/minimax-speech-28 |
| 13 | **Amazon Polly** | **NONE — no he-IL voice** (verified in full voice table) | Standard/Neural tiers | **No Hebrew support.** Out. | n/a | https://docs.aws.amazon.com/polly/latest/dg/available-voices.html |
| 14 | **Play.ht** | UNVERIFIED (language list page 404s; Hebrew not confirmed) | From $39/mo (round-up) | No primary-source Hebrew confirmation. | UNVERIFIED | https://docs.play.ht |
| 15 | **Hume Octave** | UNVERIFIED (product page 404s) | UNVERIFIED | No primary-source Hebrew confirmation. | UNVERIFIED | https://www.hume.ai |

**The blunt summary:** for *expressive* Hebrew the leaders are all **paid cloud** (Deepdub / Gemini 3.1 / ElevenLabs v3). Free he-IL (edge-tts/Azure) is intelligible but flat and sits off the arena board entirely.

---

## 2. Hebrew-specific quality issues

- **Nikkud (vowel points) as disambiguation input:** This is a *preprocessing* concern, not an engine feature — no major engine documents "accepts nikudded text to disambiguate" as a first-class flag (nisai.dev 2026-07 notes missing written vowels in training text degrades grapheme-to-phoneme accuracy). The fix is a G2P front-end. **Phonikud** (github.com/phonikud/phonikud, INTERSPEECH 2026, CC BY 4.0 code) adds nikud via a neural model (`phonikud-onnx`) then converts to IPA via a rule-based FST — produces "modern spoken phonemes" (5 vowels, 24 consonants, stress `ˈ`). Handles Vocal Shva, Hat'ama (stress), expands dates/numbers, mixed-English fallback. Limits: some nikud sounds formal; Hat'ama "not always accurate"; no choice between phonetic variants; for higher accuracy it points to **Renikud**. This is the right disambiguation layer for ambiguous words / qamatz-vs-qubuts-type edge cases.
- **Stress patterns:** ElevenLabs specifically "stress on multi-syllable words occasionally lands wrong" (nisai.dev). Phonikud's stress-marked IPA is the mitigation.
- **Code-switching Hebrew↔English (the defining Israeli failure mode):** "Mixed-language sentences are the real failure mode" — example `תשלח לי email ב-Slack` "breaks single-language TTS pipelines." **Test vendors on real support transcripts, not clean demo text, and bake off ≥3 vendors if Hebrew is load-bearing** (nisai.dev 2026-07). This is the single most important Hebrew QA gate.
- **Numbers/dates/URLs:** handled at the G2P/normalization layer — Phonikud explicitly expands dates/numbers. Engine-native normalization for Hebrew URLs is UNVERIFIED.
- **Emotional range / pacing control:** Gemini 3.1 (natural-language style prompts + audio tags) and ElevenLabs v3 (audio tags) are the only ones with real delivery steering for Hebrew. edge-tts/Azure he-IL have **no styles/roles** — only global rate/pitch/volume (edge) or per-sentence prosody SSML (Azure). Google Chirp 3 HD Hebrew is cut from pause-control.

---

## 3. Voice cloning for Hebrew

| Option | Hebrew? | Cost | Legal for commercial | Notes | Link |
|---|---|---|---|---|---|
| **ElevenLabs Instant Voice Cloning** | ✅ (on `eleven_v3` only) | **Starter $6/mo** and up; Pro Voice Cloning from Creator $22/mo (fetched 2026-08-24) | ✅ | Cheapest reputable Hebrew-capable commercial clone. | https://elevenlabs.io/pricing |
| **Chatterbox Multilingual V3** (ResembleAI) | ✅ **`he` in official 23-lang list** | **Free / self-host** | ✅ **MIT** | **Best free/self-host expressive option.** Zero-shot clone from seconds of a *consented* reference; `exaggeration`+`cfg` knobs. Working Hebrew G2P wrapper: `thewh1teagle/phonikud-chatterbox`. Sound-vs-edge-tts UNVERIFIED (not in arena) → bakeoff required. 0.5B params. | https://huggingface.co/ResembleAI/chatterbox |
| **Cartesia** | ✅ (`he` in 42 langs) | Instant cloning from Pro $5/mo; Pro cloning from Startup $49/mo (fetched 2026-08-24) | ✅ | "Voice localization 225 credits one-time." Hebrew clone quality UNVERIFIED (not in arena). | https://cartesia.ai/pricing |
| **MiniMax Speech 2.8** | UNVERIFIED | UNVERIFIED | Commercial | Clone from 10s sample. danielrosehill rated MiniMax best-with-clones for Hebrew (2025-03). | https://www.minimax.io/news/minimax-speech-28 |
| **XTTS-v2** (Coqui) | ❌ **NO Hebrew** (17 langs, he absent) | free | CPML | Out for Hebrew. | https://huggingface.co/coqui/XTTS-v2 |
| **F5-TTS** | base EN+ZH only; `asaelbarilan/f5-tts-hebrew` pipeline exists | free | **base weights CC-BY-NC ⛔** | Non-commercial base; pipeline reusable on own data. | https://github.com/asaelbarilan/f5-tts-hebrew |
| **OpenVoice v2** | ❌ natively no he (EN/ES/FR/ZH/JA/KO) | free | MIT | Hebrew not first-class. | https://github.com/myshell-ai/OpenVoice |
| **Fish Audio S2 Pro** | UNVERIFIED for Hebrew | $15/1M chars (round-up) | Commercial | Tops TTS-Arena2 globally (English-centric); no Hebrew arena presence. | https://gradium.ai/content/best-elevenlabs-alternatives-2026-tts-apis-voice-quality-price |

**Do open clones handle Hebrew phonemes?** Only Chatterbox (official `he`) among MIT/Apache bases. The good-sounding ready Hebrew checkpoints (kokoro-hebrew, Mamre-TTS, israwave, HebTTS) all derive from **SASPEECH — 30h single-speaker, custom NON-COMMERCIAL license (IPBC/Kan)** → unusable in a commercial product. **The only commercially-usable Hebrew speech corpus at scale is ivrit-ai's** (crowd-recital 50h + ~22k-hour ASR corpus, ivrit.ai license permits commercial AI training).

---

## 4. edge-tts deep dive

- **Hebrew voices:** exactly two — `he-IL-AvriNeural` (male), `he-IL-HilaNeural` (female), both tagged `VoicePersonalities:["Friendly","Positive"]`, no tailored scenarios. **Verified live on this machine** (pro-quality/01-voice.md).
- **Delivery knobs:** `--rate` (±N%), `--pitch` (±NHz), `--volume` (±N%) only. **Custom SSML was REMOVED** — "Microsoft prevents the use of any SSML" not generated by Edge itself; only a single `<voice>` tag with one `<prosody>` inside. No styles, no `styledegree`, no phoneme control, no per-word prosody.
- **Word/phoneme boundary events:** **YES — native per-word `WordBoundary` events with sub-millisecond offsets** (verified live; the ads track rides these for captions). `--write-subtitles` emits SRT. (The README itself doesn't name the WebSocket event, but the repo code + live run confirm WordBoundary — verified in prior research.)
- **License:** **GPL-3.0** — copyleft obligations apply to derivative works (a real consideration for shipping a product that bundles it).
- **ToS / commercial risk:** It uses Edge's online service **without an API key** by mimicking Edge. Microsoft actively restricts the service (the SSML removal proves they lock it to Edge-generated requests). **No ToS discussion in the repo.** For a commercial product this is a genuine risk factor: Microsoft can throttle/block unsanctioned usage at will, and there's no commercial license. **Recommend independent legal review before shipping edge-tts as the production voice of a paid product.** The safe commercial equivalent is **Azure Speech direct** (same voices, F0 0.5M chars/mo free, full SSML) — paid/legit, restores SSML.

---

## 5. Whisper-family ASR quality on Hebrew (for alignment)

| Model | Hebrew WER / notes | License | whisperx-compatible? | Link |
|---|---|---|---|---|
| **ivrit-ai/whisper-large-v3-turbo** | Apache-2.0, 0.8B, trained Apr 2025 on **~5,050h Hebrew** (knesset-plenums 4,700h + crowd-transcribe-v5 300h + crowd-recital 50h). WER figures NOT on the card → see `ivrit-ai/hebrew-transcription-leaderboard` Space (data not fetchable — UNVERIFIED numerically). Org calls the ct2 variant "state-of-the-art Hebrew speech-to-text." **Caveat: language-detection degraded in training — set Hebrew token explicitly; translation task degraded.** | **Apache-2.0** | Transcription model (whisper, not wav2vec2-CTC) → does NOT drop into whisperx `load_align_model` directly; better as a custom-aligner basis or WER-scorer | https://huggingface.co/ivrit-ai/whisper-large-v3-turbo |
| **ivrit-ai/whisper-large-v3-ct2 / -turbo-ct2 / -turbo-onnx** | ct2 = CTranslate2-converted (faster-whisper-ready). Updated Oct–Dec 2025. | Apache-2.0 | ct2 variants run in faster-whisper | https://huggingface.co/ivrit-ai |
| **openai/whisper large-v3 (base)** | Supports Hebrew (99-lang model). Hebrew-specific WER not on card — UNVERIFIED. | MIT | via faster-whisper / whisperx | — |
| **faster-whisper** | CTranslate2 reimplementation of Whisper; inherits its multilingual capability (Hebrew included). **No Hebrew-specific benchmarks in the README.** Supports converting any fine-tuned Whisper (incl. ivrit-ai's) via `ct2-transformers-converter`. | MIT | Yes (it IS the faster-whisper backend) | https://github.com/SYSTRAN/faster-whisper |
| **whisperx default Hebrew aligner** | resolves `--lang he` → `imvladikon/wav2vec2-xls-r-300m-hebrew` (wav2vec2-xls-r-300m CTC). Word-level ~10–30ms jitter — **usable for captions (≈1 frame @30fps)**. **Sub-word/syllable alignment NOT reliable** (boundaries land in silence; CTC jitter 20–40ms fatal for highlight==sound). | (model license) | native whisperx slot | verified in research/hebrew-reading/00-findings.md §2 |

**Bottom line for alignment:** keep edge-tts WordBoundary as the primary caption source; whisperx `imvladikon/wav2vec2-xls-r-300m-hebrew` is the adequate word-level fallback; for a *better* Hebrew aligner or WER-scoring harness use the **ivrit-ai Apache-2.0** whisper fine-tunes (custom aligner — they're transcription, not CTC, models).

---

## 6. Recommended Hebrew TTS ladder (default-free / mid / premium)

| Tier | Engine + concrete voice IDs | Price | When to use | Word-boundary path |
|---|---|---|---|---|
| **Default-free** | **edge-tts** `he-IL-AvriNeural` (M) / `he-IL-HilaNeural` (F) | $0 | Clean narration, the per-unit reading track (exact-by-construction timing is the moat), $0 ads default. Accept the flat delivery. | Native WordBoundary ✅ |
| **Default-free, more control** | **Azure Speech direct** same `he-IL-AvriNeural/HilaNeural` + SSML `<phoneme alphabet="ipa">` | **F0: 0.5M chars/mo free** | Targeted **pronunciation fix** for misread pointed syllables (qamatz/qubuts, stress) — same voice family, exact-articulation control. NOT an expressiveness upgrade (no he-IL styles). Legit commercial footing vs edge-tts's ToS risk. | Word/viseme events via SSML ✅ |
| **Mid (paid, expressive)** | **ElevenLabs `eleven_v3`** (`language_code:"he"`) — Aria / Rachel / Adam / Bella | **~$165–200 / 1M chars**; free 10k cr to test; cloning from Starter $6/mo | The **per-ad opt-in upgrade** for a punchy read (arena tier-A #3). Audio tags steer delivery. **Never use v2/flash for Hebrew — unintelligible.** | Char-level `/with-timestamps` ✅ (existing caption contract) |
| **Premium (best Hebrew)** | **Google Gemini 3.1 Flash TTS** (Puck/Zephyr) **or Deepdub dd-etts-3.3** (Emma) | Google pay-per-char / Deepdub UNVERIFIED | Tier-S arena leaders for Israeli-ear naturalness. Use when Hebrew voice quality is the headline feature. **Caveat: no word-level timestamps** → pair with whisperx `--lang he` forced alignment for captions. | None native → whisperx align ⚠️ |
| **Free self-host wildcard** | **Chatterbox Multilingual V3** (MIT), zero-shot clone of a *consented* Israeli voice + **Phonikud** G2P front-end | $0 (GPU) | Only commercial-legal free model that does expressive Hebrew (`exaggeration` knob for motherese/sales punch). **Requires a 5-line A/B bakeoff vs edge-tts before adoption** (sound quality UNVERIFIED). | None native → whisperx `--lang he` |

**Pipeline notes for this repo:**
- Keep the **reading per-unit track on edge-tts per-clip + RMS trim** — only exact-by-construction path; fix mispronounced units with **Azure `<phoneme>`**, not an engine swap.
- Add a **Phonikud preprocessing step** in front of any engine for ambiguous words / code-switched lines — it is the only documented nikkud→IPA disambiguator and feeds all of edge/Azure/Chatterbox.
- **Bakeoff before trusting:** (a) ElevenLabs v3 Hebrew audio-tag reliability, (b) Chatterbox-vs-edge-tts Israeli-ear preference, (c) edge-tts isolated pointed-syllable pronunciation — all UNVERIFIED.
- **Kokoro exclusion confirmed correct:** base Kokoro-82M has no Hebrew; `kokoro-hebrew` is SASPEECH-derived → non-commercial.

---

## UNVERIFIED register

| Item | Status |
|---|---|
| Deepdub dd-etts-3.3 pricing + word-timestamp support | UNVERIFIED (arena-verified quality only) |
| Gemini 3.1 Flash TTS word timestamps | Assumed absent (audio-only) — UNVERIFIED |
| ElevenLabs v3 audio-tag reliability in Hebrew | UNVERIFIED — needs 5-line bakeoff |
| Chatterbox Hebrew sound vs edge-tts (Israeli-ear) | UNVERIFIED — not in arena, needs bakeoff |
| MiniMax Speech 2.8 Hebrew support + pricing | UNVERIFIED (older v2.6 Hebrew-clone report only) |
| Play.ht / Hume Hebrew support | UNVERIFIED (language pages 404 / paywalled) |
| Cartesia word-level timestamps + Hebrew clone quality | UNVERIFIED |
| Inworld pricing / cloning / timestamps | UNVERIFIED (docs redirect to login) |
| openai/whisper large-v3 Hebrew WER, ivrit-ai leaderboard numbers | UNVERIFIED (leaderboard data loads dynamically) |
| edge-tts isolated pointed-syllable pronunciation | UNVERIFIED — needs human listening QA |
| Azure numeric per-1M-char rate | UNVERIFIED (page renders "$-" placeholders; F0 0.5M/mo free confirmed) |

## Sources
- Arena: https://huggingface.co/spaces/ivrit-ai/TTS-Arena-Hebrew (+ /api/leaderboard, pulled 2026-08-23 per pro-quality/01-voice.md)
- Round-ups: https://nisai.dev/guides/ai-voice-tts-2026/ (2026-07-14) · https://gradium.ai/content/best-elevenlabs-alternatives-2026-tts-apis-voice-quality-price
- edge-tts: https://github.com/rany2/edge-tts (+ README) · Azure: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts · https://azure.microsoft.com/en-us/pricing/details/cognitive-services/speech-services/
- Google: https://docs.cloud.google.com/text-to-speech/docs/chirp3-hd · https://ai.google.dev/gemini-api/docs/speech-generation
- ElevenLabs: https://elevenlabs.io/pricing · https://elevenlabs.io/docs · https://elevenlabs.io/text-to-speech/hebrew
- Cartesia: https://docs.cartesia.ai/build-with-cartesia/tts-models/latest · https://cartesia.ai/pricing
- OpenAI: https://developers.openai.com/api/docs/guides/text-to-speech · Amazon Polly: https://docs.aws.amazon.com/polly/latest/dg/available-voices.html
- Cloning/open: https://huggingface.co/ResembleAI/chatterbox · https://huggingface.co/coqui/XTTS-v2 · https://github.com/myshell-ai/OpenVoice · https://github.com/phonikud/phonikud · https://github.com/danielrosehill/Hebrew-TTS-Providers · https://www.minimax.io/news/minimax-speech-28
- ASR: https://huggingface.co/ivrit-ai · https://huggingface.co/ivrit-ai/whisper-large-v3-turbo · https://github.com/SYSTRAN/faster-whisper · https://huggingface.co/spaces/ivrit-ai/hebrew-transcription-leaderboard
- Prior verified repo research: research/pro-quality/01-voice.md · research/hebrew-reading/00-findings.md
