# Repo Audit — Current Talking-Avatar & Voice Pipeline

*Technical audit of `claude-faceless-shorts-creator` as of 2026-08-24, produced to plan a
HeyGen-like Hebrew talking-avatar product. All file:line refs are current. Costs quoted are the
repo's own stated/derived numbers, not fresh vendor prices.*

---

## TL;DR

The talking-avatar pipeline is **real but un-proven**: the full scaffold is built and type-clean
(CLI tools, worker `talk` stage, DB, APIs, wizard UI, a spec-driven Remotion comp, a spoken-consent
gate) but **no actual fal lip-sync clip has ever been rendered** — the one paid call is gated behind
the user funding `FAL_KEY` (`webapp/docs/avatar-track.md:86-92,104`). The `_bakeoff-talk/` dir
contains only the 13.3 s `voice.mp3`, no mp4 (`media/projects/_bakeoff-talk/`), confirming dry-run
only. The pipeline is model-agnostic by design, and the **single most important gap for Hebrew is
unverified**: no vendor guarantees Hebrew lip-sync, and the repo has not run the mandatory Hebrew QA
gate on any backend.

---

## 1. What EXACTLY is the current talking-avatar pipeline?

### 1.1 The stage (orchestration position)

`avatar` is a 4th engine track. The talk stage sits **between `voice` and `pixel`** in the generate
orchestrator:

```
story → voice → TALK → pixel → build → qa → mix → render
```
- `GENERATE_STAGES` = `['story','voice','talk','pixel','build','qa','mix','render']` — `schema.ts:308`
- `runGenerate` threads `payload.data.avatar` into the spec then calls `runTalkStage` after voice —
  `runGenerate.ts:147-153`
- `runTalkStage` is a **NO-OP unless `spec.engine==='avatar'`** — `talk.ts:47`

### 1.2 The generator tool

`tools/gen_talk.py` is a **model-agnostic fal.ai queue client** (the talking-head sibling of
`gen_clip.py`):

- **Inputs**: `--face` (a portrait **IMAGE** for photo-avatars, or with `--driver` a **driver
  VIDEO** for digital twins) + `--audio` (the Hebrew `voice.wav`). Always `audio_url`; `image_url`
  XOR `video_url` depending on `--driver` — `gen_talk.py:143-148`
- **Backend**: `--model` is a raw fal model id string — `gen_talk.py:5-9,116`. Default (CLI only) =
  `fal-ai/veed/fabric-1.0` — `gen_talk.py:42`
- **Upload seam**: local inputs uploaded to fal storage via `rest.alpha.fal.ai/media/upload` —
  `gen_talk.py:82-93`
- **Resolution**: only Fabric pays attention — `payload.setdefault("resolution", TALK_RESOLUTION||"480p")`
  — `gen_talk.py:152-153`
- **Output**: downloads the mp4 + writes a sidecar `.json` (model/payload/request_id/source_url) —
  `gen_talk.py:193-204`

### 1.3 Which models generate the talking head? (TALK_MODELS registry)

Single source of truth in `webapp/packages/spec/src/ai-models.ts:49-66` (mirrored in
`tools/bakeoff_talk.py:55-61`):

| short id | fal endpoint | input | tier | costPerSecUsd | res |
|---|---|---|---|---|---|
| `fabric-1.0` | `fal-ai/veed/fabric-1.0` | image+audio | standard | $0.10 | 480p (720p opt) |
| `fabric-1.0-fast` | `fal-ai/veed/fabric-1.0/fast` | image+audio | standard | $0.10 | 480p |
| `live-portrait` | `fal-ai/live-portrait` | image **+driving video** (not audio!) | standard | $0.02 | — |
| `musetalk` | `fal-ai/musetalk` | video+audio | standard | $0.00 | — |
| `kling-lipsync` | `fal-ai/kling-video/lipsync/audio-to-video` | video+audio | **premium** | $0.014 | — |
| `omnihuman` | `fal-ai/bytedance/omnihuman` | image+audio | **premium** | $0.14 | — |

