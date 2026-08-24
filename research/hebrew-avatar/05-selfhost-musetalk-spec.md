# Self-host Hebrew lip-sync — setup spec (MuseTalk primary, LatentSync optional)

**Status:** ready to execute. No GPU spend yet — this is the provisioning + install doc.
**Verified:** 2026-08-24 against the live repos, HuggingFace, and the vast.ai / RunPod feeds.
**Cost to flip on:** ~$0.34–0.40/hr for the box; **~$0.002–0.08 per 30s re-dubbed clip** in raw compute.

---

## 0. Why self-host (and the license correction that drives the pick)

The whole point: **stop paying fal ~$0.35–4.80 per 30s clip** for the avatar re-dub lane. Self-hosting the same audio-driven models lands at **$0.002–0.08/clip** — one to two orders of magnitude cheaper — on a rented 4090. Both candidate models condition on **Whisper audio-encoder embeddings (acoustic → viseme, never text)**, so they inherit Whisper's 99-language coverage **which formally includes Hebrew (`he`)**. That is the strongest available technical basis for Hebrew — but it is *inference, not a guarantee*, so every render still goes through the SyncNet QA gate (`tools/sync_gate.py`).

**⚠ LICENSE CORRECTION (research finding, supersedes the earlier plan):**

| Model | Code license | **Model-weights license** | Commercial re-dub product? |
|---|---|---|---|
| **MuseTalk 1.5** | **MIT** | README: models "available for any purpose, even commercially" (HF card tagged `creativeml-openrail-m`) | **✅ Primary pick** — cleanest |
| **LatentSync 1.6** | Apache-2.0 | **OpenRAIL++** (use-restricted) | ⚠ **Legal flag** — verify before commercial |

Earlier we treated LatentSync as "Apache-2.0 clean." **That was wrong at the weights level.** Only the *code* is Apache-2.0; the *weights* on HuggingFace are OpenRAIL++. So:

- **MuseTalk is the self-host primary** (MIT, explicit commercial, real-time, ~4–10 GB VRAM). Note its own HF card is tagged `creativeml-openrail-m` too and its face-parse weights come from a third-party Google-Drive re-upload — get legal sign-off before shipping paid, but it is materially cleaner than LatentSync's OpenRAIL++.
- **LatentSync 1.6 stays in the spec as the optional higher-quality re-dub**, gated on a legal review of OpenRAIL++ (it *is* sharper at 512×512). Do not ship it commercially until that clears.

---

## 1. The box

**Recommended: vast.ai community tier, RTX 4090 (24 GB), on-demand.**

| Option | $/hr (4090) | Notes |
|---|---|---|
| **vast.ai community** ✅ | **~$0.33–0.40** (live feed 2026-08-24) | Cheapest *available*; filter host by `US/EU`, `inet_down>1000 Mbps`, `reliability>0.99`. Bandwidth billed per-byte up+down; storage bills **even when stopped** → destroy instance when done. |
| RunPod community | $0.34 (secure $0.74) | Safer tooling, **free egress**, polished persistent storage. Essentially same price; pick this if you value less MLOps. |
| TensorDock spot | $0.20 | Cheapest on paper, **frequently sold out** — don't depend on it. |
| Lambda | — | **No 4090** (cheapest is RTX 6000 @ $0.69/hr). Skip. |

