# Phase 3 — Generate wizard (orchestrate as a job)

> **Goal:** the "New video" space. A 4-step wizard (input topic/script → template pick →
> script review/edit+lock → style/voice pick) that inserts a `type='generate'` job. The worker
> runs a **TS port of `.claude/skills/orchestrate/`** — `story → voice ∥ pixel → build → qa → mix` —
> calling the existing python tools (kokoro/edge voice, `contracts.py`, `audio_gate`, `mix_sfx`,
> `mix_music`) and the engine build. Per-stage progress surfaces by polling the job row. A
> **script-review step** lets the user edit the exact VO lines before render (script fidelity
> differentiator). **Cost stated before any paid pixel (fal)** — but on the FREE tier this is
> TSX templates + kokoro/edge voice only, so generation works **fully offline-of-paid-APIs**.
> **Exit:** type a topic, review+lock a script, get a finished downloadable short end-to-end.

All layout/ports/DB/spec/storage/auth/billing/job-flow invariants come from
`plans/_shared-decisions.md` — **this plan references them, never re-decides them.** Only
`type='generate'`-specific additions live here.

---

## Goal

A user lands on `/generate`, types a topic (or pastes a script), picks a template, edits + locks
the exact VO lines, picks voice/style, hits **Generate**, and watches a live per-stage progress
view (`story → voice → pixel → build → qa → mix`) while the worker orchestrates the pipeline.
When it finishes, the project is `ready`, openable in the Phase-2 editor, and the mp4 is
downloadable from the dashboard.

**Scope discipline:** this phase builds the wizard + the generate **worker orchestration + the
progress/done UI**. It does **not** build billing, paid tiers, AI-image scene generation, or the
editor itself — those are Phases 4/2. On the free tier (the only tier Phase 3 supports) there is
**no fal spend**; the pixel stage is a no-op for TSX templates (the template's TSX *is* the
pixels). Cost display still appears (it will read `$0.00` on free) so the "cost before pixels"
gate is already wired for Phase 4.

---

## Why this phase first / Dependencies

- **Depends on Phase 1** (jobs table + worker process + claim loop + storage module + job-status
  polling) and **Phase 0** (templates parametrized via `inputProps: Spec` + `calculateMetadata`).
  Both must be landed; this phase reuses their seams wholesale.
- **Depends on Phase 2** (the editor) *only* for "open the result to edit it" — but the phase's
  exit artifact (downloadable mp4) does **not** require the editor. Build the wizard against the
  Phase-0/1 seams; the "Open in editor" button is a stub until Phase 2 lands.
- It comes **before** Phase 4 (billing) so the *orchestration* is proven headless before money is
  involved. All cost/gate code is written to be a no-op at free tier and only *activated* by
  Phase 4.

---

## Exit criteria (definition of done)

- [ ] `docker compose up -d` (postgres, mailhog) + `npm run dev` (web :3000) + `npm run worker`
      (:3100) all come up clean on localhost.
- [ ] Logged-in user goes `/generate`, types a topic, picks the `form-card` template, reviews and
      **edits** the script text, locks it, picks a free kokoro/edge voice + caption preset, and
      clicks Generate.
- [ ] A `type='generate'` job appears; the UI shows a live stage spinner `story → voice → pixel →
      build → qa → mix` with a per-stage progress bar, polled every 2s from `GET /api/jobs/[id]`.
- [ ] The pipeline runs **end-to-end with zero paid-API keys** (no `FAL_KEY`, no
      `ELEVENLABS_API_KEY` needed) via kokoro/edge voice + TSX template. The worker renders the
      mp4, runs `audio_gate`, and sets `status='done'` with `outputKey`.
- [ ] The dashboard card flips to `ready` with a playable/downloadable mp4 (served at
      `/media/<outputKey>`).
- [ ] A script-fidelity check: the mp4 captions/VO speak **exactly** the user-edited script
      (edit a line, re-generate, hear the edited line).
- [ ] `npm run typecheck` + lint clean; unit tests pass (spec validators, job transition helper,
      orchestrate stage-writer); a scripted e2e smoke (`scripts/smoke-generate.mjs`) inserts a
      job and asserts it reaches `done`.
- [ ] The plan's manual verification steps (below) all pass.

---

## Data model changes

`packages/db/src/schema.ts` already defines `projects` + `jobs` (Phase 1). Phase 3 **extends**
(never renames — shared-decisions rule):

