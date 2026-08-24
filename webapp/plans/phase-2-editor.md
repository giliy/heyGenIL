# Phase 2 — The Editor (scenes + overlays + captions)

> Builds directly on **Phase 1** (Next.js shell, auth, DB, local-disk storage, render-job flow — see
> `_shared-decisions.md`). This phase ships the editing surface on top. **Do not** build Phase 3
> (generate wizard), Phase 4 (billing/AI), or Phase 5 (mini-timeline/beat-sync) features.

---

## Goal

Ship `/editor/[projectId]` — the 4-zone editing surface (react-resizable-panels) where a logged-in
user edits the **title**, **scenes** (add/duplicate/reorder/delete + per-scene duration), **text &
image overlays** (react-moveable handles over the scaled Player), **captions** (line list, inline
edit, split/merge/nudge, word-highlight presets, RTL full-line rule), and **media** (react-dropzone
upload → local disk → add/replace) on their project's spec. The Remotion `<Player>` renders the
spec **live** via `inputProps`. State = zustand+immer (doc/ui/playback slices) with zundo undo on
`doc` and debounced autosave (localStorage + revision-stamped last-write-wins server sync).

**Exit artifact:** a user edits title/text/images/timing on a Phase-1 template project, sees it
preview live in the Player, then hits **Render** and a Phase-1 render job produces their customized
mp4 (downloadable from the dashboard).

---

## Why this phase first / Dependencies

- **Dependencies (must exist from Phase 1):** Next.js 15 app at `webapp/apps/web`, workspace
  packages `webapp/packages/spec` (zod Spec/Scene/Overlay) and `webapp/packages/db` (drizzle
  `projects`, `assets`, `jobs` tables), auth (Auth.js v5, MagicLink/MailHog), `GET /api/projects/[id]`,
  `PATCH /api/projects/[id]` (spec update), local-disk storage at `webapp/.storage/<projectId>/<assetId>`
  served at `/media/<key>`, `POST /api/jobs` + `POST /api/jobs/[id]/claim`-style render flow, worker
  on port 3100 that renders via `@remotion/renderer` with a **spec-driven template** (Phase 0's
  `defaultProps`/`calculateMetadata` work is a hard prerequisite — the template must render from
  `inputProps`).
- **Why the editor is Phase 2 and not later:** the editor is the product's core differentiator
  (title/text/images/timing). It consumes only what Phases 0+1 built (spec types, DB, render job),
  so it's the natural second vertical slice. It does **not** depend on generate (Phase 3) — a user
  edits a Phase-1 template project; the generate wizard can later hand the same editor richer specs.
- The Player's `inputProps` contract == the worker's `renderMedia` `inputProps` (identical JSON),
  so live preview is guaranteed to match the render — that invariant is the whole point.

---

## Exit criteria (definition of done)

- [ ] `docker compose up -d` + `npm run dev` (web, :3000) + `npm run worker` (worker, :3100), all localhost.
- [ ] `npm run typecheck` + lint clean in `webapp/` (all workspaces); unit tests for spec validators + undo reducer + timing utils pass.
- [ ] `/editor/[projectId]` loads a Phase-1 project; the Player renders its spec live at 1080×1920 scaled to the canvas.
- [ ] Title editable in the top bar and reflected in the Player immediately.
- [ ] Scenes tab: add / duplicate / reorder (drag) / delete; per-scene `durationSec` stepper; durations propagate to Player duration + persisted spec.
- [ ] Text + image overlays: add → appears on selected scene → drag/resize/rotate via react-moveable over the scaled Player; geometry round-trips px↔screen with correct `getScale()` mapping; counter-scaled grips stay constant-size.
- [ ] Inspector (right): style (font/size/color/weight/align), timing (Fliki scene-relative in/out range slider), animation preset; opacity/rotation.
- [ ] Captions tab: line list with inline edit, **Enter-to-split**, hover merge, ±0.1s nudge, word-highlight preset picker (pop/pill/fade) "apply to all", **RTL → full-line render rule** respected in preview.
- [ ] Captions **never silently diverge from audio**: any caption edit sets a dirty flag → the Captions tab shows a persistent "preview-only, re-generate in Generate" banner; the render path surfaces the divergence (flags the dirty state) instead of claiming the edited captions match the muxed voice.
- [ ] Media tab: react-dropzone upload → local disk → asset appears; **Add** (new overlay) and **Replace** (keeps id/geometry/animation/timing, swaps `src` only).
- [ ] Undo/redo (Cmd/Ctrl+Z/Y) on doc edits; autosave to localStorage (debounced 1.5s) + server PATCH with `meta.revision` last-write-wins + "newer version exists" toast on conflict.
- [ ] **Render** button enqueues a Phase-1 render job for the *current* (edited) spec; job progresses; dashboard card flips to ready; mp4 downloads and plays back the edits.
- [ ] Manual verification script (below) passes end-to-end.

---

## Data model changes

No new tables. `packages/db` schema stays as Phase 1 created it; **only `projects` gains usage**, and
the **spec JSON in `projects.specJson` is the only thing the editor writes**. Extensions are
additive columns on existing tables (never renames — per `_shared-decisions.md`):