**Base image:** pick a host whose driver supports CUDA 11.8 (for MuseTalk's pinned stack) **and** a CUDA-12.1-capable image if you also run LatentSync (torch 2.5.1/cu121). Practical choice: start from `runpod/pytorch` or a plain `ubuntu + nvidia` CUDA image; you will pin torch inside a conda env anyway.

**Rules:**
- **Avoid RTX 50-series / Blackwell** (sm_120). MuseTalk's `mmcv 2.0.1` and LatentSync's `torch 2.5.1/cu121` **do not have wheels for it** (MuseTalk #409/#382, LatentSync #362/#355). **4090 (Ada, sm_89) is the safe card.**
- On vast.ai, **fully destroy** the instance when done — stopped instances keep billing storage.
- Spot/interruptible saves ~50% but a preemption **loses the whole render** (neither CLI checkpoints). Only worth it if you batch many short clips and can requeue.

---

## 2. MuseTalk install (PRIMARY)

> Env: **Python 3.10** (conda env `MuseTalk`), torch **2.0.1+cu118**. The `mmcv` stack only has prebuilt wheels for this exact combo — do not upgrade torch.

```bash
git clone https://github.com/TMElyralab/MuseTalk.git && cd MuseTalk
conda create -n MuseTalk python==3.10 -y && conda activate MuseTalk

pip install torch==2.0.1 torchvision==0.15.2 torchaudio==2.0.2 \
    --index-url https://download.pytorch.org/whl/cu118

pip install -r requirements.txt            # pins incl. tensorflow==2.12.0, transformers==4.39.2, huggingface_hub==0.30.2, numpy==1.23.5

pip install --no-cache-dir -U openmim && mim install mmengine
pip install --no-build-isolation chumpy    # BEFORE mmpose (issue #411) — else build fails
mim install "mmcv==2.0.1" && mim install "mmdet==3.1.0" && mim install "mmpose==1.1.0"

apt-get install -y ffmpeg                  # or static build; pass via --ffmpeg_path
```

**Weights (~9–10 GB → `./models/`).** Use the repo's `download_weights.sh` **then fix the two traps it sets:**
```bash
bash download_weights.sh
# TRAP 1 (issue #399): it upgrades huggingface_hub to 1.x → breaks transformers 4.39.2. Re-pin:
pip install "huggingface_hub==0.30.2"
# TRAP 2: it exports HF_ENDPOINT=https://hf-mirror.com (China mirror). Edit it out for US/EU rentals.
```
Weights layout: `musetalkV15/unet.pth` (3.4 GB) + `sd-vae-ft-mse` → `models/sd-vae` + `openai/whisper-tiny` → `models/whisper` + DWPose + `latentsync_syncnet.pt` + face-parse-bisent (Google-Drive `gdown` + a resnet18).

**Run (offline re-dub, best quality):**
```bash
python -m scripts.inference \
  --inference_config configs/inference/test.yaml \
  --version v15 --use_float16 --batch_size 16 --ffmpeg_path /usr/bin
# test.yaml pairs tasks: {task_0: {video_path: input.mp4, audio_path: hebrew.wav}}
```
- `--use_float16` → ~4–10 GB VRAM, faster-than-realtime on a 4090. Single-step latent inpainting (NOT diffusion) → fast.
- `--batch_size 16–32` uses the 24 GB headroom.
- `bbox_shift` (mouth openness) is **v1-only — forced to 0 in v1.5**; in v1.5 tune it via the realtime config instead.
- Output: libx264 crf 18 mp4. Internal face region is **256×256** → plan a GFPGAN/CodeFormer post-pass if shipping >720p.
- Very short audio (<~1 s) can crash mel extraction (#366) — pad/merge lines.

---

## 3. LatentSync install (OPTIONAL — gated on legal)

> Env: **Python 3.10.13** (conda env `latentsync`), torch **2.5.1/cu121**. Higher quality (512×512) but ~18 GB VRAM and OpenRAIL++ weights.

```bash
git clone https://github.com/bytedance/LatentSync.git && cd LatentSync
source setup_env.sh        # conda env, ffmpeg via conda, pip -r requirements.txt (torch 2.5.1+cu121)

huggingface-cli download ByteDance/LatentSync-1.6 whisper/tiny.pt      --local-dir checkpoints
huggingface-cli download ByteDance/LatentSync-1.6 latentsync_unet.pt   --local-dir checkpoints
huggingface-cli download ByteDance/LatentSync-1.6 stable_syncnet.pt    --local-dir checkpoints   # for eval
```
**Run:**
```bash
python -m scripts.inference \
  --unet_config_path configs/unet/stage2_512.yaml \
  --inference_ckpt_path checkpoints/latentsync_unet.pt \
  --inference_steps 20 --guidance_scale 1.5 --enable_deepcache \
  --video_path input.mp4 --audio_path hebrew.wav --video_out_path out.mp4
```
- `inference_steps 20–50` (higher = better/slower); `guidance_scale 1.0–3.0` (higher = tighter sync but can jitter).
- Resolution lives in the yaml (`resolution: 512`), not a CLI flag.
- **v1.6 (512×512, ~18 GB) over v1.5 (256, ~8 GB)** on a 4090 — fixes blurry teeth/lips. Don't run SyncNet eval in the same process (tight on 24 GB).
- Known artifacts (broken teeth #356, red/blurry mouth #353) are usually **input-quality** — keep the face stable, frontal, well-lit.

---

## 4. The SyncNet QA gate (mandatory on the box)

Same box, separate small env (needs dlib face detect). This is what proves the Hebrew render actually syncs.

```bash
git clone https://github.com/joonson/syncnet_python && cd syncnet_python
# python 3.10, torch 2.5.1, torchaudio 2.5.1 + dlib face detector; bash download_model.sh for weights
python run_syncnet.py --videofile out.mp4 --tmp_dir tmp/
```
**Verdicts (from `tools/sync_gate.py`):** PASS if LSE-C confidence ≥ ~6.9 · HARD REJECT if < 3.0. Watch LSE-D (lower=better; real ~6.4–7.0, unsynced ~12.6). **⚠ MuEx redefines "LSE-D" as a landmark error — confirm which LSE-D a number means.** SyncNet can pass a lip-leaked clip, so pair it with a rendered-frame eyeball at phone scale.

---

## 5. The Hebrew guttural test set (the actual moat)

There is **no off-the-shelf Hebrew lip-sync model or dataset**. Whisper-tiny is multilingual but *tiny-grade* — its Hebrew features are noisy, and neither author validates Hebrew. So the competitive asset is a **fixed guttural-heavy test set** that gates every model before it ships:

- The guttural script already in `tools/bakeoff_talk.py` (`--script guttural`) — ח/ע/ר-heavy + code-switch (email/Slack/numbers).
- A stable frontal-face source clip (one newsreader-grade take).
- Run it through MuseTalk → SyncNet → eyeball, on first boot, before any client render.

**No model ships on a vendor's "any language" claim alone.**

---

## 6. Wiring into the pipeline (the payoff)

Once the box passes the gate, point the talk stage at it instead of fal. Concretely: the box exposes a small inference endpoint (or you `scp` clips in/out); `tools/gen_talk.py` / the worker `talk.ts` gain a `musetalk-selfhost` backend that POSTs `{video, audio}` and gets back the re-dubbed mp4, then runs `sync_gate.py` before accepting. Fal stays as the no-MLOps overflow/backup (`sync-lipsync` $0.70/min).

**Cost math reminder:** fal hosted ≈ $0.35–4.80/30s. This box ≈ **$0.002 (MuseTalk) – $0.08 (LatentSync)/30s.** That's the whole reason to do this.

---

## 7. Execute checklist (when you approve GPU spend)

1. [ ] Rent vast.ai 4090 (US/EU, inet_down>1000, reliability>0.99), CUDA-11.8-capable image.
2. [ ] §2 MuseTalk install + re-pin `huggingface_hub==0.30.2` + drop the hf-mirror endpoint.
3. [ ] First render: guttural test set → §4 SyncNet gate. **Decision point: PASS ≥6.9?**
4. [ ] If PASS → wire `musetalk-selfhost` into the talk stage; keep fal as overflow.
5. [ ] (Optional, after legal clears OpenRAIL++) §3 LatentSync 1.6 for the higher-quality lane.
6. [ ] Destroy the instance when idle (vast.ai storage bills while stopped).

**Blockers to resolve before commercial ship:** MuseTalk HF `creativeml-openrail-m` tag + Google-Drive face-parse provenance; LatentSync OpenRAIL++ weights. Both are legal-review items, not engineering ones.
