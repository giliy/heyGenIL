# Phase 4 — Billing, credits & AI tier

> Scope: monetize. Stripe test-mode subscriptions + webhooks, a credit ledger with upfront quotes,
> reserve/deduct/auto-refund, free-vs-paid gating, watermark compositing, and per-scene **AI image**
> generation via `tools/gen_image.py`. AI **video** scenes (highest COGS) are flagged P1 and deferred.
> Builds on Phases 1–3. Every invariant below is already locked in `_shared-decisions.md` — this plan
> references it, never re-decides it.

---

## Goal

Turn the Phase 1–3 app into a metered product: a free tier (TSX-only, kokoro/edge voice, 720p + watermark,
monthly render quota) and a paid tier (1080p no-watermark, ElevenLabs, AI images) where every render shows
an **upfront credit cost** derived from the spec, credits are **reserved on submit, deducted on done,
auto-refunded on fail**, and AI image generation is gated to paid users and billed per image. Differentiators
kept: transparent flat pricing, **never charge a failed render**.

---

## Why this phase first / Dependencies

- Depends on **Phase 1** (auth + `users` table + `projects` + `jobs` + storage + render route) and
  **Phase 3** (generate pipeline, spec persisted per project). Phase 2's editor must be able to add an
  image overlay that holds an AI-generated asset (its overlay `src`/`assetId` contract is already locked).
- Depends on **Phase 0**'s spec-driven templates: quote + watermark + resolution all hang off the spec +
  renderMedia `scale`/`codec` options. If Phase 0 hasn't parametrized a composition yet, the quote still
  works (spec is independent), but the watermark/resolution toggle needs the parametrized render path.
- **Why billing before Phase 5 polish:** every downstream phase (mini-timeline, resize, SRT, publish) is
  paid-surface work; metering is the revenue foundation and unlocks real AI-image spend, which is the
  whole point of a paid tier.

---

## Exit criteria (definition of done)

Per `_shared-decisions.md` DoD (localhost, `docker compose up -d` + `npm run dev` + `npm run worker`):

- [ ] **Paid path:** a `creator`-tier user, in the editor **Media panel**, clicks "Generate image" for a
      scene → worker runs `tools/gen_image.py` (fal/Gemini) → the PNG lands in `media/projects/<proj>/`,
      becomes an image overlay in the spec, and the preview Player shows it. Render dialog shows the exact
      credit cost; render produces a **1080p, no-watermark** mp4 downloadable from the dashboard.
- [ ] **Free path:** a free user is gated (no AI-image button, ElevenLabs voices hidden, 1080p disabled),
      renders at **720p with a watermark**, and a failed render leaves their balance **unchanged** (ledger
      shows reserve then refund).
- [ ] `npm run typecheck` + lint clean; unit tests for the quote calculator + ledger transitions; e2e
      smoke: submit→progress→done on a paid project, and a webhook simulation grants credits.
- [ ] Stripe `stripe listen --forward-to localhost:3000/api/stripe/webhook` delivers a `checkout.session.completed`
      → credit grant is observable in the ledger + credit meter.

---

## Data model changes

`packages/db/src/schema.ts` — **extends** Phase 1 schema (never rename). Add two tables + one column + one enum:

```ts
// subscriptions — one active row per user (upserted on webhook)
subscriptions: {
  id: text('id').primaryKey(),            // cuid2
  userId: text('userId').notNull().references(() => users.id).unique(),
  stripeCustomerId: text('stripeCustomerId'),   // cus_...  (test mode)
  stripeSubId: text('stripeSubId'),             // sub_...   (null while trialing/one-shot)
  tier: text('tier', { enum: ['free','creator','pro'] }).notNull().default('free'),
  status: text('status').notNull().default('active'), // active|trialing|past_due|canceled|incomplete
  currentPeriodEnd: timestamp('currentPeriodEnd', { withTimezone: true }),
  creditsGranted: integer('creditsGranted').notNull().default(0), // credits for the current period
  createdAt / updatedAt
}

// creditLedger — append-only; balance = SUM(delta) of the last row per user
creditLedger: {
  id: text('id').primaryKey(),            // cuid2
  userId: text('userId').notNull().references(() => users.id),
  jobId: text('jobId').references(() => jobs.id),   // nullable (grants/packs have no job)
  delta: integer('delta').notNull(),      // +grant / -reserve / -deduct / +refund
  reason: text('reason').notNull(),       // 'grant:creator:2026-08', 'reserve:render', 'deduct:render', 'refund:fail', 'pack:1000'
  balanceAfter: integer('balanceAfter').notNull(), // materialized for cheap reads/audit
  createdAt: timestamp(...).defaultNow(),
}

// jobs — ONE new column for atomic deduct-on-done (worker writes it, refund flips sign)
jobs: { reservedCredits: integer('reservedCredits').notNull().default(0) }
```

