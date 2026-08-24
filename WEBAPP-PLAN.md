# Shorts Engine Web App — Implementation Plan

> **Goal:** a browser product on top of the existing shorts engine. A dashboard of your videos, a
> "generate" space, and an editor where a user controls the title, adds their own text and images at
> specific times, and — on the paid tier — generates AI images. Free tier = TSX template engine,
> paid tier = AI-pixel engine + AI extras.

This plan is the synthesis of four research workstreams (editor UX, AI-generator monetization,
Remotion production architecture, editor UI engineering) mapped onto what this repo already does.
Each section ends with concrete decisions so it can be executed phase by phase.

---

## 0. What the engine already gives us (the unfair advantage)

The web app is **a UI + orchestration layer over an engine that already works.** Nothing in the
render path needs to be invented — it needs to be *exposed*. Read this before any build.

| Engine capability (today) | Where | Web-app use |
|---|---|---|
| **beats.json contract** — `{id,title,composition,format,vo[] (text+start/end+words),beats[]}` | every `shorts/short-N-*/beats.json` | **This is the project document.** The editor edits this JSON; the composition renders it. |
| **Parametrized composition** — one `.tsx` renders the spec | `remotion/src/shots/short-N/*` | Become **templates**: same component, different `inputProps`. Currently hardcoded — the one real refactor. |
| **Programmatic render** — `bundle()` + `selectComposition` + `renderMedia` with `onProgress` and a pinned headless Chrome | `remotion/scripts/render-all.mjs` | The **render worker**, verbatim, wrapped in a job. |
| **Multi-agent generation pipeline** — story → voice ∥ pixel → build → QA → mix, contract-validated | `.claude/skills/orchestrate/` | The **"generate" job**. A web "Generate" button = enqueue this pipeline server-side. |
| **Word-exact captions** — per-word `{w,start,end}` via `gen_voice.py` | `tools/gen_voice.py`, `vo.gen.ts` | The **caption editor data model** — we're *ahead* of CapCut/VEED here (we have real word times). |
| **Voice engines** — ElevenLabs (paid) / kokoro local ($0) / edge-tts | `tools/gen_voice*.py` | Free tier = kokoro/edge voice; paid = ElevenLabs + clone. Natural cost gate. |
| **AI pixels** — fal.ai image + video models, ~$0.058/s, locked characters | `tools/gen_image*.py`, `gen_clip.py`, `ai-shorts/` | The **paid AI-image / AI-video tier**. Costs are derived + gated already. |
| **SFX + music libraries** with catalogs | `media/library/sfx`, `media/library/music`, `tools/mix_*` | The **audio step** of the editor + a reusable asset library. |
| **Automated QA** — phone-scale frame JPEGs + `audio_gate.py` RMS check | `scripts/qa_frames.mjs`, `tools/audio_gate.py` | **Auto-QA before "ready"** — show the user a thumbnail strip, gate silent renders. |
| **Contract validators** | `tools/contracts.py` | Validate every job payload server-side before spending money. |

**The single biggest refactor:** today's compositions are hardcoded TSX reading a per-shot
`vo.gen.ts`, with **no `defaultProps`/`inputProps`**. To serve many users, compositions must become
**spec-driven renderers**: one component per *template*, fed a JSON spec via `inputProps`. That is
the load-bearing change; everything else is wiring.

---

## 1. Product shape (decided from research)

### The core loop
```
Dashboard → "New video" → Generate (topic/script → draft scenes) → Editor (title, text, images,
captions, timing, audio) → Preview (live, instant, free) → Render (queued, paid metered) →
Dashboard (ready, download / publish)
```

### Editing model — **scene-stack primary, hidden mini-timeline as escape hatch**
This is the most important UI decision, and the research is unambiguous:

- **Every non-pro tool uses scenes, not a free timeline.** Canva = pages/scenes with per-page
  duration. Descript/Fliki/Pictory/Lumen5 = scene lists. The pro tools (CapCut/Clipchamp/VEED) are
  timeline-first but keep it shallow.
- **Kapwing's lesson:** they shipped a Scenes tab *alongside* a timeline, it caused bugs and
  confusion, and they removed it. **Don't ship two competing paradigms.**
- **Our `beats.json` already *is* a scene list** (`beats[]` with `start/end/visual`). The scene
  model maps 1:1 onto the existing contract.

