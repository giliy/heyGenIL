# Phase 0 — Spec-driven refactor

> Build a spec-driven renderer for the engine. Locked invariants live in
> `webapp/plans/_shared-decisions.md` (monorepo layout, ports, Spec type, engine contract, DoD) —
> this plan references, never re-decides, those. **Pure engine + `packages/spec` — no web UI yet**
> (that is Phase 1+). Everything on localhost.
>
> The load-bearing change from `WEBAPP-PLAN.md` §0/§3/§7: today's compositions are hardcoded TSX
> with **no `defaultProps`/`inputProps`**. Phase 0 converts the form-card (`short-16`) and the chess
> niche kit (`short-1`) into **`inputProps`-driven templates** that render a scene/overlay `Spec`,
> and ships the render-worker **precursor** script that bundles once + renders from a spec JSON file
> with zero new TSX.

---

## Goal

Turn two existing compositions into **spec-driven template renderers** and prove the end-to-end
"hand-written `spec.json` → rendered mp4, no new `.tsx`" path the whole product depends on.

Specifically:

1. **`packages/spec`** — the TS port of `tools/contracts.py`'s role: TS types + **zod** schemas +
   validators for the `Spec` (superset of `beats.json`) from `_shared-decisions.md`. Shared by the
   future web & worker; consumed by the templates and the worker script.
2. **Generic overlay renderer** in `remotion/src/lib/` — maps a `Scene[]`/`Overlay[]` spec to
   absolutely-positioned Remotion elements, reusing the **existing brand motion presets**
   (`prog`, `EASE_OUT`, `brandSpring`, `SAFE`, `stripNikkud`, `anchorRtl`, `FONT_*` from
   `lib/shorts.tsx` + `polish.tsx`).