| Table | Change | Why |
|---|---|---|
| `projects` | *(already has `specJson jsonb`, `title`, `revision int`)* — no change needed | spec + revision already exist for conflict detection |
| `assets` | *(already has `projectId?`, `kind`, `storageKey`, `url`, `w`,`h`, `source 'upload'`)* — add `previewUrl text` **only if** missing | lets the Media tab show `<Img>` thumbnails from `/media/<key>` without re-resolving; if Phase 1 already covered thumbnailing via `url`, skip |
| `jobs` | no change | render jobs already have `inputJson`; the edited spec goes in `inputJson` at submit |

**Contract the editor must honor (from `_shared-decisions.md`, restated only, not re-decided):**
- Overlay `start/end` are **scene-relative seconds** (0..scene.durationSec) — scenes stay reorderable.
- Overlay `x/y/w/h` are **composition px (1080×1920)**; the UI maps to screen via `getScale()`.
- `meta.revision` increments on every persisted edit; `PATCH /api/projects/[id]` rejects if the
  incoming revision ≤ stored revision (last-write-wins → newest wins; older client gets 409 + toast).
- Durations/format derive from scenes via `calculateMetadata` on the server — the editor never
  writes absolute frame counts.

**spec.ts / spec.validators.ts** (in `packages/spec`, mostly exists from Phase 1) — add/adjust:
- `Overlay` zod schema must permit BOTH `{assetId, src}` forms (image) and require `content`/`style`
  (text), with `start/end` constrained `0 ≤ start < end ≤ scene.durationSec` at the scene level
  (validator walks `scenes` and clamps/errors). Add `.superRefine` for: image overlays need
  `assetId` XOR `src`; text overlays need `content`.
