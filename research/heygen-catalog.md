# HeyGen — Feature + API + Tech Catalog
*Compiled 2026-08-24 from heygen.com, developers.heygen.com, docs.liveavatar.com, help.heygen.com, github.com/heygen-com, and news sources.*

Scale markers HeyGen advertises: **159M+ videos created, 135M+ avatars created, 22.5M+ videos translated, 1M+ developers/companies, 85% of Fortune 100, $200M ARR, 30M+ users, customers in 196 countries.** (vendor claims)

---

## 1. Feature catalog

### Avatar types (models: Avatar III → Avatar IV → Avatar V)
- **Stock/public avatars** — 500+ on Free plan, **700+** on paid plans.
- **Digital Twin** (custom video avatar) — trained from a **15-second phone recording** (Avatar V) or longer footage; 1 custom twin on Free/Creator/Pro, 5+ on Business, 10+ on Enterprise; extra twins are a paid add-on.
- **Avatar V** (flagship, launched **May 4, 2026**) — "most realistic" model; separates *performance* from *appearance* (record once → multiple looks: outfit/setting/background swaps); multi-angle consistency, long-form stability, no identity drift; 177+ languages. Costs **20 credits/min** (parity with Avatar IV since May 2026).
- **Avatar IV** — default v3 API engine; animates a single photo or arbitrary image (even animals/aliens); exclusive **`motion_prompt`** (natural-language body/hand gesture control, e.g. "walk towards the camera slowly") and **`expressiveness`** (high/medium/low). 20 credits/min.
- **Avatar III** — legacy engine, 4K-capable for video-avatar looks, 3 credits/min.
- **Photo Avatar / talking photo** — one static photo → talking video; prompt-based look generation; **Look Packs** (professional/lifestyle/holiday/fantasy); emotion presets with adjustable intensity; natural blinks/eye movement; **unlimited** on Creator and above; $1.00/creation call via API.
- **Cinematic Avatar** — prompt + 1–3 avatar looks → 4–15 sec stylized clip; flat **$7.00/video**; 720p/1080p.
- **Studio avatars** (`studio_avatar` type) — professionally shot stock/presenter footage.
- **LiveAvatar** (interactive/streaming) — spun out to **liveavatar.com**; see §"Interactive/streaming" below.
- **Avatar Groups & Avatar Looks** — one identity, many looks (managed via API too).

### Voice
- **300+ natural AI stock voices** (marketing historically said "700+ voices"); **175–177+ languages/dialects** (site copy varies between the two numbers).
- **Voice cloning** — from ~1 minute of clean speech (site); the Avatar V research report claims cloning from **as little as 10 seconds** of audio (LLM backbone with discrete audio token prediction, multilingual, emotion control). API: `POST /v3/voices/clone` (Apr 2026).
- **Voice design** — `POST /v3/voices` / "Design a Voice" (generate a custom voice from a description).
- **Voice Director & Voice Mirroring** (AI Studio) — per-line control of speed, pitch, emotional tone, pauses, emphasis, pronunciation.
- **TTS engine: "Starfish"** — stock TTS voices must be Starfish-compatible (changelog, Apr 2026); TTS API $0.000667/sec, 1–5,000 chars, 0.5×–2.0× speed.
- Third-party voices: **ElevenLabs is a HeyGen subprocessor** (trust page), and LiveAvatar supports ElevenLabs/Fish Audio/Cartesia BYO-TTS.

### Video translation / dubbing
- **175+ languages & dialects**; up to **10 target languages per job**; file upload or **YouTube link** input.
- **Voice clone preserved across languages**; lip-synced dubbing; auto subtitles (SRT/VTT now *always* generated — `enable_caption` deprecated Aug 2026).
- **Brand Glossary** — forced translations, protected terms, pronunciation control (API-manageable).
- **Edit & Review / Proofread sessions** — edit translated script before render; proofread API (SRT download/upload → regenerate); precision/proofread mode is **Enterprise-only**.
- Two API modes: **Speed** ($0.0333/sec audio-only or lip-sync) and **Precision** ($0.0667/sec).
- Embeddable **multilingual player** for any page or LMS. Claimed ~80% cost reduction vs traditional dubbing (Trivago case: 30 markets, −50% post-production time).

