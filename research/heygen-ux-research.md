# HeyGen — End-to-End User Flow & Product UX Map

*Researched 2026-08-24. Sources: HeyGen homepage, pricing page, help center (help.heygen.com), developer docs (developers.heygen.com), third-party reviews. Note: HeyGen is mid-rebrand of several product names (Digital Twin = "video avatar"; LiveAvatar is being split into its own platform at liveavatar.com); the docs themselves contain some inconsistent numbers, flagged where found.*

---

## 1. Onboarding flow & free tier

### Signup
- Auth lives at `auth.heygen.com`. Every hero CTA is **"Start for free"**; no credit card required. Google/social login implied (not documented in detail).
- Post-signup, the user lands on a **Home** dashboard with a left sidebar. The dominant entry points on Home:
  - **"Create" → "Create a Video"** button
  - A **"Photo to Video"** tag directly on the Home page (fastest path: one photo + script → video)
  - **Video Agent** (prompt-native creation) from the Home page
  - **Avatars** tab, **Tools** tab (left sidebar, "All Apps"), **Templates** (via Brand tab), **Projects** tab
- First-run flow per the official "Create your first video" guide: the editor opens with a **default avatar ("Annie") already on the canvas** and one auto-created scene — the user just types a script. There is no forced tutorial documented; the help center's "Popular Articles" ("Create your first video in our Studio!", "AI Studio overview") serve as the tour.
- Drafts **auto-save** into a "draft" section.

### Free tier (exact limits, from pricing page + billing docs)
- **$0, no credit card. 3 videos/month** (billing article says "1–3 free videos, varies by region"), **max 1 minute per video**, standard processing priority, **concurrency 1**.
- Export **up to 1080p** (pricing page; the credits article says "720p sharing link" — inconsistent), **watermark ON** (removal starts at Creator).
- **500+ stock avatars**, **1 Custom Digital Twin** slot (up to 500 looks), **up to 3 photo avatars**, **1,000+ AI voices**, **1 voice clone**, **30+ languages**, **75+ templates**, **1 seat**.
- **Limited trial access to premium features**: Avatar IV, Video Agent (3 Video Agent videos/month), and lip-sync translation.
- **Free plan gets no credits** — it uses a fixed video quota. Paid plans are credit-based.

### Plan ladder (self-serve, from /pricing)
| Plan | Price | Credits/mo | Max video len | Export | Notable |
|---|---|---|---|---|---|
| Free | $0 | none (quota) | 1 min | 1080p, watermarked | 3 videos/mo, 1 Digital Twin, 3 photo avatars |
| Creator | $29/mo ($24/mo annual) | 600 | 30 min | 1080p, no watermark | 175+ languages, unlimited photo avatars, 1 seat |
| Pro | from $49/mo (to $4,300/mo) | 1,000–100,000 | 30 min | 4K | translation proofread, all advanced AI models, 1 seat |
| Business | $149/mo + $20/seat | 1,500 shared pool | 60 min | 4K | workspaces, brand kit, SCORM, interactivity, Zapier/HubSpot/n8n/Make, 6 concurrency |
| Enterprise | custom | custom | unlimited | 4K | SSO/SAML, SCIM, proofreader seats, multi-workspace, audit log |

- **Credits**: monthly plans roll over 1 extra billing cycle; annual plans accumulate until renewal; credits die on cancellation. Business top-ups $0.05/credit (min 100 = $5). Creator can't top up (must upgrade). **No free API credits since Feb 2026.**
- **Credit burn rates**: Avatar III ≈ **3 cr/min**; Avatar IV/V ≈ **20 cr/min** (IV photo look 16 cr/min, video look 31 cr/min); translation 4 cr/min audio-only, 6 cr/min with lip sync ("Speed"), 10 cr/min "Precision"; Video Agent ~20–40 cr/min standard, 90–120 cr/min with Seedance visuals (docs contradict themselves — 20 vs 30–40).
- **Dynamic limits**: videos/day, queue, and fair-use caps are *dynamic* (shift with GPU costs/model efficiency) and intentionally not published as fixed numbers; avatar slots are fixed. ~95% of users never hit dynamic caps.
- **Render SLA reality**: ~**10 min render per 1 min of Avatar video** (often faster); translation w/ proofread ≈ 5 min/min. Queue can approach 24h on busy weekdays (Monday mornings EST are peak). Concurrency: Free 1 / Creator+Pro 3 / Business 6 / Enterprise 20 / API 10.