- New pure helpers (unit-testable, shared by editor + validators):
  - `sceneDurationSec(scene)` → `scene.durationSec` (trivial, but keeps one source).
  - `clampOverlayToScene(overlay, durationSec)` → mutated-in-place clamped copy (used by range
    slider so `end` can't exceed the scene).
  - `normalizeSpec(spec)` → fills defaults (missing `captions.preset`, `animation: 'none'`,
    `opacity: 1`, `rotation: 0`) so old/partial specs render.
- Re-export everything from `packages/spec/src/index.ts`.

---

## API routes

All under `apps/web/app/api/`. Auth-guarded (Phase 1 middleware). Responses JSON.

| Method & path | Request body → response | Purpose (editor) |
|---|---|---|
| `GET /api/projects/[id]` | → `{ project: {...}, spec }` | load a project + its spec into the store on editor mount |
| `PATCH /api/projects/[id]` | `{ spec, revision }` → `{ project, spec, conflict?: boolean }` | **autosave** — last-write-wins. If `body.revision < project.revision` → `409 { conflict:true, serverSpec }`. Else update `specJson`, bump `revision`, `updatedAt`, return 200. Body validated by `specSchema`. |
| `PATCH /api/projects/[id]/title` | `{ title }` → `{ project }` | save top-bar title (also rides the spec `title`; kept as a thin convenience that flips the card title on the dashboard) |
| `POST /api/projects/[id]/assets` | `multipart/form-data: file` → `{ asset }` | react-dropzone upload → local-disk `/media/<key>`; insert `assets` row (kind from mime: image/video), store `w/h` via client-provided dims or omit |
| `DELETE /api/projects/[id]/assets/[assetId]` | → `{ ok }` | remove an upload (only if unreferenced by any overlay; else 409) |
| `GET /api/jobs/[id]` | → `{ status, progress, outputUrl }` | render-progress poll (Phase 1 — reused, no change) |
| `POST /api/jobs` | `{ projectId, inputSpec }` → `{ job }` | **Render** — Phase 1 flow, but `inputSpec` is the *edited* spec (validated by `specSchema`), quoting + reserving as Phase 1/4 wire |

No SSE this phase (poll every 2s). No generate route (Phase 3).

---

## UI surface

### Layout — `/editor/[projectId]` (App Router route, `app/editor/[projectId]/page.tsx`)

`react-resizable-panels` three-column + bottom strip, persisted via `localStorage` layout keys:

```
┌───────────────────────────────────────────────────────────────┐
│ TopBar: ← back · Title <input> (editable, debounced save)     │
│         · undo/redo · credits · Preview ●Live · Render ▸ ⋯     │
├──────────┬───────────────────────────────────┬────────────────┤
│ left     │  Canvas: Player 1080×1920 scaled  │  right         │
│ panel    │  + react-moveable handles on the  │  Inspector     │
│ (tabs:   │  selected overlay (counter-scaled │  (contextual:  │
│ Scenes / │  grips), safe-area guides overlay │  Style · Timing│
│ Media /  │                                  │  · Animation)   │
│ Captions)│                                  │                │
├──────────┴───────────────────────────────────┴────────────────┤
│ bottom: scene thumbnail strip + playhead (from Player)         │
└───────────────────────────────────────────────────────────────┘
```

Component tree (all under `apps/web/app/editor/[projectId]/`):
- `page.tsx` — loads project, gates auth, mounts `<EditorShell projectId>`.
- `_components/EditorShell.tsx` — the panels + top bar + bottom strip, owns `PlayerRef`.
- `_components/canvas/PlayerStage.tsx` — the `<Player>` + overlay handle layer + `getScale()` bridge.
- `_components/canvas/OverlayHandles.tsx` — react-moveable wrapper (see below).
- `_components/canvas/useScale.ts` — hook wrapping `PlayerRef.getScale()` + `scalechange` +
  `ResizeObserver`, returns `{ scale, compToScreen, screenToComp }`.
- `_components/left/{ScenesPanel,MediaPanel,CaptionsPanel}.tsx` (tab switch via Radix Tabs).
- `_components/inspector/{InspectorPanel,StylePanel,TimingPanel,AnimationPanel}.tsx`.
- `_components/topbar/{TopBar,TitleInput,RenderDialog}.tsx`.
- `_components/bottom/SceneStrip.tsx`.
- `_components/RenderDialog.tsx` — shows credit cost, resolution toggle, enqueues `POST /api/jobs`.

### Player (center)

```tsx
<Player
  ref={playerRef}
  component={TemplateComponent}     // imported from the shared template bundle (see Engine section)
  inputProps={spec}                // the zustand `doc.spec` — single source of truth
  compositionWidth={1080} compositionHeight={1920} fps={30}
  durationInFrames={useMemo(() => specToFrames(spec), [spec])}
  style={{ width: '100%', height: '100%' }}
  loop controls
/>
```
- `specToFrames(spec)` = `round(sum(scenes[].durationSec) * fps)` (must match `calculateMetadata`).
- The Player re-renders the whole composition whenever `doc.spec` changes (zustand subscription),
  giving **live preview on every edit**. That's fine for TSX templates at 30fps.
- `getScale()` from the PlayerRef is the comp↔screen factor.

### Overlay handles (react-moveable)

- When an overlay is selected (`ui.selectedSceneId` + `ui.selectedOverlayId`), wrap the target in
  `react-moveable`:
  - `target` = a DOM element positioned at the overlay's comp box **translated to screen** via
    `useScale()`: `left = x*scale`, `top = y*scale`, `width = w*scale`, `height = h*scale`,
    `transform: rotate(rotation deg)`.
  - **Write-back:** on `onDrag/onResize/onRotate`, convert screen deltas back to comp:
    `comp = screen / scale`, dispatch a `doc` action updating `x/y/w/h/rotation`.
  - **Counter-scaled grips:** pass `scalable/rotatable` handle styles with `transform: scale(1/scale)`
    so corner dots stay constant-size regardless of zoom.
  - `snappable` + `snapDirections` snap to canvas edges + other overlays (P0 minimal: edges + center
    guides; P1: cross-overlay).
  - Use **zundo `temporal`-excluded `onDragStart`/`onDragEnd` coalescing** so a drag commits one
    history entry, not 60 (see Store).

### Scene stack (left · Scenes tab)

- Vertical list, each row: **thumbnail (frame-0 still or a `<Sequence>`-captured mini), duration
  stepper (±0.1s), overlay count badge, drag handle**.
- Add (appends a default 3.0s scene with zero overlays + a `visual` placeholder), Duplicate (deep
  copy with fresh ids on overlays), Delete (disabled if 1 scene remains), Reorder via
  `react-dnd` or native drag-drop (P0: simple up/down + HTML5 drag; keep `@dnd-kit/core` as the P1
  upgrade if needed).
- Selecting a scene sets `ui.selectedSceneId`; the Player seeks to that scene's start and the
  inspector + canvas target it.

### Inspector (right · contextual)

- **Nothing selected** → Project panel: theme accent (`react-colorful`), caption preset, format readout.
- **Text overlay selected** → Style tab (font picker from brand faces, size slider, `react-colorful`
  color, weight, align) · Timing tab (**Fliki range slider**: a single track spanning
  `0 → scene.durationSec` with in/out handles; values scene-relative; on change clamp end ≤ scene,
  enforce `start < end`) · Animation tab (rise/fade/pop/none).
- **Image overlay selected** → same Timing/Animation + Replace (media picker) + opacity/rotation.
- Timing slider is a small bespoke component (`components/inspector/RangeSlider.tsx`) — two thumbs
  over one track; no lib needed (keep deps lean), but `re-resizable`-style is fine if preferred.

### Captions tab (left)

- Lists `spec.voice.lines[]` as editable rows: text input, start–end readout, **±0.1s nudge**
  buttons, merge affordance when adjacent.
- **Enter-to-split:** caret position → split the line into two at the nearest word boundary,
  distributing `words[]` (and re-deriving timings via the engine's `timeWords` estimate).
- **Caption-edit contract (display-only — see "Captions vs spoken audio" box below):** a caption
  edit touches `voice.lines` (the **display** document) **only**. It does **not** re-synthesize
  audio this phase, and it does **not** pretend the render's muxed voice now speaks the edited
  text. `voice.lines` stays the single TTS source contract from Phase 3 — the same lines become
  the TTS input when Generate re-runs. Until that re-synthesis happens, edited captions are
  **display-only** and flagged as diverging from the spoken audio (banner, below). Never silently
  ship caption text that disagrees with the muxed voice.

> **Captions vs spoken audio (integration note — Phase 2 ⇄ Phase 3).**
> `spec.voice.lines` is **both** the caption document the editor shows **and** the TTS input Phase 3's
> voice stage synthesizes (the locked script → kokoro/edge via `gen_voice.py`). Phase 2 has no voice
> pipeline, so after a Phase-2 caption edit (split/merge/nudge/text change) the displayed timing/text
> can diverge from the already-muxed audio track. The editor therefore renders a **persistent
> `CaptionsPanel` banner**: *"Caption edits are preview-only and don't change the spoken audio.
> Re-generate in Generate to re-synthesize captions & voice."* The banner appears whenever any
> `voice.lines` value differs from what the render's audio actually speaks (tracked as a dirty flag
> set by every `setCaptionLine`/`splitCaption`/`mergeCaptions`/`nudgeCaption` action, cleared on a
> fresh Generate). **Phase 3's contract (unchanged, this plan only flags it):** a Generate job
> re-synthesizes `voice.lines` verbatim into the muxed audio, so after Generate the captions and
> voice agree again. Until then, a Phase-2 render **must not** claim the edited captions match what
> is heard — the render either re-times captions from the audio's word times (when those are
> available and the text is unchanged) or, when the text/timing actually changed, renders the edited
> captions only **with the divergence banner state carried into the result**, never silently.
- **Word-highlight preset picker** (pop / pill / fade) → writes `spec.captions.preset` + a
  `style` object; "apply to all" applies the current preset to every line (P1: per-line override).