### Editor / AI Studio
- Script/text-based editor with **scenes** (1–50 scenes/video; scene types: avatar_video, image, video), realistic previews, gesture control.
- **Voice Director / Voice Mirroring**, auto captions + caption styling (burned-in captions via `caption.style`), B-roll, background music & SFX library (API-searchable), media/asset library.
- **Brand Kit** (typography/colors/logos; creatable from a website URL via API), team collaboration: comments, tagging, multi-user editing (Business+).
- **PPT/PDF-to-video**, **URL-to-video**, text/image/audio-to-video tools, AI script assist, templates (700+ stock avatars + Studio Template API), AI clipping (auto-highlight clips, $0.15/clip), filler-word removal ($0.01/sec source).
- Output: 1080p default, **4K** on Pro+ (4K temporarily unavailable for Avatar IV/V as of Jun 2026); 16:9/9:16 (+1:1, 4:5, 5:4, auto on some flows); max 30 min (Business 60 min; Enterprise unlimited); most videos render "within a minute."

### Video Agent (prompt → finished video; flagship 2026 launch)
- Free-text prompt (up to 10,000 chars via API; 500 in the consumer widget) → script, visuals, voiceover, edits/transitions, **AI presenter A-roll** + B-roll + motion graphics.
- **Blueprint preview** — scene-by-scene creative breakdown before render; conversational revision ("Send Message or Request Revision" endpoint); every element stays editable in AI Studio without re-render.
- Every Video Agent scene is now **composed/rendered with HyperFrames** (Jul 2026). 20 credits/min; API $0.0333/sec. 1080p/4K.
- Modes/styles API, `mode: generate|chat`, `auto_proceed`, `thinking` status — a genuinely agentic session model.

### Interactive / streaming avatar — **LiveAvatar** (liveavatar.com, docs.liveavatar.com)
- Real-time conversational avatar sessions; **two modes**: FULL (managed WebRTC + ASR/LLM/TTS, 2 credits/min) and LITE (you manage WebRTC via **LiveKit or Agora**, BYO ASR/LLM/TTS, 1 credit/min); free **Sandbox** mode.
- **BYO LLM**: any OpenAI-compatible model or your own inference endpoint; BYO TTS (ElevenLabs, Fish Audio, Cartesia, others); conversational or push-to-talk.
- **Embed API**: `POST https://api.liveavatar.com/v2/embeddings` (avatar_id, context_id, is_sandbox) → short-lived iframe URL. Auth `X-API-KEY`, keys at app.liveavatar.com.
- **Web SDK** (`github.com/heygen-com/liveavatar-web-sdk`, TypeScript), LiveKit agent starter (Python), open-source demo sales agent, agent skills (`npx skills add heygen-com/liveavatar-agent-skills`).
- HeyGen's research blog reports the streaming pipeline achieves **<5 s time-to-first-frame** and **27+ fps at 720p** generation (faster than realtime). Zoom app puts interactive avatars in live meetings.
- ElevenLabs documents HeyGen LiveAvatar as an integration target for ElevenAgents.

### Collaboration, analytics, apps
- Team workspaces (Business: $149/mo + $20/seat; SAML/SSO, SCORM export; Enterprise: multi-workspace, SCIM).
- Mobile app: **Android** ("HeyGen: AI Video Generator", `com.heygen.app` on Google Play); iOS presence implied by the SwiftTweaks fork in their GitHub but not verified.
- Analytics: no dedicated analytics product surfaced; engagement claims (40% higher watch time etc.) are marketing stats.

### Integrations (~50 listed at heygen.com/integrations)
- **Direct**: Zapier (8,000+ apps), Make, n8n, Pabbly, viaSocket, **Canva**, **Adobe Express**, HubSpot, Clay, Vimeo, Zoom, Mindstamp, Tolstoy, Trupeer, FlowShare, Hexus, Plainly (After Effects templates), Repurpose.io.
- **Agent platforms (MCP)**: ChatGPT, Claude (built-in tool), Cursor, Grok, Lovable, Manus, Superhuman; Microsoft Copilot, NVIDIA NemoClaw, OpenClaw "coming soon."
- **MCP data-source workflows**: Slack, Notion, GitHub, Figma, Salesforce, Google Drive, Airtable, Asana, Linear, Jira/Confluence, Intercom, Stripe, Snowflake, Vercel, PostHog, Granola, Gamma, Apollo, Customer.io; Discord & Telegram coming soon.
- LMS: no named LMS integration; SCORM export (Business) + embeddable multilingual player cover LMS use.

