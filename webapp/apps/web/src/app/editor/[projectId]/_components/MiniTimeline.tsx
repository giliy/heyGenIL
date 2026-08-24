'use client';
// Mini-timeline escape hatch (collapsible, OFF by default). A SINGLE overlay lane across all
// scenes: every overlay is placed at its ABSOLUTE composition time (scene start + scene-relative
// offset), scene boundaries are drawn as vertical dividers, and the playhead is driven by the
// Player's frame via the store's currentFrame (frame / fps = seconds).
//
// Interactions write back through the SAME zustand/immer `doc` slice the range slider uses
// (updateOverlay) — one source of truth — then debounce a POST /api/projects/[id]/timeline to
// persist the trim. Trims coalesce into ONE undo entry via pauseTemporal/resumeTemporal.
//
// Bars are color-coded by overlay type (text=indigo, image=violet) with a type glyph.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Timeline, type TimelineState } from '@xzdarcy/react-timeline-editor';
import type { TimelineRow, TimelineAction } from '@xzdarcy/timeline-engine';
import '@xzdarcy/react-timeline-editor/dist/react-timeline-editor.css';
import { useEditorStore, pauseTemporal, resumeTemporal } from '../_store/editorStore';
import { round3 } from '@shorts/spec';
import { cn } from '@/lib/utils';

const ROW_HEIGHT = 32;

interface MiniTimelineProps {
  projectId: string;
}

/** Build one continuous TimelineRow: all overlays at absolute composition seconds. */
function toRow(scenes: { id: string; durationSec: number; overlays: { id: string; start: number; end: number; type: string }[] }[]): TimelineRow {
  const actions: TimelineAction[] = [];
  let acc = 0;
  for (const scene of scenes) {
    for (const ov of scene.overlays) {
      actions.push({
        id: ov.id,
        start: round3(acc + ov.start),
        end: round3(acc + ov.end),
        effectId: ov.type === 'image' ? 'image' : 'text',
        movable: true,
        flexible: true,
        minStart: acc,
        maxEnd: acc + scene.durationSec,
      });
    }
    acc += scene.durationSec;
  }
  return { id: 'lane', actions };
}