- **RTL full-line rule:** if any line's text is Hebrew/Arabic (bidi check), the **preview renders
  full lines, not token pops** — the Player's caption component already handles this (`mode:'pill'`
  + `rtl` renders full pages). The editor flags it and the engine contract holds. No token-animated
  pops for RTL, ever.
- Burn-in + SRT export are **Phase 5** (not this phase) — skip.

### Media tab (left)

- `react-dropzone` dropzone (accepts image/video) → `POST /api/projects/[id]/assets` → shows a grid
  of the project's `assets` (thumbnails via `/media/<key>`).
- **Add to scene:** drag an asset onto the canvas or click "Add to scene" → inserts an image overlay
  at a default centered slot on the selected scene (`x=540,y=960,w=min(w,800),h=auto`).
- **Replace:** select an existing image overlay → "Replace" → pick an asset → **mutate only `src` /
  `assetId`, keep `id`, geometry, animation, timing** (undo stays valid; this is the spec'd
  Replace-vs-Add contract).
- Video uploads are accepted and stored but **render/pill playback is Phase 5** — for this phase a
  video asset can be placed as a still? No: **this phase only enables image overlays in-canvas**;
  video assets appear in the Media grid but "add to scene" is disabled with a "video scenes in
  Phase 5" tooltip. (Keep scope tight.)

### Bottom strip

- Scene thumbnails + a playhead synced to the Player (`frameupdate` via `useSyncExternalStore`), not
  a busy loop. Click a thumbnail → seek.
- The **collapsed mini-timeline is Phase 5** — do not build it here.

### Undo / save / conflict UX

- **Undo/redo:** `Ctrl/Cmd+Z` / `Ctrl/Cmd+Shift+Z` (or Y) via the zundo temporal store on `doc` only.
  Toast + top-bar buttons.
- **Autosave:** on `doc.spec` change (debounced 1.5s) → `PATCH /api/projects/[id]` with the spec +
  `revision`. Success → update local `revision`. `409 conflict` → toast "Newer version exists —
  reloading server copy" + prompt to reload (last-write-wins per spec; don't silently overwrite).
- **localStorage autosave:** also write `webapp:editor:<projectId>:spec` every 1.5s (try/catch) as a
  crash-recovery cache; on mount, offer "restore unsaved local copy" if it's newer than the server spec.

---

## Worker changes

Worker (port 3100) mostly inherits Phase 1. **The only phase-2-relevant worker concern:** the render
job must consume the **edited spec** from `jobs.inputJson`, pass it as `inputProps` to
`selectComposition`/`renderMedia`, and re-derive `durationInFrames` from the spec's scenes (via the
template's `calculateMetadata` — already wired in Phase 0). No new worker routes this phase.

- Confirm `inputJson` (the edited spec) is validated by `specSchema` before claim (shared via
  `packages/spec`).
- Confirm the template's `calculateMetadata` recomputes duration from the spec's scenes so a
  user-edited duration actually changes the render length.
