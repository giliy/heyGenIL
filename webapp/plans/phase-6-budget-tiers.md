# Phase 6 — Budget tiers & enforcement (session notes)

> Session of 2026-08-23. Also closed out the tail of Phase 5 (vox QA). Full plan:
> `~/.claude/scratch/track-alignment-plan.html` (7-phase track-alignment plan).

## Phase 5 close-out (completed first)

The interrupted Phase 5 QA was finished before Phase 6 began:

- **Blank-render false alarm resolved.** VoxSpec phone-scale QA frames *looked* blank in tiny
  thumbnails but PIL pixel analysis proved real content (mean RGB ≈ (220,224,183) warm cream,
  ~12k unique colors at full res). Cropped full-res frame confirmed the `PAPER-COLLAGE`
  label chip renders legibly. Lesson: **don't trust compressed thumbnails — pixel-analyze.**
- **`VoxSpec.tsx`**: image layers (`cutout`/`photo`) with no `src` now render nothing
  (`return null`) instead of `staticFile('')` → 404. src is minted later by the pixel stage,
  so a spec authored before generation must still render.
- Cleanup: deleted `VoxDebug.tsx` diagnostic + temp QA frames, regenerated the registry.
- Gates at close: worker typecheck clean, spec vitest 99/99, VoxSpec bundles + renders.

## Phase 6 work

### 1. CREDIT_TABLE rows for generated audio (`packages/spec/src/quote.ts`)

```
sfxGen: 2    # per generated SFX cue (gen_sfx.py)
musicGen: 4  # per generated music bed (gen_music.py)
```

- `sfxCueSchema` / `musicConfigSchema` gained an optional `generate: z.boolean()` marker
  (`packages/spec/src/schema.ts`). **Library cues/beds stay FREE (reuse-first);** only
  `generate: true` bills. `quoteSpec` counts generated audio into `breakdown.audioGen`
  + total. Note: `gen_sfx.py`/`gen_music.py` exist in `tools/` but the worker has no
  generation path wired yet (mix stage is library-first, P1) — the schema marker +
  pricing rows are the deliverable; the generation job is future work.

### 2. Tier config as shared data (`packages/spec/src/tiers.ts`, NEW)

The single source of truth for "what can this tier do":

- `TIERS`: free / creator / pro, each with price, `rendersPerMonth` (null = unbounded),
  `watermark`, `maxResolution`, and a `capabilities` map:
  `elevenlabsVoice, aiImage, aiVideoClip, voxCollageLayers, audioGen, priorityQueue`.
  - free: 720p + watermark, 10 renders/mo, **no paid capability**, tsx track only.
  - creator: 1080p clean, unbounded, elevenlabs + aiImage + audioGen, tracks tsx/ad/kids.
  - pro: everything + aiVideoClip + voxCollageLayers + priorityQueue, all 5 tracks.
- Helpers: `tierAtLeast`, `tierAllows`, `tierAllowsTrack`, `getTier`.
- `CREDIT_BASIS` mirrors `CREDIT_TABLE` — published so the wizard/billing page show honest
  per-block prices without recomputing.
- 9 new tests in `tiers.test.ts`.

### 3. `GET /api/billing/tiers` (NEW route)

Publishes the unlock matrix + creditBasis as data (free's rendersPerMonth reflects the
`FREE_RENDERS_PER_MONTH` env override). Authed, pure read, no ledger touch.

### 4. Server-side tier→capability enforcement (matrix-driven everywhere)

