// Canonical DB schema (Drizzle + Postgres 16). Mirrors _shared-decisions.md §Database.
// Phase 1 creates these; later phases only EXTEND (new columns/tables, never rename).
//
// IDs are cuid2 TEXT PKs (never uuid) per R11. Timestamps are timestamptz default now().
// The three Auth.js adapter tables (accounts/sessions/verificationTokens) match the
// exact shape @auth/drizzle-adapter expects — do not rename columns.
import { pgTable, text, integer, timestamp, jsonb, real, bigint, boolean, primaryKey, index, uniqueIndex } from 'drizzle-orm/pg-core';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

// ---------------------------------------------------------------------------
// users — Auth.js adapter shape. The installed @auth/drizzle-adapter (1.11.x) is the
// authority on these columns: it requires `emailVerified` (PgTimestamp) on users and
// a `sessionToken` PRIMARY KEY on sessions. (Supersedes the looser sketch in
// _shared-decisions.md, which omitted emailVerified and gave sessions a synthetic id PK.)
// ---------------------------------------------------------------------------
export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: timestamp('email_verified', { withTimezone: true }),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Auth.js adapter tables — exact column names/types the Drizzle adapter requires.
// (These are the documented adapter shapes; the adapter reads them by name.)
// ---------------------------------------------------------------------------
export const accounts = pgTable(
  'accounts',
  {
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })]
);

export const sessions = pgTable('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })]
);

