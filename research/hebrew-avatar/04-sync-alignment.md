# 04 — Lip-Sync Quality Engineering, Hebrew Alignment & RTL Captions (HeyGen-like product)

**Compiled:** 2026-08-24. **Method:** WebFetch against Brave/Seznam search ladders + direct primary sources (arXiv full text, GitHub READMEs/LICENSEs, HF model cards, W3C/Unicode docs) + live probes against this machine's `.venv-voice312` (edge-tts Hebrew voices, WhisperX). Every claim carries a source URL; anything not confirmed against a primary source is tagged **UNVERIFIED**.

**Scope vs. siblings:** `02-lipsync-models.md` picks *which* models/endpoints; `03-hebrew-tts.md` picks the *voice*. This file is the **quality + QA layer**: what makes sync look "HeyGen-good," whether Hebrew phonetics are a risk, how to get word-exact Hebrew captions, how to render RTL captions without bidi bugs, how to upscale cheaply, and how to gate sync quality in CI.

> **Repo reality:** the whole caption-timing spine already exists here. `tools/gen_voice_edge.py` synthesizes edge-tts with `boundary="WordBoundary"` and writes real per-word `{w,start,end}` into `beats.json`; `tools/align_words.py` is the WhisperX fallback (`--lang he` → auto-resolves the Hebrew wav2vec2). Captions already sync exactly from those word times. This report's job is to harden + QA that spine for the avatar product.

---

## TL;DR — the seven decisions this drives

1. **"HeyGen-good" is a full-face problem, not a lip-corner problem.** The 2025-2026 quality levers, ranked by the literature: (a) a **task-matched sync-trained audio encoder** beats both joint-trained and generic self-supervised (Wav2Vec2) encoders; (b) **native high mouth-region resolution** (512×512 latent, with explicit teeth/gum structure) — not post-hoc upscale; (c) **Reference-Attention identity injection** (EchoMimic-style Reference U-Net), not channel-concat or image embeddings; (d) **temporal self-attention motion module** to kill single-frame jitter; (e) fixing **identity-reference lip leaking**. Teeth visibility and tongue/jaw gestures are explicit human-eval axes.
2. **Language matters less for audio-driven models than for text-driven ones** — but the audio encoder's *training language* is the hidden variable. Whisper-encoder models (LatentSync, MuseTalk, HighSync) inherit Whisper's 99-language coverage incl. Hebrew; **chinese-wav2vec2-encoder models (InfiniteTalk, MultiTalk) are the Hebrew risk** (already flagged in `02`/`avatar-backend-models`). Wav2Lip's ReSyncED benchmark was built by TTS-dubbing ~55 languages — the strongest published evidence that audio-feature models are language-agnostic *when the encoder is*.
3. **Best free word-exact Hebrew timing = edge-tts `WordBoundary` first** (native, zero-aligner, already wired), **WhisperX + `imvladikon/wav2vec2-xls-r-300m-hebrew` as the fallback / re-verify path**. WhisperX hard-maps `he`→ that model in `DEFAULT_ALIGN_MODELS_HF`. MFA has **no** Hebrew model; Gentle is English-only — both dead ends.
4. **RTL caption bugs come from skipped bidi + wrong base direction, not from fonts.** Set base direction with *markup* (`dir`/`RLI…PDI`), never rely on raw RLM/LRM sprinkled in text; wrap embedded Latin/numbers in isolating marks. The failure signature is punctuation/line-breaks landing on the wrong side (confirmed by an OpenCut issue).
5. **Burned-caption fonts: keep Rubik/Heebo** — both SIL OFL 1.1 (commercial-OK), both niqqud-safe (Rubik added explicit OpenType nikkud mark positioning; Heebo is Hebrew-primary). No new display font needed.
6. **Upscale talking-head output with a face-aware per-frame restorer (CodeFormer / GFPGAN) + Real-ESRGAN background, and accept that none of the cheap GAN restorers are temporally consistent** — mitigate flicker with RealBasicVSR (recurrent) where it fits, or by ordering ops so the face restorer runs at the *target* mouth resolution. Cheap-restorer licenses: GFPGAN Apache-2.0, Real-ESRGAN BSD-3, **CodeFormer NTU S-Lab (custom — read before commercial use)**.
7. **Gate sync quality with SyncNet LSE-C/LSE-D in CI.** `joonson/syncnet_python` is MIT and runs on Python 3.10 + PyTorch 2.5.1 / CUDA 12.4 (current). Use **LSE-C ≥ ~6.9 as a floor** (real-video baseline on LRS2/LRS3 is ~7.6–7.9) and LatentSync's own data-cleaning cutoff (**SyncNet confidence < 3 = discard**) as the hard reject. Pair with a rendered-frame visual read — never ship on the metric alone.