---

## 2. Avatar Video creation flow (the core loop)

### Entry → editor
1. Left sidebar **Create → Create a Video**.
2. Choose **orientation: Landscape (16:9) or Portrait (9:16)** — this is set up front; the output follows it.
3. Choose a starting method: **from scratch, Photo to Video, Template, PPT/PDF upload, or Video Agent**.
4. → lands in **AI Studio** ("Create in AI Studio").

### Editor paradigm: scene-based, NOT timeline-based
- The video is a sequence of **scenes (slide-like sections)**. Scene 1 is auto-created; each scene carries **its own script segment** (max ~1,000 chars per segment — longer text auto-splits into more scenes; recommended <2,000 chars per section).
- Explicitly described as **"script-focused," not timeline-based**: there IS a timeline strip of scene thumbnails (used to duplicate scenes via ⋯ menu, spot interactive scenes via blue icons, and preview audio), but **element timing is set by dragging two markers inside the script text** (when an element appears/disappears relative to spoken words), not on a track-based timeline.
- Layout: **canvas center; right-side panel** hosts all feature menus; script editor tied to scenes (left/below depending on context); Brand System picker top-center.

### Right-side menu (exact names) and what each does
| Panel | Contents |
|---|---|
| **Avatar** | Public collection (500–700+ stock; styles: professional, lifestyle, "UGC-style", AI-generated, community) or your own avatars/looks |
| **Script / Voice** | Type script in any language; voice options: **accent, tone, model, speed**; voice engine picker (**Auto, ElevenLabs V2/V3, Panda, Starfish, Fish**); **Play ▶︎** previews audio per scene; **"Apply to all scenes"**; advanced sliders (similarity/stability/style) for 11Labs/Fish engines |
| **AI** | Built-in tools: **Script Writer, Motion Designer, Image Generator, Video Generator** |
| **Media** | Background images/videos + uploads (JPG/PNG ≤200MB ≤4167²px; MP4/MOV ≤200MB; MP3/WAV ≤100MB). Video clip modes: **Loop / Fill the Scene / Freeze at the End**; "Set as Background" button; uploaded video audio muted by default. No asset folders. |
| **Text** | Titles/subtitles/headlines — size, font, color, position |
| **Music** | Music Library organized by mood (Happy, Instrumental, Playful, Calm, Dramatic, Inspiring) + My Music + Upload; trim, volume, fade in/out |
| **Stylized Captions** | Word-synced burned-in captions, style/color/font/size/position; text editable. ⚠️ **Closed captions (CC) are NOT available for avatar videos** — only burned-in stylized captions (CC toggleable by viewers exists only for translation projects, enabled from the Share page) |
| **Templates** | In-editor template browser |
| **Layers** | Z-order of elements |
| **Interactivity** (Business/Ent) | Branching, action buttons, quizzes (see §7) |
| **Brand System** (top center) | Apply saved logo/colors/fonts/images/videos |

