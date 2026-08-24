# Talking-Head / Lip-Sync Backend — Research Report
**Hebrew-first HeyGen-style avatar platform · 2026-08-24**

Pipeline: (locked face photo **or** ~2-min digital-twin video) + finished Hebrew WAV → lip-synced 9:16 1080×1920, ≤60s. Backend via fal.ai / Replicate (pay-per-use) or self-host GPU.

> **Pricing note:** all hosted prices were read off the live fal.ai / Replicate / vendor pages on 2026-08-24. Where a number was not printed on the page it is marked **NF** (not found), never estimated. fal and Replicate reprice frequently — re-verify before contracting.

---

## The one structural fact that shapes everything

Your two input types map to **two different model families**, and no single hosted endpoint does both well:

- **Image + audio → generate a talking head** (the "photo becomes an avatar" lane): OmniHuman, Creatify Aurora, SadTalker, Hallo, MultiTalk, Wan2.2-S2V.
- **Video + audio → re-dub an existing talking-head** (the "2-min twin clip gets new lines" lane): Sync Labs lipsync, LatentSync, InfiniteTalk, Wav2Lip, MuseTalk, HeyGen lipsync endpoints, PixVerse lipsync.

A photo input needs family 1. A 2-min twin video can be driven by family 2 (re-sync its mouth to new Hebrew audio) — which is cheaper and preserves identity better than regenerating. **Plan for both lanes, not one model.**

---

## Hosted — pay-per-use (fal.ai / Replicate / vendor)

| Endpoint | Input | Price | 30s output | Max dur | Res | Hebrew | Commercial |
|---|---|---|---|---|---|---|---|
| `fal-ai/bytedance/omnihuman` | **I**+audio | $0.14/s | **~$4.20** | 30s (hard) | NF | not stated | ✅ via fal partner |
| `fal-ai/bytedance/omnihuman/v1.5` | **I**+audio | $0.16/s | ~$4.80 | 30s@1080p / 60s@720p | 720p/1080p | not stated | ✅ badge |
| `replicate: bytedance/omni-human` | I+audio/video | $0.14/s | ~$4.20 | NF | NF | not stated | — |
| `fal-ai/creatify/aurora` | **I**+audio | $0.07/s(480p)/$0.14/s(720p) | ~$4.20 (720p) | NF | 480/720p | not stated | ✅ badge |
| `prunaai/p-video-avatar` (Replicate) | **I**+audio/TTS | $0.025/s(720p)/$0.045/s(1080p) | **$0.75** / $1.35 | NF | 720/1080p | TTS 10 langs; audio any | — |
| `replicate: veed/fabric-1.0` | **I**+audio | NF | NF | **60s** | 480/720p | — | — |
| `fal-ai/sync-lipsync` (1.9) | **V**+audio | $0.70/min | ~$0.35 | NF | NF | "any language" own-audio | ✅ via fal partner |
| `fal-ai/sync-lipsync/v2` | **V**+audio | $3/min | ~$1.50 | NF | NF | "any language" own-audio | ✅ Partner |
| `fal-ai/sync-lipsync/v2/pro` | **V**+audio | $5/min | ~$2.50 | NF | up to 4K* | "any language" own-audio | ✅ badge |
| `replicate: heygen/lipsync-speed` | **V**+audio | $0.0333/s | **~$1.00** | NF | NF | — | ToS |
| `replicate: heygen/lipsync-precision` | **V**+audio | $0.0667/s | ~$2.00 | NF | NF | — | ToS |
| `replicate: bytedance/latentsync` | **V**+audio | ~$0.10/run (105s) | ~$0.10 | NF | NF | Whisper feats → HE substrate | open src |
| `fal-ai/pixverse/lipsync` | **V**+audio / TTS | $0.04/s | ~$1.20 | NF | NF | — | ✅ badge |
| `kwaivgi/kling-lip-sync` (Replicate) | V+audio/text | NF | NF | NF | NF | CN/EN/JP/KR/ES per 3rd-party | ⚠️ data→Kuaishou |
| **Kling lip-sync on fal** | — | — | **NOT ON FAL (all paths 404)** | — | — | — | — |
| Hedra Character-3 (own API) | I+audio | credits, $15–75/mo tiers | n/a (no per-min API price) | — | — | not documented | — |

\* lipsync-2-pro advertises "up to 4K" via diffusion super-res. **Sync plan gate:** API access + max duration are subscription-gated (free 20s → Scale 30 min); per-second rates above are the fal-hosted passthrough, Sync's own Scale plan is $0.04/s.

**Kling lip-sync is NOT on fal.ai** — every probed path 404'd (`kling-video/lip-sync*`, `ai-avatar*`). It lives on Replicate as `kwaivgi/kling-lip-sync` (unpriced) and on Kuaishou's own kling.ai. Drop it as a fal candidate.

---

## Self-host — open source