- **Indexes:** `creditLedger(userId, createdAt)`, `creditLedger(jobId)` (refund lookup), `subscriptions(userId)`.
- **No new enum type on `projects.engine`** — AI-image overlays are still TSX renders; `engine:'tsx'` stays.
  AI-*video* scenes would need `engine:'ai'` later (P1) but that's a Phase-3 artifact, out of scope here.
- **Migrations:** add a `drizzle-kit` migration per change (Phase 1 established the flow). One migration adds
  all three.

---

## API routes

All under `apps/web/app/api`. Auth via the Phase-1 middleware (routes below are protected unless noted).

| Method/Path | Auth | Purpose | Notes |
|---|---|---|---|
| `POST /api/stripe/checkout` | user | Start checkout → returns Stripe Checkout session URL (client redirects) | `stripe.checkout.sessions.create`; `mode:'subscription'`; price from `STRIPE_PRICE_CREATOR`; `customer_email` = user email; success/cancel URL → `/dashboard` |
| `POST /api/stripe/portal` | user | Customer portal URL (cancel/update) | `stripe.billingPortal.sessions.create` |
| `POST /api/stripe/webhook` | **none** | Stripe webhook (verified by signature) | `constructEvent` with `STRIPE_WEBHOOK_SECRET`; handles `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted` |
| `GET /api/billing/me` | user | {tier, status, currentPeriodEnd, creditsBalance, creditsGranted, quotas:{rendersUsed,rendersMax}} | Single source for the top-bar meter + gating |
| `POST /api/quotes` | user | Body `{projectId}` → returns `{credits, breakdown:{tsxFlat, aiImages, aiVoiceLines, aiVideoSec}}` | Pure function of the spec; **does not** touch the ledger |
| `POST /api/jobs` (extended) | user | Existing render-submit route now: quote → check balance → **reserve** ledger row → insert job with `reservedCredits` | Reject 402 `{error:'insufficient_credits', shortfall}` if balance < quote |
| `POST /api/projects/[id]/ai-image` | user + **paid-only** | Enqueue a `generate` job (stage `pixel`) for one scene | Body `{sceneId, prompt, model?}`; returns `{jobId, costCredits}`; gated: free → 403 |
| `POST /api/billing/packs` | user | (P1) one-time credit pack purchase | Stub returning 501 unless built |

**Webhook semantics (the anti-credit-rage core):**
- `checkout.session.completed` → find user by `customer_email`/`client_reference_id`; upsert subscription
  (tier=`creator`, status=`active`, `currentPeriodEnd`); **grant** `CREDITS_PER_PERIOD` ledger row with
  `reason='grant:creator:<YYYY-MM>'`.
- `customer.subscription.updated`/`.deleted` → update status/periodEnd; on `canceled` set tier→`free`
  but **keep leftover credits** (they roll — builds trust; "keeps projects forever" differentiator).
- Refund-on-fail lives in the **worker**, not the webhook: on `jobs.status→failed` the worker writes
  `refund:fail` (`delta=+reservedCredits`). The webhook only handles money/subscription state.

---

## UI surface

**Top bar (app shell, all pages)** — a persistent credit meter: pill showing `⚡ {balance}` + tier badge
(`Free` / `Creator` / `Pro`). Click → `/billing`. Paid users also see `{rendersUsed}/{rendersMax}` this month.

**New `/billing` page** (`apps/web/app/billing/page.tsx`):
- **Plan cards:** Free (TSX only, kokoro/edge, 720p watermark, N renders/mo) · Creator (~$15/mo: 1080p
  no-watermark, ElevenLabs, AI images, credits/mo) · Pro (~$35/mo, **P1** — shows "soon").
- Active plan state from `GET /api/billing/me`; buttons: "Upgrade" (→ checkout redirect), "Manage" (→ portal),
  "Cancel" (→ portal).
