# Phase 5 — Polish & Growth

> Implements the delight + growth slice of the web app on top of Phases 0–4. **Locked context:**
> `_shared-decisions.md` (ports, layout, DB schema, Spec type, storage, auth, billing, job flow, DoD).
> This plan references those invariants instead of re-deciding them; if this file disagrees with
> `_shared-decisions.md`, that file wins.

**Exit (per phase brief):** the **mini-timeline escape hatch**, **one-click aspect resize**, and
**SRT export** work end-to-end. Beat-sync, render-history/versions, SSE upgrade, direct-publish
stubs, and the scale-up doc are delivered as working-or-stub/doc per the checklist below.

---

## Goal

Turn the Phase-2/4 editor into a *delightful* production tool and hand growth teams the levers they
need, all still 100% localhost:

1. **Mini-timeline escape hatch** — one collapsed, single-lane overlay timeline (scene-relative)
   so power users can trim overlay in/out by dragging instead of the range slider.
2. **Beat-sync** — quantize scene boundaries to the music bed's beats for musical cuts.
3. **One-click aspect resize** — re-render any project at 9:16 / 1:1 / 16:9 from the same spec.
4. **SRT export** — download a `.srt` subtitle file derived from the caption model's word times.
5. **Render-history / versions** — every successful render recorded as a version; project keeps the
   mp4 + spec snapshot for each.
6. **SSE upgrade** (optional, behind a flag) — job progress as server-sent events instead of 2s polling.
7. **Direct publish stubs** (TikTok / YouTube) behind feature flags.
8. **Scale-path doc** — MinIO presigned URLs, BullMQ, `@remotion/lambda` notes.

---

## Why this phase first / Dependencies

Phase 5 is last: it polishes what Phases 0–4 already expose and adds growth scaffolding.

| Dependency | What Phase 5 consumes | Verified in |
|---|---|---|
| **Phase 0** (spec-driven templates) | `Spec` shape, `calculateMetadata`, per-template bundle | `_shared-decisions.md` §Templates |
| **Phase 2** (editor) | scene stack, overlay `start/end` (scene-relative), caption model, Player preview | `_shared-decisions.md` §UI / §Spec |
| **Phase 4** (billing/storage) | render job flow, credit reserve/refund, storage module, `.storage/` layout | `_shared-decisions.md` §Storage/§Job flow |

Phase 5 **adds** to the schema (never renames), **adds** API routes and UI surface, and makes one
small engine-facing change (see §Engine). It does **not** re-decide layout, ports, auth, billing, or
the Spec — those are locked.

**Why now:** everything prior is functional but single-purpose (one aspect, one timeline paradigm, no
way out of a locked project). These features are the visible "production product" layer — the ones a
first paying creator notices — and they are cheap once Phases 2+4 exist.

---

## Exit criteria (definition of done)

From `_shared-decisions.md` §DoD, made concrete for this phase:

- [ ] Runs on `docker compose up -d` + `npm run dev` (web) + `npm run worker`, all localhost.
- [ ] **Mini-timeline**: expandable single-lane overlay timeline in the editor; dragging an overlay
      bar's in/out trim writes the same scene-relative `start/end` the range slider writes, and the
      Player updates live.
- [ ] **Aspect resize**: from the editor's Render dialog, pick 9:16 / 1:1 / 16:9; a render job
      re-derives `format` and re-renders the *same* spec at the new aspect; the mp4 downloads.
- [ ] **SRT export**: a ready project's card/editor offers "Download SRT"; the `.srt` timestamps
      match the caption word times and the mp4 plays back with the words on those times.
- [ ] Beat-sync: a working trim function + a graceful "no beats" fallback (see §Worker/§Risks).
- [ ] Render-history/versions: a project lists ≥2 versions after ≥2 renders; each has its own mp4
      + spec snapshot + poster; download works per version.
- [ ] SSE (flag off by default) + publish stubs + scale doc exist and are exercised per §Test plan.
- [ ] `npm run typecheck` + lint clean; unit tests for the new spec helpers, SRT formatter, beat
      quantizer, and version snapshot; e2e smoke for timeline trim + resize + SRT.