// ---------------------------------------------------------------------------
// projects
// ---------------------------------------------------------------------------
export const projects = pgTable('projects', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  template: text('template').notNull(),
  // Phase 1 (track alignment): the render engine (tsx|ai) PLUS the content-track values
  // (ad|kids|vox) so non-tsx tracks persist. 'ai' covers both the engine and the ai track.
  engine: text('engine', { enum: ['tsx', 'ai', 'ad', 'kids', 'vox', 'avatar'] }).notNull().default('tsx'),
  // The content track, declared first-class (redundant with but authoritative over the
  // template-derived engine). Mirrors spec.mode; kept as a column for cheap filtering.
  mode: text('mode', { enum: ['tsx', 'ad', 'kids', 'ai', 'vox', 'avatar'] }).notNull().default('tsx'),
  status: text('status', { enum: ['draft', 'generating', 'ready', 'failed'] }).notNull().default('draft'),
  specJson: jsonb('spec_json'),
  posterKey: text('poster_key'),
  outputKey: text('output_key'),
  durationSec: real('duration_sec'),
  width: integer('width'),
  height: integer('height'),
  fps: integer('fps'),
  revision: integer('revision').notNull().default(0),
  // Phase 5: denormalized convenience for the dashboard filter. Source of truth stays
  // spec.format (recomputed by resize). '9:16' | '1:1' | '16:9'.
  aspectRatio: text('aspect_ratio').notNull().default('9:16'),
  // Phase 5: the "current" render version (the last completed render). FK to render_versions.
  // AnyPgColumn breaks the projects<->render_versions circular type reference.
  lastRenderedVersionId: text('last_rendered_version_id').references(
    (): AnyPgColumn => renderVersions.id,
    { onDelete: 'set null' }
  ),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// assets
// ---------------------------------------------------------------------------
export const assets = pgTable('assets', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  kind: text('kind', { enum: ['image', 'video', 'audio', 'consent_video', 'talk_clip'] }).notNull(),
  storageKey: text('storage_key').notNull(),
  url: text('url'),
  w: integer('w'),
  h: integer('h'),
  durationSec: real('duration_sec'),
  bytes: bigint('bytes', { mode: 'number' }),
  source: text('source', { enum: ['upload', 'ai', 'library'] }).notNull().default('upload'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// characters (Phase 2) — the productized locked recurring-character system. A user
// uploads a reference portrait; a mint job (gen_image --ref) locks a consistent
// character.png + a canonical specJson (incl. video_model for the Phase-4 AI track).
// refImageKey = the LOCKED canonical render (what every scene image is conditioned on).
// status: 'minting' while the mint job runs, then 'ready' once character.png is locked,
// 'failed' if minting errored (user can re-try). DELETE returns 409 while any project
// references the character (mirrors the asset-delete rule).
// ---------------------------------------------------------------------------
export const characters = pgTable('characters', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  status: text('status', { enum: ['minting', 'ready', 'failed'] }).notNull().default('minting'),
  // User's uploaded source portrait (source 'upload' asset).
  sourceImageKey: text('source_image_key'),
  // LOCKED canonical reference — what gen_image --ref points at for scene consistency.
  refImageKey: text('ref_image_key'),
  refImageUrl: text('ref_image_url'),
  // Canonical specJson (character.json parity): style lock + video_model for the AI track.
  specJson: jsonb('spec_json'),
  // The mint job that produced the lock (for progress/error surfacing).
  mintJobId: text('mint_job_id').references(() => jobs.id, { onDelete: 'set null' }),
  // HeyGen-IL (avatar track): the avatar KIND — 'stock' (marketplace), 'photo' (selfie →
  // talking photo avatar), or 'twin' (a consented 2-min digital-twin driver video).
  kind: text('kind', { enum: ['stock', 'photo', 'twin'] }).notNull().default('photo'),
  // The locked lip-sync face: for 'photo' a still front-facing portrait; for 'twin' the
  // driver video (both = the face/input the talk stage consumes).
  faceRefImageKey: text('face_ref_image_key'),
  // The chosen talk backend (short id: musetalk/liveportrait/omnihuman/kling-lipsync).
  talkModel: text('talk_model'),
  // Consent — the trust gate for any real-person footage. A Hebrew consent script read
  // aloud with a spoken code; verified same-person before the avatar may render.
  consentAssetKey: text('consent_asset_key'), // the recorded consent clip (asset 'consent_video')
  consentVerifiedAt: timestamp('consent_verified_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// jobs
// ---------------------------------------------------------------------------
export const jobs = pgTable('jobs', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  type: text('type', { enum: ['generate', 'render'] }).notNull().default('render'),
  status: text('status', { enum: ['queued', 'running', 'done', 'failed'] }).notNull().default('queued'),
  stage: text('stage'),
  progress: real('progress').notNull().default(0),
  inputJson: jsonb('input_json'),
  resultJson: jsonb('result_json'),
  error: text('error'),
  costCredits: integer('cost_credits').notNull().default(0),
  // Phase 4 (billing): credits RESERVED at submit time; deducted on done, refunded on fail.
  reservedCredits: integer('reserved_credits').notNull().default(0),
  // Phase 5: the aspect a resize render was asked for ('9:16'|'1:1'|'16:9'); null for normal renders.
  inputAspect: text('input_aspect'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  heartbeatAt: timestamp('heartbeat_at', { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// subscriptions (Phase 4) — one active row per user (upserted on Stripe webhook).
// Mirrors _shared-decisions.md §Database. Tier drives every paid gate (1080p,
// ElevenLabs, AI images). `creditsGranted` = credits allotted for the current period.
// ---------------------------------------------------------------------------
export const subscriptions = pgTable(
  'subscriptions',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    stripeCustomerId: text('stripe_customer_id'), // cus_... (test mode)
    stripeSubId: text('stripe_sub_id'),           // sub_...
    tier: text('tier', { enum: ['free', 'creator', 'pro'] }).notNull().default('free'),
    status: text('status').notNull().default('active'), // active|trialing|past_due|canceled|incomplete
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    creditsGranted: integer('credits_granted').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('subscriptions_user_id_uq').on(t.userId)]
);

// ---------------------------------------------------------------------------
// creditLedger (Phase 4) — APPEND-ONLY. Balance = the balanceAfter of the latest row
// for a user (materialized for cheap reads/audit). delta: +grant / -reserve / -deduct /
// +refund. reason: 'grant:creator:2026-08', 'reserve:render', 'deduct:render',
// 'refund:fail', 'pack:1000', … jobId is nullable (grants/packs have no job).
// ---------------------------------------------------------------------------
export const creditLedger = pgTable(
  'credit_ledger',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    jobId: text('job_id').references(() => jobs.id, { onDelete: 'set null' }), // nullable
    delta: integer('delta').notNull(),
    reason: text('reason').notNull(),
    balanceAfter: integer('balance_after').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('credit_ledger_user_created_idx').on(t.userId, t.createdAt),
    index('credit_ledger_job_idx').on(t.jobId),
  ]
);

// ---------------------------------------------------------------------------
// render_versions (Phase 5) — one row per COMPLETED render; the immutable history of
// a project. specJson is a FROZEN snapshot of what actually rendered. A version row is
// NEVER mutated; "restore" writes to a NEW revision (a new row). UNIQUE(projectId, revision)
// guarantees one version per rendered revision.
// ---------------------------------------------------------------------------
export const renderVersions = pgTable(
  'render_versions',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    revision: integer('revision').notNull(),
    format: jsonb('format'), // { width, height, fps } at render time
    outputKey: text('output_key'),
    posterKey: text('poster_key'),
    durationSec: real('duration_sec'),
    specJson: jsonb('spec_json'), // frozen Spec snapshot
    jobId: text('job_id').references(() => jobs.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('render_versions_project_revision_uq').on(t.projectId, t.revision),
    index('render_versions_project_idx').on(t.projectId),
  ]
);

// ---------------------------------------------------------------------------
// music_beats (Phase 5) — per-bed beat metadata, derived ONCE and cached (library-first;
// never re-analyze a bed already analyzed). bedId == media/library/music/catalog.json clip id.
// `times` are beat onsets in seconds (absolute within the clip); gridMs = 60000/bpm/2 (8ths).
// source: 'bpm-analyzed' | 'bpm-grid' | 'none' (beatless ambient beds are honest 'none').
// ---------------------------------------------------------------------------
export const musicBeats = pgTable('music_beats', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  bedId: text('bed_id').notNull(),
  bpm: real('bpm'),
  times: real('times').array(),
  gridMs: real('grid_ms'),
  source: text('source', { enum: ['bpm-analyzed', 'bpm-grid', 'none'] }).notNull().default('none'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// avatars (HeyGen-IL, Phase 1) — the STOCK avatar marketplace. Rows are seeded from the
// Hebrew-market stock set (locked synthetic faces via gen_image --ref). A user "picks" a
// stock avatar into their project (the talking-head face); unlike characters these are
// shared/global, not user-owned. `kind`: 'stock' always here (photo/twin live on characters).
// ---------------------------------------------------------------------------
export const avatars = pgTable('avatars', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  kind: text('kind', { enum: ['stock', 'photo', 'twin'] }).notNull().default('stock'),
  nameHe: text('name_he').notNull(), // Hebrew display name (e.g. "דנה — מרצה")
  faceImageKey: text('face_image_key'), // the locked stock face portrait (served via /media)
  faceImageUrl: text('face_image_url'),
  talkModel: text('talk_model'), // short talk backend id
  premium: boolean('premium').notNull().default(false), // premium (photoreal) engine
  active: boolean('active').notNull().default(true), // marketplace visibility toggle
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// brandKits (HeyGen-IL, Phase 1) — per-workspace Hebrew brand identity: logo, colors, fonts,
// and CTA copy. Mirrors HeyGen's Brand Kit. Consumed by the avatar/ad render (lib/ads.tsx)
// and the RTL templates.
// ---------------------------------------------------------------------------
export const brandKits = pgTable(
  'brand_kits',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    // Logo asset (an uploaded 'image' asset), for the ad end-card Logo + watermark.
    logoAssetId: text('logo_asset_id').references(() => assets.id, { onDelete: 'set null' }),
    accent: text('accent').notNull().default('#0b6ce0'), // brand accent hex
    font: text('font').notNull().default('hebrew'), // 'hebrew' | 'display' | 'body'
    // Default CTA copy for generated videos (e.g. "להזמנת תור בוואטסאפ").
    ctaText: text('cta_text'),
    phone: text('phone'),
    website: text('website'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('brand_kits_user_name_uq').on(t.userId, t.name)]
);
