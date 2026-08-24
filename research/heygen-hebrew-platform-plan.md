# Plan: "HeyGen-IL" — a Hebrew-first AI talking-avatar platform

*Drafted 2026-08-24. Built on 4 research reports: `research/heygen-ux-research.md` (user flow), `research/heygen-catalog.md` (features/API/tech), HeyGen business-model research (inline below), and a read-only audit of this repo's `webapp/`.*

---

## 0. One-paragraph thesis

HeyGen is a **$200M-ARR** business whose entire product reduces to one pipeline: *a face + a script → a lip-synced talking video*, wrapped in credits, templates, and an editor. This repo already has everything around that pipeline — a Next.js+worker+Postgres SaaS skeleton (auth, Stripe, a credit ledger, a job queue, a Remotion editor, S3-compatible storage), the best-in-class cost-metering discipline, a locked-character system, and a **Hebrew voice + RTL captions stack nobody else has wired end-to-end** (edge-tts `he-IL-*`, WhisperX `he` alignment, nikkud tools, full-line RTL caption rendering). The one defining piece we do **not** have is the **lip-sync / talking-head generation stage** — that is the core net-new build. Our wedge: **the only Hebrew-native talking-avatar product** (HeyGen/Synthesia/D-ID all treat Hebrew as a tier-2 translation language with poor RTL and weak Hebrew voices).

**⚠ Scope note:** we are cloning HeyGen's *product flow and business logic*, not copying its brand, avatars, templates, or marketing copy. "Like HeyGen, in Hebrew" — never HeyGen's pixels, names, or likenesses.

---

## 1. What HeyGen actually is (the model we're copying)

### 1.1 The core loop (from UX research)
1. Land → "Create a Video" / "Photo to Video" / Video Agent.
2. Pick an avatar (stock / photo-avatar / digital twin) → scene-based editor opens.
3. **Script-first, scene-based editor — explicitly NOT a timeline.** Scenes = slides; each scene has its own script segment; element timing is set by markers *inside the script text*, not tracks.
4. Pick a voice (1,000+), set speed/pitch/pauses/emotion; **audio-only preview** (rendering the avatar costs credits, so iteration is pushed into the free audio step).
5. **Generate** → queue → email → Projects tab. ~10 min render per 1 min of video.
6. Export MP4 720p/1080p/4K (plan-gated), SRT captions, 16:9 or 9:16 chosen at creation.

### 1.2 The avatar ladder (the product's value ladder)
`stock (500–700+) → Photo Avatar (1 still + motion engine; unlimited on paid) → Digital Twin (2-min 1080p footage, ~15-min processing) → Avatar V (15-sec expressive clip)`. **Consent is a hard gate** for any real-person footage: read a script aloud with a spoken code, verified same-person. Voice cloning is separate (1 free, unlimited paid).

### 1.3 The business machine (from business-model research)
- **Plans:** Free $0 (3 videos/mo, 1-min max, watermark) → **Creator $29/mo** (600 cr, 1080p, 30-min, watermark off) → **Pro from $49/mo** (1,000–100,000 cr, 4K) → **Business $149 + $20/seat** (1,500 pooled cr, 60-min, workspaces/brand kit/SCORM) → **Enterprise custom** (SSO/SCIM, no caps).
- **The single-currency credit spine.** One credit pool drains at different rates by engine — this *is* the monetization:

| Feature | HeyGen credits/min |
|---|---|
| Avatar III (standard) | 3 |
| Avatar IV / V (photoreal) | 20 |
| Audio dub (no lip-sync) | 2 |
| Full translation w/ lip-sync | 5 |
| Video Agent (prompt→video) | 20 |