- [ ] This phase's exit artifact is produced end-to-end: **an mp4 re-rendered at 1:1 from an edited
      project, plus its matching `.srt`, plus a usable mini-timeline** (see §Test plan manual steps).

---

## Data model changes

`packages/db/src/schema.ts` — **additive only** (per `_shared-decisions.md` §Database). No renames.

New tables:

```ts
// render_versions — one row per completed render; the immutable history of a project.
render_versions(
  id        cuid2 PK
  projectId FK -> projects.id  (NOT NULL)
  revision  int                 // == spec.meta.revision at render time
  format    jsonb               // {width,height,fps} at render time
  outputKey text                // .storage/<proj>/...  mp4 key (nullable until done)
  posterKey text
  durationSec real
  specJson  jsonb               // frozen Spec snapshot (what actually rendered)
  jobId     FK -> jobs.id       // the render job that produced this
  createdAt timestamptz default now()
)
UNIQUE(projectId, revision)     // one version per rendered revision (a re-render bumps revision)

// music_beats — per-bed beat metadata, derived once (see §Worker). Also caches BPM.
music_beats(
  id        cuid2 PK
  bedId     text        // == media/library/music/catalog.json clip id
  bpm       real
  times     real[]      // beat onsets in seconds (absolute within the clip)
  gridMs    real        // derived subdivision (ms) = 60000/bpm/2  (8th notes)
  source    text        // 'bpm-analyzed' | 'bpm-grid' | 'none'
  createdAt timestamptz default now()
)
```

New **columns** on existing tables:

```ts
projects: add  lastRenderedVersionId FK -> render_versions.id (nullable)  // "current" version
            add  aspectRatio text default '9:16'   // mirror of spec.format; last-resized
jobs:     add  inputAspect text nullable           // the aspect a resize render was asked for
```

Notes:
- **No renames, no drops.** `render_versions.specJson` is the frozen spec; later edits create a *new*
  revision + a new row. Do NOT mutate a version's row.
- `music_beats.times` is a Postgres `real[]` — Drizzle models it as `real('times').array()`.
- `aspectRatio` on `projects` is a denormalized convenience for the dashboard filter; the source of
  truth stays `spec.format` (recomputed by resize).

---

## API routes

All under the existing `/api/*` auth guard (`_shared-decisions.md` §Auth); zod-validated via
`packages/spec`.