---

## 2. API surface

**Base URL:** `https://api.heygen.com` · **Auth:** `x-api-key` header (pay-as-you-go billing) *or* OAuth2 bearer (MCP/CLI, billed to subscription credits) · **Idempotency:** `Idempotency-Key` on ~10 POST endpoints · Keys managed at `app.heygen.com/developers/api`. Docs: developers.heygen.com (+ llms.txt, OpenAPI at `/openapi.yaml` and `/openapi/external-api.json`). **v1/v2 endpoints sunset Oct 31, 2026** — v3 is current.

### Endpoint groups (v3 reference, all confirmed in docs index)
| Group | Key endpoints |
|---|---|
| **Videos** | `POST /v3/videos` (discriminated union: `avatar` / `image` / `cinematic_avatar` / `studio`), `GET /v3/videos/{id}`, list, delete |
| **Video Agent** | `POST /v3/video-agents` (create session), `GET /v3/video-agents` (cursor-paginated list, limit 1–100), session get/stop, list session videos, list styles, send message/request revision, get session resource |
| **Batches** | `POST /v3/videos/batches` (up to 100 payloads/call), translation batches, lipsync batches, asset-upload batches + 4 bulk-status endpoints |
| **Avatars** | create avatar ($1/call digital twin or photo), create **avatar consent** (`consent_video` upload, open to all Enterprise Aug 2026), avatar groups CRUD, avatar looks CRUD |
| **Voices** | list/get, **`POST /v3/voices/clone`**, design-a-voice `POST /v3/voices`, delete, generate speech (Starfish TTS) |
| **Video Translation** | create/get/list/update/delete, list supported languages, proofread sessions (SRT up/download, generate-from-proofread) |
| **Lipsync** | create/get/list/update/delete (Speed & Precision modes) |
| **Templates** | `GET /v3/templates`, get, generate-video-from-template |
| **HyperFrames** | `POST /v3/hyperframes/renders`, get/list/delete renders |
| **On Brand** | brand kits CRUD incl. **create-from-website** (`POST /v3/brand-kits` with a public URL); brand glossaries CRUD; `brand_glossary_id` usable on videos, translations, Studio videos |
| **Assets** | upload (direct-upload flow >32 MB), create/complete upload, get, delete |
| **Audio** | `GET /v3/audio/sounds` — search background music & sound effects |
| **Tools** | AI clipping CRUD ($0.15/highlight), filler-word removal create/get ($0.01/sec, auto-refund if no change) |
| **Webhooks** | endpoint CRUD, rotate signing secret, list event types, list events (events incl. `avatar_video.success`) |
| **Account** | `GET /v3/users/me` (incl. wallet balance, `included_credits`/`remaining_credits`) |
| **LiveAvatar** (separate host) | `POST https://api.liveavatar.com/v2/embeddings`; session APIs documented at docs.liveavatar.com |

### Limits
- **Concurrency:** 10 max concurrent video jobs (renders + Video Agent sessions + translations) on Pay-As-You-Go; `429` + `Retry-After` on throttle (no published req/min).
- **Inputs:** video ≤100 MB/<2K; image ≤50 MB/<2K; audio ≤50 MB (≤10 min for avatar audio); script ≤5,000 chars; Video Agent prompt ≤10,000 chars + 20 attachments.
- **Outputs:** 25 fps avatar video; 128–4096 px/side (default 1080p); ≤50 scenes; ≤30 min duration.
- **Plan access:** API is **billed independently** — prepaid USD wallet, pay-as-you-go "from $5", no subscription required; MCP/OAuth path instead consumes subscription plan credits. Enterprise gates: precision/proofread translation, custom watermarks, some consent flows.

### API pricing (selected, self-serve)
- Avatar V digital twin $0.0667/sec · Avatar IV photo $0.05/sec, twin/studio $0.0667/sec · Avatar III twin $0.0167/sec, photo $0.0433/sec (720p/1080p)
- Video Agent $0.0333/sec · Cinematic $7.00/video · HyperFrames render $0.10–$0.30/min (1080p–4K, 30/60 fps)
- Translation: Speed $0.0333/sec (audio-only or lip-sync), Precision $0.0667/sec · Lipsync same two rates · TTS $0.000667/sec · Avatar creation $1.00/call