- **Photo-avatar (standard) default** = `fabric-1.0` (VEED Fabric 1.0), $0.10/s @480p — `ai-models.ts:52,65`
- **Photo-avatar (premium) default** = `omnihuman`, $0.14/s — `ai-models.ts:62,66`
- **Digital twin (driver video)** always rides `kling-lipsync` (video+audio re-dub, $0.014/s) —
  `talk.ts:109`, `ai-models.ts:60`
- `resolveTalkModel(model, premium)` returns the def; unknown short ids fall back to the tier
  default; raw fal ids pass through — `ai-models.ts:72-80`

> ⚠️ **`live-portrait` is misclassified as a talk input.** It is image + **driving video** (facial
> reenactment), NOT audio-driven. It should never be picked for an audio lip-sync; only reachable by
> explicit `--model` (not a default). Worth flagging in any backend-selector UI.

### 1.4 The worker stage (`talk.ts`)

`runTalkStage` (talk.ts:38-155):
1. **Resolves the locked face**, priority: `avatar.faceSrc` → `avatar.faceAssetId` (an `assets` row
   = direct upload, or a `characters` row whose `kind:'twin'` sets `driverVideo=true`) →
   `spec.characterId` → the character's `refImageKey` — `talk.ts:56-88`. **No face = hard throw.**
2. **Derives premium**: `talk.premium===true || driverVideo` — a twin always rides the premium rate
   — `talk.ts:95`
3. **Cost gate**: `intendedSpend = ceil(totalSec) * rate` must be ≤ quoted credits — `talk.ts:99-105`
4. **Runs `gen_talk.py`** with the resolved model + `--driver` flag, 15-min timeout — `talk.ts:123-132`
5. Writes a `talk_clip` **asset** row — `talk.ts:137-145`
6. Sets `spec.scenes[0].clip = {src, durationSec}` — `talk.ts:148-151`

**Key structural fact**: the WHOLE script is minted as **ONE continuous talking-head clip** (a single
fal call), not per-scene. Scenes only scope the render window — `talk.ts:114-115`. The
`talkDir`/per-line-resegment variable is explicitly "kept for a future per-line resegment; single
clip for now" — `talk.ts:133`.

### 1.5 The render comp

`remotion/src/shots/avatar-spec/AvatarSpec.tsx` renders the single clip **full-bleed 1080×1920@30**,
9:16, with a gentle Ken-Burns zoom (1→1.04 over the duration), RTL pill captions + progress bar —
`AvatarSpec.tsx:84-142`. Before a real clip exists it shows a **dark fallback plate** — `AvatarSpec.tsx:87-95`.
`mode:'avatar'` deliberately relaxes the no-CTA-outro / seamless-loop house rules — `AvatarSpec.tsx:49-51`.

### 1.6 Consent flow (the anti-impersonation gate)

Digital-twin avatars require **spoken Hebrew consent**:
- `GET /api/consent` issues a one-time **4 random Hebrew words** challenge phrase, 10-min TTL —
  `api/consent/route.ts:30-48` (in-memory Map — single-process dev only, `route.ts:27`)
- `POST /api/consent` stores the consent clip as a `consent_video` asset, moves the twin to
  `minting`, enqueues a `consent-verify` job — `route.ts:57-150`
- The worker runs `tools/verify_consent.py`:
  - **TIER 1 (real ASR)**: WhisperX `large-v3` Hebrew transcription + fuzzy phrase match (≥50% of
    phrase words in transcript) — `verify_consent.py:46,124,157-163`. Only attempted if a whisper
    model is already cached OR `VERIFY_CONSENT_ASR=1` (avoids a multi-GB download) —
    `verify_consent.py:110-115`
  - **TIER 2 (deterministic fallback)**: clip has audio stream, ≥1.5 s, RMS ≥ −45 dB → accepted —
    `verify_consent.py:44-45,186-195`. **This fallback does NOT verify the words** — it trusts the
    in-app recording. Production-strict only once an ASR model is cached.
- Photo avatars (`kind:'photo'`) need **NO consent** — the uploader's own face is the ref —
  `api/avatars/route.ts:112-145`

### 1.7 Avatar creation API

- `GET /api/avatars` → `{stock, mine}` — `api/avatars/route.ts:21-60`
- `POST /api/avatars` → create `photo` (Creator/Pro gate, instant ready) or `twin` (Pro, minting→consent)
  — `api/avatars/route.ts:81-182`. **Both are gated to `pro` tier** (`avatars_require_pro`) —
  `route.ts:105-108`