- No python-tool orchestration here (that's Phase 3). Voice/audio are **not re-synthesized** this
  phase — the render muxes the project's existing voice track, so a caption edit does **not** change
  what is heard. That is precisely why edited captions are **display-only** and flagged: the render
  must carry the divergence state (see "Captions vs spoken audio" integration note) so it never
  claims edited caption text matches the muxed voice. Full re-synthesis (making `voice.lines` the
  spoken audio again) is Phase 3's Generate job.

---

## Engine/Remotion changes

**Goal:** the template must be **fully spec-driven** so the Player (web) and `renderMedia` (worker)
consume the identical `inputProps` JSON.

- **Prerequisite (Phase 0, verify not regressed):** the launch template (`short-16` form-card at
  minimum) exposes `defaultProps: Spec` and a `calculateMetadata` that sets `durationInFrames` from
  `scenes[].durationSec`, and renders `scenes[].overlays[]` (text via `style`/`content`, images via
  `src` with `x/y/w/h/rotation/opacity/animation`) + `voice.lines` captions (`mode` from
  `captions.preset`, `rtl` from bidi detection) + `title`.
- **No changes required to `remotion/src/lib/shorts.tsx`, `brand.ts`, `fonts.ts`, or existing shots.**
  Reuse `Captions`/`CaptionsPill` (they already take `lines`, `rtl`, `mode`, `accent`), `SAFE`,
  `prog`, `brandSpring`, and the RTL contract (`stripNikkud`, `anchorRtl`, `unicodeBidi:isolate`).
- **New (Phase 0, confirm present):** a shared **overlay renderer** (a small `OverlayRenderer.tsx`
  in `remotion/src/lib/` or inside the template) that maps a `Scene.overlays[]` entry to the DOM:
  position/rotate by `x/y/w/h/rotation`, gate visibility by scene-relative `start/end`, apply
  `animation` via the brand easings. The web Player imports the **same** component (not a duplicate).
- **Templates consumed by web:** the web app imports the template component + spec types from the
  monorepo. To avoid web depending on `remotion/`'s build, Phase 0/1 established the pattern — web
  imports from a path (e.g. `remotion/src/shots/short-16/Short16Formy.tsx` and its `defaultProps`)
  directly through the workspace (Remotion's Player renders React components in-browser; no bundling
  needed for preview). Verify this wiring works (see Test plan).
- **No renderer code changes this phase** unless the Phase-0 template gap surfaces — fix the
  template, not the editor.

---

## Infra & env (docker-compose, .env)

**No new services.** Reuse Phase 1's `webapp/docker-compose.yml` (postgres :5432, mailhog
:1025/:8025). Add to `webapp/apps/web/.env.local` (or extend Phase 1 `.env` — same values):

