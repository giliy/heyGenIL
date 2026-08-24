// Spec / Scene / Overlay / … types — DERIVED from the zod schema (schema.ts is the
// single source of truth) so the TS types and the runtime validator can never drift.
// Mirrors `_shared-decisions.md` §Project spec.
import type { z } from 'zod';
import type {
  specSchema, sceneSchema, sceneClipSchema, overlaySchema, overlayTextSchema, overlayImageSchema,
  overlayStyleSchema, captionsConfigSchema, audioConfigSchema, voiceConfigSchema,
  voiceLineSchema, voiceWordSchema, formatSchema, themeSchema, metaSchema, specEngineSchema,
  generatePayloadSchema, generateScriptRequestSchema, generateVoLineSchema,
  generateVoiceSchema, generateCaptionsSchema, specModeSchema, specLanguageSchema,
  adConfigSchema, talkConfigSchema,
  voxConfigSchema, voxSceneSchema, voxLayerSchema, voxCutoutSchema, voxPhotoSchema,
  voxLabelSchema, voxStampSchema, voxCamKeySchema, voxPaperSchema,
} from './schema';

export type SpecEngine = z.infer<typeof specEngineSchema>;
export type { SpecMode, SpecLanguage, AdConfig, TalkConfig } from './schema';
export type { TrackDef, TrackMode, TrackLanguage } from './tracks';
export type OverlayStyle = z.infer<typeof overlayStyleSchema>;
export type Overlay = z.infer<typeof overlaySchema>;
export type OverlayText = z.infer<typeof overlayTextSchema>;
export type OverlayImage = z.infer<typeof overlayImageSchema>;
export type Scene = z.infer<typeof sceneSchema>;
export type SceneClip = z.infer<typeof sceneClipSchema>;
export type VoiceWord = z.infer<typeof voiceWordSchema>;
export type VoiceLine = z.infer<typeof voiceLineSchema>;
export type VoiceConfig = z.infer<typeof voiceConfigSchema>;
export type CaptionsConfig = z.infer<typeof captionsConfigSchema>;
export type AudioConfig = z.infer<typeof audioConfigSchema>;
export type SpecFormat = z.infer<typeof formatSchema>;
export type SpecTheme = z.infer<typeof themeSchema>;
export type SpecMeta = z.infer<typeof metaSchema>;
export type Spec = z.infer<typeof specSchema>;
export type GenerateVoLine = z.infer<typeof generateVoLineSchema>;
export type GenerateVoice = z.infer<typeof generateVoiceSchema>;
export type GenerateCaptions = z.infer<typeof generateCaptionsSchema>;
export type GeneratePayload = z.infer<typeof generatePayloadSchema>;
export type GenerateScriptRequest = z.infer<typeof generateScriptRequestSchema>;
export type { GenerateStage } from './schema';
// Phase 5 — the vox collage layer model.
export type VoxConfig = z.infer<typeof voxConfigSchema>;
export type VoxScene = z.infer<typeof voxSceneSchema>;
export type VoxLayer = z.infer<typeof voxLayerSchema>;
export type VoxCutout = z.infer<typeof voxCutoutSchema>;
export type VoxPhoto = z.infer<typeof voxPhotoSchema>;
export type VoxLabel = z.infer<typeof voxLabelSchema>;
export type VoxStamp = z.infer<typeof voxStampSchema>;
export type VoxCamKey = z.infer<typeof voxCamKeySchema>;
export type VoxPaper = z.infer<typeof voxPaperSchema>;