### Agent-native tooling (notable!)
- **MCP server** for every endpoint; first-class clients: Claude Code/Desktop, Cursor, Codex CLI, Gemini CLI, Grok, Lovable, Manus, OpenAI, Superhuman.
- **`heygen-cli`** (Go, Apache-2.0) — official terminal client, full v3 coverage, `--wait`, `--request-schema`.
- **`heygen-com/skills`** — agent skills (heygen-video, heygen-avatar, heygen-translate) installable into Claude Code/Codex/Cursor.

---

## 3. Tech signals

### Models (unusually well documented — heygen.com/research)
- **Avatar V architecture**: **Diffusion Transformer (DiT) with flow matching**; conditions on the *full token sequence* of the reference video (no bottleneck embeddings) via **Sparse Reference Attention** (~linear scaling in reference length); joint motion representation as objective + conditioning signal; dedicated **super-resolution refiner** sharing the DiT backbone (sparse temporal attention, multi-stage distillation, few-step denoising); **Audio engine = LLM backbone predicting discrete audio tokens**, voice cloning from ≥10 s, multilingual + emotion control.
- **Training (5 stages)**: T2V pretraining (internet-scale) → audio-to-video pretraining (talking-head corpus w/ audio cross-attention) → "Personality SFT" (same-identity pairs + human-aware auxiliary losses) → distillation (CFG + Distribution Matching Distillation, >10× cheaper inference) → **RLHF (GRPO flow-matching + DPO, KL-regularized)** with rewards for identity/motion/teeth.
- **Benchmarks (vendor-run, 70 cases)**: beats Veo 3.1 on face similarity (0.840 vs 0.714), pairwise win rates 68.9–85.7% vs OmniHuman 1.5, Veo 3.1, Kling O3 Pro, Seedance 2.0; best LSE-C/LSE-D lip-sync scores.
- **Inference infrastructure** (from "Avatar Inference at Scale" research post): 3-stage pipeline (A2V DiT → identity-aware SR DiT → **streaming VAE decode** chunk-by-chunk); rolling-state memory (constant peak GPU regardless of duration); **8-GPU nodes with FSDP**, 5 co-located models, forward prefetching, pinned-CPU offload, NUMA-aware placement; **<5 s TTFF, 27+ fps @720p, <10 ms stage switches, unlimited duration**; delivery via **GStreamer → H.264/AAC → Amazon Kinesis Video Streams (kvssink)** — i.e., AWS-based.
- **TTS: "Starfish"** in-house engine (API changelog); **ElevenLabs** is a subprocessor (likely powers some voices); LiveAvatar BYO-TTS supports ElevenLabs/Fish Audio/Cartesia.
- **Third-party generative models integrated**: **Seedance 2.0** (ByteDance) available inside HeyGen for cinematic hooks/motion-first scenes; HeyGen avatar models also distributed via **fal.ai** and **Runware**.
- **Open research artifact**: **TransVLM** — vision-language framework/benchmark for shot-transition detection (Apache-2.0).

### Open source (github.com/heygen-com, 31 repos)
- **`hyperframes`** ⭐ ~42.3k — "Write HTML. Render video. Built for agents." HTML/CSS/JS→video rendering framework (Apache-2.0); powers Video Agent scenes since Jul 2026; cloud render API; Vercel & Modal templates. *(Direct conceptual competitor to Remotion.)*
- **`heygen-cli`** (Go), **`liveavatar-web-sdk`** (TS), **`liveavatar-starter-livekit-agent-python`**, **`liveavatar-sales-agent`** (MIT), **`skills`** (agent skills for Claude Code/Codex/Cursor), launch-video compositions, TransVLM; forks of **ray** (AI compute) and SwiftTweaks.
- Subprocessor list (trust page) confirms infra stack: **AWS, Microsoft Azure**, Cloudflare, Datadog, Intercom, ElevenLabs.

---

## 4. Compliance & trust

