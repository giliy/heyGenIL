'use client';
// The editor chrome: TopBar + 3-column resizable layout + bottom scene strip.
// Owns hydration of the store from the server-loaded spec and mounts every panel.
//
// Layout (react-resizable-panels v4): Group(horizontal) > [Panel left | Separator | Panel
// center | Separator | Panel right]. A vertical split is NOT needed — the bottom SceneStrip
// is a fixed-height bar under the center canvas.
import React, { useEffect } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import type { Spec } from '@shorts/spec';
import { useEditorStore } from '../_store/editorStore';
import { PlayerStage } from './canvas/PlayerStage';
import { TopBar } from './TopBar';
import { ScenesPanel } from './panels/ScenesPanel';
import { MediaPanel } from './panels/MediaPanel';
import { CaptionsPanel } from './panels/CaptionsPanel';
import { AudioPanel } from './panels/AudioPanel';
import { AdPanel } from './panels/AdPanel';
import { InspectorPanel } from './panels/InspectorPanel';
import { SceneStrip } from './SceneStrip';
import { useAutosave } from '../_hooks/useAutosave';
import { useEditorHotkeys } from '../_hooks/useHotkeys';

export interface EditorProject {
  id: string;
  title: string;
  template: string;
  engine: string;
  revision: number;
  specJson: Spec | null;
}

export function EditorShell({
  project,
  initialSpec,
}: {
  project: EditorProject;
  initialSpec: Spec | null;
}) {
  const loadSpec = useEditorStore((s) => s.loadSpec);
  const activeLeftTab = useEditorStore((s) => s.activeLeftTab);

  // Hydrate the store once on mount from the server-loaded spec.
  useEffect(() => {
    if (initialSpec) loadSpec(initialSpec);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced autosave (localStorage + revision-stamped server sync) + undo/redo hotkeys.
  useAutosave(project.id, project.revision);
  useEditorHotkeys();

  if (!initialSpec) {
    return (
      <div className="flex h-screen items-center justify-center bg-cream text-ink">
        <div className="rounded-xl border border-line bg-paper p-8 text-center">
          <p className="text-lg font-semibold">This project's spec failed to parse.</p>
          <p className="mt-2 text-sm text-muted">
            The stored spec is invalid. Return to the dashboard and recreate the project.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-cream text-ink">
      <TopBar project={project} />

      <Group orientation="horizontal" className="flex-1" id="editor-main">
        {/* LEFT: scenes / media / captions */}
        <Panel defaultSize="22" minSize="15" className="border-r border-line bg-paper">
          {activeLeftTab === 'scenes' && <ScenesPanel />}
          {activeLeftTab === 'media' && <MediaPanel projectId={project.id} />}
          {activeLeftTab === 'captions' && <CaptionsPanel />}
          {activeLeftTab === 'audio' && <AudioPanel projectId={project.id} />}
          {activeLeftTab === 'ad' && <AdPanel projectId={project.id} />}
        </Panel>
        <Separator className="w-1 bg-line transition-colors hover:bg-signal" />

        {/* CENTER: live Player + scene strip */}
        <Panel defaultSize="56" minSize="30" className="flex flex-col bg-neutral-950">
          <div className="min-h-0 flex-1">
            <PlayerStage />
          </div>
          <SceneStrip projectId={project.id} />
        </Panel>
        <Separator className="w-1 bg-line transition-colors hover:bg-signal" />

        {/* RIGHT: inspector (style / timing / animation) */}
        <Panel defaultSize="22" minSize="16" className="border-l border-line bg-paper">
          <InspectorPanel />
        </Panel>
      </Group>
    </div>
  );
}