| Repo | License | Commercial? | Input | VRAM / speed | Res / dur | Hebrew risk |
|---|---|---|---|---|---|---|
| **InfiniteTalk** (MeiGen-AI) | Apache-2.0 | ✅ **clean** | **V+A dub** + I+A | low-VRAM mode, fp8; 4–8 step LoRAs | 480/720p; **unlimited V2V**, 40s/chunk | ⚠️ chinese-wav2vec2 encoder — test |
| **LatentSync** (ByteDance) | Apache-2.0 | ✅ | V+A | **8GB**(1.5)/**18GB**(1.6) | 512², 5–10s segs | ✅ Whisper feats (HE in 99-lang list) |
| **MuseTalk** (TME) | MIT, explicit commercial | ✅ | V or I + audio | **real-time 30fps on V100**; 4GB min | face 256² + super-res | ✅ Whisper-tiny (unvalidated) |
| **Wan2.2-S2V** (Wan-Video) | Apache-2.0 | ✅ | I+A, long | **80GB** (S2V-14B) | 480/720p, follows audio length | unconfirmed |
| **MultiTalk** (MeiGen-AI) | Apache-2.0 | ✅ | I+A (multi-speaker) | 4090 low-VRAM / 8GB Wan2GP | 480/720p, **≤15s** | ⚠️ chinese-wav2vec2 |
| **Ditto** (antgroup) | Apache-2.0 | ✅ | I+A **realtime/streaming** | A100, TensorRT | NF | unconfirmed |
| **SkyReels-A1** (Skywork) | Skywork Community | ✅ "supports commercial use" | V **or** A driven | datacenter (4090 TODO) | any length | unconfirmed |
| SadTalker | **Apache-2.0** (relaxed) | ✅ (src repo) | I+A | NF | 256/512² | unvalidated |
| hallo2 / hallo3 | MIT / CogVideoX(register) | ✅ / ⚠️ | I+A | A100/H100 | 4K, up to 1hr | ❌ **English-only** |
| EchoMimic V1/V2 | Apache-2.0 + research-intent | ⚠️ counsel | I+A | V100/4090, slow diffusion | NF | ❌ En/Zh only |
| LivePortrait | MIT **+ InsightFace NC** | ⚠️ swap detector | image+**driving video** (no audio) | 14.8ms/f on 4090 | 512² | n/a — not audio-driven |
| Sonic (Tencent) | CC BY-NC-SA | ❌ | I+A | 32GB | NF | — |
| Wav2Lip | **non-commercial** | ❌ contact Sync Labs | V+A | modest | low-res | (technically agnostic) |
| HunyuanVideo-Avatar | Tencent Community | ⚠️ <100M MAU, **EU/UK/KR banned** | I+A | 24GB slow / 96GB rec | 704×768, ~5s clips | unconfirmed |

**License landmines confirmed from raw LICENSE files:** Wav2Lip = hard non-commercial. Sonic = CC BY-NC-SA. hallo = English-only training. HunyuanVideo-Avatar bans EU/UK/Korea use (matters even for an Israeli co serving the diaspora). LivePortrait is MIT but its InsightFace detector is non-commercial — must be swapped before commercial deployment, and it isn't audio-driven anyway.

---

## Hebrew — the decisive, mostly-empty finding

**No hosted vendor publishes a Hebrew lip-sync commitment except Vozo** (own platform, not fal/Replicate). What is actually documented:

- **Sync Labs:** "provide your own translated audio **in any language** for lipsync" — language-agnostic for the bring-your-own-audio flow, which is *exactly* your pipeline (you supply a finished Hebrew WAV). Hebrew not enumerated.
- **Whisper formally supports Hebrew** (`"he": "hebrew"`, 99-language list). LatentSync and MuseTalk build their audio encoders on Whisper → they inherit real multilingual acoustic coverage. This is the strongest *technical* basis for Hebrew, but it's inference, not a guarantee.
- **wav2vec2 XLSR-53 does NOT include Hebrew** (MLS+CommonVoice+BABEL corpora exclude it). **XLS-R 128 does.** InfiniteTalk/MultiTalk use a **chinese-wav2vec2** encoder — the biggest Hebrew-quality risk among self-host candidates.
- **Kling:** third parties claim CN/EN/JP/KR/ES; no Hebrew, nothing official.
- **Hebrew-specific talking-head models don't exist publicly.** Gutturals (ח, ע, ר) are rare in training corpora — **empirical QA on Hebrew audio is mandatory for every candidate before shipping**, regardless of claims.

Architectural point: these models map *acoustic features → visemes* and never see text, so "supports Hebrew" really means "its audio encoder wasn't English/Chinese-only." Bring-your-own-Hebrew-audio models on multilingual encoders are the safe bet.

---

## Recommendation

### P0 — launch (pay-per-use, fastest to ship, clear commercial terms)

Run **two lanes**, both hosted, behind one internal interface:

- **Photo → avatar:** **`prunaai/p-video-avatar`** (Replicate) as primary — image+audio, 720p **$0.025/s → ~$0.75/30s**, cheapest image-driven endpoint found. Fallback / quality tier: **`fal-ai/bytedance/omnihuman/v1.5`** ($0.16/s, 1080p, ~$4.80/30s) when a client pays for premium realism. Both commercial-badged.
- **Twin video → re-dub:** **`fal-ai/sync-lipsync/v2`** ($3/min → **~$1.50/30s**), "any language" own-audio posture, fal partnership = clear commercial use. Cheaper acceptable-quality alternative: **`heygen/lipsync-speed`** (~$1.00/30s).

**Blended P0 cost: ~$0.75–1.50 per 30s video** (premium OmniHuman tier ~$4.20–4.80). No vendor guarantees Hebrew — gate launch on a rendered-frame Hebrew QA pass of these two endpoints.

### P3 — migrate (self-host for cost-at-scale)

- **Dub lane (twin video):** **InfiniteTalk** — Apache-2.0 (cleanest license audited), video+audio, unlimited length, low-VRAM/fp8 path. Its chinese-wav2vec2 encoder is the Hebrew risk → if QA fails, fall back to **LatentSync** (Apache-2.0, Whisper encoder = Hebrew substrate, 8–18GB).
- **Photo lane:** **Wan2.2-S2V** (Apache-2.0, image+audio, long-form) if you can afford 80GB; **MultiTalk** (Apache-2.0, ≤15s) or **Ditto** (realtime) on lighter GPUs.
- **Throughput note:** MuseTalk (MIT, real-time on a V100, Whisper-tiny) is the cheapest possible self-host dub if its 256² face + super-res passes your quality bar.

**Self-host cost at scale:** a single L40S/4090 node amortized is roughly **$0.02–0.10 per 30s video** in compute — an order of magnitude under P0 — at the price of MLOps and a mandatory Hebrew QA gate per model.

### The 2-stage gate
**P0:** `prunaai/p-video-avatar` (photo) + `fal-ai/sync-lipsync/v2` (dub) → ship in days, ~$1/30s blended, commercial-clean.
**P3:** migrate to self-hosted **InfiniteTalk** (dub) + **Wan2.2-S2V**/**MultiTalk** (photo) once volume justifies a GPU box → ~$0.05/30s.
**Hard gate between them:** a fixed Hebrew test set (a newsreader clip + a photo avatar, guttural-heavy script) rendered through each candidate, frames read at phone scale. No model ships on a vendor's "any language" claim alone.