- `DELETE /api/avatars/[id]` — guarded 409 while referenced by a project (per avatar-track.md)

**Stock marketplace**: 8 seeded Hebrew-market faces (avi/dana/david/michal/noa/shlomo/yael/yossi),
2048×2048 PNGs at `webapp/.storage/avatars/stock/<slug>.png`, 2 marked premium —
`avatar-track.md:63-64`; confirmed dims 2048×2048.

---

## 2. Hebrew voice generation today

### 2.1 Default engine by track

| Context | Engine | Voice | Where |
|---|---|---|---|
| Avatar track (default spec) | **edge** | `he-IL-HilaNeural` | `templates.ts:382`, `AvatarSpec.tsx:65` |
| Ad track | **edge** | `he-IL-HilaNeural` (feminine verticals) / `he-IL-AvriNeural` (rest) | `make-ad/SKILL.md`, `lexicon.py:84` |
| Reading/kids track | **edge** | `he-IL-HilaNeural`, rate −18% | `make-reading-short/SKILL.md` |
| Generic generate wizard | **kokoro default** (but kokoro has **NO Hebrew**!) | `af_bella` | `voice.ts:18`, `generate/page.tsx:92` |

**⚠️ The biggest voice-pipeline landmine**: the worker `voice` stage defaults to **kokoro**
(`KOKORO_DEFAULT='af_bella'`) — `voice.ts:18,91` — and the wizard's step-3 voice engine default is
**kokoro** — `generate/page.tsx:92`. But `make-ad/SKILL.md:242` and `make-reading-short` both state
**kokoro has NO Hebrew** ("Exclude kokoro entirely (no Hebrew)"). So a default Hebrew generate in the
webapp wizard would silently try to synthesize Hebrew with an English-only voice unless the UI/user
selects **edge**. The Hebrew-safe path is **edge-tts** with `he-IL-*` personas.

**Hebrew edge-tts voices shipped** (from `/api/generate/voices`): `he-IL-HilaNeural` (הילה) and
`he-IL-AvriNeural` (אברי) — `api/generate/voices/route.ts:24-25`. `gen_voice_edge.py` accepts any
`--voice` id — those are the two bundled personas.

### 2.2 How the Hebrew voice is synthesized

- **edge-tts** (`tools/gen_voice_edge.py`) — Microsoft Edge neural TTS, **free, unlimited**, native
  **WordBoundary** events give real per-word times — `gen_voice_edge.py:81-93`. Default `en-US-AriaNeural`;
  the avatar/ad path passes `he-IL-*`.
- **ElevenLabs** (`gen_voice.py`) — Hebrew **only on `eleven_multilingual_v3`**; v2/flash-v2.5 have
  **no Hebrew** (wrong model silently yields garbage) — `make-ad/SKILL.md:240-242`. `DEFAULT_MODEL` in
  gen_voice.py is `eleven_multilingual_v2` — `gen_voice.py:44` — **which has no Hebrew**, so an
  ElevenLabs Hebrew request MUST override to v3 or it breaks.
- **Kokoro** — local, $0, but **English-only** (lang_code 'a') — `gen_voice.py:159-170`.

### 2.3 Known quality issues (documented in repo research)

- **edge-tts is an UNOFFICIAL endpoint** — Microsoft breaks it periodically; documented BREAKAGE
  DRILL (`pip install -U edge-tts`, else local TTS + `align_words.py --lang he` recovery) —
  `gen_voice_edge.py:24-30`, `make-ad/SKILL.md:236-239`. The worker auto-falls back edge→kokoro on
  failure (`voice.ts:99-104`) — which, for Hebrew, lands on an English-only voice. **This fallback is
  actively wrong for Hebrew.**
