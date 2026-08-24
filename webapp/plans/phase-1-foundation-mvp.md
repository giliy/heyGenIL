# Phase 1 — Foundation + MVP dashboard/render

> Locked invariants live in [`_shared-decisions.md`](./_shared-decisions.md) (layout, ports, DB schema,
> Spec type, storage, auth, billing, job flow, DoD). This plan **references** those invariants and adds
> only Phase-1 implementation detail. It must NOT contradict them.
>
> **Context dependency:** Phase 1 sits on top of **Phase 0** (spec-driven refactor). Phase 0 must have
> converted ≥1 composition (`short-16`/form-card, and ideally one niche kit) from hardcoded `vo.gen`
> to an **`inputProps`/`defaultProps`-driven renderer** with `calculateMetadata`, and produced the
> **worker precursor** (`renderMedia(spec)` callable as a function). If Phase 0 is not merged, this
> phase's worker cannot render a *user-created* spec; the `render` job code below still stands — it
> just needs Phase 0's `renderSpec(templateId, spec)` function as its backend. See Risks §R1.

---

## Goal

Stand up the `webapp/` skeleton and prove **render-from-web end-to-end**: a browser user signs in
locally (email magic link via MailHog), sees their projects on a Dashboard, clicks **"Render this
template"** on a launch template, the worker picks the job up, renders the Phase-0 spec to an mp4,
writes progress, and the Dashboard flips to **ready** with a downloadable file.

Deliverables (all under `webapp/`):
- npm workspaces monorepo: `apps/web` (Next.js 15 App Router), `apps/worker` (Node 24),
  `packages/spec` (zod Spec), `packages/db` (Drizzle schema + client).
- `docker-compose.yml` (Postgres 16 + MailHog on the locked ports; MinIO optional/disabled).
- Drizzle schema + migration for `users/projects/assets/jobs` + Auth.js adapter tables.
- Auth.js v5 email magic link via MailHog; middleware protects `/dashboard` + `/api/*`.
- Next.js App Router app with the **brand Tailwind/shadcn shell**; Dashboard grid of project cards
  (poster = frame 0, status pill, download when ready).
- "Render this template" action → inserts a `render` job.
- Worker job loop (claim via `SELECT … FOR UPDATE SKIP LOCKED` → Phase-0 render → `onProgress` →
  done/failed → write `outputKey`).
- Local-disk storage module (`webapp/.storage`) + `/media/[key]` serving.
- `GET /api/jobs/[id]` polled by the Dashboard.

**Non-goals (later phases — do NOT build):** the editor (Phase 2), the generate wizard (Phase 3),
billing/credits (Phase 4), S3/MinIO presigned uploads (storage stays local disk), SSE, multi-worker
concurrency tuning. A "Render this template" button + hardcoded seed projects are the Phase-1 UX; the
spec comes from Phase 0's seed/template, not from a user editor.

---

## Why this phase first / Dependencies

1. **Everything else is wiring on top of this.** Auth + DB + storage + job queue + a working render
   are the substrate every later phase (editor, generate, billing) touches. Building the editor first
   with no render path would dead-end.
2. **Proves the risky path earliest.** The highest-risk unknown is "web → worker → Remotion → mp4 →
   back to web" on localhost (Chrome headless-shell pin, spec→`inputProps` fidelity, job claim/lock,
   file serving). Phase 1 retires that risk with a real, downloadable video (per DoD: *each phase ends
   in a rendered/downloadable video*).
3. **Dependencies on existing code:**
   - **Phase 0** (spec renderer): `remotion/src/shots/short-16/Short16Formy.tsx` gains `defaultProps`
     (Spec-shaped), `calculateMetadata` (duration from scenes), and reads the spec via `inputProps`
     instead of the hardcoded `VO` from `./vo.gen`. Worker backend = Phase 0's `renderSpec()`.
   - **Engine patterns** (already exist, reuse verbatim): `render-all.mjs`'s `bundle()` with
     `publicDir: ../media`, pinned headless-shell Chrome resolution, `concurrency:'75%'`,
     `onProgress`; `contracts.py`'s validation role (ported to zod in `packages/spec`).
   - **Auth.js adapter** needs the users/accounts/sessions/verificationTokens tables — created here.
4. **Order within phase:** compose+env → db schema+migration → auth → seed projects/templates →
   storage + `/media` → render job insert + `GET /api/jobs/[id]` → worker loop → dashboard UI →
   e2e. Each step is independently verifiable.

---

## Exit criteria (definition of done)

- [ ] `docker compose up -d` (in `webapp/`) brings up Postgres (5432) + MailHog (SMTP 1025, UI 8025).
- [ ] `npm run dev` (web, port 3000) + `npm run worker` (port 3100) run concurrently, localhost only.
- [ ] `npm run typecheck` + `npm run lint` clean across all workspaces.
- [ ] Signing in via **email magic link captured in MailHog UI (localhost:8025)** grants a session;
      `/dashboard` redirects anonymous users to `/sign-in`; `/api/*` (except auth + `/api/jobs/[id]`)
      rejects unauthenticated requests.