---

## 1. What makes lip-sync look "HeyGen-good" vs "cheap"

The literature is unambiguous that perceived quality is a *bundle* of full-face cues, not just mouth-corner accuracy. Sources below are 2023-2026 arXiv full-text reads.

### The quality levers, ranked

**(a) Audio encoder — task-matched beats generic or joint-trained.** The strongest single finding is from *Audio-driven Talking Face Generation with Stabilized Synchronization Loss* (arXiv:2307.09368v3). Their ablation holds the input representation constant (mel-spectrogram 16×80) and varies only the *encoder*:

| Setup | Encoder | LSE-C ↑ | LSE-D ↓ | LMD ↓ |
|---|---|---|---|---|
| A | trained jointly with generator | 7.116 | 7.396 | 2.408 |
| **B** | **pretrained frozen AVSyncNet (sync objective)** | **7.271** | **7.106** | 2.325 |
| C | Wav2Vec2 (large self-supervised) | 7.220 | 7.158 | 2.278 |

> "We obtain the best score with such frozen audio encoder" — Wav2Vec2's *large-scale* pretraining "slightly decreases the scores." **Task-matched (sync-objective) pretraining beats scale.** Counterpoint: the viseme-dynamics work (arXiv:2301.06059) found Wav2Vec2 features "sufficient to produce high-quality viseme curve output" for *3D* animation — so Wav2Vec2 is fine for landmark/viseme regression, but a sync-trained encoder edges it for *photoreal pixel* generation.

**(b) Identity-reference "lip leaking" is a real failure mode.** Same paper: because the identity reference frame is randomly sampled, its lip shape sometimes already matches the target audio, and the generator "tends to replicate the lip movements from the identity reference, resulting in poor lip synchronization." Their fix is a silent-lip generator that closes the reference's lips. **Takeaway: when QA-ing, test with identity frames whose mouth is *not* near the target pose.**

**(c) Native mouth-region resolution + teeth/tongue.** HighSync (arXiv:2605.16918v1) is the clearest 2026 statement: it runs **natively at 512×512** and produces "anatomically plausible teeth structures with realistic gum boundaries and individual tooth definition," which it attributes to the 512² latent + pixel-space Spatial Loss. The phoneme-viseme work (MuEx, arXiv:2510.06612v1) makes teeth/tongue an explicit human-eval axis ("teeth visibility clarity and naturalness"; gestures of "lip closure, tongue elevation, or jaw movement"). **Cheap lip-sync is recognizable precisely by a smeared mouth interior (no teeth/tongue).**

**(d) Identity preservation via Reference-Attention, not concat.** HighSync rejects channel-concatenation and image embeddings as "insufficient" and instead uses an EchoMimic-style **Reference U-Net injecting identity at every transformer block**. The survey (arXiv:2308.16041v2) formalizes the identity term as a face-recognition cosine-similarity loss.

**(e) Temporal consistency via a motion module.** HighSync uses AnimateDiff-style temporal self-attention over 12-frame batches — and only *after* fixing two data-leakage sources (per-frame bbox height jitter; upper-face↔lip biomechanical coupling via masked attention). The survey lists the generic levers: "frame-difference, optical-flow, or feature-consistency losses," plus temporal discriminators. **This is the anti-jitter lever** — and it's what MuseTalk (single-step, single-frame) lacks by design, which is why MuseTalk's README admits "jitter from single-frame generation."

**(f) Emotion / blink / head micro-motion.** These are present but secondary in the *sync-accuracy* literature — they're the province of the *portrait-animation* models (EmoFace arXiv:2407.12501, Audio2Face-3D arXiv:2508.16401). For a talking-avatar product, blink/head-motion realism is a *generator* property (OmniHuman/HeyGen class), not something a re-dub model (LatentSync/MuseTalk) adds. **Implication: pick the generator for motion realism; pick the re-dub model for sync accuracy — they are different lanes (matches `02`).**