### Script & voice details
- **Pause button** inserts pauses adjustable in **0.5s steps** (+/–).
- **Upload Audio / Record Audio** per scene (import pre-recorded file or built-in recorder) — then either use as-is or enable **Voice Mirroring** (avatar's voice mimics YOUR delivery/tone from the recording; script auto-transcribed for review; "Convert to Voice Mirroring" turns an existing text scene into a teleprompter-style recorder).
- **Voice Director** (megaphone 📢 icon, left toolbar): line-by-line emotion direction, presets — Excited, Casual, Calm, Cool, Serious, Funny, Angry, Sarcastic — each an editable natural-language instruction; requires **Panda voice engine**.
- **Script file import/export** (top-left menu): .txt (one scene per line), Excel/CSV (one scene per cell), .docx (not .doc); download preserves pause markers; processed locally in-browser; appends as new scenes.
- In-script **Translate** button (Voice Settings) converts the script to another language.
- Third-party voices: **ElevenLabs, LMNT, Play, Character AI** can be connected; default clone model = ElevenLabs Multilingual v2. Voice clone creation: Voice section → **+ New Voice → Create New Voice** → "Instant Voice Cloning" or "Generate a New Voice". There's an **"Improve Your Voice"** chat-based fixer + Voice Remix ("Improve Audio Quality" preset).

### Preview & submit
- ⚠️ **No rendered avatar preview during editing** — only **audio preview** (Play on scene/timeline). Avatar animation/lip-sync only materializes after submission and costs credits. This is the single most notable UX constraint for a design doc: preview = audio + static canvas.
- **Submit flow**: click **Generate** → Submit Video menu: **title, destination folder, frame rate (FPS), output resolution (720p/1080p/4K per plan), format, watermark toggle** (paid only; sticky across future videos) → **Submit**. A warning popup appears if e.g. no avatar exists; submission still allowed.
- Post-submit: project enters queue (Pending → processing), email notification on completion, output lands in **Projects** tab; failed/cancelled jobs cost nothing.

### Faster/side doors into video creation (all reachable from Home/Tools)
- **Photo to Video** (single-scene tool): photo + script/audio → Generate; Avatar IV engine; motion via "Motion Engine" picker incl. third-party engines (Kling, Runway, Hailuo, Seedance — flat 10 cr/video) and custom motion prompts.
- **Quick Avatar Video**, **AI Video Generator**, **PPT/PDF→Video**, **Audio→Video**, **Video Podcast**, **AI Clipping**, **Batch Mode**, **Automated Video Series**, **Face Swap**, **Product Placement**, **Screen Recorder** (in Studio).
- **Video Agent** (see below) is increasingly the *default* creation path.

### Video Agent (prompt-native creation)
- Open from Home → pick avatar (default voice auto-attached) → optional **Brand System** → choose **Chat Mode** (collaborate on a plan) or **Autopilot Mode** (researches + builds + generates) → set **duration + orientation** → optional **Seedance toggle** (AI cinematic visuals vs stock/B-roll) → prompt with script + style/pacing/tone/scene/motion instructions + attachments → **Generate Video Plan (free, infinitely refinable)** → type **"Proceed"** to render (≈20–120 cr/min depending on mode). Post-generation: keep chatting for edits, or **"Edit a Copy in AI Studio"** for manual control (recommended for final polish).

---

## 3. Avatar creation options (tiers & consent)

HeyGen's avatar quality ladder (names as of Aug 2026):

### a) Stock/public avatars
500–700+ ready avatars (professional/lifestyle/UGC/AI-generated/community). Note: the "Public Avatars" (community-contributed real-person avatars) program is being wound down ("Public Avatars Going Offline").

### b) Photo Avatar (instant, from a still image)
- Entry: **Avatars tab → "New Avatar" → Upload photos** OR **"Design with AI"** (text-prompt-generated character).
- Input guidance: human-like face proportions, visible eyes/lips, large in frame; works for cartoons/animals if face reads human.
- Looks: generate variations via reference photos, prompts, or library "inspiration" photos. In Studio, motion via **Motion Engine** setting + **Advance Settings** prompt-based motion.
- Limits: **Free = 3 photo avatars; paid = unlimited.** Costs only premium credits for AI-*generated* looks; engine cost applies at render (III 3 cr/min, IV 20 cr/min).
- **Avatar IV** is the flagship engine for this path: single image → expressive head/face performance (audio-to-expression diffusion model; head tilts, micro-expressions). Photo look 16 cr/min, video look 31 cr/min, custom-motion photo-to-video ≈ 2:1 credit ratio. Billed only on actual avatar seconds in Studio.

### c) Digital Twin / Video Avatar (custom, from footage) — now powered by Avatar IV/V
- Entry: **Avatars → "Create New Avatar" → Digital Twin** → record (webcam/phone/pro camera; optional 2nd side-angle cam) or upload.
- Footage requirements: **min 2 min (≤5 min recommended), ≥1080p30 (4K60 preferred), 16:9 or 9:16, one continuous take, clean static background, speech audio mandatory** (needed for lip sync). Processing ≈ **10–20 min** (non-4K).
- **Slots**: Free = 1 slot; Business = 5; Enterprise = 10+; extra slot add-on $29/mo or $288/yr. **Up to 500 Looks per slot** (photo + video looks combined); looks = background/wardrobe/angle/stance variants, created via upload or "Design with AI" prompts. Rebuild allowance: **1 redo per billing month per slot**; deleting a slot deletes all its looks; after two deletions you can't create a third identity avatar.
- **Avatar V** (newest): persistent identity from a **15-second** expressive self-video ("Clone a Real Person" in Avatars); motion trained on your footage, appearance swappable via photo looks; **max 3-min videos**; auto-selected as motion engine in Studio; optional separate voice clone recommended.
- **Walking/motion avatars** exist as an advanced Digital Twin variant; green-screen/**WebM transparent avatars** exportable for Adobe Premiere workflows; background removal available on any avatar.

### d) Voice cloning
- Separate step from the avatar (can clone from avatar footage audio or a separate audio file). Free = **1 voice clone; paid = unlimited.** "Instant Voice Cloning" or AI "Generate a New Voice"; manageable via avatar's three-dot menu → **Set Primary Voice → Manage Voices**.

### Consent flow (mandatory for any real-person video avatar)
- Required **at the same time as** avatar-footage submission; read an **on-page consent script exactly as written** (incl. a spoken code, "loud and clear").
- Three recording paths: **upload file/Google Drive link, laptop webcam, or smartphone via QR code** (QR enables remote consent — the person being avatar-ified records it themselves from anywhere).
- Specs: **<30s, MP4/MOV/WebM, 480p–4K, ≤10GB**, clear light/sound; same person must appear in consent + footage; no screen-recorded statements.
- Failure → avatar rejected with reason shown on the avatar card (error codes documented). This is a hard safety gate — photo avatars of *yourself* don't need it, but all footage-based twins do.

### e) LiveAvatar (interactive/streaming) — see §5.

---

## 4. Video translation flow

1. **Entry**: Translation tool → import via **local file (drag-drop), existing HeyGen project, or URL (YouTube/Google Drive direct links)**. Formats **MP4/MOV/WebM, ≤5GB, 2s–10h** (plan caps: Creator/Pro 30 min, Business 60 min, Enterprise unlimited).
2. **Source language**: **Auto Detect** or manual; source must be single-language or the job fails (unsupported sources "fail instantly, no credits").
3. **Target languages**: up to **10 per job**. Per language choose **Base** (preserves original voice/accent) vs **Localized** (native target accent). **Speaker's voice is always cloned** for similarity regardless.
4. **Engine choice** (= lip-sync tier):
   - **Audio Only** — 4 cr/min, no lip sync
   - **Speed** — 6 cr/min, lip sync for front-facing video
   - **Precision** — 10 cr/min, handles side profiles/occlusions, highest quality
5. **Proofread ("Review & Edit")** step — word-by-word script editing pre-generation; **Pro/Business/Enterprise only** (Enterprise adds dedicated *proofreader seats*). Proofread mode supports **SRT upload** (output spoken exactly as the SRT).
6. Advanced settings: **Dynamic Duration** (±20% stretch, on by default), **Remove Background Sound**, **Enhance Voice**, **Output to Original Video Specs** (Pro+), **Enable Captions** (renders two versions: burned-in + clean; exports SRT), **Brand Glossary** (terminology consistency), **Create a Collection**.
7. **Translate** → email on completion (~5 min processing per 1 min of content w/ proofread). Multi-language jobs auto-create a **subfolder/Collection**; outputs shareable via link (password optional), audio-only download is Enterprise-only, **SCORM/xAPI export** Business/Enterprise.
8. **Language coverage**: **85 languages / ~160 regional variants** documented for translation (marketing says "175+ languages and dialects" for voices generally; voice/TTS list ≈ 77 languages / ~146 locales). Spanish (23 locales), Arabic (18), English (14), Chinese (9).
9. Free tier: translation export 720p; Creator 1080p; Pro+ 4K (if source matches).

---

## 5. Interactive / streaming avatar (LiveAvatar)

- **LiveAvatar is now a separate platform** (`app.liveavatar.com`, docs.liveavatar.com, API separate from HeyGen API plans) — HeyGen credentials work for login. Formerly "Interactive/Streaming Avatar."
- **Dashboard**: My Avatars / Public Avatars / Examples tabs. Pick a public avatar or build custom (also from photo).
- **Custom LiveAvatar footage**: continuous unedited video, **min 2 min in 3 parts — Listening (15s silent, expressive), Talking (90s), Idling (15s silent, neutral)**; 1080p, chest-up, ≥5 ft from static/green backdrop, soft two-light setup; **~24h processing**; one free remake if unsatisfied. Non-human/3D characters: generate 2+ min in HeyGen Studio + consent + manual approval via custom-avatar@heygen.com.
- **Brain setup**: avatar is LLM-powered via a prompt called **"Context"** (formerly knowledge base) — instructions, tone, grounding info; **"Chat Now"** to test. Custom avatars: rename + change voices.
- **Modes**: **Full Mode** — HeyGen runs STT→LLM→TTS→turn-taking→memory, **2 credits/min**. **Lite Mode** — bring your own LLM + voice (voice IDs from ElevenLabs/OpenAI/Azure/Google), **1 credit/min**.
- **Embed/distribution**: Share button, hosted link, or **HTML embed** (watermark not removable on platform embeds); API token or **Streaming SDK** for custom sites (watermark removable on paid API); "requires some programming." Old trial-token mechanism removed. **25+ API endpoints** (sessions, avatars, voices, contexts, LLM configs, secrets); **Sandbox Mode** for testing; SSO setup guides for Okta/Entra.
- **Plans**: Free (2-min sessions, concurrency 1, ~5–10 min total) · **Starter $19/mo** (150 cr, 5-min sessions, concurrency 5, ~$0.13–0.25/min effective) · **Essential $99/mo** (1,000 cr, 20-min sessions, 20 concurrent) · **Business $475/mo** (5,000 cr, 60-min sessions, 40 concurrent, 1 custom 1080p avatar) · **Enterprise from ~$48,800 min budget** (concurrency cap liftable).
- Separate from LiveAvatar: **in-video Interactivity** (clickable buttons/branching/quizzes — an L&D feature, Business/Enterprise, see §7).

---

## 6. Templates

- **75+ templates on all plans including Free.** Two homes: **Brand tab → Brand Templates** (browse all / filter by use case — explainers, training, announcements, social) and the **Templates panel inside AI Studio**.
- Use flow: pick template → **"Create from template"** → editor opens with avatar, background, script, music pre-filled; swap avatar (HeyGen Library or uploads), edit script manually or via ✨ **AI Tools → Script Writer**, change music (⋯ → Delete audio; 🎵 Music icon), then **Generate → Submit**.
- **Custom templates**: Brand → Brand Templates → **"Create Template"** → build in editor → **"Done editing"** → appears in your Templates section. Also: from any finished video's Share page, **"Create a template from the video"**.
- **Personalized Video templates** (sales/outreach at scale): template with variable placeholders → Google Sheets → **Zapier zaps** → per-row rendered videos → Gmail mail-merge delivery; native **HubSpot** integration variant. This is HeyGen's batch-personalization playbook.
- No public template marketplace documented.

---

## 7. Team / workspace / collaboration

- **Workspaces** with roles (exact names): **Viewer** (view-only; *still consumes a paid seat*), **Creator** (creates avatars/videos/voices), **Developer** (Creator + API access), **Super Admin** (everything + billing/purchases/invites/content removal). No standalone "Admin."
- **Sub-Workspaces**: isolated environments per client/team with own members, permissions, and separable **billing, avatars, API keys, templates** (agency/enterprise pattern).
- **Invites**: same-domain auto-discovery (non-public domains), email invite, or shareable link; role chosen at invite; managed in **Settings → Members and Workspaces**; seats $20/mo each on Business (shared credit pool — extra seats don't add credits).
- **Project/folder sharing** (three-dot menu): **Private** (you + Super Admin), **Specific Collaborators** (asset-level roles: **Editor / Viewer / Proofreader**), **All Collaborators**. Folders: unlimited nesting, drag-drop, bulk move, **Download folder → .zip** at chosen resolution.
- **Real-time co-editing — "Single Editor Mode"** (Teams/Enterprise): auto-activates when ≥2 teammates open the same draft; presence indicators, live scene-navigation following; **only one Editor at a time** (first opener); Viewers watch live, comment, and **"Request Access"** → current Editor approves/declines → roles swap.
- **Commenting**: draft commenting on Business+; viewers can comment in real time in Single Editor Mode. No formal approval-workflow state machine documented — review happens via comments + share-page review.
- **Brand System** (all paid plans, unlimited count): logos, brand colors (HEX), fonts (TTF/OTF ≤100MB), images, videos (≤200MB) — auto-applied in AI Studio (top-center picker) and attachable to **Video Agent** prompts (+ icon in prompt box).
- **Share-page collaboration**: reactions (emoji at any timestamp), comments (**cannot be disabled**), view analytics; translation-from-share creates a draft in target language.
- **Proofreader** role ties into translation review (Enterprise gets dedicated proofreader seats).
- Enterprise controls: **SAML SSO (Okta/Entra), SCIM, Team Member MFA, multi-workspace control, audit log, invoice billing, dedicated CSM**.

---

## 8. Export, sharing & integrations

### Export
- **Where**: Projects tab → ⋯ on video → **Download**; or open video → top-right Download. Options: **full video, captions-only (SRT file), audio-only**. Folder-level bulk download → **.zip**.
- **Resolutions**: **720p / 1080p / 4K** via Advanced Settings at submit; 4K requires Pro+ (and matching source for translation). **No HDR** (HDR uploads converted to SDR).
- **Aspect ratios**: chosen at project creation — **Landscape 16:9 or Portrait 9:16** (photo avatars also offer square 1:1 at design time). No post-render ratio conversion documented; orientation is a creation-time decision.
- **Watermark**: all videos watermarked by default; paid users toggle it off in the Submit menu (sticky setting); Free cannot remove.
- **SCORM/xAPI export**: Business/Enterprise (LMS distribution).
- **Caption export**: **SRT download**; burned-in stylized captions are the only in-video option for avatar videos (no viewer-toggleable CC except on translation share pages).

### Share page (per-video hub)
- **Share** button: link with audience controls (team / anyone-with-link / folder — Enterprise adds **password protection**), **embed** (embed URL), **Twitter/X, LinkedIn, email, GIF thumbnail**. **No direct YouTube/TikTok publishing documented** — download-and-upload is the flow.
- Viewer engagement: emoji reactions at timestamps, comments (always on), CC toggle (translation videos).
- **Built-in analytics ("Insights")**: views, shares, downloads, avg watch time, completion rate, total watch time.
- Also from share page: edit, make-template, move to folder, delete, translate, grab video ID for support.

### Integrations & API
- **Native/third-party**: Zapier, Make, n8n, HubSpot (personalized video), Canva (import designs), Adobe (import/export workflows), Google Sheets+Zapier personalization pipeline, ElevenLabs/LMNT/Play/Character AI voices, LMS via SCORM.
- **API** (developers.heygen.com, base `https://api.heygen.com`, `X-Api-Key` auth, key from **Settings → API** / app.heygen.com/developers/api):
  - Flagship: **Video Agent API** (`POST /v3/video-agents` → poll or `callback_url` webhook → `video_url`). Also **Avatar Video**, **Cinematic Avatar**, **Video Translation** ($2/min, billed on source length), **TTS**, **HyperFrames** (HTML/CSS/JS→motion graphics), **Photo Avatar**, **Templates**, **LiveAvatar** (separate).
  - **Pay-as-you-go only**: standard avatar video **$1/min** (720p/1080p), Avatar IV 1080p **$4/min** ($5/min 4K), Video Agent $2/min. No free API credits (since Feb 2026). Concurrency 10. PAYG credits expire 12 months. v1/v2 APIs sunset Oct 31, 2026.
  - Tooling: **CLI** (`heygen video create`), **MCP server** + llms.txt + typed schemas (agent-native; official `heygen-com/skills` GitHub repo for Claude Code/Cursor), batch APIs (up to 100 requests/call), webhooks.
- **Mobile app** (iOS/Android): creation + sharing on the go, phone-friendly avatar creation; desktop remains the full experience (full voice library, AI Studio advanced features, LiveAvatar, workspace switching). Mobile-only: weekly Creator billing + credit top-ups; Pro in-app capped at 4,000 cr/mo; Business/Enterprise purchase web-only.

---

## Notable UX characteristics (for the design doc)

1. **Script-first, scene-based editor** — slides, not tracks. Element timing binds to script markers, not a timeline. Lowest learning curve in category, but weak for fine A/V control.
2. **No visual render preview** — audio-only preview pre-submit; every look at your avatar costs credits and queue time. Iteration is deliberately funneled through cheap steps (audio preview, static canvas).
3. **Creation-path sprawl, converging on prompts** — Studio, Photo-to-Video, Quick Video, PPT→Video, Podcast, Clipping… with **Video Agent positioned as the front door** (free plan generation, pay only at render).
4. **Hard safety gates**: consent video with spoken code, same-person verification, content moderation queue ("Pending/Rejected"), EU AI Act compliance docs.
5. **Credit economy with dynamic caps** — fixed avatar slots, variable daily/queue limits that "float" with GPU economics; costs surfaced in-product before each generation.
6. **Free tier = genuine but tightly bounded** (3×1-min videos/mo, watermark, 720–1080p) with *taste-of-premium* trials (Avatar IV, Video Agent, lip-sync translation) as the upgrade hook.
7. **Collaboration is Business-tier monetization** — workspaces, roles, brand systems, SCORM, interactivity, SSO ladder cleanly Free→Creator→Pro→Business→Enterprise.

---

## Sources

- https://www.heygen.com/ (homepage, nav, product names, CTAs)
- https://www.heygen.com/he-il/pricing and https://www.heygen.com/he-il/faq (plans, credits, limits, watermark)
- https://help.heygen.com/en/ (help center collections)
- https://help.heygen.com/en/articles/11049655-overview-our-new-ai-studio
- https://help.heygen.com/en/articles/11049837-create-your-first-video-in-our-studio
- https://help.heygen.com/en/articles/11381771-how-to-write-scripts-in-the-ai-studio
- https://help.heygen.com/en/articles/7951425-add-media-in-ai-studio
- https://help.heygen.com/en/articles/8305536-how-to-use-captions
- https://help.heygen.com/en/articles/9834825-how-to-download-or-export-a-video
- https://help.heygen.com/en/articles/11788079-how-to-share-your-videos
- https://help.heygen.com/en/articles/11057301-how-to-remove-the-heygen-watermark
- https://help.heygen.com/en/articles/9655503-heygen-video-processing-times
- https://help.heygen.com/en/articles/10034438-how-to-get-started-with-photo-avatars
- https://help.heygen.com/en/articles/11269603-heygen-avatar-iv-complete-guide
- https://help.heygen.com/en/articles/12089286-create-your-first-digital-twin-video-avatar-with-avatar-iv
- https://help.heygen.com/en/articles/14602974-avatar-v-is-now-available-on-heygen
- https://help.heygen.com/en/articles/12092609-recording-your-consent-video
- https://help.heygen.com/en/articles/9964694-avatar-looks-explained
- https://help.heygen.com/en/articles/9834925-how-to-get-started-with-voices
- https://help.heygen.com/en/articles/11202248-using-voices-in-the-ai-studio
- https://help.heygen.com/en/articles/11408956-how-to-use-voice-mirroring-and-voice-director
- https://help.heygen.com/en/articles/11391932-voice-languages-we-support
- https://help.heygen.com/en/articles/10029081-how-to-get-started-with-video-translation
- https://help.heygen.com/en/articles/11391941-video-translation-languages-we-support
- https://help.heygen.com/en/articles/8830251-how-to-use-brand-glossary (via collection listing)
- https://help.heygen.com/en/articles/10035615-how-to-get-started-with-liveavatar
- https://help.heygen.com/en/articles/9182113-what-is-a-liveavatar (via collection listing)
- https://help.heygen.com/en/articles/13466178-how-to-use-templates-in-heygen-to-streamline-video-creation
- https://help.heygen.com/en/articles/9889198-how-to-create-a-brand-system
- https://help.heygen.com/en/articles/9468098-collaboration-and-access-control-with-workspaces
- https://help.heygen.com/en/articles/13540469-single-editor-mode-collaborate-on-video-projects-in-real-time
- https://help.heygen.com/en/articles/13016632-how-to-organize-your-workspace-folders-collections-more
- https://help.heygen.com/en/articles/13538881-how-to-use-heygen-s-interactivity-for-branching-and-clickable-videos
- https://help.heygen.com/en/articles/12402907-how-to-get-started-with-video-agent
- https://help.heygen.com/en/articles/15125761-heygen-credit-based-pricing-plans-subscriptions-explained
- https://help.heygen.com/en/articles/12095329-how-dynamic-non-dynamic-limits-work-at-heygen
- https://help.heygen.com/en/articles/10207693-how-to-get-started-with-heygen-for-mobile
- https://help.heygen.com/en/articles/10060327-heygen-api-pricing-explained
- https://developers.heygen.com/ and https://developers.heygen.com/docs/quick-start and https://developers.heygen.com/live-avatar
- https://aibrainjet.com/synthesia-vs-heygen/ (third-party review, supplementary)
- https://github.com/heygen-com/skills (agent tooling)