3. **Refactor `short-16` (form-card) + `short-1` (chess)** to accept `inputProps: Spec` + `defaultProps`
   + `calculateMetadata` (durationInFrames from last scene end), **moving every user-editable string and
   timing constant out of the TSX and into the spec** (scenes from beats; BigTitle/Kicker/CTA/copy as
   text `overlays[]`; captions from `spec.voice.lines`; loop-restore from the last scene's end) so an edit
   to the spec visibly changes the render.
4. **Worker precursor** `webapp/apps/worker/render-spec.mjs` — bundles `remotion/` once and renders a
   composition from a **spec JSON file path**, reusing `render-all.mjs`'s pinned headless-shell Chrome
   + `concurrency:'75%'` + `onProgress`.

**Exit artifact:** `node render-spec.mjs --spec spec.json --template Short16Formy` produces a
playable mp4 from a hand-written spec — no new TSX written for that video.

---

## Why this phase first / Dependencies

- **Dependencies (engine reality, already present):**
  - Remotion **4.0.515**, React 18 (`remotion/package.json`, all `@remotion/*` pinned).
  - `render-all.mjs` already proves the programmatic path: `bundle()` (+ `publicDir: ../media`) →
    `selectComposition` → `renderMedia` with pinned Chrome, `concurrency:'75%'`, `onProgress`.
  - Brand motion presets + RTL caption contract already in `lib/shorts.tsx` / `lib/polish.tsx`.
  - `registry.gen` (from `gen-registry.mjs`) discovers `compositionConfig` + default component;
    `Root.tsx` maps each to a `<Composition>`. **We must extend these to pass `defaultProps` and
    wire `calculateMetadata`.**
  - `tools/contracts.py` is the Python validator seam we port to TS/zod.
- **Why first:** every later phase (web editor, generate pipeline, render worker, billing) consumes
  the `Spec` and the spec-driven templates. Doing the refactor first means Phase 1's render button,
  Phase 2's Player preview, and Phase 3's generate job all talk one contract and one render path.
  It's the biggest structural change, so it must land before the UI wraps it.
- **No cross-phase build-out:** no web routes, no DB, no auth, no billing, no job table. Those are
  Phase 1+. We only build what Phase 1+ imports: `packages/spec` + the spec-driven engine + the
  standalone render precursor.

---

## Exit criteria (definition of done)

Per `_shared-decisions.md` §DoD, plus phase-specific:

- [ ] `packages/spec` builds; `npm run typecheck` clean across `webapp/`.
- [ ] Zod spec validator rejects malformed specs (bad overlay type, out-of-range `start/end`, missing
      required fields) with precise messages — covered by unit tests.
- [ ] `short-16` (`Short16Formy`) and `short-1` (`Short1Chess`) render **identically or near-identically**
      when fed their existing `beats.json` content mapped to a `Spec` via `defaultProps` AND via an
      external `spec.json` through the worker — no new TSX.
- [ ] `calculateMetadata` computes `durationInFrames` from the last scene end (verified: changing a
      scene's `durationSec` changes the rendered length).
- [ ] **Text + timing are spec-driven (no hardcoded user-editable strings):** editing a `defaultProps`
      spec's **text** (a BigTitle/Kicker/CTA/copy overlay's `content`), a scene's `durationSec`, or a
      `voice.lines` caption produces a **visibly different** render — the exact property Phase 2's editor
      relies on. Verified in Studio and via render-spec (see T0.13).
- [ ] The generic overlay renderer supports **text + image**, `x/y/w/h/rotation/opacity`,
      scene-relative `start/end` → `<Sequence>` mapping, entrance animations **rise/fade/pop**, and
      **RTL text handling** (full-line RTL, `stripNikkud` + `anchorRtl`, Hebrew-capable font).
- [ ] **Exit artifact:** `node render-spec.mjs --spec <handwritten>.json --template Short16Formy`
      renders an mp4 to `webapp/apps/worker/out/`, frame 0 fully composed (thumbnail rule), last
      frame == frame 0 (seamless loop). Player preview of the same spec renders the same frames.
- [ ] A second spec JSON (different scenes/overlays) renders a *different* video through the **same**
      template — proving no-per-video-TSX.
- [ ] `npm run typecheck` + lint clean; spec-validator unit tests pass; manual QA frames read.

---

## Data model changes

**No DB, no `packages/db` (Phase 1).** The only "model" this phase adds is the **Spec document**
already locked in `_shared-decisions.md` §Project spec. Deliver it as the `packages/spec` workspace
package:

```
webapp/packages/spec/
  package.json          # name: "@shorts/spec", main: dist/index.js, types: dist/index.d.ts
  tsconfig.json         # strict, composite, outDir dist
  src/
    types.ts            # Spec, Scene, Overlay, OverlayText, OverlayImage, CaptionsConfig, AudioConfig, VoiceConfig (re-exported types only)
    schema.ts           # zod schemas mirroring types.ts (the source of truth for runtime validation)
    validators.ts       # parseSpec(json) / validateSpec(spec) -> {ok} | throws ZodError; getDurationSec(spec)
    index.ts            # re-exports
```

**Spec shape (copy the invariant, don't re-derive)** — from `_shared-decisions.md`:

```ts
type Overlay = {
  id: string;
  type: 'text' | 'image';
  content?: string;                              // text only
  style?: { font?: string; size?: number; color?: string; weight?: number; align?: string };
  assetId?: string; src?: string;                // image only (src = resolved URL at render)
  x: number; y: number; w: number; h: number;    // comp px, 1080×1920
  rotation?: number; opacity?: number;
  start: number; end: number;                    // SCENE-RELATIVE seconds (0..scene.durationSec)
  animation?: 'rise' | 'fade' | 'pop' | 'none';
};
type Scene = { id: string; durationSec: number; beatId?: string; visual?: string; overlays: Overlay[] };
type Spec = {
  id: string; title: string; template: string; engine: 'tsx' | 'ai';
  format: { width: number; height: number; fps: number };
  theme: { accent?: string; font?: string };
  voice?: { engine: 'kokoro'|'edge'|'elevenlabs'; voiceId: string;
            lines: { text: string; start: number; end: number; words?: {w:string;start:number;end:number}[] }[] };
  scenes: Scene[];
  captions?: { preset: 'pop'|'pill'|'fade'; burnIn: boolean; style?: Record<string,unknown> };
  audio?: { sfx?: { id: string; at: number; gainDb?: number }[]; music?: { id: string; duck?: boolean } };
  meta: { revision: number; updatedAt: string };
};
```

**Zod invariants to enforce** (these are the `contracts.py` port):
- `type` is `'text'` | `'image'` (discriminated union; `content` required for text, `src|assetId` for image).
- `start >= 0` and `end <= scene.durationSec` and `end > start` (per overlay, **scene-relative**).
- `x/y` within `[0, format.width/height]` allowed but not required (anchors can be center-based); warn not fail on out-of-bounds `w/h` (text can overflow). Enforce `w>0,h>0`, `0<=opacity<=1`, `rotation` any number.
- `scenes` non-empty; each `durationSec > 0`.
- `format` width/height/fps positive; `engine` in `('tsx','ai')`.
- `meta.revision` is a non-negative integer.
- `getDurationSec(spec)` = `sum(scenes.durationSec)` — the value `calculateMetadata` uses (scenes are back-to-back; no inter-scene gaps in this model).

> **Cross-phase note:** zod schema here is authoritative for later phases' API payload + job-input
> validation. Keep it exported from `@shorts/spec` and unit-test it now.

---

## API routes

**None.** Phase 0 is engine + package only. The web app has no HTTP surface yet (that's Phase 1).
The only "endpoints" this phase exposes are the **template components' props contract** and the
**worker script's CLI**, not HTTP routes.

---

## UI surface

**None.** No web app UI in Phase 0. The only interactive surface is the **Remotion Studio** (already
at port 3101+, unchanged) used to *manually verify* the refactored templates via their `defaultProps`,
and the **CLI** of `render-spec.mjs`. Phase 1 wires the web UI + Player.

---

## Worker changes

Precursor only — a **standalone script**, not the Phase-1 job loop. No DB claim, no Postgres, no
`jobs` table, no billing.

**File:** `webapp/apps/worker/render-spec.mjs` (plain Node, ESM; imports `@remotion/bundler` +
`@remotion/renderer` by path, exactly like `render-all.mjs`).

**Role:** the reference render path Phase 1's worker wraps in a job. One bundle per template+version
(cached via `TEMPLATE_CACHE_DIR`), then `selectComposition` + `renderMedia` with the **same pinned
headless-shell Chrome, `concurrency:'75%'`, `onProgress`** as `render-all.mjs`.

**CLI contract:**
```
node render-spec.mjs --spec <path-to-spec.json> --template Short16Formy [--out out/out.mp4] [--fps 30] [--scale 1]
```
- Reads + validates the spec JSON with `@shorts/spec` (zod) → **fails fast with the ZodError path**,
  no render, exit 1 (this is the contract seam — malformed spec must never reach Chrome).
- Resolves the **`serveUrl`** by bundling `remotion/` once: `bundle({ entryPoint: remotion/src/index.ts,
  publicDir: remotion/../media })`, cached keyed by `template + remotion/package.json version +
  bundle-mtime`.
- `selectComposition({ serveUrl, id: template, inputProps: spec, browserExecutable })`.
- `renderMedia({ serveUrl, composition, inputProps: spec, outputLocation, codec:'h264', pixelFormat:'yuv420p',
  imageFormat:'jpeg', crf:21, concurrency:'75%', browserExecutable, onProgress })`.
- Writes `out/<template>-<spec.id>.mp4`; logs final path.

**Reuse from `render-all.mjs` (copy, don't refactor the engine script):** the `resolvePinnedShell()`
logic (incl. worktree fallback + `REMOTION_BROWSER_EXECUTABLE` override). Duplicating ~25 lines is
safer than coupling the new app script to the engine's bulk renderer.

**Engine path resolution:** worker resolves `remotion/` root as `path.resolve(import.meta.url, ../../..)`
(the `webapp/apps/worker` → `webapp` → repo-root layout). `packages/spec` is resolved via the
`webapp/package.json` workspace symlink (`@shorts/spec`). Requires `webapp` install run so the
workspace links exist (see Infra).

---

## Engine/Remotion changes

All under `remotion/`. **Keep every existing non-template shot untouched** (they must still render).

### 1. `remotion/src/lib/spec-renderer.tsx` (NEW) — the generic overlay renderer

Reuses brand motion + RTL helpers from `lib/shorts.tsx` and `lib/polish.tsx` — do **not** reimplement
the presets.

```tsx
import type { Spec, Scene, Overlay } from '@shorts/spec';   // via webapp workspace (see packaging note below)
```

**Packaging note (critical gotcha):** `remotion/` is a **separate package.json** from `webapp/`.
To import `@shorts/spec` types into remotion we add a `paths`/type-only import. **Prefer a
type-only + zod-value dependency through a relative path OR a workspace link.** The robust option:
add `"@shorts/spec": "file:../webapp/packages/spec"` to `remotion/package.json` AND a tsconfig
`paths` alias. The renderer needs only **types** + `getDurationSec` at runtime; to avoid a hard
build-order coupling we vendor the two tiny runtime helpers (`getDurationSec`, `clampProg`) locally
and import only **types** from the package (types don't need the package built). **Decision:**
- Runtime: define `getDurationSec`/`prog` locally in `spec-renderer.tsx` (they're 5 lines; duplicating
  a pure helper is acceptable and avoids bundler/build-order coupling).
- Types: `import type { Spec, Scene, Overlay } from '@shorts/spec'` with a tsconfig `paths` mapping
  `@shorts/spec` → `../../webapp/packages/spec/src/index.ts` so the compiler reads source types
  directly (no build needed for typecheck).
- zod runtime validation stays **in the worker** (Node side) and in the future web API — not bundled
  into remotion (keeps the bundle lean, avoids shipping zod into the browser bundle for free-tier).

**Exports:**
```tsx
export const OverlayLayer: React.FC<{ overlay: Overlay; scene: Scene; localFrame: number; fps: number }>
export const SceneOverlays: React.FC<{ scene: Scene; sceneStartFrame: number; fps: number }>
export const RenderSpecOverlays: React.FC<{ spec: Spec }>   // maps spec.scenes[] to <Sequence>s + overlays
```

**Scene-relative → Sequence mapping (the invariant):**
- Total duration = `sum(scenes.durationSec)`. Each scene `i` starts at global frame
  `sceneStartFrames[i] = round(Σ_{j<i} scenes[j].durationSec * fps)`.
- Wrap each scene in `<Sequence from={sceneStartFrames[i]} durationInFrames={round(scenes[i].durationSec*fps)}>`.
- Inside the sequence, `useCurrentFrame()` is LOCAL; an overlay's window is
  `localStart = round(ov.start*fps)`, `localEnd = round(ov.end*fps)`; render only while
  `localFrame >= localStart && localFrame < localEnd`.
- Overlay layout uses **`AbsoluteFill`** container (matches composition 1080×1920); each overlay is
  an absolutely-positioned div at `left/top/width/height` from `x/y/w/h`, with `transform:
  rotate(Ndeg)`, `opacity` base.

**Entrance animations** (brand §5, calm/premium — reuse `EASE_OUT` + `brandSpring`):
- `rise`: opacity 0→1 + `translateY 24px→0` over ~7 frames, ease-out.
- `fade`: opacity 0→1 over ~7 frames.
- `pop`: `scale 0.94→1` + opacity over ~8 frames (max 1.06 per brand).
- `none`: static.
- Animations keyed to `prog(localFrame, localStart, localStart+7/8)` — deterministic, frame-repeat safe.

**Text overlay rendering:**
- Font: `style.font` maps to a known face — `'display'`→`FONT_DISPLAY_H`, `'body'`→`FONT_BODY_H`,
  `'mono'`→`FONT_MONO`, `'hebrew'`→`FONT_HEBREW`/`FONT_HEBREW_CAPTION`; default `FONT_DISPLAY_H`.
  Apply `style.size`, `color` (default white), `weight`, `align` (default center).
- **RTL:** when `style.align === 'right'` OR `style.font === 'hebrew'`, set `direction:'rtl'` on the
  element, wrap content with `stripNikkud(text)` and apply `unicodeBidi:'isolate'` on the text node.
  **Render the FULL line** (never token-split) — matches the RTL invariant in `_shared-decisions.md`
  §Captions ("RTL captions render full lines (no token pops)"). Reuse `stripNikkud` + `anchorRtl` +
  `RLM` from `lib/shorts.tsx`.

**Image overlay rendering:**
- `<Img src={ov.src} style={{...}}>` (or `OffthreadVideo` if src is a video later — Phase 2+).
- `objectFit:'cover'` within the w×h box by default; `opacity`, `rotation` applied on the wrapper.
- If `src` missing but `assetId` present, render nothing + console.warn (asset resolution is Phase 2).

### 2. `remotion/src/lib/template-utils.ts` (NEW) — `calculateMetadata` helper

```ts
import type { Spec } from '@shorts/spec';
export const specDurationFrames = (spec: Spec) => Math.round(spec.scenes.reduce((a,s)=>a+s.durationSec,0) * spec.format.fps);
export const specDimensions = (spec: Spec) => ({ width: spec.format.width, height: spec.format.height });
```
Reused by both templates' `calculateMetadata`.

### 3. Refactor `remotion/src/shots/short-16/Short16Formy.tsx`

**All user-editable text and timing must be spec-driven — nothing user-facing stays hardcoded.**
The form-card *chrome* (the persistent card + niche visual) stays a template scene (`visual` cue),
but every visible string and every timing constant must come from the `Spec`.

- **Emit scenes from the beats:** `defaultProps: Spec` is built from the existing `beats.json`, one
  `Scene` per beat (`durationSec`, `beatId`, `visual`), in order. Do **not** keep any
  `HOOK_END`/`PAIN_END`/`BUILDER_END`/`SIGN_END`/`LOGIC_END`/`INTEG_END`/`CTA_END` frame constants in
  the template — scene boundaries derive from `spec.scenes[].durationSec`.
- **Move every visible string into `overlays[]` (text type):** the hook title (currently `BigTitle`
  `'צריך להחתים'`/`'הרבה לקוחות?'`), the intro wordmark + tagline, the builder/signature/logic
  field labels, the kickers (`'גרירה ויזואלית'`, `'חתימה דיגיטלית חוקית'`, `'לוגיקה מותנית'`), the
  integration chip labels, and the CTA copy all become text overlays in their scene. Their
  `x/y/w/h`, `style` (font/size/color/weight/align), and scene-relative `start/end` are set so the
  render matches today's layout. **Do not leave any of this text compiled into `Short16Formy`.**
- **Captions are spec-driven:** keep using the existing `Captions` (pill/pop) fed by
  `spec.voice.lines` (the `VoLine[]` shape matches exactly — `{text,start,end,words?}`). RTL flag
  from `spec.captions`/`theme` (as today). The caption **`y`** is no longer the hardcoded `1560` —
  derive it from the format (e.g. `format.height - SAFE`) or from `spec.captions.style`. The caption
  frame-override (`frameOverride`) and its reset come from the spec's scene timeline, not a fixed
  frame constant.
- **Loop-restore from the spec:** replace the hardcoded `loopRestore = prog(frame, F(35.6), F(36))`
  (and the `ProgressBar resetAt={F(35.6)}`) with a value derived from the **last scene's end**
  (`specDurationFrames(spec)`). Frame 0 == last frame loop still holds, but the restore window moves
  with the spec's actual duration instead of a baked `F(35.6)`.
- Signature: `const Short16Formy: React.FC<{ spec?: Spec }> = ({ spec = defaultProps })`.
  Read `spec.format`, `spec.scenes`, `spec.theme.accent`, `spec.voice.lines` (captions), `spec.captions`.
- `calculateMetadata`:
  ```ts
  export const calculateMetadata = async ({ props }) => ({
    durationInFrames: specDurationFrames(props.spec ?? defaultProps),
    fps: (props.spec ?? defaultProps).format.fps,
    width: ...format.width, height: ...format.height,
  });
  ```
- **Split**: keep `compositionConfig` (registry discovery) but ALSO export the component + metadata so
  `Root.tsx` can wire `defaultProps` + `calculateMetadata`.

### 4. Refactor `remotion/src/shots/short-1/Short1Chess.tsx`

Same props/`calculateMetadata` treatment. **Scope guard:** the chess *board* (moves/highlights) is a
niche `visual` asset driven by `scene.visual` + the existing `lib/chess.tsx`; we do **not** re-encode
the board as generic overlays in this phase. What becomes spec-driven:
- `defaultProps: Spec` derived from `shorts/short-1-chess/beats.json` (scenes from `beats[]`,
  overlays = the text elements the spec can express).
- Hook title / pain / CTA / stat chips that are plain text become `text` overlays via the renderer;
  the board + `ChessBoard` + `BoardMove` timeline stays the niche scene visual.
- `calculateMetadata` identical pattern (duration from scenes).

### 5. `remotion/src/Root.tsx` + `gen-registry.mjs` — wire `defaultProps` + `calculateMetadata`

- `gen-registry.mjs` currently reads only `compositionConfig`. **Extend** (backward-compatible) to
  also capture optional `defaultProps` + `calculateMetadata` exports per shot file, and emit them in
  `registry.gen.tsx` alongside `Comp`/`config`.
- `Root.tsx`: pass `defaultProps={cfg.defaultProps}` and `calculateMetadata={cfg.calculateMetadata}`
  to each `<Composition>` when present (skip for legacy shots that lack them — they keep rendering as
  today).
- After editing, run `cd remotion && npm run gen` to regenerate the registry (the CLAUDE.md rule).

### 6. Sample spec JSON fixtures (NEW)

- `webapp/apps/worker/fixtures/short-16.spec.json` — a hand-written `Spec` reproducing the form-card
  short (scenes + overlays + voice lines + captions + theme). This is the proof fixture.
- `webapp/apps/worker/fixtures/second.spec.json` — a **different** spec (different overlays/scenes,
  maybe an image overlay referencing a `media/library` logo) proving one template renders many videos.
- `webapp/apps/worker/fixtures/bad-timing.spec.json` — a deliberately malformed spec (an overlay with
  `start > scene.durationSec`) proving `render-spec.mjs` fails fast with a ZodError and **no** Chrome
  launch (the contract seam). Referenced by the agent brief's exact verification commands.

---

## Infra & env (docker-compose, .env)

**No Docker in Phase 0** — no Postgres/MailHog/MinIO needed (those are Phase 1+; `docker-compose.yml`
ships in Phase 1). Phase 0 needs only:

**`webapp/package.json`** (workspace root):
```json
{
  "name": "shorts-webapp",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "render:spec": "node apps/worker/render-spec.mjs"
  }
}
```
**`webapp/tsconfig.json`** — project references + strict; includes `packages/spec`, `apps/worker`.

**`webapp/packages/spec/package.json`**: name `@shorts/spec`, `dependencies: { zod: "^3.23.8" }`,
`devDependencies: { typescript: "^5.9.3", vitest: "^2.1.9" }`. `"main": "./dist/index.js"`,
`"types": "./dist/index.d.ts"`, `"scripts": { "build": "tsc -p tsconfig.json", "test": "vitest run" }`.

**`webapp/apps/worker/package.json`**: name `@shorts/worker`, `dependencies: {
  "@shorts/spec": "file:../../packages/spec", "@remotion/bundler": "^4.0.515",
  "@remotion/renderer": "^4.0.515", "zod": "^3.23.8" }`. `"type": "module"`.

**`.env`** (Phase 0 needs none of the paid keys — but **PEXELS/PIXABAY not needed** either; the
fixtures reference `media/library` local assets only). No `.env` required for Phase 0 render.

**Node version note:** worker + spec package use the repo's Node v24.18.0. The **voice/aligner
python is NOT needed in Phase 0** (we pass `voice.lines` straight into captions — no TTS run).

**Install/build sequence (exact):**
```bash
cd webapp && npm install          # creates workspace symlinks incl. @shorts/spec
cd packages/spec && npm run build # build zod schemas/types to dist
cd ../.. && npm run typecheck
```

> **Pinning note:** `@remotion/bundler`/`@remotion/renderer` in `apps/worker` must match the engine's
> pinned `4.0.515` — install them at `^4.0.515` but **pin-lock** (the engine already locks). This is
> the one place two package.jsons touch Remotion; the worker renders the engine's bundle, so versions
> must agree.

---

## Task list

### P0 — must (ordered)
- [ ] **T0.1** Scaffold `webapp/` workspaces: `package.json` (workspaces), `tsconfig.json`,
      `packages/spec/` (package.json, tsconfig, src/), `apps/worker/` (package.json, tsconfig). `npm install`.
- [ ] **T0.2** `packages/spec`: `types.ts` (Spec/Scene/Overlay/…), `schema.ts` (zod), `validators.ts`
      (`parseSpec`, `getDurationSec`), `index.ts`. `npm run build`.
- [ ] **T0.3** `packages/spec` unit tests (vitest): valid spec passes; each invariant violation fails
      with the right path; `getDurationSec` sums correctly; RTL overlay shape accepted.
- [ ] **T0.4** `remotion/src/lib/spec-renderer.tsx` — `OverlayLayer`, `SceneOverlays`, `RenderSpecOverlays`
      (text/image, x/y/w/h/rotation/opacity, scene-relative Sequence, rise/fade/pop, RTL full-line).
- [ ] **T0.5** `remotion/src/lib/template-utils.ts` — `specDurationFrames`, `specDimensions`.
- [ ] **T0.6** Extend `gen-registry.mjs` + `Root.tsx` to pass `defaultProps`/`calculateMetadata` when a
      shot exports them (backward compatible). `cd remotion && npm run gen`.
- [ ] **T0.7** Refactor `Short16Formy.tsx` → props + `defaultProps` (from beats.json) + `calculateMetadata`,
      overlays through `RenderSpecOverlays`, captions from `spec.voice.lines`. **Every visible string and
      timing becomes spec-driven:** scenes emitted from beats, BigTitle/Kicker/IntegChips/CTA/copy text in
      `overlays[]` (text), caption block from `spec.voice.lines` + `captions.preset`/rtl + format-derived `y`,
      loop-restore from the last scene's end (no `HOOK_END`/`F(35.6)`/`y={1560}` constants).
- [ ] **T0.8** Refactor `Short1Chess.tsx` → props + `defaultProps` + `calculateMetadata` (board stays a
      niche visual; text overlays through the renderer).
- [ ] **T0.9** Write fixtures `short-16.spec.json` + `second.spec.json` (one with an image overlay from
      `media/library`) + `bad-timing.spec.json` (an overlay `start > scene.durationSec`, for the fail-fast
      contract test).
- [ ] **T0.10** `webapp/apps/worker/render-spec.mjs` — CLI, `@shorts/spec` validation, cached bundle,
      pinned Chrome, `selectComposition`/`renderMedia` with `inputProps`, `onProgress`, output to `out/`.
- [ ] **T0.11** QA: render frames at phone scale (`qa_frames.mjs` or `render-all.mjs --still`) and READ
      them; verify frame 0 composed + last==frame 0.
- [ ] **T0.12** **Exit artifact**: `node render-spec.mjs --spec fixtures/short-16.spec.json
      --template Short16Formy` → playable mp4; then the `second.spec.json` renders a *different* video
      through the same template. Prove no-TSX.
- [ ] **T0.13** Manual Studio check: both templates' `defaultProps` render in `remotion studio`; a
      modified `defaultProps` (change a `durationSec`, add an overlay, **edit a text overlay's `content`**)
      shows the new length/frames **and the new text**. This proves the property Phase 2's editor relies on:
      editing a spec text/timing changes the render.
- [ ] **T0.14** `npm run typecheck` + lint clean across `webapp/`; document the plan file's
      cross-phase assumptions.

### P1 — nice (only if P0 is green and time allows)
- [ ] **T1.1** `render-spec.mjs` gains `--still <frame>` to emit a poster PNG (frame 0) — Phase 1's
      dashboard thumbnail path, proven early.
- [ ] **T1.2** `--progress-json <path>` to stream `onProgress` to a JSON file (the seed of the Phase 1
      job-progress poll).
- [ ] **T1.3** A third fixture exercising `animation:'pop'` + `rotation` on an image overlay.
- [ ] **T1.4** Zod error formatter that prints a human "scene 3 overlay 2: start(5.0) > end(4.0)" line
      (nicer than raw ZodError).

---

## Risks & gotchas

| Risk | Mitigation |
|---|---|
| **Bundle/workspace coupling** — remotion importing `@shorts/spec` from a separate package.json | Import only **types** from `@shorts/spec` via tsconfig `paths` (source read, no build needed); keep runtime helpers (`getDurationSec`, `prog`) local in `spec-renderer.tsx`. zod stays Node-side (worker), never bundled into remotion. |
| **Registry breakage** — `gen-registry.mjs` is regex-based over `compositionConfig`; extending it could miss legacy shots | Make new fields optional; a shot without `defaultProps`/`calculateMetadata` emits them as undefined and `Root.tsx` skips them → legacy shots render exactly as today. Run `npm run gen` + confirm all 22 existing ids still listed. |
| **`calculateMetadata` on `<Composition>`** — React/Remotion wiring details | Follow Remotion 4.x: pass `defaultProps` and `calculateMetadata` directly on `<Composition>`; metadata returns `{durationInFrames,fps,width,height}`. Keep `compositionConfig` duration as the legacy fallback so `render-all.mjs` still works if metadata isn't wired. |
| **RTL overlay layout** — bidi reordering / nikkud | Reuse the proven `stripNikkud` + `anchorRtl` + `RLM` + `unicodeBidi:'isolate'` from `lib/shorts.tsx`; render full lines, never token-split. Test with the short-16 Hebrew fixture. |
| **Scene-relative vs global** — the recurring engine bug | Enforce the invariant in the renderer (each scene in its own `<Sequence>`; `localFrame` inside; `localStart/localEnd` from `ov.start/end`). Never compute overlay times in global frames. |
| **Frame 0 / loop contract** | First scene's overlays must be present at local frame 0 (use `start:0` / `warm`-style pre-rolled) so frame 0 is fully composed; last scene must restore frame-0 state (brand §6 + CLAUDE.md loop rule). Fixtures honor this; QA reads frame 0 + last. |
| **Chrome pinning drift** in the worker script | Copy `resolvePinnedShell()` verbatim from `render-all.mjs` (worktree fallback + `REMOTION_BROWSER_EXECUTABLE`). Don't refactor the engine script. |
| **Font loading in headless render** | Only `@remotion/google-fonts` faces already used by the engine (Space Grotesk/Inter/JetBrains Mono/Heebo/Rubik). The renderer's `font` map references only these — no new font host. |
| **Duration changes not propagating** | `calculateMetadata` is the single source; verify by changing `durationSec` in `defaultProps` and observing the Studio/render length change (T0.13). |
| **User-editable text left hardcoded in TSX** | The form-card refactor must move every visible string (BigTitle/Kicker/IntegChips/CTA/copy) into scene `overlays[]` (text), drive captions from `spec.voice.lines` + format-derived `y`, and derive loop-restore from the last scene's end — no `HOOK_END`/`F(35.6)`/`y={1560}` constants. Exit check (T0.13 + the "text + timing spec-driven" criterion) proves an edit changes the render. |
| **Two Remotion package.json versions drifting** | Pin `@remotion/bundler`/`@remotion/renderer` in worker to `4.0.515` and document that they must match the engine. |

---

## Test plan

### Unit (vitest, `packages/spec`)
- `spec.valid` — a complete valid spec passes `parseSpec` and returns typed Spec.
- `spec.missingTemplate` — rejects with `/template/` in error.
- `spec.badOverlayType` — `type:'video'` rejects.
- `spec.overlayTimingOOR` — `start > scene.durationSec` rejects with the overlay path.
- `spec.overlayZeroBox` — `w:0` rejects.
- `spec.opacityOOR` — `opacity:1.5` rejects.
- `spec.getDuration` — 3 scenes of 3+4+2s @30 → `durationInFrames` 270.
- `spec.rtlText` — a Hebrew text overlay (align right, font hebrew) parses.

### Integration (engine, manual + script)
- `render-all.mjs` still renders all legacy shots after the registry change (regression).
- Both refactored templates render via `renderMedia` with `inputProps = defaultProps` — pixel-compare
  frame 0 and mid frames against a pre-refactor render (should match or near-match).
- `render-spec.mjs` end-to-end (see manual below).

### E2E / manual verification steps (exact)
1. `cd webapp && npm install && cd packages/spec && npm run build && cd ../.. && npm run typecheck` → clean.
2. `cd packages/spec && npm test` → all unit tests green.
3. `cd remotion && npm run gen` → registry lists all 22 ids; then `npm run studio` (or open
   `remotion studio src/index.ts`) → verify `Short16Formy` + `Short1Chess` render from `defaultProps`;
   scrub the timeline; confirm frame 0 composed, last frame ≈ frame 0.
4. Edit `defaultProps`: change a scene `durationSec` → Studio duration changes (metadata wired); **change a
   text overlay's `content` (e.g. the hook title) → the rendered text visibly changes**; change a
   `voice.lines` caption → the caption text changes. This is the exact property Phase 2's editor relies on.
5. **Exit artifact:**
   ```bash
   cd webapp
   node apps/worker/render-spec.mjs --spec apps/worker/fixtures/short-16.spec.json --template Short16Formy
   node apps/worker/render-spec.mjs --spec apps/worker/fixtures/second.spec.json --template Short16Formy
   ```
   → two mp4s in `apps/worker/out/`; open both; confirm they differ and render their specs' overlays.
6. **Malformed spec fails fast:**
   `node apps/worker/render-spec.mjs --spec apps/worker/fixtures/bad-timing.spec.json --template Short16Formy`
   → exits 1, prints ZodError path, **no** Chrome launched (proves the contract seam).
7. **No-new-TSX proof:** point out that `short-16.spec.json` + `second.spec.json` produced two different
   videos with zero `.tsx` changes between them.
8. QA frames: `cd remotion && node scripts/qa_frames.mjs Short16Formy 0,<scene-boundaries>,last --scale=0.333`
   → READ the JPEGs (frame 0 = thumbnail, last == frame 0).

---

## Agent brief

> Copy-paste this block as the execution prompt for the Phase 0 agent.

---

**Phase 0 — Spec-driven refactor. Execute exactly, in order, on `C:/source/shorts-with-claude/claude-faceless-shorts-creator`. Read these first: `webapp/plans/_shared-decisions.md` (locked invariants — don't contradict), `webapp/plans/phase-0-spec-refactor.md` (this plan), `remotion/scripts/render-all.mjs` (render path to reuse), `remotion/src/lib/shorts.tsx` + `lib/polish.tsx` (brand motion + RTL presets to reuse).**

**Constraints (hard):**
- Pure engine + `packages/spec`. **No web UI, no DB, no auth, no billing, no job table, no docker** (all Phase 1+).
- Run everything from the **repo root** (CLAUDE.md). Remotion templates must NOT break the 22 existing shots.
- Spec shape = `_shared-decisions.md` §Project spec, verbatim. Overlay `start/end` are **scene-relative seconds**.
- Reuse existing brand presets (`prog`, `EASE_OUT`, `brandSpring`, `stripNikkud`, `anchorRtl`, `RLM`, `SAFE`, `FONT_*`) — do not reimplement.
- `render-spec.mjs` copies `render-all.mjs`'s pinned Chrome + `concurrency:'75%'` + `onProgress` + `publicDir: ../media`.
- Remotion stays on `4.0.515`; worker pins the same `@remotion/bundler`/`@remotion/renderer`.

**Invariants to preserve:**
- Frame 0 fully composed (thumbnail); last frame == frame 0 (seamless loop).
- RTL captions/overlays render **full lines** with `stripNikkud`+`anchorRtl`+`unicodeBidi:'isolate'` — never token-split.
- Scene-relative timing only; each scene in its own `<Sequence>`; `localFrame` inside.

**Ordered steps (P0):**
1. Scaffold `webapp/` workspaces + `packages/spec` + `apps/worker` package.jsons/tsconfigs; `cd webapp && npm install`.
2. Implement `packages/spec`: `types.ts`, `schema.ts` (zod), `validators.ts` (`parseSpec`, `getDurationSec`), `index.ts`; `npm run build`.
3. Write `packages/spec` vitest unit tests (T0.3 list); `npm test`.
4. `remotion/src/lib/spec-renderer.tsx` — generic overlay renderer (text+image, x/y/w/h/rotation/opacity, scene-relative Sequence, rise/fade/pop, RTL).
5. `remotion/src/lib/template-utils.ts` — `specDurationFrames`/`specDimensions`.
6. Extend `gen-registry.mjs` + `Root.tsx` for optional `defaultProps`/`calculateMetadata` (backward compatible); `cd remotion && npm run gen`; confirm 22 ids.
7. Refactor `Short16Formy.tsx` (form-card) — `defaultProps` from `shorts/short-16-formy/beats.json`, `calculateMetadata`, overlays via renderer, captions from `spec.voice.lines`. **No user-editable string or timing stays hardcoded:** scenes from beats; BigTitle/Kicker/IntegChips/CTA/copy text into `overlays[]` (text); caption block from `spec.voice.lines` + `captions.preset`/rtl + format-derived `y` (not `y={1560}`); loop-restore from the last scene's end (not `F(35.6)`); no `HOOK_END`/beat-window constants.
8. Refactor `Short1Chess.tsx` — same props/`calculateMetadata`; board stays a niche `visual`, text overlays via renderer.
9. Write fixtures `apps/worker/fixtures/short-16.spec.json` + `second.spec.json` (second includes an image overlay from `media/library`) + `bad-timing.spec.json` (overlay `start > scene.durationSec`, for the fail-fast test).
10. `apps/worker/render-spec.mjs` — CLI (`--spec --template [--out]`), zod-validate spec (fail fast, no Chrome), cached bundle, pinned Chrome, `selectComposition`+`renderMedia` with `inputProps`, `onProgress`.
11. QA: `cd remotion && node scripts/qa_frames.mjs Short16Formy 0,<boundaries>,last --scale=0.333` → **READ** the frames.
12. Verify **exit artifact** and regression (below).

**Exact verification commands:**
```bash
# from repo root
cd webapp && npm install && cd packages/spec && npm run build && cd ../.. && npm run typecheck
cd packages/spec && npm test
cd ../remotion && npm run gen          # 22 ids still listed
node scripts/render-all.mjs            # regression: legacy shots still render
# exit artifact:
cd ../webapp
node apps/worker/render-spec.mjs --spec apps/worker/fixtures/short-16.spec.json --template Short16Formy
node apps/worker/render-spec.mjs --spec apps/worker/fixtures/second.spec.json --template Short16Formy
# malformed spec fails fast (no Chrome):
node apps/worker/render-spec.mjs --spec apps/worker/fixtures/bad-timing.spec.json --template Short16Formy  # expect exit 1 + ZodError
```

**Prove done (DoD):**
- `npm run typecheck` + lint clean; spec unit tests green; legacy shots still render.
- Two different mp4s produced from two spec JSONs through the SAME template, **zero new .tsx**.
- `calculateMetadata` drives duration (changing a scene `durationSec` changes the render length — verified in Studio and via render).
- **Text + timing are spec-driven:** editing a `defaultProps` text overlay `content`, a caption, or a scene `durationSec` produces a visibly different render (no hardcoded `HOOK_END`/`F(35.6)`/`y={1560}` strings left in `Short16Formy`).
- Frame 0 composed + last==frame 0 confirmed by READ QA frames.
- Report: files added/changed, the two output mp4 paths, the zod rejection output, and any assumption you had to make that the plan didn't cover.

---
