// Zod schemas — the runtime source of truth for Spec validation (the TS port of
// tools/contracts.py). Mirrors types.ts; every API payload + job input in later
// phases validates against these.
import { z } from 'zod';

export const specEngineSchema = z.enum(['tsx', 'ai', 'vox', 'avatar']);

// ---------------------------------------------------------------------------
// Phase 1 (track alignment) — the content TRACK (mode) + language axis.
// 'mode' is what the engine's five tracks map onto; 'language'/'rtl' make Hebrew/RTL a
// first-class, declared property instead of today's implicit isRtlText detection.
// ---------------------------------------------------------------------------

/** The content tracks. 'tsx' is the default generic short; the rest are the engine modes. */
export const specModeSchema = z.enum(['tsx', 'ad', 'kids', 'ai', 'vox', 'avatar']);
export type SpecMode = z.infer<typeof specModeSchema>;

/** Supported spoken languages. Drives the voice list, RTL, captions, and nikkud handling. */
export const specLanguageSchema = z.enum(['en', 'he']);
export type SpecLanguage = z.infer<typeof specLanguageSchema>;

/** The Ad toolkit block (mode:'ad'). Structured CTA/end-card config — see lib/ads.tsx. */
export const adConfigSchema = z.object({
  business: z.string().optional(), // the business/brand name (Logo + AdEndCard)
  ctaText: z.string().optional(), // the call-to-action line on the end card
  price: z.number().optional(), // the offer price (PriceBadge)
  oldPrice: z.number().optional(), // the crossed-out "before" price (freier-proof math)
  currency: z.string().optional(), // e.g. '₪' — defaults per language
  phone: z.string().optional(), // WhatsApp / phone for the CTA
  website: z.string().optional(),
  logoAssetId: z.string().optional(), // an uploaded asset used as the Logo
  endCardHoldSec: z.number().positive().optional(), // how long the CTA end card holds
});
export type AdConfig = z.infer<typeof adConfigSchema>;

export const overlayStyleSchema = z.object({
  font: z.string().optional(),
  size: z.number().optional(),
  color: z.string().optional(),
  weight: z.number().optional(),
  align: z.string().optional(),
});

// Shared placement/timing base for both overlay kinds.
const overlayBase = z.object({
  id: z.string().min(1),
  x: z.number(),
  y: z.number(),
  w: z.number().positive().finite(), // w>0
  h: z.number().positive().finite(), // h>0
  rotation: z.number().optional(),
  opacity: z.number().min(0).max(1).optional(), // 0<=opacity<=1
  start: z.number().nonnegative().finite(),
  end: z.number().positive().finite(),
  animation: z.enum(['rise', 'fade', 'pop', 'none']).optional(),
});

// end > start is enforced at the spec level (withOverlayBoundsSchema) — a per-overlay
// .refine() would wrap the members in ZodEffects and break z.discriminatedUnion.
export const overlayTextSchema = overlayBase.extend({
  type: z.literal('text'),
  content: z.string().min(1),
  style: overlayStyleSchema.optional(),
});

export const overlayImageSchema = overlayBase.extend({
  type: z.literal('image'),
  assetId: z.string().optional(),
  src: z.string().optional(),
});

export const overlaySchema = z.discriminatedUnion('type', [overlayTextSchema, overlayImageSchema]);

/** A scene's AI-video clip reference (Phase 4 — mode:'ai'). Mirrors the image-overlay
 *  assetId/src convention; when present the worker runs an image-to-video clip for the
 *  scene (character ref → fal) and this points at the produced video asset. */
export const sceneClipSchema = z.object({
  assetId: z.string().optional(),
  src: z.string().optional(),
  durationSec: z.number().positive().optional(), // the clip's length (real, from ffprobe)
});

// ---------------------------------------------------------------------------
// Avatar track (HeyGen-IL) — mode:'avatar'. The "talking-head" engine.
// ---------------------------------------------------------------------------

/**
 * Talk config — the avatar's talking-head stage (mode:'avatar'). The worker's talk stage
 * (between voice and pixel) consumes a LOCKED face reference (a photo avatar OR a consented
 * 2-min digital-twin driver video) + the finished Hebrew voice track, and runs the lip-sync
 * backend to produce a talking-head clip. `faceAssetId`/`faceSrc` point at the avatar face
 * image or driver video; `talkModel` is the short backend id (resolved via resolveTalkModel);
 * `premium` selects the photoreal engine tier (the ~6× credit burn, like HeyGen IV/V).
 */