- **The 6.7× burn gap** between standard and premium engines is the central upsell lever (Creator's 600 cr = 200 min on Avatar III but only 30 min on IV/V). Rollover 1 cycle, **forfeit on cancel**, Business-only top-ups at $0.05/cr.
- **Growth loops:** watermark virality on free videos; 35% recurring affiliate program; API as B2B lock-in (pay-as-you-go $1–4/min); HyperFrames open-source land-grab; template/stock-avatar content moats.
- **Known weakness to exploit:** Trustpilot 2.4/5 — complaints center on **opaque credit burn**. Our Hebrew product should be *radically transparent* about cost (this repo's "derive cost before spend" discipline is exactly the antidote).

---

## 2. Gap analysis — what we have vs. what HeyGen needs

### 2.1 Already built (real assets — from repo audit)
| HeyGen need | We have | Where |
|---|---|---|
| SaaS skeleton (auth, billing, jobs) | Next.js 15 + worker + Postgres + Drizzle + Auth.js + Stripe (test) | `webapp/` |
| Credit/quote/tier system | `quoteSpec()`, `CREDIT_TABLE`, tier matrix, reserve→deduct→refund, append-only ledger | `packages/spec/src/quote.ts`, `tiers.ts`, `apps/worker/src/billing.ts` |
| Scene editor w/ live preview | Remotion Player editor shell, overlay handles, scene strip, render dialog | `apps/web/src/app/editor/` |
| Render farm (batch) | `render-spec.mjs` (zod-validated, bundle cache, h264), `render-all.mjs`, pinned Chrome | `webapp/apps/worker/`, `remotion/scripts/` |
| Locked recurring character | `character.json` + 3 iron rules + webapp `characters` table + mint job | `ai-shorts/blue-man/`, `packages/db/src/schema.ts`, `apps/worker/src/character.ts` |
| TTS w/ word timing | ElevenLabs + Kokoro + edge-tts → same contract (mp3 + `.words.json`) | `tools/gen_voice.py`, `gen_voice_edge.py` |
| **Hebrew voice + RTL** | edge-tts `he-IL-HilaNeural`/`AvriNeural`, WhisperX `he` aligner, RTL full-line captions, `stripNikkud`, `anchorRtl`, nikkud tools | `tools/`, `remotion/src/lib/` |
| Cost-before-spend discipline | derived cost + `--verify-prices` + worker pre-render gate | `tools/bakeoff_clip.py`, `stages/pixel.ts` |
| Video-gen plumbing | fal.ai queue, image-to-video, model bakeoff harness, storage upload | `tools/gen_clip.py`, `bakeoff_clip.py`, `apps/worker/src/fal.ts` |
| Media library / assets | `media/library` catalogs, projects, webapp `assets` table, S3/local storage | `media/`, `apps/web/app/media/` |

### 2.2 The gaps (what we must build)
| # | Gap | HeyGen equivalent | Effort |
|---|---|---|---|
| **G1** | **Lip-sync / talking-head generation** — nothing exists today (grep confirms: no Wav2Lip/LivePortrait/Hedra/OmniHuman/Kling-lip-sync/Sync anywhere) | Avatar III/IV/V engine | **THE core build** |
| **G2** | Photorealistic human avatar from a selfie (today's characters are stylized faceless puppets) | Photo Avatar / Digital Twin | High |
| **G3** | Voice cloning wired into the pipeline (named as a Pro-tier plan, not integrated) | Voice clone (1 free) | Medium |
| **G4** | Hebrew script-assist / prompt→video agent (RTL copywriting, not translation) | Video Agent | Medium |
| **G5** | Real-time / streaming avatar | LiveAvatar | Later phase (offline batch today) |
| **G6** | Consent flow for real-person footage | spoken-code consent gate | Medium (trust-critical) |
| **G7** | Avatar-centric editor UX (marketplace, per-scene avatar) | AI Studio scenes | Medium |
| **G8** | Direct publish to TikTok/YouTube/Reels | (HeyGen doesn't have it either) | Low (we have a stub) |
| **G9** | Cloud render scale-out (Remotion Lambda) | their 8-GPU FSDP infra | Later phase |

---

## 3. Target architecture

```
┌─────────────────────────── apps/web (Next.js 15, RTL) ───────────────────────────┐
│  /he-IL dashboard → "צור סרטון" wizard → AI-Studio-like scene editor (RTL)        │
│  Script-first scenes · audio-only preview · avatar picker · brand kit            │
└──────────────┬───────────────────────────────────────────────────────────────────┘
               │ spec (zod) · quoteSpec() credits
┌──────────────▼─────────────────────────── apps/worker (Node 24) ─────────────────┐
│  claim (SKIP LOCKED) → orchestrate:                                              │
│   story(he) → voice(edge-tts he-IL / ElevenLabs he) → align(WhisperX he)         │
│   → ★ LIPSYNC (NEW) → pixel → build(Remotion) → qa(frames) → mix → postprocess  │
│  billing: reserve → deduct on done → refund on fail                              │
└──────────────┬───────────────────────────────────────────────────────────────────┘
               │
   ┌───────────▼────────────┐   ┌─────────────────────┐   ┌────────────────────────┐
   │ NEW: lip-sync service  │   │ fal.ai i2v (exists) │   │ Remotion render (exists)│
   │ face.png + voice.wav   │   │ locked character    │   │ 1080×1920 h264 + QA     │
   │ → talking-head mp4     │   │ motion/B-roll       │   │                        │
   └────────────────────────┘   └─────────────────────┘   └────────────────────────┘
```

**The ★ LIPSYNC stage is the only genuinely new engine.** Its two inputs — a locked face reference image and a finished Hebrew voice track with word timings — are *already produced* by the existing pipeline. We add a third stage between `voice` and `pixel`.

---

## 4. Feature plan (phased)

### Phase 0 — "Talking head MVP" (prove the core, CLI-first)
*Goal: a selfie + Hebrew text → a 30-second lip-synced 9:16 talking video, end to end, via the existing skill plumbing. No new UI yet.*

1. **Lip-sync stage (`tools/gen_talk.py`)** — new stdlib tool modeled on `gen_clip.py`:
   - Input: `--face <image.png>` (or short driver video) + `--audio <voice.wav>` (from `gen_voice_edge.py`) + `--aspect 9:16`.
   - Backend: a fal.ai/Replicate talking-head model (evaluate **Kling lip-sync, OmniHuman, Sync Labs, LivePortrait, MuseTalk, SadTalker** — pick by Hebrew-speech quality + cost/sec via a new `bakeoff_talk.py` harness, mirroring `bakeoff_clip.py`).
   - Output: mp4 + sidecar json; **derive cost before spend** (iron rule), `--verify-prices` against fal pricing.
   - **Hebrew acceptance test:** a fixed 3-sentence Hebrew script (with nikkud + without, male + female voice) rendered across ≥3 candidate models; judge lip accuracy on phone-scale QA frames (the mandatory QA rule).
2. **Character lock extension** — extend `character.json` schema with a `face` block (front-facing reference, consented source) + `talk_model` + `cost_per_second`. Keep the "never re-derive from text" rule; the face ref is the lock.
3. **Glue in `orchestrate/`** — add `stages/talk.ts` between `voice` and `pixel`; gate behind a new spec flag `track:"avatar"`. Reuse the cost-before-pixels gate in `pixel.ts` for the talk stage.
4. **Editor render path** — a minimal Remotion comp that lays the talking-head clip over the existing caption kit (RTL full-line captions) + brand background. Reuse `render-spec.mjs`.

### Phase 1 — Hebrew AI-Studio (web productization)
*Goal: the HeyGen scene-editor flow, in Hebrew, RTL, self-serve.*

5. **RTL scene editor** — adapt `apps/web/src/app/editor/` to full RTL (`dir="rtl"`, logical CSS properties, mirrored iconography), script-first scene model (scenes-as-slides, per-scene script segment, markers in text for timing — copy HeyGen's *interaction*, not its layout pixel-for-pixel).
6. **Avatar picker** — stock avatars (we generate a Hebrew-market starter set via `gen_image.py --ref`, each a locked consented synthetic face) + "my photo avatar" (user selfie upload → Phase-0 talk stage).
7. **Hebrew voices** — surface edge-tts `he-IL-*` + ElevenLabs `eleven_multilingual_v3 --lang he` in a voice picker with speed/pitch/pauses; **audio-only preview** (free) before spend (the HeyGen iteration funnel).
8. **Consent gate (G6)** — for any real-person upload: on-page Hebrew consent script + spoken-code recording, stored with the character row. Trust-critical; non-negotiable before launch.
9. **Hebrew brand kit + templates** — RTL ad templates reusing `lib/ads.tsx` (CTA end card, PriceBadge, Logo), seeded for Israeli SMB verticals (the `/make-ad` track's home turf).

### Phase 2 — Business logic (Hebrew-market monetization)
*Goal: HeyGen's credit machine, tuned for Israel, transparent by design.*

10. **Plans (₪, VAT-inclusive, monthly/annual):** adapt `tiers.ts` —
    - **חינם** Free: 3 videos/mo, 1-min, watermark, 720p, 1 photo-avatar.
    - **יוצר** Creator ~₪49/mo: watermark off, 1080p, unlimited photo-avatars, credit rollover.
    - **פרו** Pro ~₪99/mo: 4K, premium lip-sync engine, translation, priority queue.
    - **עסקי** Business ~₪299 + ₪40/seat: pooled credits, workspaces, brand kit.
    - **ארגוני** Enterprise: SSO, custom — sales-led.
11. **Credit table for talk** — add to `CREDIT_TABLE`: `talkSec` (standard engine) vs `talkSecPremium` (photoreal), keeping a **HeyGen-like ~6× burn gap** as the upsell lever. Bill lip-sync by the second, reserve→deduct→refund via the existing `billing.ts`.
12. **Radical cost transparency (our differentiator)** — every render shows the exact credit cost + ₪ equivalent *before* submit (the repo's quoteSpec discipline, surfaced in UI). Anti-HeyGen-Trustpilot play.
13. **Stripe in ₪ + annual** — flip Stripe from test to live; Israeli invoicing (חשבונית) email receipts.
14. **Watermark viral loop** — free-tier exports carry our watermark (already have `postprocess.ts` 720p+watermark).

### Phase 3 — Scale & advanced (later)
15. **Video translation** (EN↔HE dubbing with lip-sync) — second use of the talk stage; SRT export exists.
16. **Hebrew Video Agent** — prompt→script(he)→talking video; blueprint preview before render.
17. **Streaming/live avatar** (G5) — LiveKit/Agoda-style WebRTC, BYO-LLM; big lift, only after PMF.
18. **Remotion Lambda scale-out** (G9) + direct TikTok/YouTube/Reels publish (G8, finish the stub).

---

## 5. Data model changes (Drizzle, `packages/db/src/schema.ts`)

- `characters` — add: `kind` (`stock|photo|twin`), `faceRefImageKey`, `talkModel`, `talkCostPerSecCredits`, `consentAssetKey`, `consentVerifiedAt`, `language default 'he'`.
- `avatars` (new) — stock-avatar marketplace rows (name_he, preview clip, kind, created via gen_image).
- `assets.kind` — add `consent_video`, `talk_clip`.
- `creditLedger` / `quotes` — new line types `talkSec`, `talkSecPremium`, `translationMin`.
- `projects` — add `track:'avatar'`, `direction:'rtl'`, `language:'he'` defaults.
- `brandKits` (new, Phase 1) — logo/colors/font per workspace (RTL fonts from `media/library/fonts`).

---

## 6. API / route changes (`apps/web/src/app/api/`)

- `POST /api/avatars` — create photo-avatar (selfie upload → consent → mint job).
- `POST /api/talks` — submit a talking-head render (face + script → quote → job).
- `POST /api/voices/clone` (Phase 2) — Hebrew voice clone.
- `GET /api/avatars` — stock marketplace list.
- Extend `generate/voices` to return Hebrew voice set; extend `quotes` to price `talkSec`.
- `POST /api/consent` — store + verify the spoken-code consent clip.
- Keep the existing `jobs/`, `projects/`, `stripe/`, `billing/` routes unchanged.

## 7. Worker pipeline changes (`apps/worker/src/orchestrate/`)

- New `stages/talk.ts` (between `voice` and `pixel`): takes the locked face ref + `voice.wav` → calls the lip-sync backend (fal) → uploads result to storage → writes an asset row → emits cost into the quote gate.
- `engine.ts` — register the `avatar` track: `story(he) → voice → align(he) → talk → pixel → build → qa → mix`.
- `billing.ts` — extend `completeAndDeduct` pricing for talk seconds.
- `qa.ts` — add a lip-sync sanity check (mouth-region motion vs. audio energy) on QA frames before full render.

## 8. New tools (`tools/`)

- `gen_talk.py` — the lip-sync generator (see Phase 0.1).
- `bakeoff_talk.py` — multi-model talking-head bakeoff with cost burned into a grid (mirrors `bakeoff_clip.py`), Hebrew test script built in.
- `consent_verify.py` (Phase 1) — spoken-code match on the consent clip.
- Extend `character.json` + `make-ai-short` iron rules for the `face` lock.

---

## 9. The Hebrew moat (why we win the segment)

1. **RTL-native everything** — editor, captions (full-line RTL, `anchorRtl`, `stripNikkud`), templates, brand kit. HeyGen/Synthesia bolt RTL on; we start there.
2. **Hebrew voices that don't sound translated** — edge-tts `he-IL-*` native word boundaries + ElevenLabs multilingual-v3 Hebrew + WhisperX `he` alignment, already wired to word-exact captions.
3. **Nikkud/decoding support** (`tools/nikkud.py`) — unique for the education/kids vertical HeyGen can't touch.
4. **₪ pricing + חשבונית invoices + Israeli SMB templates** — the `/make-ad` track's exact market.
5. **Cost transparency** as a brand value against HeyGen's credit-confusion backlash.

## 10. Risks & mitigations

| Risk | Mitigation |
|---|---|
| **Lip-sync quality on Hebrew speech** (phoneme coverage, RTL) | Bakeoff across ≥3 models with a fixed Hebrew test script before committing; keep the edge-tts→WhisperX timings as ground truth for QA |
| Lip-sync model cost blows up margins | Keep the 6× standard/premium credit gap; derive + surface cost before every render (existing gate) |
| Consent/deepfake liability (real-person faces) | Hard consent gate (spoken code) before any twin; moderation pass; no political use; honor takedown |
| Single-box render bottleneck | Phase 3 Remotion Lambda; concurrency already tuned (`REMOTION_CONCURRENCY`) |
| fal.ai model deprecation | `find_video_url()` schema-walk pattern + bakeoff harness = swap backends cheaply |
| Scope creep toward LiveAvatar | Streaming explicitly deferred to Phase 3; offline batch is the MVP |

## 11. Open questions for the user
1. **Lip-sync backend preference** — pay-per-use fal/Replicate (fastest to ship, cost/sec) vs. self-hosted open model (LivePortrait/MuseTalk on a GPU box, cheaper at scale, more ops)?
2. **MVP avatar type** — start with *photo-avatar* (selfie→talk) only, or also allow a *digital twin* from 2-min footage in v1?
3. **Pricing currency/anchor** — is ~₪49 Creator the right entry, and do we sell annual up front?
4. **Target first vertical** — Israeli SMB ads (leverage `/make-ad`) or L&D/education (leverage nikkud/reading)?

---

## 12. Milestones at a glance

| Milestone | Deliverable | Gate |
|---|---|---|
| **M0** | `gen_talk.py` + `bakeoff_talk.py` + Hebrew lip-sync acceptance test passes | lip-synced 30s Hebrew clip, phone-QA approved |
| **M1** | `avatar` track end-to-end in worker + minimal editor render | selfie + Hebrew text → 9:16 talking video via web |
| **M2** | RTL AI-Studio editor + avatar picker + consent gate | self-serve Hebrew user creates a video |
| **M3** | ₪ plans + credits + watermark loop + Stripe live | first paying Hebrew customer |
| **M4** | translation + Video Agent + (later) streaming + Lambda | scale |

*Sources: `research/heygen-ux-research.md`, `research/heygen-catalog.md`, HeyGen business-model research, and the 2026-08-24 read-only repo audit — all produced this session.*