- **Credit ledger table** (append-only view): date · reason · delta · balance. Cheap proof of the
  reserve/deduct/refund flow.
- **Pricing explainer card** (transparency differentiator): "1 credit ≈ $0.01" + the flat cost table
  (TSX 2–4 · AI image 3–5 · AI voice 1–2 · AI video 6–8/s) + **"Failed renders are always free."**

**Render dialog (Phase-2 editor / Phase-1 dashboard render button)** — extended:
- Shows the **upfront credit quote** (`POST /api/quotes`) with a line-item breakdown (TSX flat, AI images,
  ElevenLabs voice, AI video).
- Resolution selector: **720p** (free, always enabled) · **1080p** (paid only, disabled + lock icon on free).
- Balance readout: `Cost: 7 ⚡ · Balance: 42 ⚡`; if short → disabled button + "Need credits" → `/billing`.
- On free tier: a note "Free exports include a watermark" (toggle locked ON).

**Editor Media panel (left, Phase-2)** — on paid only:
- **"Generate image"** button per selected scene (or per empty image overlay slot). Click → inline prompt
  textarea + model select (`fast`/`pro`/`lite` from `gen_image.py`) + cost note "~3–5 ⚡, charged only on success".
  Submit → `POST /api/projects/[id]/ai-image` → progress in the scene strip → on done the image is
  **replaced into the overlay `src`** (keeps geometry/timing per Phase-2 replace-vs-add) and the Player updates.
- Free users see the button but it's **locked** with a "Part of Creator plan" tooltip → `/billing`.

**Gating helpers** (`apps/web/lib/billing.ts`): `useBilling()` hook → `{tier, credits, canAiImages, can1080,
canEleven, voiceEngine}` derived from `/api/billing/me`. Use it in: voice picker (hide ElevenLabs voices on
free), AI-image button, resolution selector, AI-video slots (P1).

---

## Worker changes

`apps/worker/` (Node 24 + `@remotion/renderer` + python tools). Files:
- `apps/worker/src/billing.ts` — ledger ops (shared via `packages/db`): `reserveCredits`, `deductCredits`,
  `refundCredits` — each inserts a `creditLedger` row with `balanceAfter = prev + delta`, wrapped in a
  transaction with the job-status update so **deduct and `done` are atomic** (no charge without a finished
  render; no render marked done without the charge).
- `apps/worker/src/quote.ts` — the canonical quote calculator (imported by web too via `packages/spec` or a
  shared util; put the pure function in `packages/spec/src/quote.ts` so web and worker never drift).
- **Render loop changes:**
  1. claim job (`FOR UPDATE SKIP LOCKED`, Phase 1) → `reservedCredits` already set by web submit.
  2. on progress `onProgress` → `jobs.progress` (Phase 1).
  3. on success: mux output → **post-process** (see below) → upload → transaction: `deductCredits` +
     `status='done'` + `resultJson.outputKey`.
  4. on fail: transaction: `refundCredits` (`delta=+reservedCredits`, `reason='refund:fail'`) +
     `status='failed'` + `error`.
  - **Never deduct twice:** reserve row (`-N`) + deduct row (`-N`) + refund (`+N`) net correctly because
    reserve is only *held* (not spent) — the spent amount is the single `deduct` row; reserve+refund cancel.
- **AI-image generate job** (`type='generate'`, `stage='pixel'`): reads `{projectId, sceneId, prompt, model}`;
  - cost stated upfront (`costCredits` from quote, `reserve` at submit like render);
  - runs `gen_image.py --prompt <prompt> --model <model> --aspect 9:16 --size 2K --out media/projects/<proj>/ai-<cuid>.png`
    with `.venv-voice312` interpreter (it needs `google-genai`; **not** the kokoro venv — create `.venv-image312`
    with `pip install google-genai pillow` OR reuse `.venv-voice312` if it already has genai — verify, document
    the choice);
  - on success: create `assets` row (`kind='image'`, `source='ai'`), insert an image overlay into
    `specJson.scenes[i].overlays` (or replace `src` on the targeted slot, `meta.revision++`), persist spec,
    then **deduct**;
  - on fail: **refund**, keep spec untouched. The dialog's "charged only on success" promise holds.

---

## Engine/Remotion changes

