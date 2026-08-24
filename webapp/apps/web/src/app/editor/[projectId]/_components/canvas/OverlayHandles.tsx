'use client';
// react-moveable handles over the scaled Player for the selected overlay.
// The target element's box is derived from the store (screen px = comp px * scale);
// moveable drag/resize/rotate deltas are converted BACK to comp px and dispatched to the
// store, which is the single source of truth (preview + render see the same numbers).
// Counter-scaled grips keep constant size (transform: scale(1/scale)).
// Drag is coalesced to ONE undo entry via pauseTemporal/resumeTemporal.
import React, { useRef, useCallback } from 'react';
import MoveableBase from 'react-moveable';
import { useEditorStore, pauseTemporal, resumeTemporal } from '../../_store/editorStore';
import type { ScaleBridge } from './useScale';
import type { Overlay } from '@shorts/spec';

// react-moveable v0.56's class type predates React 19's JSX.ElementType; cast it once.
const Moveable = MoveableBase as unknown as React.ComponentType<Record<string, unknown>>;

interface Props {
  overlay: Overlay;
  sceneId: string;
  scale: ScaleBridge;
  canvasRef: React.RefObject<HTMLDivElement | null>;
}

export function OverlayHandles({ overlay, sceneId, scale, canvasRef }: Props) {
  const updateOverlay = useEditorStore((s) => s.updateOverlay);
  const targetRef = useRef<HTMLDivElement | null>(null);

  const screen = scale.scale;
  if (screen === 0) return null; // Player not ready — hide handles (risk #1)

  // The handle layer lives inside `containerRef` (position:relative), but the Player is
  // centered within that container. So a comp-px origin must be offset by where the scaled
  // composition actually sits inside the container, else handles land displaced from the
  // overlay they edit (same mismatch the click hit-test had).
  let offsetX = 0;
  let offsetY = 0;
  const container = canvasRef.current;
  const compRect = scale.getCompRect();
  if (container && compRect) {
    const containerRect = container.getBoundingClientRect();
    offsetX = compRect.left - containerRect.left;
    offsetY = compRect.top - containerRect.top;
  }

  const left = offsetX + overlay.x * screen;
  const top = offsetY + overlay.y * screen;
  const width = overlay.w * screen;
  const height = overlay.h * screen;

  // Drag start snapshot (comp coords) + temporal pause.
  const dragStart = useRef({ x: overlay.x, y: overlay.y, rotation: overlay.rotation ?? 0 });

  const onDragStart = useCallback(() => {
    dragStart.current = { x: overlay.x, y: overlay.y, rotation: overlay.rotation ?? 0 };
    pauseTemporal();
  }, [overlay.x, overlay.y, overlay.rotation]);

  const onDrag = useCallback(
    (e: { beforeTranslate: number[]; target: HTMLElement }) => {
      const dx = e.beforeTranslate[0] / screen;
      const dy = e.beforeTranslate[1] / screen;
      updateOverlay(sceneId, overlay.id, {
        x: Math.round(dragStart.current.x + dx),
        y: Math.round(dragStart.current.y + dy),
      });
      // Reset moveable's own translate so we don't double-apply (store positions via left/top).
      if (e.target) e.target.style.transform = `rotate(${dragStart.current.rotation}deg)`;
    },
    [updateOverlay, sceneId, overlay.id, screen]
  );

  const onResizeStart = useCallback(() => {
    dragStart.current = { x: overlay.x, y: overlay.y, rotation: overlay.rotation ?? 0 };
    pauseTemporal();
  }, [overlay.x, overlay.y, overlay.rotation]);

  const onResize = useCallback(
    (e: {
      width: number;
      height: number;
      drag: { beforeTranslate: number[] };
      target: HTMLElement;
    }) => {
      const dx = e.drag.beforeTranslate[0] / screen;
      const dy = e.drag.beforeTranslate[1] / screen;
      const w = Math.max(8, e.width / screen);
      const h = Math.max(8, e.height / screen);
      updateOverlay(sceneId, overlay.id, {
        x: Math.round(dragStart.current.x + dx),
        y: Math.round(dragStart.current.y + dy),
        w: Math.round(w),
        h: Math.round(h),
      });
      if (e.target) e.target.style.transform = `rotate(${dragStart.current.rotation}deg)`;
    },
    [updateOverlay, sceneId, overlay.id, screen]
  );

  const onRotateStart = useCallback(() => {
    dragStart.current = { x: overlay.x, y: overlay.y, rotation: overlay.rotation ?? 0 };
    pauseTemporal();
  }, [overlay.x, overlay.y, overlay.rotation]);

  const onRotate = useCallback(
    (e: { beforeRotate: number; target: HTMLElement }) => {
      updateOverlay(sceneId, overlay.id, {
        rotation: Math.round((dragStart.current.rotation + e.beforeRotate) * 100) / 100,
      });
    },
    [updateOverlay, sceneId, overlay.id]
  );

  const onEnd = useCallback(() => resumeTemporal(), []);

  // Counter-scale the grips so they stay constant size at any zoom: expose 1/scale as a
  // CSS var and let a <style> rule scale .moveable-control.
  const gripScale = 1 / screen;

  return (
    <>
      {/* The moveable target: the overlay's screen box. */}
      <div
        ref={targetRef}
        style={{
          position: 'absolute',
          left,
          top,
          width,
          height,
          transform: `rotate(${overlay.rotation ?? 0}deg)`,
          border: '1.5px dashed rgba(99,102,241,0.9)',
          background: 'rgba(99,102,241,0.06)',
          pointerEvents: 'none',
          boxSizing: 'border-box',
        }}
      />
      <Moveable
        target={targetRef}
        container={canvasRef.current ?? undefined}
        draggable
        resizable
        rotatable
        throttleDrag={0}
        throttleResize={0}
        origin={false}
        renderDirections={['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']}
        onDragStart={onDragStart}
        onDrag={onDrag}
        onResizeStart={onResizeStart}
        onResize={onResize}
        onRotateStart={onRotateStart}
        onRotate={onRotate}
        onDragEnd={onEnd}
        onResizeEnd={onEnd}
        onRotateEnd={onEnd}
        scalable={false}
        snappable
      />
      {/* Counter-scale the grips so they stay constant screen size at any zoom. */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
          .moveable-control-box .moveable-control,
          .moveable-control-box .moveable-rotation {
            transform-origin: center;
            scale: ${gripScale};
          }`,
        }}
      />
    </>
  );
}