export function MiniTimeline({ projectId }: MiniTimelineProps) {
  const scenes = useEditorStore((s) => s.spec.scenes);
  const fps = useEditorStore((s) => s.spec.format.fps);
  const currentFrame = useEditorStore((s) => s.currentFrame);
  const updateOverlay = useEditorStore((s) => s.updateOverlay);
  const selectOverlay = useEditorStore((s) => s.selectOverlay);

  const timelineRef = useRef<TimelineState | null>(null);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTrim = useRef<{ sceneId: string; overlayId: string; start: number; end: number } | null>(null);

  const row = useMemo(() => toRow(scenes), [scenes]);

  // Scene boundary dividers: cumulative start of each scene (absolute seconds).
  const dividers = useMemo(() => {
    const pts: number[] = [];
    let acc = 0;
    for (const s of scenes) {
      pts.push(acc);
      acc += s.durationSec;
    }
    return pts;
  }, [scenes]);

  // Drive the playhead from the Player's frame (frame / fps = seconds).
  useEffect(() => {
    timelineRef.current?.setTime(currentFrame / fps);
  }, [currentFrame, fps]);

  /** Convert an absolute action window back to a scene-relative trim and persist it. */
  const commitTrim = useCallback(
    (action: TimelineAction, startAbs: number, endAbs: number) => {
      // Find which scene owns this overlay (its absolute window must fall in it).
      let acc = 0;
      for (const scene of scenes) {
        const sceneStart = acc;
        const sceneEnd = acc + scene.durationSec;
        if (startAbs >= sceneStart && startAbs < sceneEnd) {
          const ov = scene.overlays.find((o) => o.id === action.id);
          if (!ov) return;
          const start = Math.max(0, startAbs - sceneStart);
          const end = Math.min(scene.durationSec, endAbs - sceneStart);
          if (end <= start) return; // keep positive span
          pendingTrim.current = { sceneId: scene.id, overlayId: action.id, start, end };
          return;
        }
        acc += scene.durationSec;
      }
    },
    [scenes]
  );

  // Debounced persist: optimistic doc update already happened; push the trim to the server.
  const schedulePersist = useCallback(() => {
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      const trim = pendingTrim.current;
      pendingTrim.current = null;
      if (!trim) return;
      void fetch(`/api/projects/${projectId}/timeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trim),
      });
    }, 500);
  }, [projectId]);

  return (
    <div className="border-t border-neutral-800 bg-neutral-950">
      <div className="flex items-center gap-3 px-3 py-1 text-[11px] uppercase tracking-wide text-neutral-500">
        <span>Overlay lane</span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-indigo-400" /> text
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-violet-400" /> image
        </span>
        <span className="ml-auto text-neutral-600">trim by dragging the bar edges</span>
      </div>
      <div className="relative" style={{ height: ROW_HEIGHT + 16 }}>
        <Timeline
          ref={timelineRef}
          editorData={[row]}
          effects={{
            text: { id: 'text' },
            image: { id: 'image' },
          }}
          scale={1}
          minScaleCount={30}
          maxScaleCount={200}
          scaleWidth={80}
          startLeft={24}
          rowHeight={ROW_HEIGHT}
          autoScroll={false}
          // Color-coded bars + type glyph by overlay type.
          getActionRender={(action) => {
            const isImage = action.effectId === 'image';
            return (
              <div
                className={cn(
                  'flex h-full items-center justify-center rounded text-[10px] font-semibold text-white',
                  isImage ? 'bg-violet-500' : 'bg-indigo-500'
                )}
                title={action.id}
              >
                {isImage ? '▣' : 'T'}
              </div>
            );
          }}
          onActionMoveStart={() => {
            pauseTemporal();
            pendingTrim.current = null;
          }}
          onActionMoving={({ action, start, end }) => {
            commitTrim(action, start, end);
            return false; // we own the commit (avoid auto engine sync churn)
          }}
          onActionMoveEnd={({ action }) => {
            // Apply the optimistic doc update + select + persist.
            if (pendingTrim.current) {
              const t = pendingTrim.current;
              updateOverlay(t.sceneId, t.overlayId, { start: round3(t.start), end: round3(t.end) });
              selectOverlay(t.sceneId, t.overlayId);
              schedulePersist();
            }
            pendingTrim.current = null;
            resumeTemporal();
          }}
          onActionResizeStart={() => {
            pauseTemporal();
            pendingTrim.current = null;
          }}
          onActionResizing={({ action, start, end, dir }) => {
            commitTrim(action, start, end);
            return false;
          }}
          onActionResizeEnd={({ action }) => {
            if (pendingTrim.current) {
              const t = pendingTrim.current;
              updateOverlay(t.sceneId, t.overlayId, { start: round3(t.start), end: round3(t.end) });
              selectOverlay(t.sceneId, t.overlayId);
              schedulePersist();
            }
            pendingTrim.current = null;
            resumeTemporal();
          }}
          onClickAction={(_e, { action }) => {
            // Selecting a bar selects the overlay (no drag).
            let acc = 0;
            for (const scene of scenes) {
              if (action.start >= acc && action.start < acc + scene.durationSec) {
                selectOverlay(scene.id, action.id);
                return;
              }
              acc += scene.durationSec;
            }
          }}
        />
        {/* Scene boundary dividers overlaid on the lane. */}
        {dividers.map((sec, i) => (
          <div
            key={i}
            className="pointer-events-none absolute top-0 bottom-0 w-px bg-neutral-700"
            style={{ left: 24 + sec * 80 }}
            title={`Scene ${i + 1} starts`}
          />
        ))}
      </div>
    </div>
  );
}