- **Post-render post-processing** (`apps/worker/src/postprocess.ts`) — two ffmpeg passes after `renderMedia`
  (reuse `tools/ffw.py`-resolved ffmpeg via the worker):
  - **Resolution:** render at 1080 always (`scale:1`); if free → ffmpeg `-vf scale=720:1280` (or `-vf scale=-2:1280`)
    to a 720p mp4.
  - **Watermark:** free only → burn a semi-transparent brand lockup into the lower-third above the SAFE
    bottom zone (`short-16` SAFE.bottom=500). Reuse the brand gradient (`#6366F1→#9b7cc4`) — draw a small
    `"made with <brand>"` mark via a **pre-rendered watermark PNG** (generate once with `renderStill` at
    Phase 0 from a tiny composition, or ship a static PNG in `media/library/brand/`), composite with
    `ffmpeg -i out.mp4 -i wm.png -filter_complex "overlay=...:main_w/2-overlay_w/2:1440"`.
  - **Clean paid path:** no post-process (or a no-op pass) → exactly the source render, no quality loss.
- **No engine .tsx edits required** for Phase 4 core: watermark/resolution are *post-render ffmpeg*, so the
  free/paid split never touches `remotion/src/shots/*`. (If a future phase wants an *in-composition* animated
  watermark, add a `watermark` field to the spec — deferred, P1.)
- **AI image overlays:** the Phase-0 spec renderer already consumes `overlays[]` of `type:'image'` with
  `src`; AI-generated PNGs are written under `media/projects/<proj>/` and referenced by URL — no new Remotion
  component. Must verify the parametrized template's image overlay actually renders `src` (Phase 0 exit).

---

## Infra & env (docker-compose, .env)

**docker-compose.yml** — add **nothing** new (Stripe is an external API; MailHog already catches Stripe test
emails). Keep Postgres + MailHog from Phase 1. Optional: a `stripe-cli` service is NOT recommended in compose
(run `stripe listen` on the host so the webhook secret can rotate freely).

**.env additions** (repo root — never committed):
```
STRIPE_SECRET_KEY=sk_test_...              # test mode
STRIPE_WEBHOOK_SECRET=whsec_...            # from `stripe listen` / dashboard
STRIPE_PRICE_CREATOR=price_...             # creator monthly price ID (test)
STRIPE_PRICE_PRO=price_...                 # pro price ID (P1)
APP_URL=http://localhost:3000
CREDITS_PER_PERIOD=500                     # creator monthly credit grant
FREE_RENDERS_PER_MONTH=10
STORAGE_DIR=./.storage
AI_IMAGE_VENV=.venv-image312               # python env for gen_image.py
GEMINI_API_KEY=...                         # already supported by engine (gen_image.py)
FAL_KEY=...                                # already supported (fal path)
```

**Package deps:**
- `apps/web`: `stripe` (v16+), `@stripe/stripe-js` (v4+).
- `apps/worker`: `stripe` (signature verification via `stripe.webhooks.constructEvent` — put the webhook
  handler in `apps/web` and let the worker just read env; worker needs no Stripe lib unless doing portal work).
- `packages/spec`: no new deps (pure quote fn).

**Commands to bring up:**
```bash
docker compose up -d                 # postgres + mailhog (Phase 1)
npm run dev                          # web on :3000
npm run worker                       # worker on :3100
stripe login && stripe listen --forward-to localhost:3000/api/stripe/webhook
# -> note the printed whsec_ secret, put it in .env as STRIPE_WEBHOOK_SECRET, restart web
```

---

## Task list

### P0 — must
- [ ] **T1 · DB**: add `subscriptions`, `creditLedger`, `jobs.reservedCredits` to `packages/db/src/schema.ts`;
      write drizzle migration; run it.
- [ ] **T2 · Quote calculator**: `packages/spec/src/quote.ts` — `quoteSpec(spec, tier): Quote` with the flat
      table (TSX 2–4 flat · AI image 3–5 each · ElevenLabs voice 1–2/line · AI video 6–8/s, P1). Unit tests.
- [ ] **T3 · Ledger service**: `packages/db/src/ledger.ts` — `balanceOf`, `reserve`, `deduct`, `refund`
      (transactional, `balanceAfter` materialized). Unit tests.
