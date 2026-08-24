'use client';
// Left panel — the scene stack. Add / duplicate / reorder (up-down) / delete (never the last
// scene) + a per-scene duration stepper that clamps overlays into the shrunken window.
import React from 'react';
import { Button } from '@/components/ui/button';
import { useEditorStore } from '../../_store/editorStore';
import { formatDuration } from '@/lib/utils';

export function ScenesPanel() {
  const scenes = useEditorStore((s) => s.spec.scenes);
  const selectedSceneId = useEditorStore((s) => s.selectedSceneId);
  const selectScene = useEditorStore((s) => s.selectScene);
  const addScene = useEditorStore((s) => s.addScene);
  const duplicateScene = useEditorStore((s) => s.duplicateScene);
  const removeScene = useEditorStore((s) => s.removeScene);
  const moveScene = useEditorStore((s) => s.moveScene);
  const setSceneDuration = useEditorStore((s) => s.setSceneDuration);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Scenes</h2>
        <Button variant="outline" size="sm" onClick={() => addScene()}>
          + Add
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <ul className="space-y-2">
          {scenes.map((scene, i) => {
            const selected = scene.id === selectedSceneId;
            return (
              <li
                key={scene.id}
                className={`rounded-lg border p-2 transition-colors ${
                  selected ? 'border-signal bg-signal/5' : 'border-line bg-paper hover:bg-cream'
                }`}
              >
                <button
                  onClick={() => selectScene(scene.id)}
                  className="block w-full text-left"
                  aria-current={selected}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-ink">Scene {i + 1}</span>
                    <span className="text-xs text-muted">
                      {scene.overlays.length} overlay{scene.overlays.length === 1 ? '' : 's'}
                    </span>
                  </div>
                </button>

                {/* Duration stepper */}
                <div className="mt-2 flex items-center gap-1">
                  <button
                    onClick={() => setSceneDuration(scene.id, scene.durationSec - 0.5)}
                    className="h-6 w-6 rounded border border-line text-sm text-ink hover:bg-cream"
                    aria-label="Decrease duration"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    step={0.1}
                    min={0.1}
                    value={scene.durationSec}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!Number.isNaN(v)) setSceneDuration(scene.id, v);
                    }}
                    className="h-6 w-14 rounded border border-line bg-paper px-1 text-center text-xs text-ink"
                    aria-label="Scene duration (seconds)"
                  />
                  <button
                    onClick={() => setSceneDuration(scene.id, scene.durationSec + 0.5)}
                    className="h-6 w-6 rounded border border-line text-sm text-ink hover:bg-cream"
                    aria-label="Increase duration"
                  >
                    +
                  </button>
                  <span className="ml-1 text-xs text-muted">{formatDuration(scene.durationSec)}</span>
                </div>

                {/* Scene actions */}
                <div className="mt-2 flex items-center gap-1">
                  <button
                    onClick={() => moveScene(i, i - 1)}
                    disabled={i === 0}
                    className="rounded px-1.5 py-0.5 text-xs text-muted hover:bg-cream disabled:opacity-30"
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => moveScene(i, i + 1)}
                    disabled={i === scenes.length - 1}
                    className="rounded px-1.5 py-0.5 text-xs text-muted hover:bg-cream disabled:opacity-30"
                    title="Move down"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => duplicateScene(scene.id)}
                    className="rounded px-1.5 py-0.5 text-xs text-muted hover:bg-cream"
                    title="Duplicate"
                  >
                    ⧉
                  </button>
                  <button
                    onClick={() => removeScene(scene.id)}
                    disabled={scenes.length <= 1}
                    className="ml-auto rounded px-1.5 py-0.5 text-xs text-danger hover:bg-danger/10 disabled:opacity-30"
                    title={scenes.length <= 1 ? 'Cannot delete the last scene' : 'Delete scene'}
                  >
                    ✕
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