---

## Sources
- fal.ai: https://fal.ai/models/fal-ai/bytedance/omnihuman · https://fal.ai/models/fal-ai/bytedance/omnihuman/v1.5 · https://fal.ai/models/fal-ai/sync-lipsync · https://fal.ai/models/fal-ai/sync-lipsync/v2 · https://fal.ai/models/fal-ai/sync-lipsync/v2/pro · https://fal.ai/models/fal-ai/creatify/aurora · https://fal.ai/models/fal-ai/pixverse/lipsync · https://fal.ai/heygen-avatar · https://fal.ai/terms
- Replicate: https://replicate.com/prunaai/p-video-avatar · https://replicate.com/bytedance/omni-human · https://replicate.com/bytedance/latentsync · https://replicate.com/heygen/lipsync-speed · https://replicate.com/heygen/lipsync-precision · https://replicate.com/sync/lipsync-2 · https://replicate.com/sync/lipsync-2-pro · https://replicate.com/veed/fabric-1.0 · https://replicate.com/kwaivgi/kling-lip-sync · https://replicate.com/collections/lipsync
- Sync Labs: https://sync.so/docs · https://sync.so/docs/models · https://sync.so/pricing
- Hedra: https://www.hedra.com · https://www.hedra.com/pricing
- Self-host LICENSE/README (raw): github.com/MeiGen-AI/InfiniteTalk · github.com/MeiGen-AI/MultiTalk · github.com/bytedance/LatentSync · github.com/TMElyralab/MuseTalk · github.com/Wan-Video/Wan2.2 · github.com/antgroup/ditto-talkinghead · github.com/SkyworkAI/SkyReels-A1 · github.com/OpenTalker/SadTalker · github.com/fudan-generative-vision/hallo2 · github.com/fudan-generative-vision/hallo3 · github.com/Rudrabha/Wav2Lip · github.com/jixiaozhong/Sonic · github.com/KlingAIResearch/LivePortrait · github.com/Tencent-Hunyuan/HunyuanVideo-Avatar · huggingface.co/THUDM/CogVideoX-5B/blob/main/LICENSE · huggingface.co/OmniAvatar/OmniAvatar-14B
- Hebrew / language evidence: https://raw.githubusercontent.com/openai/whisper/main/whisper/tokenizer.py · https://huggingface.co/facebook/wav2vec2-large-xlsr-53 · https://arxiv.org/abs/2006.13979 · https://arxiv.org/abs/2502.01061 (OmniHuman) · https://www.vozo.ai/lip-sync · https://www.heygen.com/pricing · https://www.d-id.com/pricing