### Evaluation metrics the field actually reports
From the survey (arXiv:2308.16041v2) + Wav2Lip (arXiv:2008.10010): **LSE-C / LSE-D** (lip-sync confidence/distance — see §6), **FVD** (video distribution quality, temporal dynamics, but *not* lip-audio matching), **CSIM** (identity cosine similarity), plus human studies. ⚠️ **Terminology trap:** MuEx (2510.06612) *redefines* "LSE-D" as a 26-point MediaPipe lip-landmark geometric error, *not* the SyncNet distance — when comparing papers, check which LSE-D they mean. Wav2Lip's LSE-D is SyncNet-based; MuEx's is landmark-based.

---

## 2. Audio-driven vs text-driven — does language matter for Hebrew?

**Short answer:** for audio-driven models, the *text* is irrelevant — but the **audio encoder's training distribution** is everything. Language only "doesn't matter" if the encoder was trained multilingually.

### The evidence

- **Wav2Lip is the canonical language-agnostic case** (arXiv:2008.10010). It lip-syncs "arbitrary talking face videos in the wild with arbitrary speech," "not limited by identities, voices, or vocabulary." Critically, its ReSyncED "TTS" benchmark category was **built by Google-Translate-dubbing ~55 languages** — i.e., the model was *validated* cross-lingually, and still matched real-video sync. This works because it maps **acoustic features → visemes** and never sees text.
- **Whisper-encoder models inherit Whisper's multilingual coverage.** LatentSync uses **whisper-tiny** ("to convert melspectrogram into audio embeddings" via cross-attention). MuseTalk uses a frozen **whisper-tiny** and "supports audio in various languages, such as Chinese, English, and Japanese" — **Hebrew not named** (UNVERIFIED for Hebrew specifically). HighSync switched *from* Wav2Vec2 *to* Whisper because Whisper embeddings are "linguistically structured and robust to acoustic variation." Whisper formally supports Hebrew (`he`, in the 99-language list — confirmed in `avatar-backend-models-2026-08.md`). **This is the strongest technical basis for Hebrew, but it is inference from the encoder, not a vendor guarantee.**
- **chinese-wav2vec2 encoders are the Hebrew risk.** InfiniteTalk and MultiTalk use a **chinese-wav2vec2** encoder (confirmed in `avatar-backend-models-2026-08.md`). A monolingual-Chinese-trained acoustic encoder will mis-represent Hebrew phonetics. **If a candidate uses chinese-wav2vec2, Hebrew QA is mandatory before shipping.**
- **wav2vec2 XLSR-53 does NOT include Hebrew; XLS-R 128 does** (from `avatar-backend-models-2026-08.md`, citing the XLSR model card + arXiv:2006.13979). So even within wav2vec2, coverage is model-specific.