export const talkConfigSchema = z.object({
  faceAssetId: z.string().optional(), // the avatar's face/driver asset (characters ref)
  faceSrc: z.string().optional(), // direct /media src (photo avatar or driver video)
  talkModel: z.string().optional(), // short backend id; resolved server-side
  premium: z.boolean().optional(), // true → talkSecPremium burn (photoreal engine)
  driverVideo: z.boolean().optional(), // true → the face ref is a 2-min driver video (digital twin)
});
export type TalkConfig = z.infer<typeof talkConfigSchema>;

// ---------------------------------------------------------------------------
// Phase 5 — the VOX collage layer model (mode:'vox'). Mirrors the /make-vox paper-collage
// grammar (vox/DESIGN.md) so a spec can express a layered collage short WITHOUT hand-authored
// TSX — the spec-driven VoxSpec composition maps these onto the collage.tsx kit.
//
// A vox scene is a STACK of layers on one shared paper board, with a virtual camera that
// travels across the board (collage.tsx CollageBoard). Layers carry a `depth` for parallax.
// The paper background + camera keyframes live in the spec-level `voxConfig`; each scene's
// layers ride in `scene.vox.layers`.
// ---------------------------------------------------------------------------

/** The board surface behind every scene (paper texture; flat cream when src omitted). */
export const voxPaperSchema = z.object({
  src: z.string().optional(), // paper texture (a generated layer); relative /media path
});

/** One virtual-camera keyframe (collage.tsx CamKey): board-center + zoom at global frame f. */
export const voxCamKeySchema = z.object({
  f: z.number().int().nonnegative(), // global frame — strictly increasing across the list
  x: z.number(),
  y: z.number(),
  z: z.number().positive(), // zoom (1.0 = full board)
});

/** Base for every layer kind: board-center position, width, entrance, depth, idle drift. */
const voxLayerBase = z.object({
  id: z.string().min(1),
  x: z.number(), // board px of the layer CENTER
  y: z.number(),
  w: z.number().positive(), // layer display width in board px (height derives from asset aspect)
  at: z.number().int().nonnegative().optional(), // local entrance frame
  dur: z.number().int().positive().optional(), // entrance duration (frames)
  enter: z.enum(['pop', 'place', 'slide-l', 'slide-r', 'rise', 'fade', 'wipe', 'none']).optional(),
  rotate: z.number().optional(), // deg
  depth: z.number().optional(), // parallax: 0 = glued to board, + = foreground, - = far
  drift: z.number().optional(), // idle "breathing" multiplier; 0 = static
  z: z.number().int().optional(), // z-index within the scene
  style: z.enum(['plain', 'torn']).optional(), // torn paper + washi tape treatment (T10)
});

/** A die-cut photographic subject on the paper (collage.tsx Cutout). */
export const voxCutoutSchema = voxLayerBase.extend({
  type: z.literal('cutout'),
  // src is OPTIONAL until the pixel stage mints it: a vox scene can be authored/quoted with a
  // srcPrompt and no pixels yet; runVoxPixelStage fills src in place. A scene that reaches the
  // build/render with a cutout still missing src is a bug (VoxSpec renders nothing for it).
  src: z.string().min(1).optional(), // transparent PNG asset (/media path), minted at pixel stage
  srcPrompt: z.string().optional(), // generation prompt for gen_image.py (the layer's content)
  sticker: z.number().optional(), // white outline px (collage.tsx Cutout applies it; 0 = none)
  shadow: z.number().optional(), // 0..3 elevation
});

/** A bordered archival photo print with duotone/sepia treatment (collage.tsx ArchivalPhoto). */
export const voxPhotoSchema = voxLayerBase.extend({
  type: z.literal('photo'),
  src: z.string().min(1).optional(), // minted at pixel stage (see cutout.src note)
  srcPrompt: z.string().optional(), // generation prompt for gen_image.py
  treatment: z.enum(['sepia', 'mono', 'none']).optional(),
  caption: z.string().optional(),
});

/** A white annotation tag (collage.tsx LabelChip). */
export const voxLabelSchema = voxLayerBase.extend({
  type: z.literal('label'),
  text: z.string().min(1),
  size: z.number().optional(),
  accent: z.string().optional(), // left bar color
  kicker: z.string().optional(), // tiny overline
  kickerColor: z.string().optional(),
});

/** A red official stamp (collage.tsx RubberStamp). */
export const voxStampSchema = voxLayerBase.extend({
  type: z.literal('stamp'),
  text: z.string().min(1),
  size: z.number().optional(),
  color: z.string().optional(),
});

export const voxLayerSchema = z.discriminatedUnion('type', [
  voxCutoutSchema,
  voxPhotoSchema,
  voxLabelSchema,
  voxStampSchema,
]);