- **Certifications/claims**: **SOC 2 Type II, GDPR, CCPA, EU AI Act, EU-US Data Privacy Framework**; AES-256 at rest, TLS 1.2+ in transit, MFA, daily backups, annual pen tests.
- **Consent verification**: identity verification required to create custom avatars; API-level consent flow (`create-avatar-consent`, `consent_video` upload — Level 2 consent video now available to all Enterprise without whitelisting); users must hold explicit consent of any depicted person; depicted-person removal requests honored.
- **Content moderation**: two-layer — ML scanning at upload/generation + human review of flagged content; enforcement up to account termination and reporting to authorities; appeal path. Prohibited: violent/hateful/deceptive/sexual/infringing/**political campaigning**/minor-harm content, scams, misinformation.
- **Watermarking**: custom watermark controls in API (scale/opacity/placement) as an **Enterprise premium** option; free-plan exports are watermarked. **No C2PA / content-credentials provenance standard is mentioned anywhere** — a notable gap vs. some competitors.
- **Data training policy**: Enterprise data never used for training; non-enterprise data may be used **with opt-out**; subprocessors contractually barred from training on customer data.

---

## 5. Notable launches (2025 → Aug 2026)

| When | Launch |
|---|---|
| May 2026 | **Avatar V** — flagship digital-twin model (15-sec input, look/appearance separation, 177+ languages); research report published; pricing parity with Avatar IV |
| 2026 | **Video Agent** — prompt→finished-video agentic pipeline (API + consumer); blueprint previews, conversational revisions; HyperFrames-powered scenes (Jul 2026) |
| 2026 | **LiveAvatar** — interactive/streaming avatar spun out to liveavatar.com with its own docs, embed API, web SDK (FULL/LITE/Sandbox modes) |
| Apr 2026 | **v3 API launch** (Video Agent, Videos, Voices, Translations, Lipsync, Avatars, Assets, Webhooks); v1/v2 sunset announced for Oct 31, 2026; **Voice Cloning API**, burned-in captions, custom watermarks |
| May 2026 | **HyperFrames** open-sourced + **HyperFrames Render API**; new aspect ratios; brand glossaries in translation |
| Jun 2026 | **Cinematic Avatar** ($7/video); motion-prompt hand gestures; sound-effects API; Avatar III engine API support |
| Jul 2026 | **HeyGen Studio API** (`type:"studio"` scene composition, up to 4K, 50 scenes); **Studio Template API**; **Batch APIs** (videos, translations, lipsyncs, assets — 100 payloads/call) |
| Aug 2026 | Brand kits from website URL; brand-glossaries on avatar/image videos; consent-video upload for all Enterprise; captions always on for translations/lipsyncs |
| Ongoing | **MCP server** + agent skills + CLI (agent-native distribution push); Seedance 2.0 model integration; distribution via fal.ai and Runware; Zoom interactive-avatar app; Harvard Business School bootcamp-feedback deployment (Aug 2026 news) |

---

## Sources
- https://www.heygen.com/ (product inventory, scale claims)
- https://www.heygen.com/photo-avatar · /video-translate · /agent · /avatars/avatar-v (feature pages)
- https://www.heygen.com/tool/ai-voice-generator (voice catalog, cloning, security claims)
- https://www.heygen.com/pricing (plans/credits)
- https://www.heygen.com/integrations · /integrations/zapier (integration catalog)
- https://www.heygen.com/trust-and-safety (compliance, moderation, subprocessors)
- https://www.heygen.com/research/avatar-v-model · /research/avatar-inference-at-scale (model + infra)
- https://www.heygen.com/blog/announcing-avatar-v (Avatar V launch, May 4 2026)
- https://developers.heygen.com/ · /llms.txt · /reference · /reference/create-video · /avatar-iv · /changelog · /docs/pricing · /docs/usage-limits (API)
- https://docs.liveavatar.com/ (LiveAvatar modes, embed endpoint, SDKs)
- https://help.heygen.com/ (help-center collections)
- https://github.com/heygen-com (open-source repos)
- https://play.google.com/store/apps/details?id=com.heygen.app (Android app)
- https://elevenlabs.io/docs/eleven-agents/guides/integrations/live-avatar (ElevenLabs↔LiveAvatar integration)
- https://www.bing.com/news/search?q=HeyGen (news: funding history, HBS usage, heygen-com/skills)
- https://www.linkedin.com/posts/heygen_heygen-is-now-live-on-fal-activity-7434298000618770432-Q8vk (fal.ai distribution)
- https://runware.ai/creators/heygen (Runware distribution)