```env
# from Phase 1 (already present)
DATABASE_URL=postgres://shorts:shorts@localhost:5432/shorts
AUTH_SECRET=...                        # openssl rand -base64 32
STORAGE_DIR=../../.storage             # local-disk root (shared web<->worker volume/path)
NEXT_PUBLIC_WORKER_URL=http://localhost:3100
NEXT_PUBLIC_STORAGE_BASE=/media        # served by web
# new this phase (nothing cloud — all localhost)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- **Editor-specific deps** (add to `apps/web/package.json`):
  - `@remotion/player@4.0.515` (Player in-browser)
  - `react-resizable-panels@^2.1.x`
  - `react-moveable@^0.6x` (latest stable; check version at install)
  - `zustand@^4.5.5`, `immer@^10.1.1`, `zundo@^2.2.x`
  - `react-dropzone@^14.3.5`
  - `sonner@^1.5.0`, `lucide-react@^0.4xx`, `react-colorful@^5.6.1`
  - (shadcn/Radix components already installed in Phase 1; add `@radix-ui/react-tabs`,
    `@radix-ui/react-slider`, `@radix-ui/react-dialog` if not present)
  - dev: `@types/react-dropzone` if needed
- `packages/spec` and `packages/db` deps are unchanged (shared).
- npm workspaces wiring (`webapp/package.json`) already includes `apps/web`, `apps/worker`,
  `packages/spec`, `packages/db` (Phase 1) — no change.

---

## Task list (P0 must / P1 nice, ordered, checkboxed)

**P0 — must (in order; each step leaves a runnable slice):**

- [ ] **T0. Verify spec-driven template** — confirm the Phase-0 template renders from `inputProps`
  in both the Player and `renderMedia`; fix template gaps. (Gate for everything below.)
- [ ] **T1. Editor route + shell** — `app/editor/[projectId]/page.tsx` loads project/spec, mounts
  `EditorShell` with `react-resizable-panels` 3-col + bottom strip + TopBar. Empty-state canvases.
- [ ] **T2. Store** — `zustand`+`immer` slices `doc`/`ui`/`playback`; `zundo` `temporal` on `doc`
  with coalescing; actions: `setTitle`, `upsertOverlay`, `addScene`, `duplicateScene`,
  `removeScene`, `moveScene`, `setSceneDuration`, `updateOverlay`, `removeOverlay`,
  `setCaptionLine`, `splitCaption`, `mergeCaptions`, `nudgeCaption`, `setCaptionPreset`,
  `addAssetRef`, `replaceAsset`.
- [ ] **T3. Player live preview** — mount `<Player>` fed `doc.spec`; `specToFrames`; seek on scene
  select; `useScale` hook (`getScale()` + `scalechange` + `ResizeObserver`).
- [ ] **T4. Title editing** — TopBar `<input>` debounced → `PATCH .../title` + spec `title`; Player +
  dashboard reflect it.
- [ ] **T5. Scenes panel** — add/duplicate/reorder/delete + duration stepper; all write `doc.spec.scenes`.
- [ ] **T6. Overlay handles** — react-moveable drag/resize/rotate over scaled Player; px↔screen
  round-trip; counter-scaled grips; `onDragStart/End` coalesced for single undo entry.
- [ ] **T7. Add text + image overlays** — Text tab presets; Media tab upload→add; default-centered
  slot on selected scene.
- [ ] **T8. Inspector** — Style (font/size/color/weight/align), Timing (Fliki range slider,
  scene-relative, clamped), Animation (rise/fade/pop/none), opacity/rotation. All wired to `doc`.
- [ ] **T9. Captions panel** — line list, inline edit, Enter-to-split, hover merge, ±0.1s nudge,
  preset picker + apply-to-all, RTL full-line rule respected in preview, **+ the display-only
  contract**: every caption action sets a captions-dirty flag → a persistent "preview-only,
  re-generate in Generate" banner shows whenever `voice.lines` has diverged from the muxed audio;
  the render path carries that state so edited captions are never silently presented as matching
  the spoken audio.
- [ ] **T10. Autosave + conflict** — debounced localStorage + server PATCH with `meta.revision`;
  409 → "newer version" toast + reload; undo/redo buttons + shortcuts.
- [ ] **T11. Render the edited spec** — RenderDialog → `POST /api/jobs` with `inputSpec` = current
  `doc.spec`; poll progress; dashboard card ready; mp4 downloads and matches the preview.
- [ ] **T12. QA pass** — manual verification script below; fix regressions.

**P1 — nice (only after P0 green):**

- [ ] Snapping/guidelines to other overlays (moveable `snapDirections` + snap element targets).
- [ ] Thumbnails in the scene strip (frame-0 stills per scene) instead of plain chips.
- [ ] Per-line caption style override (beyond "apply to all").
- [ ] `@dnd-kit/core`-based smooth drag-reorder with animations.
- [ ] Restore-unsaved-local-copy prompt on mount (conflict-aware).
- [ ] Keyboard: `Space` play/pause, `Cmd+D` duplicate, `Del` delete selected overlay.
- [ ] Persisted panel layout via `localStorage` keys.

---

## Risks & gotchas

| # | Risk | Mitigation |
|---|---|---|
| 1 | **Player/`getScale()` timing** — scale is 0/undefined before first frame; overlay handles jump | Read scale only after `Player` reports ready; guard `scale===0 → hide handles`; recompute on `scalechange` + `ResizeObserver` (not just resize). |
| 2 | **Moveable writes 60 history entries per drag** | `zundo` coalescing: begin on `onDragStart`, end on `onDragEnd`; intermediate frames mutate live but commit once. Test: one undo undoes the whole drag. |
| 3 | **Overlay `end > scene.durationSec` after duration edit** | Duration stepper clamps overlays (or the validator clamps on save); range slider enforces `start<end`, `end≤durationSec`. |
| 4 | **Autosave race / lost work** | revision last-write-wins; localStorage crash cache; on 409 show server spec + reload, never silently overwrite. Debounce 1.5s + flush on `beforeunload`. |
| 5 | **RTL captions** | Preview must render full lines for RTL (engine contract: no token pops). Detect bidi per line; set `mode:'pill'`+`rtl`. Never reverse word arrays. |
| 6 | **Preview ≠ render (drift)** | Both consume the identical `inputProps` JSON; `specToFrames` must match `calculateMetadata` exactly or the preview length differs from render — assert in tests. |
| 7 | **Image uploads not on render path** | The render worker must read `/media/<key>` from the shared `STORAGE_DIR`; the overlay `src` must be a URL the worker can fetch (`/media/...` resolved to the shared path). Verify a placed image appears in the mp4. |
| 8 | **Video overlay stubbed this phase** | Keep scope: video assets upload + list but "add to scene" is disabled (tooltip "Phase 5"). Don't half-build video playback. |
| 9 | **Player re-render cost on every keystroke** | Fine at 30fps for TSX; if sluggish, debounce title/text input writes or isolate `doc` writes from the Player props (P1). |
| 10 | **React 18 + Remotion Player version pin** | Keep `@remotion/*` at **4.0.515** (matches engine). Don't let npm float to a newer major. |
| 11 | **Moveable + scaled container pointer math** | Compute from the wrapper's actual scale each event (never cache a stale scale across a resize mid-drag). |
| 12 | **Caption text ≠ spoken audio after a Phase-2 edit** — `voice.lines` is both the caption document and Phase 3's TTS input; a split/nudge/edit here does not re-synthesize the muxed voice, so the rendered captions can disagree with what is heard. | Enforce the display-only contract: every caption action sets a dirty flag → persistent "preview-only, re-generate in Generate" banner; the render path carries the divergence state instead of silently claiming a match; Phase 3 (re-synthesis) is the only thing that clears the flag. Never ship caption text that contradicts the muxed voice. |

---

## Test plan

### Unit tests (`vitest` in `packages/spec` + `apps/web` — P0 T12)
- **spec validators:** valid Spec passes; image overlay missing `assetId`/`src` → error; text
  overlay missing `content` → error; overlay `end > durationSec` → clamp/error; `normalizeSpec`
  fills defaults.
- **timing utils:** `specToFrames(spec)` == `sum(durationSec)*fps`; `clampOverlayToScene` bounds
  `end`; scene reorder keeps overlay `start/end` unchanged (scene-relative invariant).
- **undo reducer:** perform 3 doc edits → 2 undos → state equals after-1st-edit; a moveable drag
  (many micro-mutations) coalesces to **one** history entry.
- **captions:** split at word boundary distributes `words[]` with correct count; merge recombines;
  bidi detection flags Hebrew line as RTL.

### Integration tests (`playwright` — P0)
- `/editor/[id]` renders; Player shows frame 0; title input updates Player text; adding a text
  overlay shows it on canvas; scene duplicate doubles scene count and duration; caption split adds a
  row.
- Autosave: edit → wait 2s → `PATCH` fired with bumped revision; simulate 409 → toast shown.

### e2e — **exact manual verification steps** (run once, in order)
1. `docker compose up -d` (webapp root) · `npm run dev` (apps/web) · `npm run worker` (apps/worker).
   All three up: web :3000, worker /health :3100, postgres :5432.
2. Open `http://localhost:3000`, sign in via the MailHog magic link (`http://localhost:8025`).
3. From the dashboard open a Phase-1 template project (has a spec with scenes + voice lines).
   Confirm the editor loads and the **Player plays** the unmodified spec (frame 0 thumbnail visible).
4. **Title:** change the title in the TopBar → Player hook overlay text changes → dashboard card
   title updates after save.
5. **Scene duration:** select a scene, bump `durationSec` +0.5s → Player total duration increases →
   save → reload page → duration persisted.
6. **Reorder:** drag scene 3 before scene 1 → preview order flips, captions/timing stay correct
   (scene-relative invariant).
7. **Text overlay:** add a text overlay to scene 2 → drag it to top-left, resize, rotate → Player
   shows it live at the new geometry; counter-scaled grips stay constant-size while zooming the
   canvas.
8. **Image overlay:** Media tab → drop a PNG → thumbnail appears → Add to scene → drag/resize on
   canvas. Then **Replace** with a second image → id/geometry/animation/timing retained (only pixels
   change); press undo → first image back.
9. **Timing:** open the selected overlay's Timing tab → Fliki range slider in/out → Play → overlay
   appears/disappears exactly in that scene-relative window.
10. **Captions:** open Captions tab → inline-edit a line's text → preview caption text updates and
    the **"preview-only, re-generate in Generate" banner appears** (the dirty flag is set — audio is
    unchanged); put caret mid-line → **Enter splits** into two rows; hover a pair → merge; nudge a
    line +0.1s → caption timing shifts. **RTL project** (the form-card Hebrew template): confirm
    captions render as **full lines**, never token pops.
11. **Undo/redo:** make several edits → `Cmd+Z` steps back one logical edit per press (a drag = one
    step); `Cmd+Shift+Z` redoes.
12. **Autosave + conflict:** edit → wait 2s → confirm PATCH + revision bumped (devtools Network).
    Open a second tab, edit there, then edit in the first tab → "newer version exists" toast; reload
    → server (newer) version shown.
13. **Render the edited version:** click Render → confirm credit quote → submit → progress % climbs
    (poll 2s) → job `done` → dashboard card flips to ready → **download the mp4** → play it: title,
    added text/image overlay, and moved overlay geometry appear in the rendered file, matching the
    live preview. **Caption edits** appear on screen too, **but** because the render muxes the
    project's existing voice (not re-synthesized this phase), the rendered caption text may differ
    from what is heard — the render carries the divergence state (banner flagged on the result) and
    **never** presents the edited captions as matching the muxed voice. Full caption↔voice agreement
    returns only after a Phase-3 Generate re-synthesizes the edited `voice.lines`.
14. Reload `/editor/[id]` → all edits persisted (localStorage restore prompt only if a *newer* local
    copy exists).

---

## Agent brief

> **Copy-paste the block below verbatim as the system prompt / task for the executing agent.**

---

**You are implementing Phase 2 — the Editor — of the shorts web app in the monorepo at
`C:/source/shorts-with-claude/claude-faceless-shorts-creator`. Read, in this order, before writing
any code: (1) `webapp/plans/_shared-decisions.md` — LOCKED invariants you MUST NOT contradict; (2)
`webapp/plans/phase-2-editor.md` — this plan, your spec; (3) `WEBAPP-PLAN.md` §2.3–2.5 & §5 for the
editor's intended UX and the exact library picks; (4) as needed: `brand.md`, `remotion/src/lib/shorts.tsx`
(caption/RTL contract — reuse `Captions`/`CaptionsPill`, `SAFE`, `prog`, `stripNikkud`, `anchorRtl`),
`remotion/src/shots/short-16/Short16Formy.tsx`, `remotion/package.json`, `tools/gen_voice.py`.**

**Context.** Phase 0 converted the launch template (form-card / `short-16`) to a spec-driven
renderer exposing `defaultProps: Spec` + `calculateMetadata` (durationInFrames from `scenes`).
Phase 1 built: Next.js 15 app at `webapp/apps/web` (port 3000), workspace packages
`webapp/packages/spec` (zod Spec/Scene/Overlay) and `webapp/packages/db` (drizzle `projects`,
`assets`, `jobs`), Auth.js v5 magic-link via MailHog, local-disk storage at `webapp/.storage/`
served at `/media/<key>`, `GET/PATCH /api/projects/[id]`, `POST /api/jobs` + render worker on port
3100. You build the editor on top. Ports: web 3000 · worker 3100 · postgres 5432 · mailhog 1025/8025.

**Your deliverable.** `/editor/[projectId]` — the full editing surface. Live Player preview fed the
same `inputProps` JSON the render worker consumes; scene stack; text/image overlays with
react-moveable over the scaled Player; right inspector (style / Fliki range-slider timing /
animation); captions panel (inline edit, split/merge/nudge, presets, RTL full-line rule); title
editing; media upload (react-dropzone → local disk → add/replace, replace keeps id/geometry);
zustand+immer store (doc/ui/playback slices) + zundo undo on doc + debounced autosave (localStorage +
revision-stamped last-write-wins server sync).

**Hard invariants (do not break):**
- Overlay `start/end` are **scene-relative seconds**; `x/y/w/h` are **composition px (1080×1920)**.
- Player ↔ render consume the **identical `inputProps` spec**; `specToFrames` MUST equal the
  template's `calculateMetadata`.
- `@remotion/*` pinned to **4.0.515** (matches the engine). React 18. Do not float Remotion majors.
- **RTL captions render as full lines, never token pops.** Reuse the engine's RTL contract
  (`stripNikkud`, `anchorRtl`, `unicodeBidi:isolate`, `mode:'pill'`).
- Replace-vs-Add: **Replace mutates only `src`/`assetId`, keeps `id`, geometry, animation, timing.**
- **Caption edits are display-only.** `voice.lines` is both the caption document and Phase 3's TTS
  input. Editing it here does NOT re-synthesize audio, so any caption edit sets a dirty flag → a
  persistent "preview-only, re-generate in Generate" banner. A render must carry the divergence
  state and **never silently ship caption text that disagrees with the muxed voice** (see this
  plan's "Captions vs spoken audio" integration note).
- `meta.revision` increments per persisted edit; server PATCH is last-write-wins; 409 → "newer
  version exists" toast + reload, never silent overwrite.
- Everything localhost. No new tables. Do **not** build Phase 3 (generate), 4 (billing/AI), or 5
  (mini-timeline, SRT export, video-overlay playback).

**Exact libraries:** `@remotion/player@4.0.515`, `react-resizable-panels`, `react-moveable`,
`zustand@^4` + `immer` + `zundo`, `react-dropzone`, `sonner`, `lucide-react`, `react-colorful`,
shadcn/Radix (`tabs`, `slider`, `dialog`), Tailwind v4. Add to `apps/web/package.json`.

**Ordered steps (T0 → T12):** T0 verify the spec-driven template renders from `inputProps` in both
Player and `renderMedia` (fix the template if broken — this gates everything). T1 editor route +
panels shell. T2 store (slices + actions + zundo coalescing). T3 Player + `useScale` (`getScale()` +
`scalechange` + `ResizeObserver`, guard `scale===0`). T4 title editing. T5 scenes panel. T6 overlay
moveable handles (counter-scaled grips; coalesce drag to ONE undo entry). T7 add text/image. T8
inspector incl. Fliki range slider. T9 captions panel. T10 autosave + conflict + undo UI. T11 render
the edited spec via `POST /api/jobs`. T12 QA pass. P1 items only after all P0 green.

**Commands to develop:**
```
# repo root
docker compose up -d          # from webapp/ (postgres, mailhog)
npm install                   # webapp/ (workspaces)
npm run dev --workspace=web   # web :3000   (or: cd apps/web && npm run dev)
npm run worker --workspace=worker   # worker :3100
npm run typecheck && npm run lint   # clean before done
npm test                      # vitest unit tests
npx playwright test           # integration/e2e
```

**Prove done — run the manual verification script in this plan's "Test plan → e2e" (steps 1–14).**
You must end at step 14 with a **downloaded mp4** that plays back the user's edited title, added
text overlay, moved/resized image overlay, and caption edits — matching the live preview — plus
`typecheck` + lint clean and the unit/integration suites green. Report the edited-spec render as your
exit artifact. Do not stop until step 14 passes end-to-end.

---