/** A scene's vox layer stack. */
export const voxSceneSchema = z.object({
  layers: z.array(voxLayerSchema).default([]),
});

/** The spec-level vox block: paper + camera, with per-scene layer stacks. */
export const voxConfigSchema = z.object({
  paper: voxPaperSchema.optional(),
  cam: z.array(voxCamKeySchema).min(1), // camera keyframes — at least one anchor
  grain: z.number().min(0).max(0.2).optional(), // film-grain opacity (0 = none)
});

export const sceneSchema = z.object({
  id: z.string().min(1),
  durationSec: z.number().positive().finite(), // durationSec > 0
  beatId: z.string().optional(),
  visual: z.string().optional(),
  overlays: z.array(overlaySchema).default([]),
  clip: sceneClipSchema.optional(), // Phase 4: AI-video clip backing this scene
  vox: voxSceneSchema.optional(), // Phase 5: the paper-collage layer stack for this scene
});

export const voiceWordSchema = z.object({
  w: z.string(),
  start: z.number(),
  end: z.number(),
});

export const voiceLineSchema = z.object({
  text: z.string(),
  start: z.number(),
  end: z.number(),
  words: z.array(voiceWordSchema).optional(),
});

export const voiceConfigSchema = z.object({
  engine: z.enum(['kokoro', 'edge', 'elevenlabs']),
  voiceId: z.string(),
  lines: z.array(voiceLineSchema),
});

export const captionsConfigSchema = z.object({
  preset: z.enum(['pop', 'pill', 'fade', 'karaoke']),
  burnIn: z.boolean(),
  style: z.record(z.unknown()).optional(),
});

export const sfxCueSchema = z.object({
  id: z.string(),
  at: z.number(),
  gainDb: z.number().optional(),
  // Phase 6: when true this cue is GENERATED (gen_sfx.py) rather than library-first.
  // Generated SFX is billable (CREDIT_TABLE.sfxGen); library cues are free. The id then
  // names the to-be-generated asset (the mix stage writes it under media/projects/<proj>/).
  generate: z.boolean().optional(),
});

export const musicConfigSchema = z.object({
  id: z.string(),
  duck: z.boolean().optional(),
  // Phase 6: when true the bed is GENERATED (gen_music.py) rather than a library bed —
  // billable (CREDIT_TABLE.musicGen). Library beds are free.
  generate: z.boolean().optional(),
});

export const audioConfigSchema = z.object({
  sfx: z.array(sfxCueSchema).optional(),
  music: musicConfigSchema.optional(), // singular music bed per spec
});

export const formatSchema = z.object({
  width: z.number().positive().finite(),
  height: z.number().positive().finite(),
  fps: z.number().positive().finite(),
});

export const themeSchema = z.object({
  accent: z.string().optional(),
  font: z.string().optional(),
});

export const metaSchema = z.object({
  revision: z.number().int().nonnegative(), // non-negative integer
  updatedAt: z.string(),
});

export const specSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  template: z.string().min(1),
  engine: specEngineSchema,
  // Phase 1: the content track + language. Optional so existing specs stay valid;
  // when absent, consumers infer mode from `template` and language from the text.
  mode: specModeSchema.optional(),
  language: specLanguageSchema.optional(),
  rtl: z.boolean().optional(), // declared RTL (redundant with but authoritative over detection)
  ad: adConfigSchema.optional(), // present only when mode==='ad'
  avatar: talkConfigSchema.optional(), // present only when mode==='avatar' (HeyGen-IL talking head)
  characterId: z.string().optional(), // Phase 2: locked character ref for consistent faces
  format: formatSchema,
  theme: themeSchema,
  voice: voiceConfigSchema.optional(),
  scenes: z.array(sceneSchema).min(1), // scenes non-empty
  captions: captionsConfigSchema.optional(),
  vox: voxConfigSchema.optional(), // Phase 5: paper + camera (mode==='vox')
  audio: audioConfigSchema.optional(),
  meta: metaSchema,
});

// ---------------------------------------------------------------------------
// Phase 3 — Generate wizard payload. POST /api/generate + the worker's
// runGenerate validate against this. The LOCKED vo[] lines (the user's approved
// script) ride in `script` — the worker's story stage starts from them verbatim.
// ---------------------------------------------------------------------------

/** Canonical generate-pipeline stage strings (worker walks them in order). The 'talk' stage
 *  (HeyGen-IL talking-head lip-sync) sits between voice and pixel and is a NO-OP for every
 *  track except engine==='avatar'. */
