# 02 — Open-Source & Cheap-API Talking-Head / Lip-Sync Models (2026)

**Goal:** replace or supplement the paid fal.ai avatar pipeline for a **Hebrew-language HeyGen-like product**.
**Research date:** 2026-08-24. All pricing/capability claims carry a source URL and an "as of" note. Anything not directly verified is marked **UNVERIFIED**.

> **Prior art in this repo:** `research/hebrew-ads/avatar-backend-models-2026-08.md` (also dated 2026-08-24) already audited licenses and fal/Replicate endpoints. This report extends it with: HeyGen's 2026 feature bar + API credit math, self-host GPU economics from a live vast.ai feed, the newer Wan2.1-based generators (InfiniteTalk / MultiTalk / FantasyTalking), OmniHuman/Hedra open-weight status, and the Hebrew-specific finding.

---

## TL;DR (the three picks)

| Lane | Pick | Why |
|---|---|---|
| **(a) Zero-budget self-hosted** | **MuseTalk** (MIT, real-time, 4GB VRAM) for the re-dub lane; **LatentSync 1.5** (Apache-2.0, 8GB) for quality | Both audio-driven via Whisper → language-agnostic substrate, commercial-clean, run on a single consumer GPU. |
| **(b) <$50/mo** | **Self-host on a rented RTX 4090** (~$0.36/hr median vast.ai) running MuseTalk + LatentSync; burst to **fal sync-lipsync ($0.70/min)** for overflow | A $50 budget = ~139 GPU-hours/mo = tens of thousands of 30s clips self-hosted; fal as the no-MLOps fallback. |
| **(c) Quality-first-cheap** | **fal `bytedance/omnihuman/v1.5`** ($0.16/s) photo→avatar + **fal `sync-lipsync/v2`** ($3/min) video re-dub | Highest realism among cheap hosted endpoints; commercial-badged; "any language" bring-your-own-audio posture fits a Hebrew WAV pipeline. |

**The single most important technical fact for Hebrew:** these models map **acoustic features → visemes** and never see text. "Supports Hebrew" therefore means *"its audio encoder wasn't English/Chinese-only."* Whisper-based encoders (LatentSync, MuseTalk) inherit Whisper's 99-language coverage **which formally includes Hebrew (`he`)** — the strongest available technical basis. The Wan2.1-family (InfiniteTalk, MultiTalk) uses **chinese-wav2vec2** — the biggest Hebrew-quality risk. **Empirical QA on Hebrew audio is mandatory for every candidate.**

---

## 1. Open-source model landscape (Q1)

Two structurally different families — pick per input type:

- **Family A — image + audio → talking head** (photo becomes an avatar): OmniHuman (closed), Hallo2/3, EchoMimicV2, AniTalker, V-Express, FantasyTalking, MultiTalk, SadTalker.
- **Family B — video + audio → re-dub** (existing talking-head gets new lines): LatentSync, MuseTalk, Wav2Lip, InfiniteTalk, LivePortrait(+audio), SadTalker.

### Master comparison table