- [ ] A signed-in user sees seeded project cards (poster = composed **frame 0** thumbnail, status pill,
      engine badge, duration).
- [ ] Clicking **"Render this template"** on a launch template inserts a `render` job (visible as
      `queued` → `running` with live progress %).
- [ ] The worker claims the job, renders the Phase-0 spec to an mp4 in `webapp/.storage/`, marks
      `done`, writes `outputKey`; a failed render marks `failed` with `error` (and, once Phase 4
      lands, refunds — out of scope here, but the `failed` path + `error` column must be set).
- [ ] Dashboard polls `GET /api/jobs/[id]` (~2s) and flips the card to **ready** with a
      **playable/downloadable mp4** (`/media/<key>`, `Content-Disposition: attachment`).
- [ ] **Manual proof:** sign in → render → watch progress → download and play the mp4. (See Test plan.)

---

## Data model changes

Phase 1 **creates** the canonical tables (from `_shared-decisions.md` §Database). Later phases only
extend. All in `packages/db/src/schema.ts`, Drizzle + Postgres 16.

```ts
// packages/db/src/schema.ts  (drizzle-orm/pg-core)
users(id text PK, email text UNIQUE, name text, image text, createdAt timestamptz default now())
// Auth.js adapter tables (drizzle "authjs/pg" schema, exact column names required):
accounts(userId FK users, type, provider, providerAccountId, refresh_token, access_token,
         expires_at, token_type, scope, id_token, session_state)
sessions(sessionToken text PK, userId FK users, expires timestamptz)
verificationTokens(identifier, token, expires)   // magic-link tokens live here

projects(id text PK (cuid2), userId FK users, title text, template text, engine 'tsx'|'ai' default 'tsx',
         status 'draft'|'generating'|'ready'|'failed' default 'draft',
         specJson jsonb, posterKey text, outputKey text,
         durationSec real, width int, height int, fps int, revision int default 0,
         createdAt timestamptz default now(), updatedAt timestamptz default now())

assets(id text PK (cuid2), userId FK users, projectId text NULL FK projects,
       kind 'image'|'video'|'audio', storageKey text, url text,
       w int NULL, h int NULL, durationSec real NULL, bytes bigint NULL,
       source 'upload'|'ai'|'library' default 'upload', createdAt timestamptz default now())

jobs(id text PK (cuid2), projectId FK projects,
     type 'generate'|'render' default 'render',
     status 'queued'|'running'|'done'|'failed' default 'queued',
     stage text, progress real default 0, inputJson jsonb, resultJson jsonb, error text,
     costCredits int default 0, createdAt timestamptz default now(),
     startedAt timestamptz NULL, finishedAt timestamptz NULL, heartbeatAt timestamptz NULL)
```

- **IDs** = cuid2 (`@paralleldrive/cuid2`) generated at insert.
- **`projects.specJson`** holds the full Phase-0 `Spec` (validated by `packages/spec` zod).
- **`projects.outputKey`** / **`posterKey`** = storage keys (`<projectId>/<file>`); resolved to URLs
  by the storage module (see Storage).
- **Job input** = `{ template, spec, renderOptions:{ codec:'h264', pixelFormat:'yuv420p', crf:21 } }`
  in `inputJson`; `resultJson = { outputKey, posterKey, durationSec, width, height, fps }` on `done`,
  `{ }` on `queued`/`running`.
- **Migration:** single initial `drizzle` migration (generate once, commit). `drizzle-kit` config in
  `packages/db`; `npm run db:generate` / `npm run db:migrate` scripts.

**Auth.js Drizzle adapter note:** use the `@auth/drizzle-adapter` + its `pgTable` helpers so the
adapter table shapes match exactly what Auth.js v5 expects (it owns the exact column types for
`accounts`/`sessions`/`verificationTokens`). Do not hand-roll those three.

---

## API routes

All under `apps/web`, App Router route handlers. Auth: email magic link (Auth.js v5). Middleware
protects `/dashboard` + `/api/*` except the auth routes and `GET /api/jobs/[id]` (so unauthenticated
polling of a known job id is allowed — see Auth section for the exact matcher).

| Method/Path | Auth | Purpose | Notes |
|---|---|---|---|
| `GET /api/auth/[...nextauth]` | public | Auth.js catch-all (sign-in / callback / session / csrf / signout) | `auth.config.ts` + route handler |
| `GET /dashboard` (page) | required | Dashboard UI | redirects anon → `/sign-in` |
| `GET /sign-in` | public | sign-in page (email form) | |
| `POST /api/projects` | required | **(Phase 1 convenience)** seed a project from a launch template for the user | returns the created project (used by the "template" CTA to materialize a project, then render it) |
| `GET /api/projects` | required | list the user's projects (dashboard data) | |
| `POST /api/jobs` | required | validate spec (zod) → insert `render` job (status `queued`) | body `{ projectId }`; reads `specJson` from the project; returns `{ jobId }` |
| `GET /api/jobs/[id]` | public-for-poll | `{ status, progress, stage, error?, outputKey?, posterKey? }` | dashboard polls ~2s; a *signed-in* owner's card uses this |
| `GET /media/[...key]` | required | serve stored bytes with `Content-Type` + `Content-Disposition: attachment` for mp4s | local-disk storage; key = `<projectId>/<file>` (see Storage) |
| `GET /api/health` | public | web liveness | trivial |
| `GET /api/templates` | required | list launch templates (id, title, thumbnail, engine) for the dashboard CTA | Phase 1 returns the hardcoded launch set (form-card + niche kit) |