export const GENERATE_STAGES = ['story', 'voice', 'talk', 'pixel', 'build', 'qa', 'mix', 'render'] as const;
export type GenerateStage = (typeof GENERATE_STAGES)[number];

/** One locked VO line: exact approved text + an optional timing hint (start/end seconds). */
export const generateVoLineSchema = z.object({
  text: z.string().min(1), // never empty — the line WILL be spoken verbatim
  start: z.number().nonnegative().optional(), // hint; the voice stage replaces with real times
  end: z.number().positive().optional(),
});

/**
 * Voices the generate wizard can request. 'elevenlabs' is listed so the voice stage can run
 * it; the PAID gate stays server-side (a free-tier generate/render requesting elevenlabs is
 * rejected at the route/worker, not here).
 */
export const generateVoiceSchema = z.object({
  engine: z.enum(['kokoro', 'edge', 'elevenlabs']),
  voiceId: z.string().min(1),
});

export const generateCaptionsSchema = z.object({
  preset: z.enum(['pop', 'pill', 'fade', 'karaoke']),
  burnIn: z.boolean().default(true),
});

export const generatePayloadSchema = z.object({
  topic: z.string().min(1), // free-text topic OR the title; drives the deterministic story builder
  template: z.string().min(1), // the LAUNCH_TEMPLATES id (e.g. 'form-card')
  title: z.string().optional(),
  script: z.array(generateVoLineSchema).min(1).optional(), // the LOCKED vo[] lines — verbatim
  voice: generateVoiceSchema,
  captions: generateCaptionsSchema.default({ preset: 'pill', burnIn: true }),
  theme: themeSchema.optional(),
  // Phase 1: the chosen content track + language. Optional — when absent the worker infers
  // mode from the template and language from the locked script (current behavior).
  mode: specModeSchema.optional(),
  language: specLanguageSchema.optional(),
  ad: adConfigSchema.optional(), // the Ad toolkit block (mode==='ad')
  // Phase 6: the HeyGen-IL avatar block (mode==='avatar') — face/driver ref + talk model.
  avatar: talkConfigSchema.optional(),
  // Phase 2: the locked recurring character to condition every scene image on.
  characterId: z.string().optional(),
  // Phase 4: AI-video options. clipSeconds = per-scene fal clip length; aiModel = the
  // character's locked video model (seedance/veo/kling). Only meaningful for mode 'ai'.
  clipSeconds: z.number().positive().max(10).optional(),
  aiModel: z.string().optional(),
  // Phase 5: vox layer budget — how many AI collage layers the collage-layers pixel stage
  // may mint (each billed at CREDIT_TABLE.voxLayer). Only meaningful for mode 'vox'.
  voxLayers: z.number().int().positive().max(12).optional(),
  // Phase 6: the requested budget tier for this generate. The server resolves the CALLER's
  // actual tier and enforces capability — this field is the *intent* (e.g. the wizard's budget
  // slider picked 'pro'), validated against the caller's subscription server-side. Omitting it
  // means "cheapest tier that supports the mode".
  budgetTier: z.enum(['free', 'creator', 'pro']).optional(),
});

/** The script-preview request (POST /api/generate/script) — no voice/captions needed. */
export const generateScriptRequestSchema = z.object({
  topic: z.string().min(1),
  template: z.string().min(1),
  title: z.string().optional(),
  script: z.array(generateVoLineSchema).min(1).optional(),
  mode: specModeSchema.optional(),
  language: specLanguageSchema.optional(),
});

// A spec is valid only if EVERY overlay's scene-relative window fits inside its
// scene's duration. Enforced here (not in sceneSchema) because it needs the parent.
export const specWithOverlayBoundsSchema = specSchema.superRefine((spec, ctx) => {
  spec.scenes.forEach((scene, si) => {
    scene.overlays.forEach((ov, oi) => {
      if (ov.end <= ov.start) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `scene ${si} overlay ${oi} (${ov.id}): end(${ov.end}) must be > start(${ov.start})`,
          path: ['scenes', si, 'overlays', oi, 'end'],
        });
      }
      if (ov.start > scene.durationSec) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `scene ${si} overlay ${oi} (${ov.id}): start(${ov.start}) > scene.durationSec(${scene.durationSec})`,
          path: ['scenes', si, 'overlays', oi, 'start'],
        });
      }
      if (ov.end > scene.durationSec) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `scene ${si} overlay ${oi} (${ov.id}): end(${ov.end}) > scene.durationSec(${scene.durationSec})`,
          path: ['scenes', si, 'overlays', oi, 'end'],
        });
      }
    });
  });
});