- [ ] **T4 · Stripe setup**: add `stripe` dep; `.env` keys; `POST /api/stripe/checkout`, `POST /api/stripe/portal`.
- [ ] **T5 · Webhook**: `POST /api/stripe/webhook` (signature-verified) handling
      `checkout.session.completed` → upsert subscription + credit grant.
- [ ] **T6 · `/api/billing/me`**: tier/status/balance/quotas for the meter + gating.
- [ ] **T7 · `/api/quotes`**: return the upfront quote for a project.
- [ ] **T8 · `/api/jobs` gating**: free vs paid resolution/watermark enforced server-side (a free user can't
      sneak a 1080p/no-watermark render by editing the request); reserve-on-submit, 402 on short.
- [ ] **T9 · Worker deduct/refund**: atomic deduct-on-done + auto-refund-on-fail on the render loop.
- [ ] **T10 · Post-process (resolution + watermark)**: `postprocess.ts` for free-tier 720p + watermark burn;
      paid = clean 1080p.
- [ ] **T11 · AI-image generate job**: `POST /api/projects/[id]/ai-image` (paid-only 403 gate) → worker runs
      `gen_image.py` → writes asset + overlay into spec → deduct/refund. Reuse Phase-3 generate job plumbing.
- [ ] **T12 · UI meter + `/billing` page**: top-bar credit pill; plan cards; ledger table; pricing explainer.
- [ ] **T13 · Editor Media AI-image button + render-dialog quote/resolution** (paid gate, watermark note).
- [ ] **T14 · E2E smoke**: paid render 1080p no-watermark + free 720p watermark + refund-on-fail observable.

### P1 — nice (post-P0, some already flagged in master plan)
- [ ] **P1-a · AI video scenes** (`engine:'ai'`, fal ~$0.058/s, 6–8cr/s) — highest COGS, deferred by design.
- [ ] **P1-b · One-time credit packs** (`/api/billing/packs` + `checkout` one-shot price).
- [ ] **P1-c · Pro tier** (voice cloning, bigger credits, rollover) — mostly config once P0 plumbing exists.
- [ ] **P1-d · In-composition animated watermark** (spec `watermark` field) as an alternative to post-process.
- [ ] **P1-e · Priority queue flag** on paid render jobs (worker claims paid first).
- [ ] **P1-f · Background remover** (paid extra) once an AI-image pipeline exists.

---

## Risks & gotchas