**Decision:**
- **Primary surface = a vertical scene stack.** Each scene: thumbnail, duration, its overlays. Add /
  duplicate / reorder / delete via drag. Default scene duration ~3–4s (our shorts are ~36s / ~10
  beats, so shorter than Canva's 5s default).
- **Per-overlay timing = a Fliki-style range slider** (in/out handles spanning `0 → scene.durationSec`),
  revealed by a "Timing" toggle on the selected overlay. Times stored **scene-relative** so scenes
  stay reorderable.
- **Escape hatch = one collapsed mini-timeline** (InVideo-style) showing overlays as bars on a
  single lane — power users only, off by default. This is the *only* timeline, and it lives *inside*
  the scene model, not beside it.

### What "free vs paid" means here (from monetization research + our costs)
The category consensus: **Free = watermark + 720p + small monthly quota + non-commercial. Cheapest
paid (~$12–29/mo) = no watermark + 1080p + bigger quota.** AI features gate on a ladder.

Our two engines map onto this cleanly:

| | **Free tier** | **Paid tier** |
|---|---|---|
| Engine | **TSX template animation** (cheap compute) | + **AI-pixel engine** (fal.ai video ~$0.058/s, real COGS) |
| Voice | kokoro / edge-tts (free, local) | ElevenLabs premium + voice clone |
| Visuals | template kits + user's uploads | + **AI image generation** per scene, AI video clips |
| Export | 720p, watermark, N renders/mo | 1080p, no watermark, bigger quota, priority queue |
| Stock/SFX | core library | full library |
| Extras | — | background removal, brand kit, per-scene AI regen |

**Differentiators to lean into (the gaps competitors leave open):**
1. **Transparent, flat pricing** — "N videos/month, period." Credit rage is the #1 complaint across
   InVideo/Revid/Veed/Crayo/Opus/Runway/Kling ("735 credits for one 30s video," "charged on failed
   generations," "no rollover"). We quote a cost **upfront** and **never charge for failed renders.**
2. **Distinctive visuals, not shared stock** — Crayo/Fliki users complain everyone's videos look
   identical (same Storyblocks B-roll). Our TSX motion + AI collage pipelines give a unique look.
3. **Script fidelity + word-exact captions** — InVideo/Revid get "didn't follow my script." We render
   the *actual* script with word-level highlight (we already have the word times).
4. **Real control** — Crayo/Fliki/Revid/Pictory users are stuck in scene lists with no timing control.
   We give beat-level timing + a mini-timeline.
5. **Keep-your-projects + one-click cancel** — Opus/Crayo delete projects on cancel. Trust is a wedge.

---

## 2. Information architecture & screens

Three top-level areas (plus auth/billing). App shell: left nav rail, top bar.

### 2.1 Dashboard ("My videos")
- Grid of video cards: **poster thumbnail (frame 0 — our engine guarantees a composed frame 0)**,
  title, duration, status pill (`draft` / `rendering 34%` / `ready` / `failed`), engine badge
  (TSX / AI), modified time.
- Card actions: open editor, duplicate, download (when ready), delete.
- Top: **"New video"** CTA + a quota/credit meter (e.g. "7 / 20 renders left this month").
- Filter/sort: by status, engine, date. (Plain CSS grid is enough; add TanStack Table only if it grows.)

### 2.2 Generate ("New video")
A short wizard, **not** a blank canvas — the AI-generator pattern:

1. **Input** — topic / prompt / paste-a-script / (later) blog-URL. Template picker (the visual kit:
   chess, math, terminal, form-card, collage… each is one parametrized composition).
2. **Script review** — the AI writes the script + beat sheet; **user edits the script text and locks
   it** (script fidelity is a differentiator; show the exact words that will be spoken).
3. **Style & voice** — voice picker (free voices vs ElevenLabs premium/clone, locked by tier),
   caption style preset, color theme (brand tokens), aspect (9:16 default).
4. **Generate** → enqueues the pipeline → lands in the editor as a draft, with a live
   progress view (story → voice → pixels → build → QA → mix), driven by each stage's contract file.

Free users generate TSX-template videos; paid users can additionally pick AI-image/AI-video scenes.

### 2.3 Editor (the heart)
Four zones (the Canva/Clipchamp/Descript consensus), tuned for vertical:

```
┌──────────────────────────────────────────────────────────────┐
│ top bar:  ← title(editable) · credits · Preview/Render · ⋯     │
├──────────┬──────────────────────────────────┬────────────────┤
│ left     │         canvas (Player)          │ right          │
│ panel    │      1080×1920 live preview      │ inspector      │
│ (scenes/ │      + DOM handles on overlays   │ (selected      │
│ media/   │                                  │  overlay:      │
│ captions/│                                  │  style/timing/ │
│ audio)   │                                  │  animation)    │
├──────────┴──────────────────────────────────┴────────────────┤
│ bottom strip: scene thumbnails + playhead  (+ collapsible      │
│               mini-timeline for overlays, off by default)      │
└──────────────────────────────────────────────────────────────┘
```

- **Canvas (center):** the Remotion `<Player>` rendering the spec live. Overlays get DOM handles
  (move/resize/rotate) layered on top via coordinate mapping. Frame 0 = the thumbnail.
- **Left panel** (tabbed): **Scenes** (the stack, drag-reorder), **Media** (user uploads + library +
  AI-generate button on paid), **Captions**, **Audio** (SFX/music from the catalog, ducking),
  **Text** (preset title/body/caption styles).
- **Right inspector:** contextual. Selected overlay → Style (font/size/color/position/opacity),
  Timing (in/out range slider), Animation (entrance/emphasis preset from brand motion).
- **Bottom strip:** scene thumbnails with durations + a playhead; expandable mini-timeline.

### 2.4 Overlays — the feature the user explicitly asked for
"Control the title and add text of his own and images of his own, maybe at a specific time."

- **Title** is a first-class field (editable in the top bar and as the hook-scene overlay).
- **Text overlay:** add from the Text tab → appears on the selected scene → drag to position,
  corner-drag to resize, set content + style in the inspector. **Timing tab** sets when it appears/
  disappears (range slider over the scene; or drag handles on the mini-timeline).
- **Image overlay:** upload (drag-drop or media panel) → same position/size/timing controls.
  **Paid:** "Generate image" writes an AI image for that scene/slot (fal.ai), or remove background.
- **Replace vs Add:** replacing an image keeps its geometry + animation + timing (mutate `src` only,
  keep `id` so undo stays valid). Adding inserts at a default centered slot.
- All overlays are entries in the spec's `scenes[i].overlays[]` with `start`/`end` **scene-relative**.

### 2.5 Captions (a strength — lean in)
We already have word-level times; CapCut/VEED charge for worse.
- Left **Captions** tab lists lines (text, start/end). Inline edit (fix typos without touching audio).
- **Enter to split** a line at the cursor word; hover to **merge**; ±0.1s **nudge** buttons.
- **Word-highlight style presets** (pop / fade / glow / karaoke pill) — active-word vs future-word
  styles, "apply to all." This is the #1 short-form creator ask.
- **Burn-in toggle** at export + **SRT export**.
- RTL (Hebrew) handled by the engine's existing caption contract (`direction:rtl`, `unicodeBidi:isolate`,
  `stripNikkud`, `anchorRtl`). **For RTL, render full caption lines, not token-animated word pops** —
  tokenization breaks bidi word order. (Flagged in both engine code and Remotion research.)

### 2.6 Render / export
- **Preview is instant and free** (the Player renders in-browser — zero server cost).
- **"Render"** opens a dialog: resolution (720p free / 1080p paid), shows the **credit cost upfront**
  (derived from the spec: TSX flat, + AI images, + AI video seconds, + voice), then enqueues.
- Progress via polling `GET /api/jobs/:id` (~2s) → a dashboard progress bar; on `done`, the card
  flips to ready with a playable/downloadable mp4. **Failed render → credits auto-refunded.**
- Download (mp4, `Content-Disposition`), copy link, and (later) direct publish to TikTok/YT/Reels.

---

## 3. The spec — one JSON to rule preview & render

The single source of truth is a **project document** (a superset of today's `beats.json`). The Player
in the browser and `renderMedia` on the server both consume **the same JSON via `inputProps`** —
this is Remotion's core trick and our guarantee that *what you see is what you get*.

```jsonc
{
  "id": "proj-abc",
  "title": "Formy — digital forms",
  "template": "form-card",            // which parametrized composition
  "format": { "width": 1080, "height": 1920, "fps": 30 },
  "theme": { "accent": "#6366F1", "font": "Space Grotesk" },   // brand tokens
  "voice": { "engine": "kokoro|edge|elevenlabs", "voiceId": "...", "lines": [
      { "text": "…", "start": 0.5, "end": 3.2, "words": [{ "w": "…", "start": 0.59, "end": 0.97 }] }
  ]},
  "scenes": [                          // == beats[] today
    { "id": "hook", "durationSec": 3.0, "visual": "…",
      "overlays": [
        { "id": "ov1", "type": "text",  "content": "…", "x": 540, "y": 700, "w": 800, "h": 200,
          "rotation": 0, "opacity": 1, "start": 0.2, "end": 2.8, "style": { "font": "…", "size": 96, "color": "#1a1a2e" }, "animation": "rise" },
        { "id": "ov2", "type": "image", "src": "https://r2/.../logo.png", "x": 540, "y": 300, "w": 400, "h": 400, "start": 0.0, "end": 3.0, "animation": "fade" }
      ] }
  ],
  "captions": { "preset": "pop", "burnIn": true, "activeStyle": { "color": "#6366F1" } },
  "audio": { "sfx": [{ "id": "whoosh-soft", "at": 3.0, "gainDb": -3 }], "music": { "id": "bed-1", "duck": true } },
  "meta": { "revision": 42, "updatedAt": "…" }
}
```

- **Preview:** the app resolves this into `inputProps` and feeds the Player.
- **Render:** the worker passes the *identical* object to `selectComposition`/`renderMedia`.
- **`calculateMetadata`** (on the server) computes `durationInFrames` from the last scene end and
  can pre-fetch/validate assets — runs once per render, not per browser tab.
- **Constraint:** props must be JSON-serializable → pass **URLs and IDs, never binary blobs.** User
  images/videos are object-storage URLs; referenced in Remotion via `<Img src={url}>` /
  `<OffthreadVideo src={url}>`.

---

## 4. Architecture

### MVP (one builder, cheapest thing that scales)
```
Browser (Next.js, App Router)
 ├─ <Player component={Template} inputProps={spec}>   ← live preview, free
 ├─ Editor UI builds the spec (title, scenes, overlays, captions, audio)
 ├─ Uploads → presigned PUT → object storage (never through our server)
 └─ polls GET /api/jobs/:id (2s) → render progress
        │
Next.js API routes
 ├─ POST /api/generate   → enqueue the orchestrate pipeline (story→voice∥pixel→build→qa→mix)
 ├─ POST /api/jobs       → validate spec (contracts.py port) → quote+reserve credits → INSERT job
 ├─ GET  /api/jobs/:id   → {status, progress, output_url}
 ├─ POST /api/upload-url → presigned URL
 └─ Stripe webhooks      → credit grants / subscription state
        │
Worker (separate Node process, same host to start)
 ├─ claim job (SELECT … FOR UPDATE SKIP LOCKED)
 ├─ bundle(template)  [cached per template+version — biggest cost lever]
 ├─ selectComposition(serveUrl, id, inputProps)
 ├─ renderMedia({ onProgress → UPDATE jobs.progress })
 ├─ audio_gate + QA frames (reuse tools) → thumbnail strip
 └─ upload mp4 → storage → status=done, output_url (CDN)   [failed → refund credits]
        │
Object storage + CDN (R2 / S3+CloudFront)   Postgres (users, projects, specs, jobs)   Stripe
```

**Stack decisions (MVP):**
- **Next.js (App Router)** — serves dashboard, editor (with the Player), and API. Preview is
  in-browser, so the web tier does **no** render compute.
- **Postgres** for users / projects / specs / the **jobs table** (job queue = `FOR UPDATE SKIP
  LOCKED` — no Redis needed yet). Prisma or Drizzle for the ORM.
- **One render worker** (Node + `@remotion/renderer`) — literally `render-all.mjs` wrapped in a job
  loop, with a warm Chromium (`openBrowser()` + `puppeteerInstance`) and a cached bundle per template.
- **Storage:** R2 (S3-compatible, free egress) or S3+CloudFront. **Presigned PUT** for direct browser
  uploads; presigned/public URLs for finished mp4s.
- **Queue:** Postgres job table now → **BullMQ/Redis** when we need retries/concurrency/scheduling.
- **Realtime:** **poll first** (simple, proxy-safe); upgrade to SSE for polish later. No WebSocket.
- **Auth:** NextAuth/Auth.js (or Clerk) — email + Google. **Billing:** Stripe subscriptions + credit packs.

**Generate vs Render are two job types.** *Generate* runs the orchestrate pipeline (writes the spec
+ voice + pixels). *Render* turns a locked spec into an mp4. Both live in the same jobs table with a
`type` column and per-stage progress.

### Scaling path (to Lambda, when concurrency outgrows one box)
1. Keep templates as bundles on object storage (`deploySiteFromBundle`) so VPS worker and Lambda read
   the same `serveUrl`.
2. Abstract rendering behind one function `render(inputProps, templateId)` — today local
   `renderMedia`, later `renderMediaOnLambda` with identical props.
3. Swap the queue Postgres→BullMQ/SQS; move the job table to an event log (`renderId`, `bucketName`).
4. Move heavy render to `@remotion/lambda` (fan-out, pay-per-render, webhook progress). **Note: for
   ~36–42s shorts Lambda is about elastic scale, not speed** — keep the self-hosted worker as the
   cheap baseline, use Lambda for bursts / a paid priority tier.

### Hard parts (flagged by research — plan for them)
- **Long renders:** a 40s 1080p short on a 4-core box ≈ 2–5 min. Mitigate: warm Chromium, moderate
  `concurrency` (the engine already uses `75%`), **cache the bundle per template**, watchdog stalled jobs.
- **Serverless can't run arbitrary Chromium** — self-host the worker for MVP; Lambda is the later,
  prebuilt-layer path.
- **Fonts:** must load in headless Chromium — stick to `@remotion/google-fonts` (already the engine's
  approach) or bundled `.woff2`.
- **Memory:** each Chromium tab ~300–600MB → size the VPS (8GB+), limit concurrency.
- **Remotion licensing:** free ≤3 people; a Company License (~$25/seat/mo) applies at 4+ and
  **cloud/serverless rendering adds Cloud Rendering Units** — factor into unit economics once
  revenue/team crosses thresholds.
- **COGS reality:** one 40s AI-video short ≈ **$2.30 of fal spend** → this is why AI pixels are paid
  and TSX is free, and why credits must be quoted upfront.

---

## 5. Editor engineering (the UI build)

Concrete library picks (all MIT, vetted for license traps — several OSS editors were disqualified on
AGPL/Sustainable-Use/dual licenses):

| Area | Pick | Why |
|---|---|---|
| Editing model | Scene stack + Fliki range-slider timing | category standard; scene-relative times survive reorder |
| Optional mini-timeline | `@xzdarcy/react-timeline-editor` | MIT, active, DOM-based, drag/trim/snap/ruler/playhead, trivial Remotion sync |
| Canvas handles | `react-moveable` | only lib with move+resize+rotate + snap/guidelines over a scaled target |
| Player↔DOM sync | `PlayerRef.getScale()` + `frameupdate` + `useSyncExternalStore` | per-frame, no busy loop, doesn't re-render the Player |
| Upload | `react-dropzone` + presigned S3 PUT + XHR progress | headless, images need no multipart; uppy as upgrade path |
| State | zustand + immer, slices `doc`/`ui`/`playback` | one spec = single source of truth |
| Undo/redo | `zundo` temporal middleware on `doc` only | snapshot-based, coalesced (throttled) so dragging ≠ 60 history entries |
| Autosave | 1–2s debounced localStorage + revision-stamped last-write-wins | optimistic; "newer version exists" toast on conflict |
| App shell | Tailwind v4 + shadcn/ui + Radix | Linear/Vercel/Anthropic premium look (matches `brand.md`) |
| Editor layout | `react-resizable-panels` | standard split-pane, ARIA, persisted layout |
| Color/toast/cmd-palette/icons | react-colorful · sonner · cmdk · lucide-react | small, MIT, shadcn-native |

**Coordinate mapping (1080×1920 ↔ scaled Player):** `scale = wrapperWidth / 1080` (or
`playerRef.getScale()`); `screen = comp * scale`, write back `comp = screen / scale`. Counter-scale
the grip dots (`size / scale`) so handles stay constant-size. Recompute on `ResizeObserver` +
`scalechange`.

**OSS repos to study (clean MIT):** `itsjwill/vanta` (Remotion + timeline + captions — closest
match, has a `toRemotionSequences()` bridge), `mohyware/clip-js` (preview/render split),
`Hainrixz/editor-pro-max` (caption components). **Avoid forking:** twick (SUL), OpenChatCut (AGPL),
openvideo app (dual ≤3-emp).

---

## 6. Monetization detail

**Metering model — single credit unit, `1 credit ≈ $0.01` of our cost**, quoted **upfront** from the
spec and **refunded on failure** (the anti-credit-rage stance):

| Action | Cost basis | Credits |
|---|---|---|
| TSX render (free engine) | cheap compute | ~2–4 / short |
| AI image | per-image (fal/Gemini) | ~3–5 |
| AI voice line (ElevenLabs) | per character | ~1–2 |
| AI video second | fal ~$0.058/s | ~6–8 / sec |

**Tiers (mirroring category consensus + our differentiators):**
- **Free ($0):** TSX engine, kokoro/edge voice, 720p + watermark, ~5–10 renders/mo, core SFX/stock,
  **keeps projects forever.** Full-featured editing (trust builder).
- **Creator (~$15/mo):** no watermark, 1080p, monthly credit allowance, ElevenLabs premium voices,
  AI images, full library, priority queue. *(This is the volume tier.)*
- **Pro (~$35/mo):** bigger credits, **voice cloning**, **AI video scenes**, background remover,
  brand kit, rollover, earliest access.
- One-time **credit packs** for overflow; **failed generations are always free**; **one-click cancel.**

---

## 7. Phased roadmap

> Guiding principle: **thin vertical slices that each end in a rendered, downloadable video.** The
> engine already works — every phase is about exposing more of it.

- **Phase 0 — Spec-driven refactor (the load-bearing change).** Convert 1–2 existing compositions
  (e.g. the form-card `short-16`, one niche kit) from hardcoded to **`inputProps`-driven renderers**
  of a scene/overlay spec. Add `defaultProps` + `calculateMetadata`. Prove the same component renders
  in the Player *and* via `renderMedia` from one JSON. **Exit:** render a video from a hand-written
  spec, no new TSX.
- **Phase 1 — MVP read-only-ish.** Next.js app: auth, dashboard listing *existing* rendered videos
  (poster = frame 0), and a **render button** that enqueues a job to the worker and shows progress.
  Storage + presigned URLs + Postgres jobs table. **Exit:** render an existing template from the web,
  watch progress, download the mp4.
- **Phase 2 — The editor.** Scene stack + Player preview + text/image overlays with move/resize/
  timing (range slider) + captions panel + zustand/zundo/autosave. Title editing. **Exit:** a user
  edits title/text/images/timing on a template, previews live, renders their version.
- **Phase 3 — Generate.** The wizard → orchestrate pipeline as a job (story→voice∥pixel→build→qa→mix)
  with per-stage progress and a script-review step. Free = TSX templates.
- **Phase 4 — Paid tier + AI.** Stripe + credits + metering + refund-on-fail. Unlock ElevenLabs
  voices/clone, **AI image generation per scene**, 1080p, no watermark, priority. AI video scenes last
  (highest COGS).
- **Phase 5 — Polish & growth.** Mini-timeline escape hatch, beat-sync to music, one-click resize
  (9:16/1:1/16:9), SRT export, direct publish, Lambda scale-up when concurrency demands it.

---

## 8. Open questions for you

1. **Solo product or multi-tenant from day one?** (Assumed multi-tenant SaaS; single-tenant would
   drop auth/billing and shrink Phases 4–6.)
2. **First templates:** which 2–3 existing kits become the launch templates? (form-card, terminal,
   chess are the most "showcase.")
3. **Brand of the app itself** — reuse the video brand (indigo/violet Linear-look) or a separate
   product identity?
4. **Publish destinations** — is direct TikTok/YT/Reels publish in scope early, or download-first?
5. **Free-tier generosity** — how many free renders/mo feels right given the ~$0.01-credit economics?

---

## Appendix — research provenance

Synthesized from four research agents (sources they actually read are listed in their reports):
- **Editor UX:** Canva, CapCut Web, Clipchamp, VEED, Kapwing, Descript help/product docs.
- **Monetization:** InVideo, Pictory, Fliki, Revid, Crayo, Opus, Veed, Lumen5, Canva, Kling, Runway
  pricing pages + Trustpilot/review complaint mining.
- **Architecture:** Remotion docs (player, parametrized-rendering, data-fetching, renderer, lambda,
  cloudrun, captions, fonts, licensing) + Shotstack/Creatomate/json2video/fal pricing.
- **UI engineering:** Remotion Player API + GitHub/npm vetting of timeline, canvas, upload, state,
  and UI-kit libraries, and OSS Remotion editors.
