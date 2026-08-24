// The editor store — zustand + immer, with zundo temporal history on the `doc` slice only.
//
// Slices:
//   doc      — the Spec (single source of truth) + captionsDirty flag. Tracked by zundo.
//   ui       — selection + active tabs. NOT tracked by undo.
//   playback — playhead frame + playing flag (synced FROM the Player). NOT tracked.
//
// zundo records a history entry per `set` on the doc slice. Moveable drags call
// pauseTemporal()/resumeTemporal() so a whole drag coalesces into ONE undo entry.
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { temporal } from 'zundo';
import type { Spec, Scene, Overlay, VoiceLine, CaptionsConfig, AdConfig } from '@shorts/spec';
import {
  clampOverlayToScene,
  splitLineAtChar,
  mergeLines,
  nudgeLine,
  newId,
  specToFrames,
} from '@shorts/spec';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LeftTab = 'scenes' | 'media' | 'captions' | 'audio' | 'ad';
export type InspectorTab = 'style' | 'timing' | 'animation';

export interface DocSlice {
  spec: Spec;
  /** True when any caption edit diverged voice.lines from the muxed audio (display-only). */
  captionsDirty: boolean;
}

export interface UiSlice {
  selectedSceneId: string | null;
  selectedOverlayId: string | null;
  activeLeftTab: LeftTab;
  inspectorTab: InspectorTab;
  /** Reported by useAutosave; shown in the TopBar. Not undoable. */
  saveStatus: 'idle' | 'dirty' | 'saving' | 'saved' | 'conflict' | 'error';
}

export interface PlaybackSlice {
  currentFrame: number;
  playing: boolean;
}

export interface EditorActions {
  // --- lifecycle ---
  loadSpec: (spec: Spec) => void;
  markSaved: (revision: number) => void;

  // --- title ---
  setTitle: (title: string) => void;

  // --- ad toolkit (Phase 3) — mutate the ad{} spec block (persisted via autosave) ---
  updateAd: (patch: Partial<AdConfig>) => void;

  // --- scenes ---
  addScene: () => string;
  duplicateScene: (sceneId: string) => string | null;
  removeScene: (sceneId: string) => void;
  moveScene: (fromIndex: number, toIndex: number) => void;
  setSceneDuration: (sceneId: string, durationSec: number) => void;

  // --- overlays ---
  addOverlay: (sceneId: string, overlay: Overlay) => void;
  updateOverlay: (sceneId: string, overlayId: string, patch: Partial<Overlay>) => void;
  removeOverlay: (sceneId: string, overlayId: string) => void;
  /** Replace an image overlay's asset — keeps id/geometry/animation/timing, swaps src/assetId only. */
  replaceOverlayAsset: (sceneId: string, overlayId: string, assetId: string | undefined, src: string) => void;

  // --- captions (display-only edits; each sets captionsDirty) ---
  setCaptionLine: (index: number, text: string) => void;
  splitCaption: (index: number, charOffset: number) => void;
  mergeCaptions: (index: number) => void;
  nudgeCaption: (index: number, deltaSec: number) => void;
  setCaptionPreset: (preset: CaptionsConfig['preset']) => void;
  /** Cleared only by a fresh Generate (Phase 3). Editor edits always set it. */
  clearCaptionsDirty: () => void;

  // --- ui ---
  selectScene: (sceneId: string | null) => void;
  selectOverlay: (sceneId: string | null, overlayId: string | null) => void;
  setActiveLeftTab: (tab: LeftTab) => void;
  setInspectorTab: (tab: InspectorTab) => void;
  setSaveStatus: (status: UiSlice['saveStatus']) => void;

  // --- playback (synced from the Player; not undoable) ---
  setPlayback: (frame: number, playing: boolean) => void;
}

export type EditorStore = DocSlice & UiSlice & PlaybackSlice & EditorActions;

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_SCENE_DURATION = 3;

const EMPTY_SPEC: Spec = {
  id: 'new',
  title: 'Untitled',
  template: 'Short16Formy',
  engine: 'tsx',
  format: { width: 1080, height: 1920, fps: 30 },
  theme: {},
  scenes: [{ id: 'scene-1', durationSec: 3, overlays: [] }],
  captions: { preset: 'pill', burnIn: true },
  meta: { revision: 0, updatedAt: new Date(0).toISOString() },
};