| Risk | Mitigation |
|---|---|
| **Double-deduct / refund asymmetry** corrupting the ledger | Reserve = hold (negative row), deduct = actual spend (negative), refund = +reserved. Balance math is additive; unit-test all transitions + net-zero on fail. Deduct+`done` in one transaction. |
| Free user forges a 1080p/no-watermark render | Enforce tier at the **server** (worker re-checks the user's tier before render + post-process); never trust the client resolution field. |
| Webhook replay / missing signature | Verify with `constructEvent` + `whsec_`; the grant reason is idempotent-ish (per `checkout.session` id) — dedupe by storing `stripeSubId` and only granting once per session. |
| Failed AI-image generation leaves a half-overlay or charges | Run `gen_image.py` to a temp file; only write the asset/overlay + deduct after the PNG exists; refund on any exception. |
| Watermark burns into the SAFE-bottom zone / looks off-brand | Composite in the lower-third above y≈1440 (below SAFE.bottom=500 on 1920 height → y 1440 is the last visible-safe line for the mark; keep small + semi-transparent); brand gradient PNG, pre-generated. |
| `.venv-voice312` lacks `google-genai` for `gen_image.py` | Create a dedicated `.venv-image312` (`pip install google-genai pillow`); document which venv runs which tool (worker reads `AI_IMAGE_VENV`). |
| Stripe test emails don't arrive / `stripe listen` secret mismatch | MailHog on :8025 catches Stripe emails; confirm the `whsec_` in `.env` matches the running `stripe listen` output; restart web after updating. |
| Quota "rendersUsed" drifts across restart | Compute from `creditLedger` rows in the current period (count `deduct:render` since period start) — no separate counter to go stale. |
| Credit meter races (two submits at once) | Balance check + reserve inside a transaction with `FOR UPDATE` on the user's latest ledger row (or a `SELECT ... FOR UPDATE` on `users`). |

---

## Test plan

**Unit (`npm test` in `packages/spec` + `packages/db`):**
- `quote.test.ts`: spec with N scenes, M AI images, K ElevenLabs lines → exact expected breakdown; free-tier
  forces 720p/watermark but quote is resolution-independent (resolution is a post-process, not a credit item);
  empty/AI-video spec (P1) handled.
- `ledger.test.ts`: reserve→deduct leaves `balance - spend`; reserve→refund returns to start (net-zero);
  `balanceAfter` chain integrity; concurrent reserve rejects on short balance.

**Integration (worker + db):**
- Render job that fails at renderMedia → assert ledger has `reserve` + `refund`, `status='failed'`, no `deduct`.
- Render job that succeeds → `reserve` + `deduct`, `status='done'`, `outputKey` present, balance decreased by
  exactly the quote.
- AI-image job success → asset row + image overlay in spec + deduct; AI-image job fail → no asset, no overlay,
  refund.

**E2E smoke (manual or Playwright where Phase-1 set it up):**
1. `docker compose up -d && npm run dev && npm run worker`.
2. `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
3. Free user: open a project → render dialog shows **720p only**, watermark note; Media panel AI-image button
   is **locked**; voice picker hides ElevenLabs. Submit render → wait → download is **720p with watermark**.
4. Force a render fail (e.g. kill worker mid-render or corrupt an asset) → dashboard shows failed; `/api/billing/me`
   balance is **unchanged** (ledger: reserve + refund).
5. Paid path: upgrade via `/billing` → Stripe test checkout → webhook fires → credit grant visible in the
   meter + ledger. Reload editor → AI-image button unlocked → generate an image into a scene → Player shows it,
   exact cost deducted. Render dialog shows the quote → render → **1080p, no watermark**.
6. Confirm MailHog (:8025) received the Stripe test email(s).

---

## Agent brief

Copy the block below verbatim as the prompt for the agent executing Phase 4.

````markdown
You are implementing **Phase 4 — Billing, credits & AI tier** of the shorts web app. Repo root:
`C:/source/shorts-with-claude/claude-faceless-shorts-creator`. Read these FIRST, in order:
`webapp/plans/_shared-decisions.md` (LOCKED invariants — layout, ports, DB schema, Spec type, auth,
billing model, job flow, DoD), then `webapp/plans/phase-4-billing-ai.md` (this plan — your spec),
then `WEBAPP-PLAN.md` §6 + §7 for product intent. Engine tools you'll drive: `tools/gen_image.py`
(flags: `--prompt --model fast|pro|lite --aspect 9:16 --size 2K --out <path>`; needs GEMINI_API_KEY),
`tools/ffw.py` (ffmpeg resolution), `tools/gen_voice.py` (ElevenLabs vs kokoro). Spec/overlay contract,
ports, DB tables, and job flow are all locked in `_shared-decisions.md`.

**Constraints (hard):** everything on localhost (Postgres :5432, MailHog :1025/:8025, web :3000, worker
:3100). Do NOT build later-phase features (AI *video* scenes, credit packs, Pro tier, in-composition
watermark, priority queue — all P1, skip). Do NOT contradict `_shared-decisions.md`. Extend the Phase-1
schema; never rename columns. Credit model: `1 credit ≈ $0.01`; quote upfront, reserve on submit,
deduct on done, auto-refund on fail; ledger is append-only with materialized `balanceAfter`. Free tier =
TSX-only, kokoro/edge voice, 720p + watermark, monthly render quota. Paid (Creator) = 1080p no-watermark,
ElevenLabs, AI images. Differentiators: transparent flat pricing; **never charge a failed render**;
failed generations always free.

**Ordered steps (follow this):**
1. **T1 DB** — add `subscriptions`, `creditLedger` (append-only, `balanceAfter`), and
   `jobs.reservedCredits` to `packages/db/src/schema.ts`; write + run the drizzle migration.
2. **T2 quote** — `packages/spec/src/quote.ts`: `quoteSpec(spec, tier)` → `{credits, breakdown}` using the
   flat table: TSX render 2–4 flat; AI image 3–5 each; ElevenLabs voice line 1–2; AI video sec 6–8 (P1,
   count 0 now). Unit test.
3. **T3 ledger service** — `packages/db/src/ledger.ts`: `balanceOf/reserve/deduct/refund`, each a
   transactional insert computing `balanceAfter = prev + delta`. Unit test net-zero-on-fail.
4. **T4–T5 Stripe** — add `stripe` (+`@stripe/stripe-js`) to `apps/web`; `.env` keys
   (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_CREATOR`, `CREDITS_PER_PERIOD`,
   `FREE_RENDERS_PER_MONTH`, `APP_URL`, `AI_IMAGE_VENV`); `POST /api/stripe/checkout`,
   `POST /api/stripe/portal`; `POST /api/stripe/webhook` verified via `constructEvent`, handling
   `checkout.session.completed` → upsert subscription + grant `CREDITS_PER_PERIOD` ledger row
   (`reason:'grant:creator:<YYYY-MM>'`), and `customer.subscription.updated|deleted` → status/tier.