| Table/col | Change | Purpose |
|---|---|---|
| `jobs.type` | value `'generate'` (Phase 1 enum already includes it) | no schema change |
| `jobs.stage` | already `text` — Phase 3 defines the **canonical stage string set** | `story`, `voice`, `pixel`, `build`, `qa`, `mix`, `render` |
| `projects.status` | already `'generating'` | reused unchanged |
| `jobs.inputJson` | for `generate`, holds the **wizard payload** (see below), not a raw spec | no schema change |
| `jobs.resultJson` | on done, holds `{ spec, projectId, outputKey, stages: StageReport[] }` | no schema change |

**No new columns/tables.** The orchestration state lives in:
- `jobs.stage` — current stage (drives the spinner)
- `jobs.progress` — 0..1 within the current stage (voice line i/n, build % from `onProgress`)
- `jobs.error` — human message on `failed`

The generated **spec** is stored on the `projects.specJson` row (same place the editor reads it
in Phase 2) plus an absolute working dir resolved from a per-project scratch root.

**Working-directory contract** (the worker's orchestrate layout, under `STORAGE_DIR`):
```
<STORAGE_DIR>/generate/<projectId>/
  input.json        # wizard payload (the seed for the story stage)
  beats.json        # story output (superset of the engine contract) — the machine handoff
  script.md         # story output (human brief) — optional but nice
  voice/            # gen_voice output: line-*.mp3/.wav + voice.wav (gitignored-style, regenerable)
  sfx-plan.json     # sfx cue sheet (may be empty events[] on free tier for phase-3 scope)
  build/            # silent master mp4 + qa-contract.json + qa-verdicts.json
  out/              # final mixed mp4
```
The **canonical final mp4** is copied to `<STORAGE_DIR>/<projectId>/<assetId>.mp4` (the Phase-1
storage layout) and its key written to `projects.outputKey` + a `jobs.resultJson.outputKey`.

---

## API routes

All under Next.js App Router, same auth + zod validation discipline as Phase 1/2.

| Method + path | Body/params | Returns | Notes |
|---|---|---|---|
| `POST /api/generate` | `{ topic, template, script? (pre-script), voice: {engine, voiceId}, captions: {preset}, theme?, title? }` | `{ projectId, jobId }` | Creates `projects(status='draft')` + `jobs(type='generate', status='queued')`. Validates payload via `packages/spec` zod schema. **Quotes cost (free ⇒ 0cr) and records it in the job row** — reserve hook ready for Phase 4. |
| `POST /api/generate/script` | `{ topic, template, script? }` | `{ beats }` | **Story-stage preview**: drafts `beats.json` (vo lines + beats + duration) **without** creating a project/job. This powers the script-review step *before* Generate. Implemented as an in-request call to the story module (or a lightweight inline LLM call) — see Worker changes. No paid pixels. |
| `GET /api/generate/templates` | — | `[{ id, name, compId, previewUrl, theme }]` | Template registry (from `packages/spec` + Phase-0 template map). Free tier lists TSX templates only. |
| `GET /api/generate/voices` | — | `[{ id, engine, name, tier }]` | Free tier: `kokoro` + `edge` voices only (`tier:'free'`). ElevenLabs rows come with Phase 4. |
| `GET /api/jobs/[id]` | — | `{ status, stage, progress, error, projectId, outputUrl? }` | **Already built in Phase 1** — Phase 3 just adds `stage` to the response shape (it's already a column). Poll every 2s. |
| `GET /api/projects/[id]` | — | project incl. `status`, `specJson` | Reuse from Phase 1/2. |

Wizard flow maps: step 2 calls `POST /api/generate/script` (cheap draft); step 4 calls
`POST /api/generate` (enqueues the real job). The **locked script** (from step 3) is passed in
the generate payload so the worker's story stage starts from user text rather than re-deriving it
— that is what makes script fidelity deterministic.

---

## UI surface

New route **`/generate`** under the protected app shell (left nav "New video"). A linear 4-step
wizard with a stepper header. Tailwind v4 + shadcn/ui + Radix, brand tokens from `brand.md`,
`sonner` toasts, `lucide-react` icons. No new heavy libs.

```
/generate
  Step 1 · Input        topic textarea (or "paste a script" toggle) + Title field
                        template picker (cards: form-card + 1 niche kit, thumbnails from Phase 0)
  Step 2 · Script       (POST /api/generate/script) shows the drafted beat sheet:
                        numbered VO lines + per-beat visual + estimated duration
                        → EDIT lines inline (script fidelity), reorder, add/remove
                        → "Lock script" commits (stores locked vo[] in component state)
  Step 3 · Style/voice  voice picker (kokoro/edge free list), caption preset (pop/pill),
                        accent color (theme), aspect 9:16 (fixed this phase)
                        → live cost line ("Free tier · $0.00") from the quote
  Step 4 · Generate     review summary → POST /api/generate → redirect to
                        /projects/[id]/progress (live stage view)
```

**Progress view `/projects/[id]/progress`** (also reachable from a dashboard card when a project
is `generating`): a vertical stage list `story → voice → pixel → build → qa → mix → render` with
check/current/pending states, a per-stage bar (progress from the job row), the running stage's
subtext (e.g. "Synthesizing voice line 4/9"), and on `done` a poster + playable `<video>`
pointing at `/media/<outputKey>` + a "Download" button + an **"Open in editor"** button (stub →
Phase 2). On `failed`: show `jobs.error`, a retry button that re-enqueues with the same locked
script, and (Phase 4) the auto-refund notice.

**Script-review interaction detail** (the differentiator): the VO line list in step 2 shows the
exact strings that will be spoken. Each line is an editable textarea; edit → "unsaved" badge →
"Lock script" snapshots. Because the worker's voice stage consumes the *locked* lines (via the
generate payload, not by re-prompting), the rendered VO **matches what the user approved**. Show
a note: "The video will speak exactly these lines."

---

## Worker changes

`apps/worker/` gets the orchestrate implementation. Structure:

```
apps/worker/src/
  index.ts               # boot: connect db, poll queue, health on :3100 (Phase 1 already has this)
  orchestrate/
    types.ts             # StageReport, GeneratePayload, stage-string constants
    writer.ts            # updateJobsStage() — stage/progress heartbeat (shared, small)
    stages/
      story.ts           # produce beats.json (+ vo[] draft) from payload
      voice.ts           # gen_voice kokoro/edge -> voice.wav + word times; contracts
      pixel.ts           # TSX templates: NO-OP (assets are the TSX). ai => Phase 4. states cost.
      build.ts           # npm run gen + bundle + renderMedia silent master; qa-contract
      qa.ts              # qa_frames JPEGs -> qa-verdicts.json (contracts.py)
      mix.ts             # voice mux -> sfx -> music, audio_gate after each
      render.ts          # final mp4 copy + poster still -> storage
    engine.ts            # wrapper over @remotion/renderer (bundle cache + selectComposition + renderMedia)
    py.ts                # spawn python tools via a per-tool TOOL_VENV map, env, path resolvers
```

**Stage runner** — a single async `runGenerate(job, payload)` that walks the stages in order,
writes heartbeat via `writer.ts`, and on any throw marks `jobs.status='failed'` + `error`. Every
stage boundary validates its handoff with `contracts.py` (the TS port in `packages/spec` is for
the *web* API; the worker additionally shells the python `contracts.py` on the real files, keeping
parity with the engine's gate discipline).

### Story stage (`story.ts`)
- Input: wizard payload `{ topic, template, script? (locked vo[]), title? }`.
- If a **locked script** was passed, build `beats.json` directly from it: split the lines into
  beats (hook = line 0, etc.), assign estimated `start/end` at ~2.7 words/sec with the slack rule,
  set `format` from the template. **No LLM required** — this path is fully deterministic, offline,
  and that is what guarantees script fidelity.
- If only a `topic` was given (no pre-script), produce a beat sheet from the topic. Phase 3's
  pragmatic implementation: a **rules-based beat template** seeded by the topic/title (hook →
  pain → intro → how-it-works → proof → start-line), writing placeholder-but-sensible VO lines
  the user then edits in step 2 before locking. (The optional richer story-writer is a P1: call an
  LLM via `GEMINI_API_KEY` *if present* — never required for the happy path.)
- Emit `beats.json` + `script.md`, validate with `contracts.py beats`.
- **No paid spend.** Stage `story` complete.

### Voice stage (`voice.ts`)
- Pick interpreter by engine: `kokoro`/`edge` ⇒ `.venv-voice312\Scripts\python.exe` + the
  corresponding tool (`tools/gen_voice.py --engine kokoro` or `tools/gen_voice_edge.py`); both are
  **zero-key, $0**.
- Run, e.g.:
  ```
  .venv-voice312\Scripts\python.exe tools/gen_voice.py --beats <dir>/beats.json \
      --engine kokoro --voice <voiceId> --emit-ts <template>/vo.gen.ts
  ```
  (kokoro ships exact per-token word times; edge uses its own path. Both write `voice.wav` and
  update `beats.json` `vo[].words`.)
- **audio_gate** on `voice.wav` (non-silent) before proceeding — a silent voice is a hard stop.
- Update `projects.specJson.voice.lines` with the real `words` (the spec the render consumes).
- Sub-progress: report `progress = lineIndex / totalLines` as each line is fit.

### Pixel stage (`pixel.ts`) — FREE TIER NO-OP
- For `engine:'tsx'` templates the "pixels" are the template's own TSX — **nothing to spend, no
  fal call**. Write a one-line `asset-manifest.json` (empty layers) so the contract seam is
  preserved, validate with `contracts.py manifest`, and report `costCredits=0` on the job.
- **Manifest contract is verified, not assumed:** `tools/contracts.py` already owns a `manifest`
  validator (`validate_asset_manifest`), registered under `_VALIDATORS["manifest"]` — the pixel→build
  seam is not phase-0-orphaned. For a TSX template the worker writes the six required keys
  (`project`, `track`, `layers`, `clips`, `hero`, `cost`) with `layers: []` / `clips: []`; the
  validator's per-layer/per-clip `file` existence checks only run over non-empty entries, so an
  empty manifest passes cleanly. The free happy path therefore calls a **real, confirmed** validator
  — no `engine:'tsx'` gate is needed. State this in `stages/pixel.ts` with a comment so the seam is
  explicit rather than silently assumed.
- The **cost-before-pixels gate** is here: before any future ai pixel call, the worker asserts the
  quoted cost (reserved at submit) is sufficient. On the free tier this always passes trivially.
  The gate is *written* now, *armed* by Phase 4. P1 stub: if `engine:'ai'` is somehow passed,
  refuse with "AI pixels unlock in the paid tier" (never spend unquoted).

### Build stage (`build.ts`)
- `cd remotion && npm run gen` (Phase 0 already parametrized the template; this regenerates
  registry/`vo.gen.ts` from the just-written file).
- `engine.ts`: `bundle({ entryPoint, publicDir: media })` **cached per template+version** (the
  biggest cost lever — reuse Phase 1's bundle cache); `selectComposition`; `renderMedia` a **silent
  master** to `<dir>/build/silent.mp4` with `concurrency:'75%'`, pinned headless-shell, `crf:21`,
  `codec:'h264'`. Feed `onProgress → writer.progress` (map 0..1 into the `build` stage window).
- Write `qa-contract.json` (compId, master, frame list from beat boundaries + frame 0, loop
  f0/flast, scale 0.333, jpegQuality) → `contracts.py qa-contract`.

### QA stage (`qa.ts`)
- Run `remotion/scripts/qa_frames.mjs <CompId> <f,...> --scale=0.333` (small JPEGs).
- The worker does **not** read pixels into context (mirrors orchestrate's discipline). It writes
  `qa-verdicts.json`. Phase 3's **auto-QA** = the `audio_gate` on the final mux + a structural
  check that the render completed and the master's duration matches the spec. Frame **content**
  verdicting stays a P1 (a `qa` agent/heuristic that flags FAIL on missing/blank frames — can be a
  cheap perceptual-hash vs frame-0 check). `contracts.py qa-verdicts` runs on whatever is written.
- QA FAIL ⇒ retry loop bounded (max 2): re-run build with a note; FAIL again ⇒ `failed` + error.

### Mix stage (`mix.ts`)
- **Voice mux**: resolve ffmpeg via `tools/ffw.py` (NEVER bare ffmpeg — the silent-AAC trap), mux
  `build/silent.mp4` + `voice.wav` → `mix/voiced.mp4`. `audio_gate` after.
- **SFX** (P1, since library cue-sheeting is manual in the engine): if a `sfx-plan.json` was
  authored for the template (or P1 heuristic), run `mix_sfx.py`; else skip gracefully. `audio_gate`.
- **Music** (P1, optional per video): if a bed is chosen, `mix_music.py --bed … --base voiced.mp4`
  → final. Else final = `voiced.mp4`. `audio_gate` each.
- Final mp4 → copy to `<STORAGE_DIR>/<projectId>/<assetId>.mp4`, write `outputKey`, `durationSec`,
  `width/height/fps` on the project, set `status='ready'`, `jobs.status='done'`, fill
  `resultJson = { spec, outputKey, stages }`.

**Health/claim** stays Phase 1's model (`FOR UPDATE SKIP LOCKED` or poll); Phase 3 only fills the
`generate` branch of the claim handler.

---

## Engine/Remotion changes

Phase 3 itself **touches the engine minimally** — it *consumes* Phase 0's parametrized templates
and Phase 1's render path. The one new engine-adjacent artifact:

- **A per-template `vo.gen.ts` write**: `gen_voice` needs a concrete `--emit-ts` target. Phase 0
  should make each launch template a folder under `remotion/src/shots/<template>/` importing a
  `vo.gen.ts` (Phase 0 already parametrizes via `inputProps`; the `vo.gen.ts` is how the *captions*
  get the real word times). Phase 3's worker writes that file at build time from the voice stage.
- **No changes to `short-16`/`form-card` composition logic** — it already renders from `VO` +
  `inputProps`. If Phase 0 left the captions reading a hardcoded `VO` import, the worker overwrites
  that file; if it made captions read `inputProps.voice.lines`, the worker populates those. **This
  is the single seam Phase 3 must confirm with Phase 0.** (Assumption flagged: Phase 0 wires
  captions to `inputProps` so `vo.gen.ts` becomes optional; if not, worker writes `vo.gen.ts`.)
- `qa_frames.mjs` and `render-all.mjs` are **reused verbatim** (worker imports the render logic, or
  shells them) — no edits.

---

## Infra & env (docker-compose, .env)

No new services. `docker-compose.yml` already has postgres + mailhog (Phase 1). Additions:

- **`webapp/.env`** (already `.env.example`-documented): nothing new *required* for the free happy
  path. Optional for P1 richer story: `GEMINI_API_KEY`. Never require `FAL_KEY` / `ELEVENLABS_API_KEY`
  this phase.
- **Python**: `.venv-voice312` (Python 3.12) at repo root for kokoro/whisperx voice; `edge-tts`
  installed in it too (`pip install edge-tts`) for the edge path. System python (3.10+) runs
  `contracts.py`, `audio_gate.py`, `mix_sfx.py`, `mix_music.py` (stdlib + ffmpeg). The worker's
  `py.ts` selects the interpreter **per tool** via a `TOOL_VENV` map, never a single voice venv.
  **Cross-ref (Phase 4):** Phase 4 introduces `AI_IMAGE_VENV=.venv-image312` (image-capable venv:
  google-genai + pillow) for `gen_image`; the map lets that venv drop into Phase 3's `py.ts` with
  no rework. Phase 3 never requires it — free tier needs no image venv.
- **`STORAGE_DIR`** shared volume path writable by both web and worker (Phase 1) — `generate/` and
  per-project keys live under it.
- `npm run dev` = web :3000; `npm run worker` = worker :3100. Postgres :5432, MailHog 1025/8025.
- Verify pinned headless-shell present (Phase 1/0 already resolve `REMOTION_BROWSER_EXECUTABLE`).

---

## Task list (P0 must / P1 nice, ordered, checkboxed)

**P0 — the happy path must work end-to-end, free-tier, offline-of-paid-APIs.**

- [ ] **T1** `packages/spec`: add `GeneratePayload` zod schema (`{ topic, template, script?, voice, captions, theme?, title? }`) + validators; export stage-string constants `['story','voice','pixel','build','qa','mix','render']`.
- [ ] **T2** worker `orchestrate/py.ts`: path resolvers for `tools/`, `remotion/`, `STORAGE_DIR`; a per-tool **`TOOL_VENV`** interpreter map (`kokoro`/`whisperx` → `.venv-voice312`, `gen_image` → `AI_IMAGE_VENV`); a `runPython` wrapper (cwd = repo root, env merge, fail-fast on non-zero). No hard-coded single voice venv — Phase 4's image venv drops in via the map without refactoring.
- [ ] **T3** worker `stages/story.ts`: deterministic beat-sheet build from locked script (the no-LLM path); emit `beats.json`+`script.md`; `contracts.py beats`.
- [ ] **T4** worker `stages/voice.ts`: kokoro + edge sub-stages, `--emit-ts` write, `audio_gate` on `voice.wav`, per-line progress, spec `voice.lines` update.
- [ ] **T5** worker `stages/pixel.ts`: free-tier NO-OP + empty asset-manifest + `contracts.py manifest`; cost gate written (assert quoted ≥ cost; free = 0).
- [ ] **T6** worker `stages/build.ts` + `engine.ts`: `npm run gen`, cached bundle, `selectComposition`, silent-master `renderMedia` (75%, pinned shell), `onProgress`→stage progress, `qa-contract.json` + `contracts.py`.
- [ ] **T7** worker `stages/qa.ts`: `qa_frames` JPEGs → `qa-verdicts.json` (+ structural pass), `contracts.py`; bounded FAIL retry.
- [ ] **T8** worker `stages/mix.ts` + `render.ts`: voice mux via `ffw`, `audio_gate`; final copy→storage, `outputKey`, project `ready`, job `done`, `resultJson`.
- [ ] **T9** worker `runGenerate` orchestrator + claim-loop branch for `type='generate'` + heartbeat `writer.ts`.
- [ ] **T10** API: `POST /api/generate` (project+job insert, quote 0cr, enqueue), `GET /api/jobs/[id]` stage in response, `POST /api/generate/script` (draft beats), `GET /api/generate/templates`, `GET /api/generate/voices`.
- [ ] **T11** UI: `/generate` 4-step wizard (input → script review/lock → style/voice → generate) + `/projects/[id]/progress` live stage view + dashboard "Open in editor" stub.
- [ ] **T12** Script-fidelity e2e: edit a line → regenerate → verify the spoken line + captions match.
- [ ] **T13** `scripts/smoke-generate.mjs` + unit tests (spec validators, stage writer, transition helper); `typecheck` + lint.

**P1 — nice, non-blocking.**

- [ ] **T14** Richer story stage: LLM beat-sheet via `GEMINI_API_KEY` *if present* (never required); falls back to the deterministic builder.
- [ ] **T15** Auto-SFX cue-sheet heuristic for templates that have a palette (feed `mix_sfx.py`), optional music bed, `mix_music.py`.
- [ ] **T16** Frame-content QA: perceptual-hash frame-0 vs last + blank-frame detection for a real `qa-verdicts` FAIL path.
- [ ] **T17** Retry-with-same-locked-script button on failed job; SSE progress (poll is fine for this phase).
- [ ] **T18** Template "one niche kit" (terminal or chess) registered alongside form-card so the picker shows 2 real options.

---

## Risks & gotchas

| Risk | Mitigation |
|---|---|
| **Script fidelity drift** — worker re-derives script instead of using the locked one | Story stage **always** starts from the locked `vo[]` in the payload; LLM only fills gaps, never rewrites locked lines. e2e verifies spoken text. |
| **Silent-AAC** — bare ffmpeg produces silent voice (known engine trap) | All mux/mix via `tools/ffw.py` only; `audio_gate` after **every** mux/mix stage = hard stop. |
| **Python version** — kokoro/whisperx need 3.12, not 3.13/3.14 | `py.ts` picks the interpreter per tool via the `TOOL_VENV` map: kokoro/whisperx → `.venv-voice312`; system python for stdlib tools; `gen_image` → `AI_IMAGE_VENV` (Phase 4). Guard the selection in `py.ts`. |
| **edge-tts is an unofficial MS endpoint** (breaks periodically) | Default voice engine = **kokoro** (fully local, zero-key). edge is a P1 secondary; on edge failure, fall back to kokoro automatically. |
| **Bundle cost / cold render** | Cache `serveUrl` per template+version (Phase 1); `concurrency:'75%'`; pinned headless-shell so rasterization is stable. |
| **`npm run gen` writes `vo.gen.ts`/registry during a job** | Serialize generate jobs per template in the claim loop (don't run two builds writing the same `vo.gen.ts`); or give each generate its own template build dir. |
| **Frame-local vs global seconds bug** | Reuse Phase-0's `calculateMetadata`; QA frames chosen from *global* beat boundaries mapped to frames correctly (engine discipline). |
| **Cost displayed but Phase 4 not built** | Free tier always shows `$0.00`; the reserve/refund hooks are written but inert. Never spend unquoted (gate asserts). |
| **Phase-0 seam unknown** (captions source) | Flagged cross-phase assumption; T4/T6 verify the seam early and adapt (write `vo.gen.ts` if captions read it, else populate `inputProps.voice.lines`). |
| **Long render wall-clock** (~2–5 min) | Progress view is honest about "rendering…"; per-stage bars from heartbeat; watchdog marks stalled jobs `failed`. |

---

## Test plan

**Unit (worker + spec):**
- `packages/spec`: zod `GeneratePayload` accepts a valid payload, rejects missing `template`/empty `topic`/invalid `engine`.
- Stage writer: `writer.updateStage(jobId, 'voice', 0.5)` sets the right columns; transitions `queued→running→done|failed` are valid (shared Phase-1 helper).
- `story.ts` with a locked script returns a valid `beats.json` (passes `contracts.py beats`), deterministic (same input ⇒ same output).

**Integration (worker against real tools, free tier, NO paid keys):**
- Voice: run `voice.ts` on a 2-line test `beats.json`; assert `voice.wav` exists, non-silent (`audio_gate`), word times populated, kokoro engine.
- Build: run `build.ts` on form-card; assert silent master mp4 exists with expected `durationInFrames`.
- Full `runGenerate` on a fixture: assert stage order, `audio_gate` passes at every mux, final mp4 written to storage, project `ready`.

**e2e smoke (`scripts/smoke-generate.mjs`):**
```
- seed a user + insert a generate job with a 3-line locked script (kokoro voice)
- run the worker claim loop against it
- poll the job until terminal; assert status='done', stage='render', resultJson.outputKey set
- ffprobe the output: has video + audio stream, duration ≈ spec, RMS non-silent
- exit 0 on pass, 1 with the failing stage on any failure
```

**Manual verification steps (the DoD walk-through):**
1. `docker compose up -d`; confirm `:5432` (postgres), `:1025/:8025` (mailhog).
2. `.venv-voice312\Scripts\python.exe -c "import kokoro; print('ok')"` and `… -m pip show edge-tts` (both present). Verify `ffmpeg`/`ffprobe` on PATH.
3. `npm run dev` (web :3000) + `npm run worker` (:3100). Sign up via MailHog magic link (open `:8025`, click the link).
4. Navigate `/generate`. Step 1: type "how to make a form in Hebrew" + pick **form-card**.
5. Step 2: the beat sheet appears (draft VO lines). **Edit line 3** to a distinctive sentence. Click **Lock script**.
6. Step 3: pick a **kokoro** free voice + caption preset. Confirm the cost line reads **$0.00**.
7. Step 4: **Generate** → redirected to progress. Watch stages `story→voice→pixel→build→qa→mix→render` advance with live bars. (Do NOT provide `FAL_KEY`/`ELEVENLABS_API_KEY` — prove it works offline.)
8. On `done`: poster + `<video>` player appear. **Download** the mp4; play it — **hear the edited line 3 verbatim** and see it in the captions (script fidelity proof).
9. Back on the dashboard the card is `ready` with a playable/downloadable mp4. "Open in editor" is a stub toast (Phase 2).
10. Failure path: temporarily point voice at a nonexistent interpreter → job goes `failed` with a readable `jobs.error`, UI shows the message + retry.
11. `npm run typecheck` && `npm run lint` clean; `node scripts/smoke-generate.mjs` exits 0.

---

## Agent brief

Copy-paste this into the executing agent.

```
You are implementing Phase 3 — "Generate wizard (orchestrate as a job)" — of the shorts web app.

CONTEXT — read in this order:
1. webapp/plans/_shared-decisions.md  (LOCKED invariants: layout, ports, DB schema, Spec type,
   storage, auth, billing, job flow, DoD). Your plan MUST NOT contradict it. Do NOT re-decide
   shared infra — reuse it.
2. webapp/plans/phase-3-generate.md  (this file — the full spec you are executing).
3. Repo engine as needed: CLAUDE.md, brand.md, .claude/skills/orchestrate/SKILL.md (the pipeline
   you are porting to TS), .claude/skills/make-short/SKILL.md, remotion/scripts/render-all.mjs,
   remotion/src/lib/shorts.tsx (Captions/SAFE/prog), tools/contracts.py, tools/gen_voice.py,
   tools/gen_voice_edge.py, tools/audio_gate.py, tools/mix_sfx.py, tools/mix_music.py,
   tools/ffw.py, remotion/package.json, remotion/src/shots/short-16/Short16Formy.tsx.

CONSTRAINTS (non-negotiable):
- Everything on localhost. Postgres+MailHog via docker compose. web :3000, worker :3100.
- FREE TIER ONLY for Phase 3. The happy path must run with NO paid-API keys — no FAL_KEY, no
  ELEVENLABS_API_KEY. Voice = kokoro (default) via .venv-voice312 (Python 3.12, NOT 3.13+), edge
  as P1 fallback. Pixels = the template's TSX (no fal). Generation must work fully offline of
  paid APIs.
- TS port of orchestrate stages: story → voice ∥ pixel → build → qa → mix → render. Port the
  contract-validating + audio-gate discipline exactly (contracts.py on every handoff; audio_gate
  after every mux). Never bare ffmpeg — always tools/ffw.py.
- Script fidelity is a DIFFERENTIATOR: the worker's story stage MUST start from the user's LOCKED
  vo[] lines passed in the generate payload, never re-derive/rewrite them. Render the exact
  approved text.
- Cost-before-pixels: quote the cost at submit (free tier = 0cr), record it on the job, and write
  the gate that asserts quoted ≥ spend before any paid pixel. It is inert on free tier; Phase 4
  arms it. Never spend unquoted.
- Use the exact file paths, ports, ports, DB schema, Spec type, storage, job flow from
  _shared-decisions.md. Extend jobs via existing columns (stage/progress/error/resultJson) — no
  new columns/tables.
- Keep scope to THIS phase. Do NOT build billing, paid tiers, AI scene generation, or the editor.
  The "Open in editor" button is a stub. Reuse Phase 1's jobs/worker/storage and Phase 0's
  parametrized templates; do not rebuild them.

INVARIANTS:
- zod validation on every API payload + job input (packages/spec).
- Stage strings exactly: story, voice, pixel, build, qa, mix, render.
- Progress surfaced by polling GET /api/jobs/[id] every 2s (include stage).
- Storage: final mp4 → STORAGE_DIR/<projectId>/<assetId>.mp4, outputKey on project, served at
  /media/<outputKey>.

ORDERED STEPS:
1. packages/spec: add GeneratePayload zod schema + validators + stage constants. typecheck.
2. worker orchestrate/py.ts: path resolvers (repo root, tools/, remotion/, STORAGE_DIR) +
   a per-tool TOOL_VENV interpreter map (kokoro/whisperx → .venv-voice312; gen_image →
   AI_IMAGE_VENV, armed by Phase 4) + runPython wrapper.
3. worker stages/story.ts (locked-script deterministic beat sheet; contracts.py beats).
4. worker stages/voice.ts (kokoro primary, edge fallback, --emit-ts, audio_gate on voice.wav,
   per-line progress, update spec voice.lines).
5. worker stages/pixel.ts (free-tier no-op + empty asset-manifest + contracts.py manifest +
   cost gate).
6. worker stages/build.ts + engine.ts (npm run gen, cached bundle, selectComposition,
   silent-master renderMedia 75% pinned shell, onProgress, qa-contract + contracts.py).
7. worker stages/qa.ts (qa_frames JPEGs → qa-verdicts.json + structural pass; bounded FAIL retry).
8. worker stages/mix.ts + render.ts (voice mux via ffw + audio_gate; final copy → storage,
   outputKey, project ready, job done, resultJson).
9. worker runGenerate orchestrator + generate branch in the claim loop + heartbeat writer.
10. API: POST /api/generate, GET /api/jobs/[id] (with stage), POST /api/generate/script,
    GET /api/generate/templates, GET /api/generate/voices.
11. UI: /generate 4-step wizard + /projects/[id]/progress live stage view + dashboard stub.
12. scripts/smoke-generate.mjs + unit tests; typecheck + lint clean.

VERIFY DONE (all must pass):
- docker compose up -d clean; npm run dev + npm run worker up; MailHog magic-link signup works.
- Full manual walk (see phase-3-generate.md "Manual verification steps"): type a topic, review +
  EDIT + LOCK a script line, pick a kokoro free voice, Generate with NO paid keys, watch all
  stages advance, download the mp4, HEAR the edited line verbatim + see it in captions.
- node scripts/smoke-generate.mjs exits 0 (job reaches done, ffprobe shows video+audio non-silent).
- npm run typecheck && npm run lint clean.

PROVE DONE by reporting: the /generate + /projects/[id]/progress routes, the worker stage
files, the smoke output, and a one-line confirmation that a locked-script edit is spoken verbatim
in the rendered mp4. Then open the result in the Phase-2 editor is a stub (Phase 2).
```