| Model | License / commercial OK? | VRAM (inference) | Quality tier vs HeyGen | Hebrew robustness (audio encoder) | Speed | ComfyUI | Link |
|---|---|---|---|---|---|---|---|
| **LatentSync 1.6** (ByteDance) | **Apache-2.0 ✅** | 8GB (v1.5) / **18GB (v1.6)** | High visual (sharpest OSS); sync accuracy secondary | **Whisper** → strong (HE in 99-lang list) | Slow (diffusion, 20–50 steps) | 3rd-party / Replicate | github.com/bytedance/LatentSync |
| **MuseTalk 1.5** (Tencent Music) | **MIT, explicit commercial ✅** | **4GB min** (fp16) | Good, not sharpest; balanced | **Whisper-tiny** → strong; CN/EN/JP stated | **Real-time 30fps on V100** | chaojie/ComfyUI-MuseTalk | github.com/TMElyralab/MuseTalk |
| **Wav2Lip** (legacy baseline) | **❌ non-commercial** (LRS2-trained; contact Sync Labs) | modest | Low-res/soft on HD; **best sync accuracy** | technically agnostic (English LRS2 trained) | Lightweight | many | github.com/Rudrabha/Wav2Lip |
| **SadTalker** | **Apache-2.0 ✅** (relaxed 2023) | NF | Modest (256/512²); photo→head | unvalidated (CN demo exists) | slow | SD-webui ext (not ComfyUI) | github.com/OpenTalker/SadTalker |
| **Hallo2** | MIT ✅ | A100-class | High, 4K, up to 1hr | **❌ English-only training** | slow | — | github.com/fudan-generative-vision/hallo2 |
| **Hallo3** (Fudan, CVPR25) | MIT code **but CogVideoX-5B derivative ⚠️** | H100 tested | High (DiT, dynamic) | **❌ English-only** | slow | Gradio (not ComfyUI) | github.com/fudan-generative-vision/hallo3 |
| **EchoMimicV2** (Ant) | Apache-2.0 + research-intent disclaimer ⚠️ | 16–24GB (V100/4090D) | Good half-body + gestures | **❌ EN/ZH only** | ~50s/120f on A100 (9x accel) | ComfyUI_EchoMimic | github.com/antgroup/echomimic_v2 |
| **AniTalker** (X-LANCE, ACM MM24) | **Apache-2.0 ✅** | NF (PyTorch 1.8/CUDA11.1) | Vivid, identity-decoupled, 256² | **❌ English-primary** ("other langs not tested"); chinese-hubert encoder | MFCC fast / Hubert better | WebUI/HF (not ComfyUI) | github.com/X-LANCE/AniTalker |
| **V-Express** (Tencent) | code commercial ✅ **models non-commercial ❌** | ~8GB (V100) | Moderate; SD1.5-based | **❌ English-better**; wav2vec2-base-960h | **very slow ~84s per 1s** | ComfyUI-V-Express | github.com/tencent-ailab/V-Express |
| **LivePortrait** (KwaiVGI) | MIT **+ InsightFace detector non-commercial ⚠️** | NF; 14.8ms/f on 4090 | Excellent **motion transfer** | n/a — **NOT audio-driven** (needs driving video) | fast | ComfyUI-LivePortraitKJ etc. | github.com/KwaiVGI/LivePortrait |
| **InfiniteTalk** (MeiGen-AI) | **Apache-2.0 ✅** | low-VRAM mode + fp8; 4090 ok | High; lips + head/body/expression; **unlimited length** V2V | **⚠️ chinese-wav2vec2** — test | 4–8-step LoRAs, TeaCache | official + kijai WanVideoWrapper | github.com/MeiGen-AI/InfiniteTalk |
| **MultiTalk** (MeiGen-AI, NeurIPS25) | **Apache-2.0 ✅** | 4090 low-VRAM; 8GB via Wan2GP | Good; **multi-person**, ≤15s clips | **⚠️ chinese-wav2vec2** | TeaCache 2–3x | kijai WanVideoWrapper | github.com/MeiGen-AI/MultiTalk |
| **FantasyTalking** (Alibaba AMAP, ACM MM25) | **Apache-2.0 ✅** | 5GB (0-param) – 40GB | Good; prompt-controllable, Wan2.1-720P base | **⚠️ wav2vec2-base-960h** (English) | 15–43 s/it on A100 | merged to ComfyUI-Wan | github.com/Fantasy-AMAP/fantasy-talking |
| **OmniHuman-1 / 1.5** (ByteDance) | **❌ NO open weights** — research demo + hosted-only | n/a (hosted) | **Top-tier** (matches/exceeds HeyGen) | not stated | hosted | — | omnihuman-lab.github.io |
| **Hedra Character-3** | **❌ NO open weights** — API/subscription only (`Hedra-dev` GitHub has 0 repos) | n/a | High | not documented | hosted | — | hedra.com |
| **NVIDIA Audio2Face** (open-sourced 2025-09) | open-source (SDK+training+data; license UNVERIFIED) | NF | 3D-character lip-sync, real-time+offline | community can fine-tune per-language | real-time | Maya/UE5 plugins | developer.nvidia.com (3D, not 2D video) |

### Hebrew-robustness ranking (audio encoder is the lever)