- **`POST /api/generate`**: new track→tier gate — free can only generate tsx; creator adds
  ad/kids; pro adds ai/vox (`track_requires_tier`, 403). New `budgetTier` payload field
  (the wizard's intent) is validated against the caller's real tier
  (`budget_tier_exceeds_subscription`, 403). Resolved `tier` is stamped into the job input.
- **`POST /api/jobs`**: resolution/watermark + ElevenLabs gate now read from the matrix
  (`getTier(...).watermark/maxResolution`, `tierAllows(..., 'elevenlabsVoice')`) instead of
  a hardcoded `isPaid` boolean.
- **ai-image / ai-clip / collage-layers routes**: gates refactored from `isPaidTier` to
  `tierAllows` with the right capability. **Real tightening:** `aiVideoClip` and
  `voxCollageLayers` are **pro-only** now — creator previously passed the old paid-only
  check for clips/collage layers.
- **Worker `render.ts`**: the tier re-check reads the SAME matrix (`getTier`/`tierAllows`),
  so web submit and worker execution can never drift.

### 5. Pro realized (Stripe)

- `stripe.ts`: `STRIPE_PRICE_PRO` env + `proPriceId()` + `priceIdForPlan(plan)`;
  `apps/web/.env.example` documents it.
- **Checkout**: accepts `{ plan: 'creator'|'pro' }` (default creator), puts the plan in
  session metadata.
- **Webhook**: grants **idempotently per plan+month** (`grant:pro:2026-08` —
  replay-safe dedupe by ledger reason), upserts the subscription with the correct tier,
  and `customer.subscription.updated` now **preserves the stored tier** on renewal
  (previously hardcoded 'creator' — Pro would have been demoted on every renewal update).
- **Billing page**: Pro card is live (removed "Soon"/disabled button), checkout wired with
  the plan, Creator price corrected to $12/mo, and the pricing table is driven by
  `/api/billing/tiers` creditBasis (with a static fallback). Feature lists updated to match
  the real matrix (creator: SFX+music, ad+kids; pro: AI video, vox collage, priority).
- Publish stays a **501 stub** — real OAuth upload is deliberately out of scope this phase.

## Gates (all green)

| Gate | Result |
|---|---|
| spec vitest | **110/110** (was 99 → +2 audioGen quote tests, +9 tiers tests) |
| web typecheck | 0 errors |
| worker typecheck | 0 errors |

## Phase 6 exit criterion (from the plan)

> Each tier renders its reference video at quoted cost ±10%; free is hard-blocked
> server-side from ElevenLabs/AI-image/AI-clip/1080p; Pro checkout grants credits
> idempotently (replay-safe).

- Free hard-block: ✅ server-side via the matrix (routes + worker re-check).
- Idempotent Pro grant: ✅ per plan+month ledger dedupe.
- Quoted-cost ±10% per tier: priced by CREDIT_TABLE; a live per-tier reference render is
  the remaining smoke test (needs Stripe test keys in `.env.local` to exercise checkout).

## Files touched

```
packages/spec/src/quote.ts        + sfxGen/musicGen rows, audioGen breakdown, countAudioGen
packages/spec/src/quote.test.ts   + 2 audio quote tests (12 total)
packages/spec/src/schema.ts       + sfx/music generate markers, generatePayload.budgetTier
packages/spec/src/tiers.ts        NEW — TIERS matrix + CREDIT_BASIS + helpers
packages/spec/src/tiers.test.ts   NEW — 9 tests
packages/spec/src/index.ts        + export './tiers'
apps/web/src/app/api/billing/tiers/route.ts   NEW — GET /api/billing/tiers
apps/web/src/app/api/generate/route.ts        track gate + budgetTier validation + tier stamp
apps/web/src/app/api/jobs/route.ts            matrix-driven resolution/watermark/voice gates
apps/web/src/app/api/projects/[id]/ai-image/route.ts       tierAllows('aiImage')
apps/web/src/app/api/projects/[id]/ai-clip/route.ts        tierAllows('aiVideoClip')
apps/web/src/app/api/projects/[id]/collage-layers/route.ts tierAllows('voxCollageLayers')
apps/web/lib/stripe.ts            + proPriceId/priceIdForPlan
apps/web/src/app/api/stripe/checkout/route.ts plan param → metadata
apps/web/src/app/api/stripe/webhook/route.ts  per-plan idempotent grant + tier-preserving update
apps/web/src/app/(main)/billing/page.tsx      Pro live, $12 creator, data-driven pricing table
apps/web/.env.example             + STRIPE_PRICE_PRO
apps/worker/src/render.ts         matrix-driven tier re-check
```

## Next — Phase 7: Multi-tenant hardening

Per-tenant media/library namespaces + storage keys · rate limits on paid job routes ·
per-tenant Stripe customers + creditLedger audit trail · 50-concurrent-render soak of the
PG claim loop (`FOR UPDATE SKIP LOCKED`). Exit: two tenants run concurrent multi-track
generates with no asset/ledger cross-visibility.