- **Pacing/emotion**: edge-tts delivery is steered only by `rate`/`pitch` (e.g. −6%/−2 Hz "soft &
  intimate" default; −18% kids). No per-line emotion direction like HeyGen's Voice Director — there
  is no emotional-control path (research `heygen-ux-research.md:73-74` lists HeyGen's Excited/Casual/
  Calm/… presets as a feature we don't have).
- **Nikkud / pronunciation**: ads deliberately use **ktiv maleh (no nikkud)**, "ISRAELI > ACADEMY"
  register, Hebrish acceptable — `make-ad/SKILL.md:123-125`. The nikkud engine (`tools/nikkud.py`,
  `tools/nikkud_data.py`) is a **reading/kids educational** tool (deterministic grapheme/syllable
  segmentation of *already-pointed* text, teacher-vetted lexicon) — `nikkud.py:9-16`. It is **not** a
  TTS front-end: the product path deliberately has **NO live ML nakdan** — `nikkud.py:4-6`. So
  pronunciation issues from vowel-less Hebrew are not addressed by the pipeline; TTS infers vowels.
- **Per-vertical voice**: the ad lexicon's `voice` field drives Hila (feminine register) vs Avri
  (else) — `lexicon.py:84`. Register is vertical-dependent, not one-size — `make-ad/SKILL.md:125-127`.

---

## 3. Word-level timings / captions & lipsync-ready data

### 3.1 How timings are produced

Three TTS backends all emit the **same contract** — an mp3 + `<stem>.words.json` of
`[{w, start, end}]` seconds:

| Engine | Timing source | Accuracy |
|---|---|---|
| **edge-tts** | native `WordBoundary` events (`offset`/`duration` in 100ns → s) | ~word-precise from the vendor; scaled by any atempo fit — `gen_voice_edge.py:87-90,172-175` |
| **ElevenLabs v3** | `with-timestamps` character-level alignment, collapsed to words — `gen_voice.py:114-116,141-156` | character-precise; falls back to WhisperX forced alignment if unavailable — `gen_voice.py:133-136` |
| **Kokoro** | native per-token `start_ts/end_ts` — `gen_voice.py:173-192` | token-precise (English only) |
| **WhisperX fallback** (`align_words.py`) | forced alignment over the clip; `--lang he` resolves a **Hebrew wav2vec2 aligner** — `align_words.py:67,100`; monotonic-safety clamp — `align_words.py:84-88` | ~word-level; ~10-30 s/line CPU |

After per-line atempo time-fitting, word times are scaled and offset to global — `gen_voice.py:456-460`,
`gen_voice_edge.py:172-175`. The wizard's voice stage reads these REAL timings back into
`spec.voice.lines[].words` — `voice.ts:124-129`.

### 3.2 Accuracy for Hebrew + lipsync-readiness

- Word times are written per-word and per-line, and captions sync "to the exact spoken word, RTL" —
  `make-ad/SKILL.md:235`. This is genuinely word-exact (vendor-native for edge/eleven).
- **No phoneme-level or viseme-level data exists anywhere in the repo** (grep for `viseme`/`phoneme`
  across the repo's own code/tools returns nothing — only vendored deps + research mentions). The
  word map is the finest granularity produced.
- The lip-sync backends (Fabric/OmniHuman/Kling) map **audio features → visemes internally** and
  never see text — `avatar-backend-models-2026-08.md:82` — so they don't consume word/viseme input;
  they only need the **finished Hebrew WAV**. The repo's word timings are used for **caption burn-in
  only**, not for lipsync control.
- **Lipsync-relevant finding**: WhisperX's Hebrew aligner is already proven live (consent ASR),
  and edge-tts WordBoundary gives ~phoneme-granular word starts — but nothing emits phoneme/viseme
  boundaries a custom lipsync driver (e.g. a Wav2Lip-style model or a video-editing mouth-map) could
  consume. If the plan needs phoneme/viseme input, that data layer is net-new.

---

## 4. Webapp exposure — how close to a HeyGen-style self-serve flow?

| Surface | Status | HeyGen gap |
|---|---|---|
| **Generate wizard** (`(main)/generate/page.tsx`) | 5-step stepper: Track → Input → Script(lock) → Style&voice → Generate. `avatar` track picker (required), premium toggle w/ live ⚡ math — `generate/page.tsx:321-329,640-691` | Script is a **locked line list**, not a scene-based editor. No per-scene editor, no markers-in-text timing, no audio-only avatar preview. |
| **Avatar manager** (`(main)/avatars/page.tsx`) | stock marketplace + create-photo + digital-twin (driver video + spoken consent) + delete/retry — `avatars/page.tsx:3-7` | No avatar-looks/variants, no redo allowance, no marketplace search/filter |
| **Billing/tiers** (`tiers.ts`) | חינם ₪0 / יוצר ₪39 / פרו ₪99, capability matrix, `talkAvatar`/`talkAvatarPremium` flags, `talkSec:4⚡`/`talkSecPremium:24⚡` — `tiers.ts:66-130`, `quote.ts:30-31` | Free/creator can't touch avatars; avatar is **pro-only**. HeyGen gates photo avatars to paid but twins/trials on free. |
| **Voice picker** (`api/generate/voices`) | lists 2 Hebrew edge voices — `voices/route.ts:24-25` | No speed/pitch/pause sliders, no per-line emotion, no audio preview before spend |
| **Quote/credits** | `quoteSpec()` computes talk credits = `ceil(talkSec)*rate` — `quote.ts:179-184`; reserve→deduct→refund; live ⚡ in wizard | Transparent — better than HeyGen's opaque burn (deliberate differentiator) |

**Distance to HeyGen self-serve**: the **business spine is close** (auth, tiers, credits, reserve/
deduct, avatar CRUD, consent gate, wizard). The **creative editor is the gap** — HeyGen's scene-based
"script-first, not timeline" editor with per-scene script segments, markers, voice mirroring, brand
kit, and live audio preview does not exist here. The avatar track renders a **single talking-head
clip** over a fixed template; there's no multi-scene/segment editorial control, no avatar looks, no
emotion direction, no translation/dub lane.

---

## 5. Quality gaps & technical debt in the talk pipeline

1. **Un-proven core**: zero real fal renders. The M0/M1 gate (`bakeoff_talk.py --spend`) has never
   passed — no mp4 exists, only `voice.mp3`. All "verified" claims are payload dry-runs —
   `avatar-track.md:54,86-92`.
2. **Resolution ceiling**: Fabric default **480p** ($0.10/s); 720p is opt-in via
   `TALK_RESOLUTION=720p` ($0.20/s) — `gen_talk.py:150-153`, `ai-models.ts:52`. The comp is
   **1080×1920** — so a 480p clip is upscaled 2.25×. **Resolution mismatch = soft output.**
   Premium OmniHuman has no stated res in the registry (`ai-models.ts:62`).
3. **Face-only vs upper-body**: Fabric/OmniHuman produce a head/face talking head, not an
   expressive upper-body performer. No gestures, no hand/body motion, no camera variety. `AvatarSpec`
   applies only a slow Ken-Burns zoom to a full-bleed face clip — `AvatarSpec.tsx:97-107`.
4. **Emotion**: none. edge-tts rate/pitch only; no per-line emotion, no Voice-Director equivalent.
5. **Single continuous clip**: the whole script is one fal call; no per-line/per-scene lip-sync, so
   no ability to re-roll one line, vary camera per scene, or interleave avatar + B-roll. The
   per-line resegment is explicitly deferred — `talk.ts:133`.
6. **Multi-character**: not supported — one avatar, one clip, `scenes[0].clip` only.
7. **Identity lock**: photo avatars lock the uploaded face as `refImageKey`; twins lock the driver
   video — `api/avatars/route.ts:138,175`. But there's **no re-verify of identity per render**, and
   the deterministic consent fallback trusts in-app recording without word verification —
   `verify_consent.py:206-208`. Deepfake/impersonation risk is only as strong as the consent tier
   actually run.
8. **`live-portrait` mislabeled** as audio-input talk (it's driving-video reenactment) —
   `ai-models.ts:54-55`.
9. **Kokoro-as-default-Hebrew landmine** in the generic wizard + worker fallback — `voice.ts:18,91-104`,
   `generate/page.tsx:92`. The worker's edge→kokoro auto-fallback (`voice.ts:99-104`) replaces a
   broken Hebrew edge voice with an **English-only** voice.
10. **Consent store is in-memory** (single-process) — `api/consent/route.ts:27` — won't survive
    multi-instance prod.
11. **No lipsync QA gate**: the plan calls for a mouth-region motion vs audio-energy check
    (`heygen-hebrew-platform-plan.md:174`) but `bakeoff_talk.py` only asserts **the clip moved at all**
    (motion score > 1.0 = non-static), not that **the mouth matches the Hebrew audio** —
    `bakeoff_talk.py:195-203`. A clip that moves but lip-syncs badly still passes.
12. **fal model deprecation risk**: only the schema-walk + bakeoff harness mitigates it —
    `gen_talk.py:96-111`. Backends reprice/deprecate frequently (`avatar-backend-models-2026-08.md:6`).

---

## 6. Budget implied by current design (every stated per-generation cost)

### 6.1 Credit table (the monetization spine) — `quote.ts:16-32`

| Item | Credits | 1⚡ ≈ $0.01 |
|---|---|---|
| TSX render flat | 2 | $0.02 |
| AI image | 3 | $0.03 |
| ElevenLabs voice line | 1 | $0.01 |
| AI video second | 6 | $0.06 |
| Vox collage layer | 3 | $0.03 |
| Generated SFX | 2 | $0.02 |
| Generated music bed | 4 | $0.04 |
| **talkSec (standard lip-sync)** | **4** | **$0.04** |
| **talkSecPremium (photoreal)** | **24** | **$0.24** |

Talk is billed `ceil(totalSec) × rate` — `quote.ts:179-184`; the premium gap is exactly 6× (24/4),
the HeyGen-style upsell lever — `quote.ts:28-31`, `tiers.ts:45-46`.

### 6.2 Derived fal cost basis (registry + bakeoff) — `ai-models.ts:49-63`, `bakeoff_talk.py:55-61`

| Model | costPerSecUsd | per 30 s |
|---|---|---|
| `fabric-1.0` / `-fast` | $0.10 | ~$3.00 |
| `live-portrait` | $0.02 | ~$0.60 |
| `musetalk` | $0.00 (serverless) | ~$0 |
| `kling-lipsync` (twin) | $0.014 (5 s increments) | ~$0.42 |
| `omnihuman` (premium) | $0.14 | ~$4.20 |

### 6.3 End-to-end example (derived)

A 30 s avatar video (mode `avatar`), standard engine, no ElevenLabs/audio-gen:
- talk: `30 × 4⚡ = 120⚡ = $1.20` **credits charged to the user**
- fal to the repo: `30 s × $0.10 = $3.00` (Fabric 480p) — **the repo's real cost exceeds the credits
  charged** on the standard engine. On premium: `30 × 24⚡ = 720⚡ = $7.20` charged vs `30 × $0.14 =
  $4.20` fal cost (margin-positive). This asymmetry is deliberate (standard = loss-leader wedge) but
  worth stating explicitly for the plan.

### 6.4 Voice (free) & other costs

- edge-tts Hebrew = **$0**; ElevenLabs v3 Hebrew ≈ **$0.03–0.10/ad** (stated in make-ad/SKILL.md:241);
  kokoro = $0 (no Hebrew).
- Consent verification = **$0** (free, a trust gate, not a generation) — `api/consent/route.ts:104`.
- The prior backend research quotes alternate per-second prices (prunaai/p-video-avatar $0.025/s,
  sync-lipsync v2 $3/min, heygen lipsync-speed $0.0333/s, OmniHuman v1.5 $0.16/s) as **un-used
  candidates** — the repo's shipped registry does NOT use them — `avatar-backend-models-2026-08.md:22-42`.

---

## Prior research — what it already concludes (don't redo)

### `research/heygen-hebrew-platform-plan.md`
- **Thesis**: the repo already has the entire HeyGen-shaped stack except the lip-sync stage; the wedge
  is "the only Hebrew-native talking-avatar product." Scope = clone **product flow/business logic, not
  brand/pixels**.
- **Gap list G1–G9**: G1 lip-sync is "the core net-new build"; G2 photoreal avatar from selfie; G3
  voice cloning; G4 Hebrew script-assist; G5 streaming (deferred); G6 consent gate; G7 avatar-centric
  editor; G8 direct publish; G9 Lambda scale-out.
- **Business machine**: single credit pool, ~6.7× standard/premium burn gap (reproduced as exactly 6×
  in `quote.ts`), credits rollover/forfeit, radical cost transparency as the anti-HeyGen-Trustpilot
  differentiator.
- **Phases**: P0 CLI MVP → P1 RTL AI-Studio editor + avatar picker + consent → P2 ₪ plans + credits +
  watermark → P3 translation/Video Agent/streaming.

### `research/heygen-ux-research.md`
- Maps HeyGen's exact flows: **script-first scene-based editor (not timeline)**, audio-only preview
  (no avatar render before spend), avatar ladder (stock → Photo Avatar → Digital Twin → Avatar V),
  hard spoken-code consent gate for real-person footage, credit economy w/ dynamic caps, brand
  systems, workspace/roles ladder, SRT export, **burned-in stylized captions only for avatar videos
  (no viewer CC)**.
- Gives the pricing/limits to aim at (Creator 600 cr, 3 cr/min standard avatar, 20 cr/min IV/V) and
  the ~10 min render/min reality.

### `research/hebrew-ads/avatar-backend-models-2026-08.md`
- **Two structural lanes**: image+audio (photo→avatar) vs video+audio (twin→re-dub); **no single
  hosted endpoint does both well**.
- Hosted candidates priced (OmniHuman $0.14/s, Creatify Aurora $0.07–0.14/s, prunaai/p-video-avatar
  $0.025/s cheapest, Sync lipsync v1.9 $0.70/min / v2 $3/min / pro $5/min, Kling lipsync **NOT on
  fal** — all paths 404, lives on Replicate/Kuaishou).
- Self-host options with **license landmines** (Wav2Lip non-commercial, Sonic CC BY-NC-SA, hallo
  English-only, HunyuanVideo-Avatar bans EU/UK/KR, LivePortrait's InsightFace detector NC).
- **Hebrew finding (the decisive one)**: no vendor publishes a Hebrew lip-sync commitment except Vozo;
  bring-your-own-Hebrew-audio models on multilingual **Whisper** encoders (LatentSync, MuseTalk,
  Sync) are the safe bet because they map acoustic→visemes and never see text. **XLS-R 128 has
  Hebrew, XLSR-53 and Chinese wav2vec2 (InfiniteTalk/MultiTalk) do not** — empirical Hebrew QA is
  mandatory before shipping anything.
- **Recommendation**: P0 = `prunaai/p-video-avatar` (photo) + `fal-ai/sync-lipsync/v2` (dub),
  ~$1/30s blended; P3 = self-host InfiniteTalk/LatentSync + Wan2.2-S2V at ~$0.05/30s. Hard gate = a
  fixed Hebrew test set rendered through each candidate, frames read at phone scale.

> **Note for the plan**: the shipped `TALK_MODELS` registry (Fabric/OmniHuman/Kling-lipsync) does NOT
> match the backend research's P0 recommendation (prunaai/sync-lipsync). The registry was verified
> against fal live pages on 2026-08-24 (`ai-models.ts:45-48`), but the research flagged Kling as
> **not on fal** while the registry now lists `fal-ai/kling-video/lipsync/audio-to-video` — a
> discrepancy worth re-verifying before trusting the twin path.

---

## Bottom line for the HeyGen-Hebrew plan

- **Build on what's proven**: Hebrew edge-tts voices + word-exact RTL captions, WhisperX Hebrew
  alignment (live), credit/tier/quote spine, consent gate, avatar CRUD + stock faces, spec-driven
  comp. These are real, working assets.
- **The un-proven core is the lipsync render** — nothing has run end-to-end. Before any HeyGen-like
  roadmap, the single gate that matters is `bakeoff_talk.py --spend` on a real fal backend with the
  **Hebrew QA pass** (mouth-sync accuracy on guttural-heavy Hebrew), which the current motion-only
  gate does not provide.
- **Fix the sharp edges first**: 480p→1080p upscale, kokoro-as-default-Hebrew landmine + edge→kokoro
  fallback, live-portrait mislabel, in-memory consent store, and the registry-vs-research backend
  discrepancy.
- **The HeyGen-like editor is the big net-new UI** (scene-based script editing, audio-only preview,
  emotion/voice controls); the backend lip-sync stage is essentially built, just un-proven.