1. **Strongest basis — Whisper-based:** LatentSync, MuseTalk. Whisper's tokenizer formally lists `"he": "hebrew"` in its 99-language set → real multilingual acoustic coverage. Still inference, not a guarantee.
2. **Risk — Chinese-tuned encoders:** InfiniteTalk / MultiTalk (`chinese-wav2vec2-base`), AniTalker (`chinese-hubert-large`). May distort Hebrew gutturals (ח, ע, ר) that are rare/absent in CN/EN training corpora.
3. **Risk — English-tuned encoders:** FantasyTalking (`wav2vec2-base-960h`), V-Express (same), Hallo2/3 (English-only training), EchoMimicV2 (EN/ZH), Wav2Lip (English LRS2).
4. **wav2vec2 note:** XLSR-53 does **not** include Hebrew; XLS-R 128 does. Models on plain `wav2vec2-base-960h` are English-phoneme-biased.

**License landmines (confirmed from raw LICENSE/repos):** Wav2Lip = hard non-commercial. V-Express models = non-commercial. Hallo3 = CogVideoX-5B derivative (register/compliance). EchoMimicV2 = research-intent disclaimer. LivePortrait = MIT but its InsightFace face-detector is non-commercial (and it isn't audio-driven anyway).

---

## 2. Cheap hosted endpoints (Q2)

### fal.ai (prices read live 2026-08-24; fal reprices often — re-verify before contracting)

| Model ID | Lane | Price | 30s cost | Notes |
|---|---|---|---|---|
| `fal-ai/bytedance/omnihuman` | photo+ audio→avatar | $0.14/s | ~$4.20 | commercial/Partner badge |
| `fal-ai/bytedance/omnihuman/v1.5` | photo+audio→avatar | **$0.16/s** | ~$4.80 | 1080p, commercial badge |
| `fal-ai/creatify/aurora` | photo+audio→avatar | $0.07/s(480p)/$0.14/s(720p) | ~$4.20 | commercial badge |
| `fal-ai/sync-lipsync` (1.9) | video+audio re-dub | **$0.70/min** | **~$0.35** | "any language" own-audio |
| `fal-ai/sync-lipsync/v2` | video+audio re-dub | $3/min | ~$1.50 | enhanced facial tracking |
| `fal-ai/sync-lipsync/v2/pro` | video+audio re-dub | $5/min | ~$2.50 | up to 4K, batch |
| `fal-ai/pixverse/lipsync` | video+audio | $0.04/s | ~$1.20 | commercial badge |
| `fal-ai/musetalk` | video+audio re-dub | "$0 per compute second" | ~$0 | **likely deprecated/unmetered — verify** |
| `fal-ai/heygen/avatar5/digital-twin` | text/audio→avatar (HeyGen on fal) | NF | NF | 1080p, 175+ langs claim, **library avatars only on fal** |

### Replicate (read live 2026-08-24)

| Model | Lane | Price | 30s cost | Notes |
|---|---|---|---|---|
| `prunaai/p-video-avatar` | **photo+audio→avatar** | **$0.025/s(720p) / $0.045/s(1080p)** | **$0.75 / $1.35** | **cheapest image-driven found**; 10 TTS langs (EN/ES/FR/DE/IT/PT-BR/JA/KO/HI), **Hebrew NOT listed** — but accepts own audio (any lang) |
| `bytedance/latentsync` | video+audio re-dub | ~$0.10/run (105s on L40S) | ~$0.10 | open-source, self-hostable via Cog/Docker |
| `bytedance/omni-human` | image+audio/video | $0.14/s | ~$4.20 | — |
| `heygen/lipsync-speed` | video+audio | $0.0333/s | ~$1.00 | HeyGen ToS |
| `heygen/lipsync-precision` | video+audio | $0.0667/s | ~$2.00 | HeyGen ToS |

**Not found:** Kling lip-sync is **NOT on fal** (all paths 404); it lives on Replicate `kwaivgi/kling-lip-sync` (unpriced). fal's general video generators (Seedance 2.5, Wan 3.0, LTX 2.5, Grok Imagine) carry a "lipsync" tag but are **not** dedicated talking-head tools.

---

## 3. Self-host economics (Q3)

**Live GPU rental, vast.ai feed updated 2026-08-24T08:30Z** (per-hour USD; min / p10 / median / #offers):

| GPU | min | p10 | median | offers |
|---|---|---|---|---|
| **RTX 4090** (24GB) | $0.133 | $0.273 | **$0.361** | 681 |
| RTX 3090 (24GB) | $0.067 | $0.113 | $0.148 | 421 |
| RTX A4000 (16GB) | $0.055 | $0.074 | $0.107 | 223 |
| RTX A5000 (24GB) | $0.069 | $0.069 | $0.231 | 45 |
| L40S (48GB) | $0.401 | $0.467 | $0.534 | 64 |
| A100 SXM4 (80GB) | $0.268 | $0.601 | $1.001 | 89 |
| H100 SXM (80GB) | $1.335 | $1.492 | $2.001 | 63 |

RunPod (page dated 2026-07-27): RTX 4090 **$0.34/hr community / $0.74 secure**; RTX 3090 $0.22/$0.50; A5000 $0.16/$0.27; L40S $0.79/$0.99. → **vast.ai and RunPod community 4090 both land ~$0.34–0.36/hr.**

**Cost per 30s clip (4090 @ $0.36/hr = $0.0001/s compute):**

| Model | Approx compute for 30s clip | Cost/clip |
|---|---|---|
| **MuseTalk** (real-time) | ~30–60s | **$0.003–0.006** |
| **LatentSync** (~2–5x realtime) | ~60–150s | $0.006–0.015 |
| **InfiniteTalk/MultiTalk** (Wan-14B, 4–8 step LoRA) | ~2–6 min | $0.012–0.036 |
| Amortized dedicated 4090 (~$260/mo 24/7) @ 1 clip/min | — | **~$0.006/clip** |

**Verdict:** self-hosting is **$0.003–0.04 per 30s clip** in raw compute — roughly **1–2 orders of magnitude cheaper** than fal hosted ($0.35–4.80/30s) and HeyGen (below). The trade is MLOps + a mandatory Hebrew QA gate per model.

### vs HeyGen API (the bar)

HeyGen Enterprise credits: **1 credit = $0.50**; Avatar IV photo/digital-twin = **0.1 credits/sec = $0.05/sec → $1.50 per 30s**. Lipsync (own footage) 0.05–0.1 cr/s → **$0.75–1.50/30s**. Self-host ($0.006–0.04) beats this by ~40–250x; fal sync-lipsync v1.9 ($0.35/30s) beats it by ~4x on the re-dub lane.

---

## 4. HeyGen 2026 — the bar (Q4)

**Feature set (heygen.com, © 2026):**
- **Avatar V** (current flagship; note "IV" is now the *prior* gen on the v3 engine): consistent identity, "trained on your behavior," multiple camera angles from one recording, **phoneme-level lip-sync**, emotion synced to voice, stable beyond 30 min.
- **Avatar IV** = default v3 engine for Photo Avatar / Digital Twin / Studio Avatar.
- **Photo Avatar** (talking photo), **Video Agent** (prompt→video), **Cinematic Avatar**, **Video Translation** with voice cloning across **175+ languages/dialects**.
- **Voice cloning** on Creator tier and up.

**Hebrew:** **UNVERIFIED but likely.** HeyGen claims "175+ languages and dialects with phoneme-level lip-sync" (fal.ai/heygen-avatar + Unite.AI review) but does **not** enumerate them publicly; Hebrew is not explicitly listed on the pages fetched. Given 175+ coverage, Hebrew inclusion is probable — **must be confirmed on the official supported-languages list or by test render before promising it to clients.**

**API pricing (developers.heygen.com/docs/enterprise-pricing, no effective date shown):**
- 1 credit = $0.50. **Avatar IV/V: 0.1 cr/s ($0.05/s → $1.50/30s)**; Avatar III digital-twin 0.0167 cr/s.
- Lipsync: Speed 0.05 cr/s / Precision 0.1 cr/s. Video Translation 0.05–0.1 cr/s.
- Avatar creation (twin/photo) 1 credit/call. Self-serve plans: Free $0 / Creator $29 (600 cr) / Pro $49 (1,000 cr) / Business $149 (1,500 cr).

---

## 5. Hebrew-specific work (Q5)

**Finding: essentially empty.** No public Hebrew-specific talking-head/lipsync model or dataset surfaced (Seznam queries returned no relevant dataset/model — only generic deepfake-detection papers and commercial tools). Gutturals (ח, ע, ר) are rare in the CN/EN corpora these models train on.

**Closest commercial Hebrew claims:**
- **Vozo** (hosted-only, no self-host) explicitly lists **Hebrew** among ~80 TTS languages and claims "**any language and dialect**" for uploaded audio; has a Lip Sync API. Source: vozo.ai/lip-sync (© 2026 Honeybee Technology). *Note: D-ID is an Israeli company — Hebrew support plausible but UNVERIFIED from the fetched pricing page.*

**Implication:** there is no off-the-shelf Hebrew lipsync model — the moat is **curating a Hebrew QA/test set** (a newsreader clip + a photo avatar on a guttural-heavy script) and gating every candidate on rendered-frame QA at phone scale. This is itself a competitive asset.

---

## 6. Recommended stack (Q6)

**(a) Zero-budget self-hosted → MuseTalk + LatentSync.**
MuseTalk (MIT, explicit commercial, 4GB, real-time 30fps, Whisper encoder) is the cheapest possible re-dub that still looks decent — run it on any consumer GPU or a free/cheap box. Pair with LatentSync 1.5 (Apache-2.0, 8GB) when visual sharpness matters. Both Whisper-based = best-available Hebrew substrate. Avoid Wav2Lip (non-commercial) despite its sync accuracy.

**(b) <$50/mo → rent a 4090 (~$0.36/hr) + MuseTalk/LatentSync, burst to fal sync-lipsync v1.9.**
$50 buys ~139 GPU-hours/mo on vast.ai → tens of thousands of 30s clips at $0.003–0.04 each. No subscription lock-in, full data control, commercial-clean licenses. Keep **fal `sync-lipsync` ($0.70/min ≈ $0.35/30s)** as the zero-MLOps overflow/backup. This is the sweet spot for an SMB Hebrew product at moderate volume.

**(c) Quality-first-cheap → two hosted lanes.**
- **Photo → avatar:** `prunaai/p-video-avatar` (Replicate) **$0.025/s → $0.75/30s** as primary (cheapest image-driven, accepts own Hebrew audio); premium tier `fal-ai/bytedance/omnihuman/v1.5` ($0.16/s, 1080p) when a client pays for top realism.
- **Twin video → re-dub:** `fal-ai/sync-lipsync/v2` ($3/min) or cheap `heygen/lipsync-speed` (~$1.00/30s). "Any language" bring-your-own-audio posture fits a finished-Hebrew-WAV pipeline.

**Hard gate for all three:** a fixed Hebrew test set (guttural-heavy newsreader + photo avatar) rendered through each candidate, frames read at phone scale. **No model ships on a vendor's "any language" claim alone.**

---

## Sources
- fal.ai: /models/fal-ai/bytedance/omnihuman/v1.5 · /models/fal-ai/sync-lipsync · /models/fal-ai/sync-lipsync/v2 · /models/fal-ai/musetalk · /heygen-avatar
- Replicate: /prunaai/p-video-avatar · /bytedance/latentsync · /bytedance/omni-human · /heygen/lipsync-speed
- GitHub: bytedance/LatentSync · TMElyralab/MuseTalk · Rudrabha/Wav2Lip · OpenTalker/SadTalker · fudan-generative-vision/hallo2+hallo3 · antgroup/echomimic_v2 · X-LANCE/AniTalker · tencent-ailab/V-Express · KwaiVGI/LivePortrait · MeiGen-AI/InfiniteTalk+MultiTalk · Fantasy-AMAP/fantasy-talking · omnihuman-lab.github.io · hedra-dev (0 repos)
- HeyGen: heygen.com/pricing · developers.heygen.com/docs/enterprise-pricing · heygen.com (© 2026)
- GPU: storage.googleapis.com/vast-public-gpu-pricing/gpu-pricing-public.json (2026-08-24T08:30Z) · runpod.io/pricing (2026-07-27)
- Hebrew: vozo.ai/lip-sync · raw.githubusercontent.com/openai/whisper tokenizer.py · sync.so/blog/the-best-free-open-source-lipsync-tools-2 (2025-01-10) · smartmania.cz (NVIDIA Audio2Face open-source, 2025-09-29)