function findScene(spec: Spec, sceneId: string): Scene | undefined {
  return spec.scenes.find((s) => s.id === sceneId);
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useEditorStore = create<EditorStore>()(
  temporal(
    immer((set, get) => ({
      // doc
      spec: EMPTY_SPEC,
      captionsDirty: false,

      // ui
      selectedSceneId: null,
      selectedOverlayId: null,
      activeLeftTab: 'scenes',
      inspectorTab: 'style',
      saveStatus: 'idle',

      // playback
      currentFrame: 0,
      playing: false,

      // --- lifecycle ---
      loadSpec: (spec) =>
        set((s) => {
          s.spec = spec;
          s.captionsDirty = false;
          if (!s.selectedSceneId || !findScene(spec, s.selectedSceneId)) {
            s.selectedSceneId = spec.scenes[0]?.id ?? null;
          }
          s.selectedOverlayId = null;
        }),
      markSaved: (revision) =>
        set((s) => {
          s.spec.meta.revision = revision;
        }),

      // --- title ---
      setTitle: (title) =>
        set((s) => {
          s.spec.title = title;
          // Reflect the title in the hook overlay (first text overlay of scene 0) so the
          // on-canvas headline matches the project title (e2e step 4).
          const hook = s.spec.scenes[0]?.overlays.find((o) => o.type === 'text');
          if (hook && hook.type === 'text') hook.content = title;
        }),

      // --- ad toolkit (Phase 3) ---
      updateAd: (patch) =>
        set((s) => {
          s.spec.ad = { ...(s.spec.ad ?? {}), ...patch };
        }),

      // --- scenes ---
      addScene: () => {
        const id = newId('scene');
        set((s) => {
          s.spec.scenes.push({ id, durationSec: DEFAULT_SCENE_DURATION, overlays: [] });
          s.selectedSceneId = id;
          s.selectedOverlayId = null;
        });
        return id;
      },
      duplicateScene: (sceneId) => {
        const s = get();
        const idx = s.spec.scenes.findIndex((sc) => sc.id === sceneId);
        if (idx < 0) return null;
        const src = s.spec.scenes[idx];
        const copyId = newId('scene');
        set((st) => {
          const copy: Scene = {
            ...src,
            id: copyId,
            overlays: src.overlays.map((ov) => ({ ...ov, id: newId('ov') })),
          };
          st.spec.scenes.splice(idx + 1, 0, copy);
          st.selectedSceneId = copyId;
        });
        return copyId;
      },
      removeScene: (sceneId) =>
        set((s) => {
          if (s.spec.scenes.length <= 1) return; // never delete the last scene
          const idx = s.spec.scenes.findIndex((sc) => sc.id === sceneId);
          if (idx < 0) return;
          s.spec.scenes.splice(idx, 1);
          if (s.selectedSceneId === sceneId) {
            s.selectedSceneId = s.spec.scenes[Math.max(0, idx - 1)]?.id ?? null;
            s.selectedOverlayId = null;
          }
        }),
      moveScene: (fromIndex, toIndex) =>
        set((s) => {
          const scenes = s.spec.scenes;
          if (
            fromIndex === toIndex ||
            fromIndex < 0 ||
            toIndex < 0 ||
            fromIndex >= scenes.length ||
            toIndex >= scenes.length
          )
            return;
          const [moved] = scenes.splice(fromIndex, 1);
          scenes.splice(toIndex, 0, moved);
        }),
      setSceneDuration: (sceneId, durationSec) =>
        set((s) => {
          const scene = findScene(s.spec, sceneId);
          if (!scene) return;
          scene.durationSec = Math.max(0.1, durationSec);
          // Clamp overlays into the (possibly shrunken) scene window.
          scene.overlays = scene.overlays.map((ov) => clampOverlayToScene(ov, scene.durationSec));
        }),

      // --- overlays ---
      addOverlay: (sceneId, overlay) =>
        set((s) => {
          const scene = findScene(s.spec, sceneId);
          if (!scene) return;
          scene.overlays.push(overlay);
          s.selectedSceneId = sceneId;
          s.selectedOverlayId = overlay.id;
        }),
      updateOverlay: (sceneId, overlayId, patch) =>
        set((s) => {
          const scene = findScene(s.spec, sceneId);
          const ov = scene?.overlays.find((o) => o.id === overlayId);
          if (!ov) return;
          Object.assign(ov, patch);
        }),
      removeOverlay: (sceneId, overlayId) =>
        set((s) => {
          const scene = findScene(s.spec, sceneId);
          if (!scene) return;
          scene.overlays = scene.overlays.filter((o) => o.id !== overlayId);
          if (s.selectedOverlayId === overlayId) s.selectedOverlayId = null;
        }),
      replaceOverlayAsset: (sceneId, overlayId, assetId, src) =>
        set((s) => {
          const scene = findScene(s.spec, sceneId);
          const ov = scene?.overlays.find((o) => o.id === overlayId);
          if (!ov || ov.type !== 'image') return;
          // Replace-vs-Add: mutate ONLY src/assetId; keep id, geometry, animation, timing.
          ov.assetId = assetId;
          ov.src = src;
        }),

      // --- captions ---
      setCaptionLine: (index, text) =>
        set((s) => {
          const line = s.spec.voice?.lines[index];
          if (!line) return;
          line.text = text;
          s.captionsDirty = true;
        }),
      splitCaption: (index, charOffset) =>
        set((s) => {
          const lines = s.spec.voice?.lines;
          if (!lines || !lines[index]) return;
          const [a, b] = splitLineAtChar(lines[index], charOffset);
          lines.splice(index, 1, a, b);
          s.captionsDirty = true;
        }),
      mergeCaptions: (index) =>
        set((s) => {
          const lines = s.spec.voice?.lines;
          if (!lines || index < 0 || index >= lines.length - 1) return;
          const merged = mergeLines(lines[index], lines[index + 1]);
          lines.splice(index, 2, merged);
          s.captionsDirty = true;
        }),
      nudgeCaption: (index, deltaSec) =>
        set((s) => {
          const lines = s.spec.voice?.lines;
          if (!lines || !lines[index]) return;
          lines[index] = nudgeLine(lines[index], deltaSec);
          s.captionsDirty = true;
        }),
      setCaptionPreset: (preset) =>
        set((s) => {
          s.spec.captions = { burnIn: true, ...(s.spec.captions ?? {}), preset };
          s.captionsDirty = true;
        }),
      clearCaptionsDirty: () =>
        set((s) => {
          s.captionsDirty = false;
        }),

      // --- ui ---
      selectScene: (sceneId) =>
        set((s) => {
          s.selectedSceneId = sceneId;
          s.selectedOverlayId = null;
        }),
      selectOverlay: (sceneId, overlayId) =>
        set((s) => {
          s.selectedSceneId = sceneId;
          s.selectedOverlayId = overlayId;
        }),
      setActiveLeftTab: (tab) =>
        set((s) => {
          s.activeLeftTab = tab;
        }),
      setInspectorTab: (tab) =>
        set((s) => {
          s.inspectorTab = tab;
        }),
      setSaveStatus: (status) =>
        set((s) => {
          s.saveStatus = status;
        }),

      // --- playback ---
      setPlayback: (frame, playing) =>
        set((s) => {
          s.currentFrame = frame;
          s.playing = playing;
        }),
    })),
    {
      // Track ONLY the doc slice; ui/playback are excluded from undo history.
      partialize: (state) => ({ spec: state.spec, captionsDirty: state.captionsDirty }),
      // Coalesce rapid identical-doc sets (we pause/resume explicitly during drags).
      equality: (past, current) => past.spec === current.spec && past.captionsDirty === current.captionsDirty,
      limit: 200,
    }
  )
);

// ---------------------------------------------------------------------------
// Temporal helpers (zundo) — drag coalescing + undo/redo.
// ---------------------------------------------------------------------------

export const temporalStore = useEditorStore.temporal;

/** Pause history recording (call on drag start). */
export function pauseTemporal() {
  temporalStore.getState().pause();
}

/** Resume history recording (call on drag end) — the drag becomes ONE undo entry. */
export function resumeTemporal() {
  temporalStore.getState().resume();
}

export function undo() {
  temporalStore.getState().undo();
}
export function redo() {
  temporalStore.getState().redo();
}

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export const selectSpec = (s: EditorStore) => s.spec;
export const selectDurationFrames = (s: EditorStore) => specToFrames(s.spec);
export const selectSelectedScene = (s: EditorStore): Scene | undefined =>
  s.spec.scenes.find((sc) => sc.id === s.selectedSceneId);
export const selectSelectedOverlay = (s: EditorStore): Overlay | undefined => {
  const scene = s.spec.scenes.find((sc) => sc.id === s.selectedSceneId);
  return scene?.overlays.find((o) => o.id === s.selectedOverlayId);
};