5. **T6** — `GET /api/billing/me` → `{tier,status,currentPeriodEnd,creditsBalance,creditsGranted,
   quotas:{rendersUsed,rendersMax}}`; `rendersUsed` = count of `deduct:render` ledger rows this period.
6. **T7** — `POST /api/quotes` → quote for a project (pure, no ledger write).
7. **T8** — extend `POST /api/jobs`: quote → check balance (transactional) → 402 if short → `reserve` →
   insert job with `reservedCredits`. **Enforce tier server-side** (worker re-checks before render): free
   user renders 720p + watermark, paid renders 1080p clean.
8. **T9** — worker render loop: on success transaction `deduct` + `status='done'`; on fail transaction
   `refund` (`delta=+reservedCredits`, `reason='refund:fail'`) + `status='failed'`. Never double-deduct.
9. **T10** — `apps/worker/src/postprocess.ts`: paid = clean 1080p (no pass); free = ffmpeg
   `scale=-2:1280` (720p) + burn a semi-transparent brand watermark PNG (pre-render via `renderStill` or
   ship in `media/library/brand/`) composited in the lower-third above the SAFE bottom (y≈1440).
10. **T11** — `POST /api/projects/[id]/ai-image` (paid-only, 403 on free): enqueue a Phase-3 `generate`
    job `stage='pixel'`; worker runs `gen_image.py --model <model> --aspect 9:16 --size 2K --out
    media/projects/<proj>/ai-<cuid>.png` in the venv from `AI_IMAGE_VENV`; on success create an `assets`
    row (`source:'ai'`), insert/replace the image overlay into `specJson.scenes[i].overlays` with
    `meta.revision++`, persist, then `deduct`; on fail `refund` and leave the spec untouched. State the
    derived cost BEFORE generating.
11. **T12–T13 UI** — top-bar credit meter (`useBilling()` from `/api/billing/me`); `/billing` page (plan
    cards, Manage/Cancel via portal, ledger table, pricing explainer incl. "Failed renders are always
    free"); render-dialog upfront quote + resolution selector (720p free / 1080p paid, watermark note);
    editor Media "Generate image" button (locked on free, inline prompt+model on paid).
12. **T14 E2E smoke** — see verification below.

**Conventions:** Tailwind v4 + shadcn/ui + Radix, brand tokens from `brand.md` (indigo `#6366F1`, Space
Grotesk display). All money = integer credits. `npm run typecheck` + lint clean. Run from repo root.

**Exact verification commands:**
```bash
cd webapp && docker compose up -d
npm run dev &            # web :3000
npm run worker &         # worker :3100
cd <repo-root> && stripe login && stripe listen --forward-to localhost:3000/api/stripe/webhook
# copy the whsec_ secret into .env as STRIPE_WEBHOOK_SECRET, restart web
npm test --workspace packages/spec --workspace packages/db   # unit
```

**Manual proof of done (DoD):**
- **Free:** open a project → render dialog shows only 720p + watermark note; Media AI-image button locked;
  ElevenLabs voices hidden. Render → download is **720p with watermark**.
- **Refund:** make a render fail (kill worker mid-render) → dashboard shows `failed`; `/api/billing/me`
  balance **unchanged**; ledger shows `reserve` then `refund` (net-zero).
- **Paid:** `/billing` → Stripe test checkout → webhook grant shows in the meter + ledger. Editor Media →
  "Generate image" → AI image lands in the scene, Player shows it, exact cost deducted. Render dialog shows
  the upfront quote; render → **1080p, no watermark**.
- MailHog :8025 received Stripe test email(s).

Report back: file paths changed, migration applied, ledger-transition test output, and the two e2e results
(free watermarked 720p + paid clean 1080p + refund net-zero).
````