**Job insert flow (`POST /api/jobs`):** load project (owner) → `packages/spec` zod-validate
`specJson` → compute/ignore credits (Phase 4) → `INSERT INTO jobs (projectId, type='render',
status='queued', inputJson, costCredits=0)` → set `projects.status='generating'` → return `{jobId}`.
No reserve/deduct yet (no ledger until Phase 4).

**Job status route** returns whatever the worker wrote; the dashboard derives card UI from it.

---

## UI surface

App shell (from `_shared-decisions.md` §UI conventions + `brand.md`): **Tailwind v4 + shadcn/ui +
Radix**, Space Grotesk display / Inter body / JetBrains Mono code, indigo `#6366F1` accent, paper
`#fffef7` bg, `paper/cream` cards, radius ~14px, soft shadows, no sticker-pop. Light-only for Phase 1.

Pages/components (under `apps/web/src/`):

1. **`app/layout.tsx`** — fonts (`next/font/google` Space Grotesk + Inter + JetBrains Mono), global
   Tailwind theme tokens (CSS vars mapping brand hex), SessionProvider wrapper.
2. **`app/sign-in/page.tsx`** — centered card, single email input → `signIn("email", { email })` —
   **the default provider is Auth.js's Nodemailer/Email provider pointed at MailHog SMTP (port 1025)**,
   so magic links land in the MailHog UI (localhost:8025) with **no external API key required**.
   `EMAIL_SERVER=smtp://localhost:1025` + `EMAIL_FROM` carry the transport (see Auth — no
   `AUTH_RESEND_KEY` in the default path). Resend is the documented **fallback** only if the
   Nodemailer provider proves flaky on the pinned beta (see Auth §R3).
3. **`app/(main)/layout.tsx`** — authenticated shell: left nav rail (Dashboard, New video [disabled],
   Templates), top bar (title, user avatar, Sign out). Requires a session (redirects to `/sign-in`).
4. **`app/(main)/dashboard/page.tsx`** — server component: fetch `GET /api/projects` for the user,
   render a CSS grid of **ProjectCard**s. A `useJobsPoll` client component handles live progress.
   Top CTA: **"Render a template"** → `TemplatesDialog`.
5. **`components/ProjectCard.tsx`** — poster (`<img src=/media/<posterKey>>` = **frame 0**),
   title, status pill (`draft` / `queued` / `rendering <pct>%` / `ready` / `failed`), engine badge
   (TSX), duration, modified time, Download button when `ready` (href `/media/<outputKey>`,
   `download` attr).
6. **`components/TemplatesDialog.tsx`** — lists launch templates (form-card, niche kit) with poster +
   title; selecting one calls `POST /api/projects` (seed project) then `POST /api/jobs` (enqueue render),
   then navigates to the dashboard where the new card polls.
7. **`components/StatusPill.tsx`**, **`components/ProgressBar.tsx`** — brand-styled.
8. **`lib/useJobsPoll.ts`** — client hook: `setInterval` 2s → `GET /api/jobs/[id]`, updates card state;
   stops when status is `done`/`failed`.

No editor, no generate wizard, no billing UI in Phase 1.

---

## Worker changes

`apps/worker` — a standalone Node 24 process, port 3100 (tiny `fastify`/`express` for `/health` +
optional claim webhook). It **imports the engine and python tools by repo path** (one-repo advantage)
and shares `packages/spec` + `packages/db`.

```
apps/worker/
  src/index.ts            # boots HTTP server + starts the claim loop
  src/loop.ts             # poll for claimable jobs, run, requeue/hold on error
  src/render.ts           # the Phase-0 renderSpec(templateId, spec) call — THE job
  src/claim.ts            # SELECT ... FOR UPDATE SKIP LOCKED claim
  src/storage.ts          # writes mp4/poster into webapp/.storage (STORAGE_DIR)
  src/health.ts           # /health
  .env                    # DATABASE_URL, STORAGE_DIR
```

**Job loop (`loop.ts`):** every ~1s run `claim.ts`:
```sql
-- claim.ts (knex/pg driver via packages/db client)
BEGIN;
UPDATE jobs
   SET status='running', stage='render', startedAt=now(), heartbeatAt=now()
 WHERE id = (
   SELECT id FROM jobs
    WHERE status='queued' AND type='render'
    ORDER BY createdAt
    LIMIT 1
    FOR UPDATE SKIP LOCKED
 )
RETURNING *;
COMMIT;
```
If none, sleep and retry. On claim, load `inputJson`, call `render.ts`.