### Gutturals ח/ע/ר — the honest status
**UNVERIFIED in published literature.** No 2025-2026 talking-head paper evaluates Hebrew gutturals specifically. MuEx covers 12 languages (incl. **Arabic**, which shares pharyngeal/guttural phonemes with Hebrew) and flags Arabic + Thai as "underrepresented," with tonal languages hardest. The phoneme-viseme argument (arXiv:2510.06612) is that articulatory *gestures* ("lip closure, tongue elevation, jaw movement") recur across languages — gutturals are largely **pharyngeal/glottal** with minimal lip articulation, which is actually *easier* for a lip-sync model (little visible mouth target) than, say, rounded labials. **But this is inference, not evidence → the Hebrew guttural test set is non-negotiable (see `02`'s 2-stage gate).**

### Does phoneme-level pre-processing help?
**Yes — for cross-lingual generalization.** MuEx's core claim (2510.06612) is that phoneme→viseme prototypes (~K=40 language-agnostic anchors) enable zero-shot transfer where end-to-end audio→video models fail, because English-dominated training "learn[s] English-specific alignment" without modeling "the underlying phonological principles." **Practical upshot for us:** you don't need to feed Hebrew text to the sync model (audio-driven), but a **phoneme-aware pre-pass** (or choosing a model with a multilingual acoustic encoder) is the lever that protects non-English quality. This is a model-selection criterion, not a pipeline step you add.

---

## 3. Word-level alignment for Hebrew captions

### Tool matrix (verified 2026-08-24)

| Tool | Hebrew? | Mechanism | Status for us |
|---|---|---|---|
| **edge-tts `WordBoundary`** | ✅ he-IL voices | native TTS word events | **PRIMARY — free, zero-aligner, already wired** |
| **WhisperX** | ✅ auto | wav2vec2 forced align | **FALLBACK / re-verify** (`--lang he`) |
| **ivrit-ai** | ✅ but Whisper-only | ASR (no CTC aligner) | use their Whisper for *transcription*, not alignment |
| **MFA** | ❌ no Hebrew model | GMM/DNN forced align | dead end |
| **Gentle** | ❌ English-only | Kaldi English | dead end |
| **ElevenLabs Forced Alignment API** | UNVERIFIED for he | paid API | optional paid path |

### edge-tts WordBoundary — the primary path
- **Hebrew voices confirmed live on this machine (2026-08-24):** `he-IL-AvriNeural`, `he-IL-HilaNeural` (probed via `edge_tts.list_voices()` in `.venv-voice312`).
- **Mechanism:** `edge_tts.Communicate(text, voice, boundary="WordBoundary")` yields `WordBoundary` chunks with offsets; `tools/gen_voice_edge.py` already converts them to `{w,start,end}` and writes them to `beats.json` (captions "sync exactly" from these).
- **Accuracy caveat (empirically probed in `research/hebrew-reading/01-subword-timing.md`):** edge-tts **pads every clip with ~0.22–0.40s leading and ~1.05s trailing silence**, and the WordBoundary *end* can drift past acoustic end. For **whole-word** caption timing this is fine (word start/end are word-accurate); the padding only matters if you assume a fixed global offset — **don't; trim per-clip by RMS energy if you need absolute speech bounds.**
- **License note:** edge-tts is LGPL/GPL-family (repo ships `LICENSE` + `gpl-3.0.txt`); it shells the *consumer* Edge endpoint. Fine for a pipeline tool; do not redistribute as your own TTS.

### WhisperX + Hebrew wav2vec2 — the fallback / re-verify path
- **Confirmed model id:** WhisperX `DEFAULT_ALIGN_MODELS_HF` hard-maps **`he` → `imvladikon/wav2vec2-xls-r-300m-hebrew`** (read from `whisperx/alignment.py` source). So `whisperx audio.wav --language he` (or `tools/align_words.py --lang he`) resolves the Hebrew aligner automatically.
- **Model facts (HF card):** fine-tuned `facebook/wav2vec2-xls-r-300m` (0.3B, F32 safetensors); stage-2 WER 0.1697 (small dev) / 0.2318 (large dev); ~1.06M downloads/month; **license not stated on the card → verify before commercial reliance**. It's a standard `AutoModelForCTC`, so CTC forced alignment is applicable by construction.
- **Accuracy caveat (probed in `01-subword-timing.md`):** for **whole-clip word onsets** WhisperX lands ~10–30ms off true acoustic onset (fine for word captions). It was **disqualified for sub-word/syllable** timing (boundaries landed in silence). **Use it at word level only.**
- **Prereq:** whisperx pins `ctranslate2==4.4.0` → needs **Python <3.13** — which is exactly why this repo keeps `.venv-voice312` (Py 3.12). Already satisfied.

### ivrit-ai's role
ivrit-ai ships excellent Hebrew **Whisper** ASR (`ivrit-ai/whisper-large-v3`, `-turbo`, ct2/onnx/ggml) but **no wav2vec2/CTC alignment model** (full org model list pulled 2026-08-24). Use their Whisper for **transcription** when you don't have a ground-truth script; use WhisperX+wav2vec2 for **alignment**. Since our pipeline *has* the script (we generated the TTS), we always have the transcript → WhisperX forced alignment is the right tool.

### Best free path (recommendation)
1. **Generate** with edge-tts he-IL + `WordBoundary` → word times for free (already in `gen_voice_edge.py`).
2. **Re-verify** any line whose WordBoundary looks off by running `tools/align_words.py --lang he` (WhisperX + `imvladikon/...hebrew`) and cross-checking onsets (Δ < ~50ms = trust edge-tts; larger = trust WhisperX).
3. Never use edge-tts `visemeEnabled` for caption identity (fires but carries **no grapheme identity** — probed) and never attempt sub-word alignment (disqualified).

---

## 4. RTL caption rendering pitfalls in the video pipeline

### The failure modes (all avoidable)
The OpenCut issue #826 ([github.com/OpenCut-app/OpenCut/issues/826](https://github.com/OpenCut-app/OpenCut/issues/826)) is a clean catalog of what breaks when a caption pipeline doesn't do bidi: Hebrew "reads left-aligned or visually reversed instead of right-aligned RTL," mixed Hebrew/Latin segments "appear in the wrong order because the bidirectional algorithm isn't applied," and captions "place punctuation and line breaks on the wrong side." This is the default failure signature for any renderer (ffmpeg drawtext, ASS, Remotion DOM) that treats Hebrew as LTR bytes.

### The rules (W3C + Unicode UAX#9)
From [W3C qa-bidi-controls](https://www.w3.org/International/questions/qa-bidi-controls) and [UAX#9](https://www.unicode.org/reports/tr9/):

1. **Set base direction with markup, not control codes.** In the Remotion/DOM path that means `dir="rtl"` (or CSS `direction: rtl`) on the caption container — *not* sprinkling `‏` into the text. Control codes "don't cross paragraph boundaries" and can't set container direction.
2. **Wrap embedded opposite-direction runs in isolates.** Hebrew with embedded English words / numbers / code → wrap the Latin/number run in an isolate so surrounding neutral punctuation resolves to the correct side. W3C/Unicode recommend **RLI/LRI/PDI (U+2066–2069) over RLE/LRE/PDF**; RLM (U+200F)/LRM are only for bare attribute values / plain-text where markup is unavailable.
3. **Punctuation is neutral** → it takes direction from surrounding text. A trailing `.` or `,` on a Hebrew line will jump to the wrong side unless the base direction is RTL and any trailing Latin/number is isolated. This is the single most common visible bug.
4. **Plain-text exports (SRT/VTT) carry no direction metadata** → players must auto-detect. Most modern players apply UAX#9 per line, but the safe move for burned captions is: **render RTL in the renderer you control** (Remotion DOM with `dir=rtl`), don't rely on the player's bidi for SRT.

**This repo's posture:** full-line RTL caption rendering is already built (per `heygen-hebrew-platform-plan.md`). The net-new work for the avatar product is to (a) guarantee the caption container sets `dir=rtl`, (b) isolate any embedded Latin/number (brand names, prices, phone numbers in ads), and (c) QA punctuation placement on rendered frames at phone scale.

### Niqqud rendering in fonts
Covered in depth in `research/hebrew-reading/02-pointed-hebrew-typography.md`. The short version for *captions* (vs. early-reader display): niqqud is **optional for adult-audience captions** (modern Hebrew is usually unpointed). If you ever render pointed Hebrew in captions, the same niqqud-safe fonts (below) apply, at generous `lineHeight ≈ 1.5` so marks don't clip.

### Known-good Hebrew fonts for burned captions (free commercial use)

| Font | License | Hebrew | Niqqud | Notes |
|---|---|---|---|---|
| **Rubik** | **SIL OFL 1.1** (verified `OFL.txt`) | ✅ (revised by native reader) | ✅ explicit OpenType nikkud mark positioning (biblical cantillations excluded) | display 700/900 |
| **Heebo** | **SIL OFL 1.1** (`ofl/heebo/OFL.txt`) | ✅ Hebrew-primary (Oded Ezer / Meir Sadan) | ✅ expected (QA in-app) | body / captions |
| Frank-Rühl (CLM) | free (Culmus) | ✅ | ✅ classic pointed-book face | serif alternative |
| SBL Hebrew | free | ✅ | ✅ best diacritics at small sizes | fallback if Rubik/Heebo gate fails |

**Decision: keep Rubik (display) / Heebo (captions).** Both OFL → commercial-clean. No new font needed. (SBL/Frank-Rühl only if a pointed-text pixel-QA gate fails.)

---

## 5. Upscaling / restoring talking-head output cheaply

| Tool | License | Video? | Temporal-consistent? | Notes |
|---|---|---|---|---|
| **CodeFormer** | **NTU S-Lab License 1.0 (custom — read before commercial use)** | ✅ `--input_path video.mp4` (per-frame) | ❌ none documented | fidelity weight `w∈[0,1]` (lower=quality, higher=fidelity); optional Real-ESRGAN bg |
| **GFPGAN** | **Apache-2.0** | ❌ images only | ❌ n/a | face-GAN prior; `-bg_upsampler`→Real-ESRGAN; v1.4 best identity |
| **Real-ESRGAN** | **BSD-3-Clause** | ✅ `inference_realesrgan_video.py` (per-frame) | ❌ not addressed; tiling can cause block inconsistency | general SR; `--face_enhance`→GFPGAN |
| **RealBasicVSR** | **Apache-2.0** | ✅ native video | ✅ recurrent propagation (CVPR 2022) | the cheap temporal-consistency answer; project quiet since ~2022 |

**The practical reading:**
- **None of the cheap GAN face restorers (CodeFormer/GFPGAN/Real-ESRGAN per-frame) is temporally consistent** → naive per-frame application flickers. Real-ESRGAN's own README only warns about *tiling* block inconsistency; it offers no flicker mitigation.
- **RealBasicVSR is the one cheap tool built for temporal consistency** (recurrent propagation), Apache-2.0, and is the right backbone when you need *video* SR rather than *image* SR. Caveat: it's a general VSR model, not face-tuned, and the repo has been quiet since ~2022 (UNVERIFIED for current-driver compat — test).
- **The standard cheap pipeline for talking heads:** run the generator at its native face res → **CodeFormer (face) + Real-ESRGAN (background)** per frame → if flicker shows at phone scale, either (a) route the *whole* clip through RealBasicVSR instead, or (b) order operations so the face restorer runs at the *final* mouth resolution (flicker is worst when a per-frame restorer is asked to hallucinate at very low input res). 
- **License landmine:** CodeFormer is NTU S-Lab custom license (not OSI-standard) — **read it before commercial deployment**; GFPGAN (Apache-2.0) is the clean commercial face restorer; Real-ESRGAN (BSD-3) clean; RealBasicVSR (Apache-2.0) clean.
- **2026 alternatives:** the newest generators (e.g., HighSync's 512² native, OmniHuman/HeyGen hosted) increasingly render the mouth at high enough resolution that post-upscale is the *fallback*, not the plan. **Prefer a generator that gives you 512²+ mouth natively over upscaling a 256² face.** VRAM figures for the restorers were not printed in the READMEs (**UNVERIFIED** — all run on a single consumer GPU; benchmark on your box).

---

## 6. Evaluation — measuring lip-sync quality objectively (CI gate)

### The metrics
From Wav2Lip (arXiv:2008.10010), computed with the **publicly released pretrained SyncNet** (Chung & Zisserman 2016), *not* the authors' own discriminator:
- **LSE-D (Lip-Sync Error – Distance):** average distance between lip and audio embeddings. **Lower = better.**
- **LSE-C (Lip-Sync Error – Confidence):** average SyncNet confidence. **Higher = better.**

**Reference values (Wav2Lip Table 1, LSE-C ↑ / LSE-D ↓):**

| Dataset | Real videos | Wav2Lip | Wav2Lip+GAN |
|---|---|---|---|
| LRW | 6.931 / 7.012 | 7.490 / 6.512 | 7.263 / 6.774 |
| LRS2 | 7.838 / 6.736 | 7.789 / 6.386 | 7.781 / 6.469 |
| LRS3 | 7.592 / 6.956 | 7.887 / 6.652 | 7.574 / 6.986 |

ReSyncED "Dubbed": unsynced originals **0.896 / 12.63** → Wav2Lip **7.265 / 6.843** (near the clean baseline 7.047 / 7.767).

### Is `syncnet_python` usable?
**Yes.** [github.com/joonson/syncnet_python](https://github.com/joonson/syncnet_python) — **MIT license**, outputs AV offset / min-distance / **confidence**. Current `environment.yml` pins **python 3.10, pytorch 2.5.1, torchaudio 2.5.1, pytorch-cuda 12.4**, opencv 4.13, scenedetect, python_speech_features — i.e., a *current* stack, not a 2016 fossil. Weights via `download_model.sh`. Pipeline: face detect/track → sync offset → visualize. Note: it needs ffmpeg + a face detector; on this box, route ffmpeg via `tools/ffw.py` (the Remotion-bundled minimal ffmpeg lacks audio filters — same trap documented in `align_words.py`).

### CI thresholds (recommendation)
- **Hard reject:** SyncNet **confidence < 3** — this is LatentSync's own data-cleaning cutoff ("clips with a sync confidence score below 3 are discarded"). Reasonable as a hard floor.
- **Pass band:** **LSE-C ≥ ~6.9** (real-video territory on LRS2/LRS3 ≈ 7.6–7.9; Wav2Lip-class sync ≈ 7.5–7.9). Treat 6.9 as "real-video-adjacent."
- **Watch LSE-D ↓** (real ≈ 6.4–7.0; unsynced ≈ 12.6).
- **Always pair with a rendered-frame visual read at phone scale** (per CLAUDE.md, QA is not optional). SyncNet is a *gate*, not a *guarantee* — it can pass a lip-leaked / identity-swapped clip. ⚠️ MuEx's landmark "LSE-D" is a different metric — don't mix the two in a dashboard.

---

## 7. The practical "sync stack" — Hebrew mp3 + face → synced talking head + word captions

Given a **Hebrew mp3 from edge-tts** + a **face photo or short video**, the best free pipeline (names + versions verified above):

```
Hebrew script
  └─(1) edge-tts  he-IL-HilaNeural / he-IL-AvriNeural  boundary="WordBoundary"
        → speech.mp3 + real word times {w,start,end}      [tools/gen_voice_edge.py — ALREADY BUILT]
        (fallback word times: WhisperX --lang he → imvladikon/wav2vec2-xls-r-300m-hebrew
                                                      [tools/align_words.py — ALREADY BUILT])
  └─(2) SYNC MODEL (pick by input lane — see 02-lipsync-models.md)
        • face PHOTO + audio  → hosted prunaai/p-video-avatar (~$0.75/30s) or fal omnihuman/v1.5 (premium)
                                 self-host: Wan2.2-S2V (Apache-2.0, 80GB) / MultiTalk (≤15s)
        • face VIDEO + audio (re-dub) → hosted fal-ai/sync-lipsync/v2 (~$1.50/30s)
                                 self-host: LatentSync 1.6 (Apache-2.0, 18GB, whisper-tiny encoder)
                                 — AVOID chinese-wav2vec2 encoders (InfiniteTalk/MultiTalk) for Hebrew w/o QA
  └─(3) UPSCALE (only if mouth res < 512²)
        • face: GFPGAN (Apache-2.0)  [commercial-clean]  or CodeFormer (NTU S-Lab — check license)
        • background: Real-ESRGAN (BSD-3)
        • flicker: RealBasicVSR (Apache-2.0, recurrent) OR pick a 512²-native generator instead
  └─(4) QA GATE
        • syncnet_python (MIT, py3.10/torch2.5.1/cuda12.4): LSE-C ≥ ~6.9, reject < 3
        • rendered-frame visual read at phone scale (guttural-heavy Hebrew test set)
  └─(5) WORD CAPTIONS (burned, RTL)
        • word times from step (1) drive per-word highlight in Remotion
        • container dir="rtl"; isolate embedded Latin/numbers (RLI…PDI); punctuation resolves RTL
        • font: Rubik (display) / Heebo (captions) — SIL OFL 1.1, niqqud-safe
```

**The one Hebrew-specific hard rule:** run every sync-model candidate through a **guttural-heavy Hebrew test set** (ח/ע/ר-dense script) and read frames at phone scale before shipping. No vendor's "any language" claim substitutes — guttural evidence is **UNVERIFIED** in the literature, so the empirical gate is the product.

---

## Sources

**Lip-sync quality levers**
- arXiv:2307.09368v3 (stabilized sync loss; encoder ablation; lip leaking) — https://arxiv.org/html/2307.09368v3
- arXiv:2605.16918v1 (HighSync: 512², teeth, Reference-Attention, motion module, Whisper) — https://arxiv.org/html/2605.16918v1
- arXiv:2308.16041v2 (talking-head survey: sync/identity/temporal losses, LSE-C/D, FVD, CSIM) — https://arxiv.org/html/2308.16041v2
- arXiv:2301.06059 (Wav2Vec2 viseme dynamics) — https://ar5iv.labs.arxiv.org/html/2301.06059
- arXiv:2407.12501 (EmoFace), 2508.16401 (Audio2Face-3D) — emotion/3D motion
- Brave search result set (talking-face arxiv tracker) — https://github.com/liutaocode/talking-face-arxiv-daily

**Audio-driven vs text-driven / language**
- arXiv:2008.10010 (Wav2Lip; language-agnostic; ReSyncED ~55-lang TTS; LSE-C/D definitions + values) — https://arxiv.org/html/2008.10010
- arXiv:2510.06612v1 (MuEx: phoneme-viseme, 12 langs incl. Arabic, zero-shot) — https://arxiv.org/html/2510.06612v1
- LatentSync README (whisper-tiny encoder, VRAM, SyncNet 94% + conf<3 cutoff, Apache-2.0) — https://github.com/bytedance/LatentSync
- MuseTalk README (whisper-tiny, CN/EN/JP, MIT, 30fps V100, 256², jitter) — https://github.com/TMElyralab/MuseTalk
- prior: research/hebrew-ads/avatar-backend-models-2026-08.md (XLSR-53 vs XLS-R-128; chinese-wav2vec2 risk)

**Hebrew alignment**
- WhisperX repo (alignment, BSD-2-Clause) — https://github.com/m-bain/whisperX
- whisperx/alignment.py source (`DEFAULT_ALIGN_MODELS_HF["he"]="imvladikon/wav2vec2-xls-r-300m-hebrew"`) — https://raw.githubusercontent.com/m-bain/whisperX/main/whisperx/alignment.py
- Hebrew aligner model card — https://huggingface.co/imvladikon/wav2vec2-xls-r-300m-hebrew
- ivrit-ai full model list (Whisper only, no CTC aligner) — https://huggingface.co/ivrit-ai/models
- MFA acoustic models (no Hebrew) — https://mfa-models.readthedocs.io/en/latest/acoustic/index.html
- Gentle (English-only, Kaldi) — https://github.com/lowerquality/gentle
- edge-tts (WordBoundary mechanism, license) — https://github.com/rany2/edge-tts + live `list_voices()` probe (he-IL-AvriNeural, he-IL-HilaNeural) 2026-08-24
- prior probes: research/hebrew-reading/01-subword-timing.md (edge-tts padding, WhisperX accuracy)

**RTL captions + fonts**
- W3C bidi controls — https://www.w3.org/International/questions/qa-bidi-controls
- Unicode UAX#9 — https://www.unicode.org/reports/tr9/
- OpenCut RTL caption failure signature — https://github.com/OpenCut-app/OpenCut/issues/826
- Rubik OFL — https://raw.githubusercontent.com/googlefonts/rubik/main/OFL.txt
- Heebo OFL — https://github.com/google/fonts/tree/main/ofl/heebo
- prior: research/hebrew-reading/02-pointed-hebrew-typography.md (Rubik/Heebo niqqud, OFL)

**Upscaling / restoration**
- CodeFormer (NTU S-Lab license, video input, w) — https://github.com/sczhou/CodeFormer
- GFPGAN (Apache-2.0, images, Real-ESRGAN bg) — https://github.com/TencentARC/GFPGAN
- Real-ESRGAN (BSD-3, video script, no flicker handling) — https://github.com/xinntao/Real-ESRGAN
- RealBasicVSR (Apache-2.0, recurrent video SR) — https://github.com/ckkelvinchan/RealBasicVSR

**Evaluation**
- syncnet_python (MIT, env py3.10/torch2.5.1/cuda12.4) — https://github.com/joonson/syncnet_python + https://raw.githubusercontent.com/joonson/syncnet_python/master/environment.yml
- LSE-C/LSE-D values — arXiv:2008.10010 (above)