| Method & path | Purpose | Notes / payload |
|---|---|---|
| `POST /api/projects/[id]/timeline` | Persist an overlay-trim from the mini-timeline | body `{ sceneId, overlayId, start, end }`; validates scene-relative `0<=start<end<=scene.durationSec`; bumps `meta.revision`; returns new spec |
| `POST /api/projects/[id]/resize` | Enqueue an aspect-resize render | body `{ aspect: '9:16'\|'1:1'\|'16:9' }`; server derives new `format`, **quotes + reserves credits** (same flow as Phase-4 render), inserts a `render` job with `inputAspect`; returns `{ jobId, costCredits }` |
| `GET /api/projects/[id]/versions` | List render versions | returns `render_versions[]` (id, revision, format, durationSec, createdAt, outputUrl, posterUrl, hasSpec) |
| `GET /api/versions/[id]` | One version + download link | `{ ...version, spec, srtAvailable }` |
| `GET /api/versions/[id]/download` | Stream the version mp4 | `Content-Disposition: attachment` |
| `GET /api/projects/[id]/srt` | Generate + return the SRT | derives from `spec.voice.lines[].words`; `Content-Type: text/plain` |
| `GET /api/projects/[id]/beats` | Beat metadata for the current music bed | returns `{ bpm, times, gridMs, source }` (from `music_beats`); `{ source:'none' }` if bed has no beats |
| `POST /api/projects/[id]/beats/sync` | Apply beat-quantized scene boundaries | body `{ mode: 'nearest'\|'grid' }`; trims scene `end`s to nearest beat/grid point (never moves `start` past a scene's first VO word); bumps revision; returns diffed spec |
| `GET /api/jobs/[id]/events` | **SSE** (flag-gated) | `text/event-stream`; mirrors the polling payload `{status,stage,progress,resultUrl}`; 404 if `SSE_ENABLED !== 'true'` |
| `POST /api/publish/[platform]` | **Stub** (flag-gated) | `platform = 'tiktok'\|'youtube'`; returns `501 { message:'not implemented', flag:'PUBLISH_<PLATFORM>_ENABLED' }` when flag off; a dry-run echo when on |

**Resize cost + flow** (identical to the Phase-4 render reservation):
1. zod-validate body → read current spec → compute new `format` (see §Worker for the mapping).
2. Quote credits from the spec at the *target* resolution (1080p vs 720p per tier).
3. Reserve → insert `render` job (`inputJson` = full spec with swapped `format`) → return `jobId`.
4. Worker renders; on `done` inserts a `render_versions` row + sets `projects.lastRenderedVersionId`.

---

## UI surface

Under `apps/web/`, brand per `brand.md` (§UI conventions in `_shared-decisions.md`). New/changed:

### 1. Mini-timeline escape hatch (bottom strip, collapsible)
- New component `apps/web/components/editor/MiniTimeline.tsx` built on **`@xzdarcy/react-timeline-editor`**
  (MIT — the pick from `_shared-decisions.md` §UI). **Single overlay lane**, scene-relative.
- Model → timeline mapping: one `TimelineRow` per scene; overlay bars = `{start, end}` **within that
  scene** (seconds). The lane shows scene boundaries as vertical dividers; the playhead is driven by
  `playerRef.frame` via the existing `useSyncExternalStore` bridge (Phase 2).
- Interactions write back through the SAME zustand/immer `doc` slice the range slider uses — one
  source of truth. `onChange({sceneId, overlayId, start, end})` → optimistic update + debounced
  `POST /api/projects/[id]/timeline`.
- Toggled from the bottom strip's existing "Timeline" affordance; **off by default** per §UI.
- Timeline bars are color-coded by overlay type (text=indigo, image=violet) with a type glyph.

### 2. Aspect resize (Render dialog)
- Render dialog (`apps/web/components/editor/RenderDialog.tsx`) gains an aspect toggle
  `9:16 ▸ 1:1 ▸ 16:9`. Selecting one shows the derived resolution (`1920×1080`, `1080×1080`,
  `1920×1080`) and the re-quoted credit cost, then `POST /api/projects/[id]/resize`.
- Dashboard card / editor top bar get a small "Resize & render" quick action.

### 3. SRT export
- On a **ready** project (dashboard card menu + editor top bar): "Download SRT" →
  `GET /api/projects/[id]/srt` with `Content-Disposition: attachment; filename="<title>.srt"`.
- RTL lines keep **logical (spoken) word order** in the SRT (never reversed) — matches the caption
  contract in `shorts.tsx`.

### 4. Render-history / versions
- New `apps/web/app/(app)/projects/[id]/versions/page.tsx` (or a dialog): timeline of
  `render_versions` — revision, aspect, duration, date, poster, **Download**, **SRT**, and a
  "Restore spec" (P1) action. Dashboard card shows version count + latest.
- "Restore spec" writes `version.specJson` back to `projects.specJson` (bumping revision to a *new*
  one — never reusing a version's revision).

### 5. Publish stubs (flag-gated)
- Dashboard card menu: "Share → TikTok / YouTube". When the flag is off, a sonner toast explains the
  feature is gated (calls the 501 stub). When on, shows a disabled "coming soon" tooltip.
- No real OAuth/publish flow — documented as the integration surface.

### 6. SSE (flag-gated)
- The job-progress hook (`useJobProgress`, currently polling 2s) checks a capability endpoint /
  feature flag; if `SSE_ENABLED`, it opens `EventSource('/api/jobs/[id]/events')` and falls back to
  polling on error. **No UI change** — same progress bar, cleaner updates.

---

## Worker changes

`apps/worker/` — owns render + generate. New modules:

### A. `apps/worker/src/resize.ts` — aspect mapping
Pure function `computeFormat(spec, aspect)`:

| aspect | width | height | notes |
|---|---|---|---|
| `9:16` | 1080 | 1920 | default (unchanged) |
| `1:1` | 1080 | 1080 | square — **safe areas recompute** (`SAFE.bottom` no longer applies; re-center captions y~500) |
| `16:9` | 1920 | 1080 | landscape — caption plate sits mid-frame |

**Handling scene/overlay coordinates:** overlays are stored in composition px (`1080×1920`). Resize
must transform them. Two options, pick **option A (letterbox-safe, default)** for P0, note B for P1:
- **A. Fit-into-frame transform:** `scale = newH/oldH`; `x' = x*scale + (newW - oldW*scale)/2`,
  `y' = y*scale`. Content is scaled + centered; nothing crops; safe-area guides recomputed. Simple,
  deterministic, matches "same spec, new canvas" expectation.
- **B. Smart refit** (P1): per-overlay optional `fit: 'cover'` for images to refill a letterboxed
  frame. Not in P0.

`computeFormat` is a pure, unit-tested helper in `packages/spec` (shared web+worker) — 
`packages/spec/src/format.ts`.

### B. `apps/worker/src/beats.ts` — beat derivation + quantizer
- **Derivation** (`deriveBeats(bedPath, bedId)`): run a lightweight onset detector on the bed's
  audio. Reality check (verified): the current `media/library/music` beds are **ambient pads, no
  drums, no BPM metadata** — `librosa`/`aubio` are NOT installed and no system install is assumed.
  So:
  - Prefer a **catalog-embedded `bpm`** if `music_beats` or the catalog ever has one.
  - Else attempt onset detection via `ffmpeg`'s built-in `astats`-based amplitude onset + a simple
    peak-picking in worker TS (stdlib, no new native deps): compute a **tempo grid** at a detected
    or default BPM (120), producing 8th-note `gridMs`.
  - Record `source: 'bpm-analyzed' | 'bpm-grid' | 'none'`; insert into `music_beats`.
  - **Beatless beds → `source:'none'` → the sync API returns a clear "no beats — using a 120 BPM
    grid" or refuses.** This is the honest, documented fallback (see §Risks). A future percussive
    bed with a real `bpm` gets real beats with zero worker change.
- **Quantizer** `quantizeScenes(spec, beats, mode)`:
  - `mode:'nearest'`: snap each scene's `end` to the nearest beat in `times`.
  - `mode:'grid'`: snap to the nearest `gridMs` multiple.
  - **Invariants:** a scene's `end` never moves earlier than its *first VO word's `end` + 0.05s*;
      never moves past the next scene's `start`; `start` is untouched; scene 0 `start` stays 0.
  - Returns a new spec (revision bumped) + a diff list `[{sceneId, from, to}]` for the UI to toast.

### C. `apps/worker/src/srt.ts` — SRT formatter
`buildSrt(spec)` → `.srt` text. From `spec.voice.lines[].words` (`{w,start,end}`): one cue per line
(or per word if words present — pick **per line** by default, P1 toggle for per-word). Format:
```
1
00:00:00,500 --> 00:00:03,230
צריך להחתים הרבה לקוחות?

```
- Cue numbering 1-based; timestamps `HH:MM:SS,mmm`; lines in **logical order** (RTL-safe, no reversal).
- **Nikkud policy:** each cue carries the ORIGINAL `line.text` — nikkud intact, logical order. The SRT is a
  standalone artifact (burned in a separate player), so its text is never altered: `stripNikkud` is NOT applied
  to the export. It applies only to the on-screen caption burn (display).
- If `burnIn:false`, still export (SRT is a separate file, not burned). Clamp to `durationSec`.
- Unit-tested formatter (pure, no I/O). Tests must assert the cue text equals the original `line.text` string
  (nikkud preserved) — see §Test plan.

### D. Worker job handling additions
- On render `done` (both normal + resize): **insert `render_versions`** row (frozen specJson,
  outputKey, posterKey, format, revision, jobId) and set `projects.lastRenderedVersionId`.
- The resize path reuses the cached bundle (same template) — only `inputProps.format` changes, so
  `bundle()` is NOT re-run (`_shared-decisions.md` §Templates).
- Beat metadata: derived **once per bed** and cached in `music_beats` (library-first — never
  re-analyze a bed already analyzed).

---

## Engine/Remotion changes

**Minimal — no template TSX changes.** The existing parametrized compositions already consume
`inputProps: Spec` (Phase 0). Phase 5 touches:

1. **`calculateMetadata` already derives duration from scenes** — resize changes `spec.format`, which
   flows straight through `selectComposition`/`renderMedia` (`_shared-decisions.md` §Job flow, and
   `render-all.mjs` shows `selectComposition` takes the props). **No engine edit required for resize.**
2. **Optionally expose `SAFE` recompute** in `remotion/src/lib/shorts.tsx` if a template hardcodes
   caption `y`. Check each launch template: if it reads `SHORT.H`/`SAFE` from the import (short-16
   uses `y={1560}` etc.), add a `captionY`/`safe` derived from `format.height` in the shared kit so
   non-9:16 renders center captions. This is a small, additive enhancement; if a template can't adapt,
   note it and keep the letterbox-safe transform (option A) as the fallback so nothing breaks.
3. **No new engine deps.** The worker's beat detector is stdlib TS + ffmpeg `astats`; no `librosa`.

---

## Infra & env (docker-compose, .env)

From `_shared-decisions.md` §Ports/§Storage — unchanged ports; storage stays **local disk**
(`STORAGE_DRIVER=disk`, `STORAGE_DIR=webapp/.storage`) for P0. MinIO stays optional (scale doc).

`.env` (webapp root, copy `.env.example`) additions:

```
# Phase 5
SSE_ENABLED=false            # SSE job progress upgrade (off = polling, default)
PUBLISH_TIKTOK_ENABLED=false # direct-publish stubs behind flags
PUBLISH_YOUTUBE_ENABLED=false
BEAT_SYNC_GRID_BPM=120       # fallback tempo for beatless beds
STORAGE_DRIVER=disk          # unchanged default; 's3' is the documented scale path
STORAGE_DIR=webapp/.storage
```

`docker-compose.yml`: **no new services** for P0 (Postgres + MailHog already present from Phase 1/4).
MinIO compose block documented (not enabled) in `webapp/docs/scale.md`.

---

## Task list

**P0 — must (the phase's working exit):**

- [ ] `packages/db`: add `render_versions`, `music_beats` tables + `projects.aspectRatio`,
      `projects.lastRenderedVersionId`, `jobs.inputAspect`; run migration; regenerate drizzle client.
- [ ] `packages/spec/src/format.ts`: `computeFormat(spec, aspect)` + overlay transform (option A) +
      unit tests.
- [ ] `apps/worker/src/srt.ts`: `buildSrt(spec)` + unit tests.
- [ ] `apps/worker`: on render `done`, insert `render_versions` + set `lastRenderedVersionId`.
- [ ] API: `POST /api/projects/[id]/resize` (quote+reserve+enqueue), `GET .../versions`,
      `GET /api/versions/[id]`, `GET /api/versions/[id]/download`, `GET /api/projects/[id]/srt`,
      `POST /api/projects/[id]/timeline`.
- [ ] UI `MiniTimeline.tsx` on `@xzdarcy/react-timeline-editor` (single overlay lane, scene-relative,
      trim→same `doc` slice→live Player update→persist via timeline API). Off by default.
- [ ] UI Render dialog aspect toggle → `POST resize`; dashboard/editor "Download SRT"; versions page.
- [ ] `npm run typecheck` + lint clean; e2e smoke (timeline trim, resize, SRT).

**P1 — nice (stubs/docs + working-with-fallback):**

- [ ] `apps/worker/src/beats.ts`: onset/grid detector + `quantizeScenes` + `music_beats` cache;
      API `GET .../beats`, `POST .../beats/sync`; beatless fallback (`source:'none'` / grid).
- [ ] UI "Sync to beat" button in the Audio tab → quantizer → toast diff → Player update.
- [ ] SSE: `GET /api/jobs/[id]/events` + `useJobProgress` EventSource fallback; flag-gated.
- [ ] Publish stubs: `POST /api/publish/[platform]` (501 when flag off) + gated dashboard actions.
- [ ] Version "Restore spec" (writes specJson → new revision, never reuses a version revision).
- [ ] `webapp/docs/scale.md`: MinIO presigned URLs (`STORAGE_DRIVER=s3`), BullMQ/Redis swap,
      `@remotion/lambda` notes (bundle on object storage → `deploySiteFromBundle`, one
      `render(inputProps, templateId)` seam, event-log jobs). Include the Remotion licensing +
      CRU warning from `WEBAPP-PLAN.md` §Hard parts.

---

## Risks & gotchas

| Risk | Mitigation |
|---|---|
| **Ambient music beds have no beats** (verified: current beds are drumless pads, no BPM) | Beat-sync is honest: `source:'none'` → grid fallback or "nothing to sync". Never fake beats. The architecture reads a future real `bpm` from the catalog with zero code change. |
| **Mini-timeline vs scene-stack dual paradigm** (Kapwing lesson in `WEBAPP-PLAN.md` §5) | It is the **single** escape hatch, one lane, scene-relative, off by default; it edits the SAME `doc` state the stack edits. Never a second competing model. |
| **Resize coordinate drift** (overlays stored in 1080×1920 px) | `computeFormat` option A scales+centers deterministically; safe-area guides recompute. Add a per-aspect QA frame read before any resize render. |
| **RTL + SRT** | Keep logical word order; never reverse word arrays. **Decided:** the SRT keeps the ORIGINAL `line.text` — nikkud intact, logical order — because a downloaded `.srt` is a standalone subtitle artifact (burned elsewhere), and stripping nikkud from it would silently alter authored user text. `stripNikkud` is **display-only**: it applies to the on-screen caption burn, never to the export. A unit test pins this (§Test plan). |
| **Versions immutability** | A version row is never mutated; "restore" writes to a *new* revision. `specJson` frozen at render. |
| **SSE behind reverse proxy / localhost** | Flag off by default → polling (proxy-safe, `_shared-decisions.md` §Job flow). EventSource only when `SSE_ENABLED`; on error, catch and fall back to polling. |
| **Resize re-render cost** | Reuses cached bundle (no re-bundle); quotes credits at target resolution before enqueue (Phase-4 flow). Free tier resize stays 720p+watermark. |
| **Missing new native deps** | Beat detection is stdlib TS + ffmpeg `astats`; NO `librosa`/`aubio` assumed (they aren't installed). If a real onset pass is needed later, document the dep in `scale.md`, don't block P0. |

---

## Test plan

**Unit** (`apps/worker/src/*.test.ts`, `packages/spec/src/*.test.ts` — vitest):
- `format.ts`: each aspect's `width/height`; overlay transform math (scale + center offset); degenerate inputs.
- `srt.ts`: cue numbering, `HH:MM:SS,mmm` formatting, RTL line order preserved, clamping to duration, empty-word fallback (estimated timing via `timeWords`-style distribution), and **nikkud preserved** — assert each cue's text equals the original `line.text` string byte-for-byte (the SRT keeps nikkud and logical order; `stripNikkud` must NOT be applied to the export).
- `beats.ts`: quantizer invariants (never before first word, never past next scene start, start untouched), grid vs nearest, beatless → `source:'none'`.
- `render_versions`: one row per revision (UNIQUE), frozen specJson, no mutation on restore.

**Integration** (worker→db→storage):
- Render `done` creates a `render_versions` row + updates `lastRenderedVersionId`; second render (revision bump) creates a second row.
- `POST /resize` reserves credits, enqueues `render` job with `inputAspect`, and `render_versions` records the target `format`.

**e2e smoke** (Playwright, `apps/web/e2e/`):
- Open editor → expand mini-timeline → drag an overlay trim → Player reflects new `start/end` → reload persists.
- Render at 1:1 → progress → ready → version listed with 1:1 format → download works.
- Download SRT → file name + cue count + timestamps sane.

**Manual verification steps (exact):**
1. `docker compose up -d` · `npm run dev` (port 3000) · `npm run worker` (port 3100).
2. Log in via MailHog magic link (`localhost:8025`).
3. Open a Phase-2 project; bottom strip → expand mini-timeline; drag an overlay bar's right handle in
   ~0.5s; confirm the range slider in the right inspector shows the same value and the Player
   playback reflects it; reload → persists.
4. Render dialog → pick `1:1` → confirm resolution `1080×1080` + credit cost → Render → watch
   progress (polling or SSE) → dashboard card ready with 1:1 poster → **download the mp4 and open it**.
5. On the ready card → "Download SRT" → open the `.srt`; the subtitle timestamps line up with the
   spoken words in the mp4 (spot-check the hook line).
6. Render again after a small edit → versions page shows 2 rows (different revisions/aspects) → each
   downloads its own mp4.
7. Set `SSE_ENABLED=true`, restart web, start a render → progress arrives as SSE (check network tab
   `text/event-stream`); set `false` → polling (no event-stream).
8. Set `PUBLISH_TIKTOK_ENABLED=true` → card shows "Share → TikTok" → click → sonner/disabled "coming
   soon"; with flag `false` → 501 toast.
9. Audio tab → "Sync to beat" on the current bed → toasts the per-scene trim diff (or "no beats —
   grid") → Player updates → re-render.

---

## Agent brief

Copy this block verbatim as the prompt to the agent that will EXECUTE Phase 5.

```
You are implementing Phase 5 — Polish & Growth of the shorts web app. Work inside the repo
claude-faceless-shorts-creator/. Run every command from the repo root unless a command says otherwise.

CONTEXT YOU MUST READ FIRST (in order):
1. webapp/plans/_shared-decisions.md — LOCKED invariants (ports, layout, DB schema, Spec type,
   storage, auth, billing, job flow, DoD). Your work MUST NOT contradict it. Reference it; don't
   re-decide. Ports: web=3000, worker=3100, Postgres=5432, MailHog=1025/8025. Storage=local disk.
2. webapp/plans/phase-5-polish.md — THIS plan. Follow its task list, API routes, schema additions,
   UI surface, worker modules, and test plan exactly.
3. WEBAPP-PLAN.md — master plan (editor model: scene-stack primary, ONE collapsed mini-timeline
   escape hatch, off by default).
4. Engine reality (read as needed): brand.md, remotion/src/lib/shorts.tsx (Captions/SAFE/prog/RTL
   contract), remotion/src/brand.ts, remotion/scripts/render-all.mjs (bundle+selectComposition+
   renderMedia, pinned headless-shell, concurrency '75%'), tools/gen_voice.py (word times in
   .words.json -> spec.voice.lines[].words), tools/contracts.py.

HARD CONSTRAINTS:
- Everything localhost; docker compose up -d for Postgres/MailHog. No cloud, no new services in
  compose for P0 (MinIO stays optional, documented only).
- Schema changes are ADDITIVE (new tables/columns only; never rename/drop). Timestamps
  timestamptz default now(); id = cuid2; money = integer credits.
- Overlay start/end are SCENE-RELATIVE seconds. Never change that invariant.
- meta.revision increments on every persisted edit. render_versions rows are IMMUTABLE; "restore"
  writes to a NEW revision, never reuses a version's revision.
- Beat-sync must be honest: the current music beds are ambient pads with NO beats (verified). Use
  source:'none' + a grid fallback; never fake beats. No librosa/aubio — stdlib TS + ffmpeg astats only.
- Resize: computeFormat option A (scale + center, no crop) for P0. Reuse the cached bundle — do NOT
  re-bundle. Quote+reserve credits before enqueue (Phase-4 flow).
- SRT keeps LOGICAL word order (RTL-safe, never reverse) AND keeps the ORIGINAL line text with nikkud intact.
  `stripNikkud` is display-only (on-screen caption burn); it is NEVER applied to the exported `.srt` (a standalone
  subtitle artifact). Assert this in the `srt.ts` unit test.
- SSE and publish stubs are flag-gated and OFF by default (polling + 501 stubs).
- Match the brand (indigo/violet/teal, Space Grotesk/Inter/JetBrains Mono, premium calm).

PACKAGES (workspaces): web in apps/web (Next.js 15 App Router), worker in apps/worker (Node 24),
spec in packages/spec (zod), db in packages/db (drizzle). Share pure helpers (computeFormat,
buildSrt, quantizeScenes) in packages/spec so web+worker don't drift.

ORDERED STEPS:
1. packages/db: add render_versions + music_beats tables, projects.aspectRatio +
   projects.lastRenderedVersionId, jobs.inputAspect. Run migration, regen drizzle client.
2. packages/spec: src/format.ts (computeFormat + option-A overlay transform), unit tests.
3. apps/worker: src/srt.ts (buildSrt) + unit tests; src/beats.ts (deriveBeats + quantizeScenes +
   music_beats cache); on render done insert render_versions + set lastRenderedVersionId.
4. API routes under /api/* auth: POST /api/projects/[id]/timeline, POST .../resize, GET .../versions,
   GET /api/versions/[id], GET /api/versions/[id]/download, GET /api/projects/[id]/srt,
   GET /api/projects/[id]/beats, POST /api/projects/[id]/beats/sync, GET /api/jobs/[id]/events (SSE,
   flag), POST /api/publish/[platform] (stub, flag).
5. UI: MiniTimeline.tsx on @xzdarcy/react-timeline-editor (ONE overlay lane, scene-relative, trim ->
   same zustand/immer doc slice -> live Player -> POST timeline); RenderDialog aspect toggle ->
   POST resize; dashboard/editor "Download SRT"; versions page; gated publish actions; Audio-tab
   "Sync to beat".
6. .env additions (SSE_ENABLED=false, PUBLISH_TIKTOK_ENABLED=false, PUBLISH_YOUTUBE_ENABLED=false,
   BEAT_SYNC_GRID_BPM=120). No new compose services.
7. webapp/docs/scale.md: MinIO presigned URLs (STORAGE_DRIVER=s3), BullMQ swap, @remotion/lambda
   notes (deploySiteFromBundle, one render(inputProps,templateId) seam, event-log jobs, licensing/CRU
   warning).
8. npm run typecheck + lint clean; run all unit/integration/e2e tests.

VERIFY DONE (all must pass):
- docker compose up -d && npm run dev && npm run worker all healthy on localhost.
- Unit: format, srt, beats quantizer, render_versions immutability.
- Manual (with a logged-in user via MailHog at localhost:8025):
  a) Mini-timeline expands; dragging an overlay trim updates the inspector range slider + Player live
     and persists across reload.
  b) Render at 1:1 -> ready -> version row with format 1080x1080 -> mp4 downloads and plays.
  c) "Download SRT" yields a .srt whose hook-line timestamps match the spoken words.
  d) Two renders of two revisions -> versions page lists 2 rows, each downloads its own mp4.
  e) SSE_ENABLED=true -> network tab shows text/event-stream; =false -> polling.
  f) Publish stub: flag on -> sonner/disabled tooltip; flag off -> 501 toast.
  g) "Sync to beat" -> per-scene diff toast (or "no beats — grid") -> Player updates -> re-render ok.

PROVE DONE: report the file paths you wrote/edited, the exact commands you ran, the test output, and
the one-line result of each manual step (a)–(g). If anything in this plan conflicts with
_shared-decisions.md, _shared-decisions.md wins — flag it instead of guessing.
```

---

### Cross-phase assumptions (for the reviewer)

1. **`packages/spec` already owns a shared `computeFormat`/pure-helper home** — this plan puts the
   resize transform, SRT formatter, and beat quantizer in `packages/spec` so web+worker share them.
   If Phase 0–4 left that package without a test runner, add vitest there (doesn't touch other phases).
2. **Phase-4's render `done` handler is the single insertion point** for `render_versions` — assumed it
   already owns "on done, write outputKey + poster"; Phase 5 extends it with a version row.
3. **Aspects beyond 9:16 require the template to read `format`/`SAFE` dynamically.** Phase 5 ships the
   letterbox-safe transform (option A) so no template edit is strictly required; the shared-kit
   `SAFE`/caption-y enhancement is flagged as a small additive engine tweak only if a template hardcodes
   `y`.
4. **Music beds are ambient and beatless** (verified) — beat-sync ships as a grid/`source:'none'`
   fallback plus a catalog-`bpm` path for future percussive beds; the task list treats full onset
   detection as P1/optional, not a P0 blocker.