**`render.ts` (Phase-0 worker precursor, wrapped in a job):**
1. Set `stage='render'`, `progress=0`; update `heartbeatAt`.
2. Call Phase 0's `renderSpec(templateId, spec)` — which does the `render-all.mjs` recipe: resolve the
   pinned headless-shell Chrome (reuse `resolvePinnedShell()` logic), `bundle({ entryPoint: remotion/src/index.ts, publicDir: remotion/../media })` cached per template+version, `selectComposition({ id: templateId, inputProps: spec })`, then
   `renderMedia({ outputLocation, concurrency:'75%', codec:'h264', pixelFormat:'yuv420p', imageFormat:'jpeg', crf:21, onProgress })`.
3. **`onProgress`** → `UPDATE jobs SET progress=<p>, heartbeatAt=now()` (throttled to ≥250ms writes so
   we don't hammer PG).
4. Render to a temp path, then **write to storage** via `storage.ts`:
   - `outputKey = <projectId>/render.mp4` → copy to `webapp/.storage/<projectId>/render.mp4`.
   - **Poster (frame 0):** Phase 0 renderer should also emit a frame-0 still (`renderStill({ frame:0 })`
     → `posterKey = <projectId>/poster.jpg`). If Phase 0 doesn't, Phase 1 captures it via a second
     `renderStill` call in `render.ts`. (Frame 0 is fully composed per brand.md §6.)
5. On success: `UPDATE jobs SET status='done', stage='complete', progress=1, resultJson={outputKey, posterKey, durationSec, width, height, fps}, finishedAt=now()`; set `projects.status='ready', outputKey, posterKey, durationSec, updatedAt`.
6. On failure: `UPDATE jobs SET status='failed', error=<message>, finishedAt=now()`; set
   `projects.status='failed'`. (Refund is Phase 4; the `failed` state + `error` are Phase 1.)
7. **Watchdog:** a sweeper updates stale `running` jobs with old `heartbeatAt` (e.g. >2× render budget)
   to `failed` with `error='stalled (no heartbeat)'`. Cheap insurance against a hung Chromium.

**Worker precursor boundary:** if Phase 0's `renderSpec` isn't merged, `render.ts` still encodes the
full call — the agent should stub it against the existing `render-all.mjs` path (bundle + select +
renderMedia for `Short16Formy`) until Phase 0 lands (R1).

---

## Engine/Remotion changes

Phase 1 makes **minimal** engine changes; the spec-driven refactor is Phase 0's job. Phase 1 only:

1. **Template registration list** (read-only, Phase-1 side): the launch templates Phase 1 exposes on
   the dashboard come from Phase 0's spec-driven compositions. Phase 1 adds a `webapp/`-side template
   catalog (`apps/web/lib/templates.ts` + mirrored in `apps/worker`) mapping
   `templateId → { id, title, compositionId, defaultSpec, poster }` for **form-card (`Short16Formy`)**
   and (if Phase 0 did the niche kit) **terminal/chess**. This catalog is the single source for the
   `POST /api/projects` seed + worker `renderSpec(templateId, …)`.
2. **No edits to `remotion/src/shots/*`** in Phase 1 (they're Phase 0's). If Phase 0 is late, see R1:
   Phase 1 may need a *temporary* minimal `defaultProps` shim on `Short16Formy` — but prefer to block
   on Phase 0 rather than fork the composition.
3. **`gen-registry`** must have been run (Phase 0) so `Short16Formy` is registered with
   `defaultProps`/`calculateMetadata` in `registry.gen.tsx`/`shots.manifest.json`. The worker's
   `bundle()` re-runs it or consumes the committed registry — reference Phase 0's decision.
4. **Pinned Chrome:** reuse `render-all.mjs`'s `resolvePinnedShell()` + `REMOTION_BROWSER_EXECUTABLE`
   override; the worker must pass `browserExecutable` to `selectComposition`/`renderMedia`/`renderStill`
   exactly like the engine does, so renders match bit-for-bit.

---

## Infra & env (docker-compose, .env)

`webapp/docker-compose.yml` (Postgres + MailHog; MinIO present but `profiles: [minio]`/commented so
it stays off for local disk):

```yaml
services:
  postgres:
    image: postgres:16
    environment: { POSTGRES_DB: shorts, POSTGRES_USER: shorts, POSTGRES_PASSWORD: shorts }
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck: { test: ["CMD-SHELL","pg_isready -U shorts"], interval: 2s, retries: 20 }
  mailhog:
    image: mailhog/mailhog
    ports: ["1025:1025", "8025:8025"]   # SMTP / UI
  minio:                                 # OPTIONAL — enable only when a phase needs real S3
    profiles: [minio]
    image: minio/minio
    command: server /data --console-address ":9001"
    environment: { MINIO_ROOT_USER: shorts, MINIO_ROOT_PASSWORD: shortsdev }
    ports: ["9000:9000", "9001:9001"]
volumes: { pgdata: {} }
```

**Root `webapp/package.json` (workspaces):**
```json
{
  "name": "webapp",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "npm run dev -w @shorts/web",
    "worker": "npm run dev -w @shorts/worker",
    "db:generate": "npm run db:generate -w @shorts/db",
    "db:migrate": "npm run db:migrate -w @shorts/db",
    "db:studio": "npm run db:studio -w @shorts/db",
    "typecheck": "npm run typecheck --workspaces",
    "lint": "npm run lint --workspaces",
    "test": "npm run test --workspaces"
  }
}
```

**Env files (never commit real values; `.env.example` committed):**

`apps/web/.env.local`:
```
DATABASE_URL=postgres://shorts:shorts@localhost:5432/shorts
AUTH_SECRET=<generate: npx auth secret>
AUTH_URL=http://localhost:3000
# Nodemailer/Email provider (default) → MailHog SMTP; no external key needed.
# AUTH_RESEND_KEY only if the Resend fallback is switched on (see Auth §R3).
EMAIL_SERVER=smtp://localhost:1025
EMAIL_FROM=shorts@localhost
STORAGE_DIR=C:/source/shorts-with-claude/claude-faceless-shorts-creator/webapp/.storage
```
`apps/worker/.env`:
```
DATABASE_URL=postgres://shorts:shorts@localhost:5432/shorts
STORAGE_DIR=C:/source/shorts-with-claude/claude-faceless-shorts-creator/webapp/.storage
PORT=3100
```
(`STORAGE_DIR` is a **shared path** both web and worker read/write — same host, no volume mount needed
on localhost; if MinIO is later enabled it becomes a config swap per `_shared-decisions.md`.)

**Package/version pins (all in the respective workspace `package.json`):**
- `apps/web`: `next@15`, `react@18.3.1`, `react-dom@18.3.1`, **`next-auth@5.0.0-beta.28` (hard-pinned —
  do NOT float the beta; `@auth/drizzle-adapter` + the magic-link flow are verified against exactly this
  beta, and other betas can break the adapter/table contract)**, `@auth/drizzle-adapter`, `drizzle-orm`, `@paralleldrive/cuid2`,
  `tailwindcss@4`, `@tailwindcss/postcss`, `shadcn/ui` deps (`@radix-ui/react-*`, `class-variance-authority`,
  `clsx`, `tailwind-merge`, `lucide-react`, `sonner`), `@shorts/spec`, `@shorts/db` (workspace).
- `apps/worker`: `@remotion/renderer@4.0.515` (matches engine), `@remotion/bundler@4.0.515`,
  `@remotion/cli@4.0.515`, `fastify@5`, `pg`, `@shorts/spec`, `@shorts/db`. Node 24. Node `--loader`
  / tsx as the worker runs TS directly (reference Phase 0's worker precursor for the exact runner).
- `packages/spec`: `zod@3` (or zod@4 — pin per engine), `typescript`.
- `packages/db`: `drizzle-orm`, `drizzle-kit`, `pg`, `@paralleldrive/cuid2`.

**Shared spec (`packages/spec`):** port the `Spec`/`Scene`/`Overlay` types + zod schemas from
`_shared-decisions.md` §Project spec. `validateSpec(json)` used by `POST /api/jobs` (web) and
`render.ts` (worker). This is the TS port of `tools/contracts.py`'s role.

---

## Task list

### P0 — must (ordered, each independently verifiable)
- [ ] **1. Scaffold monorepo** — `webapp/package.json` workspaces; `apps/web`, `apps/worker`,
      `packages/spec`, `packages/db` with minimal `package.json` + tsconfig; root `npm install`.
      Verify: `npm run typecheck -w @shorts/db` etc. run.
- [ ] **2. `docker-compose.yml`** — Postgres 16 + MailHog (+ disabled MinIO profile). Verify:
      `docker compose up -d` → `pg_isready`, MailHog UI at localhost:8025.
- [ ] **3. `packages/db` schema + migration** — schema.ts (users + Auth.js adapter + projects +
      assets + jobs per §Data model), drizzle-kit config, initial migration, client helper.
      Verify: `npm run db:migrate` applies; `psql \dt` shows tables.
- [ ] **4. `packages/spec` zod schemas + validators + unit tests** — validate a good Spec passes, a
      malformed one throws.
- [ ] **5. Auth.js v5 + middleware** — **Nodemailer/Email provider→MailHog SMTP** (default; Resend
      fallback per §R3), `next-auth@5.0.0-beta.28` hard-pinned, Drizzle adapter, middleware matcher
      protecting `/dashboard` + `/api/*` (except auth + `GET /api/jobs/[id]`); sign-in page.
      Verify: email → MailHog → click link → session; `/dashboard` redirects anon.
- [ ] **6. Storage module + `/media/[...key]`** — `apps/web/lib/storage.ts` (+ worker `storage.ts`)
      reads/writes `STORAGE_DIR`; route serves bytes (mp4 → `application/mp4` + `Content-Disposition:
      attachment`; jpg → `image/jpeg`). Verify: curl a seeded file.
- [ ] **7. Templates catalog + seed projects** — `apps/web/lib/templates.ts` (form-card + niche kit);
      `POST /api/projects` materializes a project for the user from a template's `defaultSpec`
      (`specJson`), poster via a Phase-0 frame-0 still (or render a poster once at seed). Verify:
      `POST /api/projects` returns a project with a reachable poster.
- [ ] **8. `POST /api/jobs` + `GET /api/jobs/[id]`** — zod-validate spec → insert queued render job →
      set project `generating`; status route returns live fields. Verify via curl.
- [ ] **9. Worker loop + `render.ts`** — claim (SKIP LOCKED), Phase-0 `renderSpec`, `onProgress` →
      DB, write mp4+poster to storage, done/failed transitions + watchdog. Verify: seed a job, watch
      it go queued→running→done, file lands in `.storage/<projectId>/`.
- [ ] **10. Dashboard UI** — brand shell, ProjectCard grid, `useJobsPoll`, TemplatesDialog, Download.
      Verify end-to-end (Test plan).
- [ ] **11. `GET /api/templates`** + dashboard CTA wiring.
- [ ] **12. Final gate** — `typecheck`/`lint` clean; manual e2e proof (below).

### P1 — nice (after P0 green)
- [ ] Worker `/health` reports last-claim heartbeat + queue depth; web shows a small "worker" indicator.
- [ ] Poster generation at **seed time** via a cached `renderStill` (so cards have thumbnails even
      before any render), with the frame-0 poster stored on the project.
- [ ] Job status route returns `estimatedSecondsRemaining` (from progress rate) for a nicer pill.
- [ ] Seed 2–3 demo projects per new user so the dashboard isn't empty on first sign-in.
- [ ] `.gitignore` for `webapp/.storage`, `.env.local`, node_modules; commit `.env.example`.

---

## Risks & gotchas

| # | Risk | Mitigation |
|---|---|---|
| **R1** | **Phase 0 not merged** — `Short16Formy` still hardcoded (`vo.gen`), no `inputProps`/`calculateMetadata`, no worker precursor. The worker can't render a user spec. | **Highest risk.** Phase 1's `render.ts` depends on Phase 0's `renderSpec`. If Phase 0 is late, temporarily point `render.ts` at the *existing* `render-all.mjs` recipe (bundle + select + renderMedia for the `Short16Formy` composition with the hardcoded VO) so the app proves the full web→worker→file→download path; swap in `renderSpec` the moment Phase 0 lands. Do NOT fork `Short16Formy` in Phase 1. Flag this dependency in the phase brief. |
| **R2** | **Auth.js adapter table shapes** must match exactly or sign-in breaks. | Use `@auth/drizzle-adapter`'s schema helpers for `accounts/sessions/verificationTokens`; don't hand-roll. Test the full magic-link round trip early (task 5). |
| **R3** | **Email provider must not hard-require a real API key** on localhost, and the chosen provider must work against the pinned beta. | **Locked default: Auth.js Nodemailer/Email provider pointed at MailHog SMTP (port 1025)** — it needs no external key (`EMAIL_SERVER=smtp://localhost:1025`, `EMAIL_FROM`), unlike Resend which hard-requires an API key + external send. Verify the link actually arrives in MailHog (task 5). **Resend is the documented fallback only if the Nodemailer provider breaks on `next-auth@5.0.0-beta.28`** — the critical path must not depend on a provider that needs a real key. |
| **R4** | **Pinned Chrome not found** → render falls back to Remotion default and rasterization drifts (or render fails). | Reuse `render-all.mjs`'s `resolvePinnedShell()` + `REMOTION_BROWSER_EXECUTABLE`; worker must run from the repo root so `.remotion/` resolves, or pass the resolved path explicitly. |
| **R5** | **Progress hammering PG** — `onProgress` fires per frame. | Throttle DB writes to ≥250ms; `heartbeatAt` on the same write. |
| **R6** | **Stalled jobs** if the worker dies mid-render. | Watchdog sweeper flags `running` jobs with stale `heartbeatAt` → `failed` (`error='stalled'`). |
| **R7** | **`concurrency:'75%'` + memory** — one Chromium tab ~300–600MB; many frames at once can OOM the box. | Keep Phase 0's `concurrency:'75%'` (engine-verified); one worker at a time in Phase 1; moderate render resolution. |
| **R8** | **`publicDir` must be passed to `bundle()`** — remotion.config.ts doesn't apply to programmatic bundle. | Copy `render-all.mjs`: `bundle({ entryPoint: remotion/src/index.ts, publicDir: remotion/../media })`. |
| **R9** | **Middleware accidentally blocks `GET /api/jobs/[id]`** used by polling. | Exact matcher: protect `/dashboard` and `/api/*`; explicitly allow `/api/auth/*` + `GET /api/jobs/*` + `/api/health`. |
| **R10** | **Windows path spaces** in `STORAGE_DIR` / repo path break env parsing or Chrome args. | Quote paths; prefer forward slashes; `.env` values with spaces in quotes. |
| **R11** | **cuid2 IDs vs varchar PK** — ensure Drizzle PK columns are `text` (not `uuid`), since we use cuid2 strings. | Schema uses `text` PKs per `_shared-decisions.md`; match `projects.id`/`jobs.id` types everywhere. |

---

## Test plan

### Unit tests
- **`packages/spec`**: `validateSpec` accepts the Phase-0 form-card Spec; rejects missing `scenes`,
  invalid overlay `start>end`, non-serializable fields. (~6 cases.)
- **`packages/db`** job transitions: a pure `transition` helper (queued→running→done / →failed)
  returns legal next-states; illegal transitions throw.
- **Worker `claim`**: with two queued jobs, two concurrent claims return disjoint ids (SKIP LOCKED).

### Integration tests
- `POST /api/jobs` validates spec (400 on bad spec) and inserts a `queued` row; `GET /api/jobs/[id]`
  returns `{status,progress}`.
- `/media/<key>` serves a seeded mp4 with the right `Content-Type` + `Content-Disposition`.

### E2E (manual — the DoD proof)
1. `docker compose up -d`; `npm install` at root; `npm run db:migrate`.
2. Terminal A: `npm run dev` (web, :3000). Terminal B: `npm run worker` (:3100).
3. Open `http://localhost:3000` → redirected to `/sign-in`.
4. Enter any email (e.g. `you@localhost`) → Submit. Open `http://localhost:8025` (MailHog) → open the
   message → click the magic link → you land signed-in on `/dashboard`.
5. Dashboard shows seeded project card(s) with a **poster image** and a status pill.
6. Click **"Render this template"** → pick **form-card** → a new card appears as `queued` → `running`
   with a rising **progress %** (the worker is rendering).
7. Wait for the pill to flip to **ready** (2–5 min for a 36s 1080p short on a 4-core box — see
   WEBAPP-PLAN §Hard parts).
8. Click **Download** → the mp4 saves; **play it** — it's the form-card short.
9. `npm run typecheck` and `npm run lint` pass across all workspaces.
10. **Failure path:** (optional) temporarily point `render.ts` at a bad spec → the card flips to
    `failed` with an error message, not a hang.

---

## Agent brief

> Copy everything below as the prompt for the agent executing Phase 1.

You are implementing **Phase 1 — Foundation + MVP dashboard/render** of the shorts web app. Repo root:
`C:/source/shorts-with-claude/claude-faceless-shorts-creator`. Everything runs on **localhost**
(Docker for Postgres/MailHog). All new code lives under `webapp/`.

**Read first, in order:**
1. `webapp/plans/_shared-decisions.md` — LOCKED invariants. Do not contradict: code layout, ports
   (web 3000, worker 3100, Postgres 5432, MailHog 1025/8025, MinIO 9000/9001 optional), DB schema,
   Spec type, storage (local disk `webapp/.storage` served at `/media/<key>`, `STORAGE_DIR` env), auth
   (Auth.js v5 + Drizzle + email magic link via MailHog), job flow, UI conventions, DoD.
2. `webapp/plans/phase-1-foundation-mvp.md` — this plan. Follow its sections exactly.
3. Engine reality: `remotion/scripts/render-all.mjs` (the `bundle`→`selectComposition`→`renderMedia`
   recipe, pinned headless-shell Chrome, `concurrency:'75%'`, `onProgress`), `remotion/src/brand.ts`,
   `brand.md`, `remotion/package.json` (Remotion **4.0.515**), `tools/contracts.py` (validation role →
   ported to zod).

**Constraints & invariants:**
- Monorepo under `webapp/`: npm workspaces `apps/web` (Next.js 15 App Router), `apps/worker` (Node 24),
  `packages/spec` (zod Spec), `packages/db` (Drizzle). Root `webapp/package.json` wires `dev`/`worker`/
  `db:*`/`typecheck`/`lint`/`test`.
- **Scope is Phase 1 only.** Build auth, dashboard (project list + render a template), the render job
  queue, local storage, and `/media`. Do NOT build the editor (P2), generate wizard (P3), billing/
  credits (P4), S3/MinIO uploads, SSE, or multi-worker tuning.
- DB: create the canonical `users`/`projects`/`assets`/`jobs` tables + Auth.js adapter tables
  (`accounts`/`sessions`/`verificationTokens`) in `packages/db/src/schema.ts`. IDs = cuid2 **text** PKs.
  Generate one initial Drizzle migration and commit it. Use `@auth/drizzle-adapter`'s schema helpers for
  the three adapter tables — do not hand-roll them.
- Spec: `packages/spec` exports the `Spec`/`Scene`/`Overlay` types + `validateSpec()` zod schema from
  `_shared-decisions.md` §Project spec. Both web and worker import it.
- Auth: Auth.js v5 (**`next-auth@5.0.0-beta.28` hard-pinned**) + Drizzle adapter, **Nodemailer/Email
  provider pointed at **MailHog SMTP (port 1025)** so magic links land in `http://localhost:8025` with
  no external API key**. `EMAIL_SERVER=smtp://localhost:1025`; no `AUTH_RESEND_KEY` in the default path
  (Resend is the fallback per R3 — only switch if the Nodemailer provider breaks on the pinned beta).
  Middleware protects `/dashboard` + `/api/*`, **allowing** `/api/auth/*`, `GET /api/jobs/*`, and
  `/api/health`.
- Storage: one module — `apps/web/lib/storage.ts` + `apps/worker/src/storage.ts` — reading/writing
  `STORAGE_DIR` (`webapp/.storage/<projectId>/<file>`). `/media/[...key]` serves bytes; mp4 →
  `application/mp4` + `Content-Disposition: attachment`, jpg → `image/jpeg`.
- Worker: separate process, port 3100, a fastify/express `/health`. Job loop claims `type='render'`
  `queued` jobs via `SELECT … FOR UPDATE SKIP LOCKED`, runs the render, writes progress via `onProgress`
  (throttle ≥250ms), sets `done`/`failed` + `error`, writes `outputKey`/`posterKey`. Add a watchdog that
  fails stalled `running` jobs (stale `heartbeatAt`).
- Engine calls: reuse the `render-all.mjs` recipe — `bundle({ entryPoint: remotion/src/index.ts,
  publicDir: remotion/../media })`, resolve the pinned headless-shell Chrome (`REMOTION_BROWSER_EXECUTABLE`
  or the `.remotion/` path), `selectComposition({ id: templateId, inputProps: spec })`, `renderMedia({
  concurrency:'75%', codec:'h264', pixelFormat:'yuv420p', imageFormat:'jpeg', crf:21, onProgress })`.
  Render poster via `renderStill({ frame:0 })` (frame 0 is fully composed per brand.md §6).
- **Phase 0 dependency:** the worker's render step should call Phase 0's `renderSpec(templateId, spec)`.
  If that function isn't available, wire `render.ts` to the existing `render-all.mjs` recipe for the
  `Short16Formy` composition as a stopgap so the full path works, and add a `// TODO(P0)` — do not fork
  `Short16Formy.tsx`. Flag this in your summary.
- Templates: `apps/web/lib/templates.ts` maps the launch template(s) (form-card = `Short16Formy`; add
  the niche kit only if Phase 0 shipped it) to `{ id, title, compositionId, defaultSpec, poster }`.
  `POST /api/projects` seeds a project for the user from a template's spec; `POST /api/jobs` inserts a
  render job; the Dashboard polls `GET /api/jobs/[id]` ~2s.
- UI: Tailwind v4 + shadcn/ui + Radix, **light-only**, brand palette (indigo `#6366F1`, paper
  `#fffef7`, cards `paper/cream`, radius ~14px, soft shadows), Space Grotesk/Inter/JetBrains Mono via
  `next/font/google`. Dashboard = CSS grid of `ProjectCard`s (poster, status pill, engine badge,
  duration, Download when ready) + "Render a template" dialog.

**Ordered steps (each verifiable before moving on):**
1. Scaffold the monorepo + workspaces; `npm install`; typecheck compiles.
2. Write `docker-compose.yml` (Postgres 16 + MailHog; MinIO `profiles:[minio]` disabled); `docker
   compose up -d`; confirm `pg_isready` + MailHog UI :8025.
3. `packages/db`: schema.ts + drizzle-kit config + initial migration + client; `npm run db:migrate`;
   `psql` shows the 7 tables.
4. `packages/spec`: zod schemas + `validateSpec` + unit tests.
5. Auth: Auth.js v5 (`next-auth@5.0.0-beta.28` pinned) + Drizzle adapter + **Nodemailer→MailHog** +
   middleware + sign-in page; verify the full magic-link round trip via MailHog (Resend only as the
   R3 fallback).
6. Storage module + `/media/[...key]`; verify by curling a seeded file.
7. Templates catalog + `POST /api/projects` (seed project with poster).
8. `POST /api/jobs` + `GET /api/jobs/[id]`.
9. Worker: claim loop + `render.ts` + storage write + transitions + watchdog; seed a job and watch it
   go queued→running→done with a file in `.storage/`.
10. Dashboard UI + `useJobsPoll` + TemplatesDialog + Download.
11. `GET /api/templates` + CTA wiring.
12. `npm run typecheck` + `npm run lint` clean; run the manual e2e below.

**Exact verification commands:**
```bash
cd C:/source/shorts-with-claude/claude-faceless-shorts-creator/webapp
docker compose up -d
npm install
npm run db:migrate
npm run typecheck && npm run lint && npm run test
# terminal A:
npm run dev                  # web on :3000
# terminal B:
npm run worker               # worker on :3100
```
Manual proof (DoD): sign in via MailHog magic link → dashboard shows a project card with a poster →
"Render a template" → form-card → card goes queued→running with rising % → flips to ready → Download →
**play the mp4**. Also verify the anonymous `/dashboard` redirect and the `failed` path (bad spec →
card shows failed + error, not a hang).

**Prove done:** (1) all commands above green; (2) the manual e2e produced a downloadable mp4; (3) typecheck/
lint clean; (4) `.env.example` committed, `.env.local`/`.storage`/node_modules gitignored; (5) a short
summary of what you built + any Phase-0 dependency gaps (e.g. whether `renderSpec` existed or you used
the stopgap).
