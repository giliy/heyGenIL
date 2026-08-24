# Context note for synthesis (written by orchestrator, 2026-08-24)

## Environment facts (verified inline)
- NO GPU on this box (nvidia-smi absent) — self-host = rented GPU only.
- ffmpeg NOT on PATH currently; node v24.18.0, python 3.12.10.
- .env keys: GEMINI_API_KEY, ELEVENLABS_API_KEY, FAL_KEY (no Replicate token).

## Current talk stage — what is ACTUALLY implemented (read inline)
- tools/gen_talk.py exists. Model-agnostic fal queue tool. DEFAULT_MODEL = "fal-ai/veed/fabric-1.0"
  (NOT prunaai — the plan's P0 pick was NOT what shipped). Fabric resolution: 480p default via
  TALK_RESOLUTION env; 720p behind env var. Payload: image_url+audio_url (or video_url with --driver).
- webapp/apps/worker/src/orchestrate/stages/talk.ts exists, runs between voice and pixel for
  engine==='avatar'. Resolves locked face (asset or character row), cost-gates via CREDIT_TABLE
  talkSec/talkSecPremium, mints ONE continuous clip for the whole script, writes talk_clip asset,
  sets scene.clip for AvatarSpec. Driver/twin → premium engine,
  resolveTalkModel(explicit ?? 'kling-lipsync' for driver).
- Consent: tools/verify_consent.py exists + webapp api/consent route.
- So the MVP M0/M1 plumbing mostly EXISTS. The remaining work is QUALITY: which model, what
  resolution, Hebrew QA gate, caption sync, upscaling, cost ladder.

## Prior plan open questions (research/heygen-hebrew-platform-plan.md §11) — user answered implicitly:
focus on VIDEO QUALITY at near-zero budget, Hebrew-first, lipsync quality. Frame recommendations accordingly.
