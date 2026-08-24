'use client';
// Bottom strip under the canvas: the left-panel tab switcher (Scenes / Media / Captions) plus
// a compact scene timeline that mirrors the stack and seeks the Player on click. A "Timeline"
// toggle opens the collapsible MiniTimeline overlay-lane escape hatch (OFF by default).
import React, { useState } from 'react';
import { useEditorStore, type LeftTab } from '../_store/editorStore';
import { MiniTimeline } from './MiniTimeline';
import { cn } from '@/lib/utils';

const BASE_TABS: { id: LeftTab; label: string }[] = [
  { id: 'scenes', label: 'Scenes' },
  { id: 'media', label: 'Media' },
  { id: 'captions', label: 'Captions' },
  { id: 'audio', label: 'Audio' },
];

export function SceneStrip({ projectId }: { projectId: string }) {
  const scenes = useEditorStore((s) => s.spec.scenes);
  const specMode = useEditorStore((s) => s.spec.mode);
  const selectedSceneId = useEditorStore((s) => s.selectedSceneId);
  const selectScene = useEditorStore((s) => s.selectScene);
  const activeLeftTab = useEditorStore((s) => s.activeLeftTab);
  const setActiveLeftTab = useEditorStore((s) => s.setActiveLeftTab);

  // Ad-track projects get the Ad toolkit tab (Phase 3).
  const TABS = specMode === 'ad' ? [...BASE_TABS, { id: 'ad' as LeftTab, label: 'Ad' }] : BASE_TABS;

  // Mini-timeline escape hatch — OFF by default (§UI).
  const [timelineOpen, setTimelineOpen] = useState(false);

  const total = scenes.reduce((a, s) => a + s.durationSec, 0) || 1;

  return (
    <div className="border-t border-neutral-800 bg-neutral-900">
      {/* Tab switcher for the left panel */}
      <div className="flex items-center gap-1 px-3 pt-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveLeftTab(t.id)}
            className={cn(
              'rounded-t-md px-3 py-1 text-xs font-medium transition-colors',
              activeLeftTab === t.id
                ? 'bg-neutral-800 text-white'
                : 'text-neutral-400 hover:text-neutral-200'
            )}
          >
            {t.label}
          </button>
        ))}
        <button
          onClick={() => setTimelineOpen((v) => !v)}
          className={cn(
            'ml-auto rounded-t-md px-3 py-1 text-xs font-medium transition-colors',
            timelineOpen
              ? 'bg-neutral-800 text-white'
              : 'text-neutral-400 hover:text-neutral-200'
          )}
          title="Mini-timeline overlay lane (escape hatch)"
        >
          Timeline
        </button>
      </div>

      {/* Compact scene timeline */}
      <div className="flex h-12 items-stretch gap-0.5 px-3 pb-2 pt-1">
        {scenes.map((scene, i) => {
          const selected = scene.id === selectedSceneId;
          const widthPct = (scene.durationSec / total) * 100;
          return (
            <button
              key={scene.id}
              onClick={() => selectScene(scene.id)}
              style={{ width: `${widthPct}%` }}
              className={cn(
                'flex min-w-8 items-center justify-center rounded text-xs font-medium transition-colors',
                selected
                  ? 'bg-signal text-white'
                  : 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
              )}
              title={`Scene ${i + 1} — ${scene.durationSec}s`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      {/* Collapsible mini-timeline escape hatch (OFF by default) */}
      {timelineOpen && <MiniTimeline projectId={projectId} />}
    </div>
  );
}
