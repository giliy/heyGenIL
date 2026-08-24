'use client';
// The live preview surface: the @remotion Player running the SAME spec-driven template the
// render worker runs, fed the SAME inputProps the worker consumes. Byte-identical pixels.
//
// - Player computes scale internally; useScale bridges comp px (1080x1920) <-> screen px so
//   overlay handles sit exactly on the overlays they edit.
// - Clicking the canvas (not an overlay) clears overlay selection.
// - Clicking an overlay region selects it (we hit-test scene overlays in comp coords).
import React, { useEffect, useRef, useCallback } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import Short16Formy from '@engine/shots/short-16/Short16Formy';
import { specToFrames } from '@shorts/spec';
import { useEditorStore, selectSelectedOverlay, selectSelectedScene } from '../../_store/editorStore';
import { useScale } from './useScale';
import { OverlayHandles } from './OverlayHandles';

export function PlayerStage() {
  const spec = useEditorStore((s) => s.spec);
  const playerRef = useRef<PlayerRef | null>(null);
  const scale = useScale(playerRef);

  const selectedScene = useEditorStore(selectSelectedScene);
  const selectedOverlay = useEditorStore(selectSelectedOverlay);
  const selectOverlay = useEditorStore((s) => s.selectOverlay);
  const setPlayback = useEditorStore((s) => s.setPlayback);

  const durationInFrames = specToFrames(spec);
  const fps = spec.format.fps;

  // Sync playhead -> store so panels (captions, timing) can reflect the current frame.
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const onFrame = (e: { detail: { frame: number } }) => {
      setPlayback(e.detail.frame, player.isPlaying());
    };
    player.addEventListener('frameupdate', onFrame);
    return () => player.removeEventListener('frameupdate', onFrame);
  }, [setPlayback]);

  // Seek the Player when a different scene is selected, so the preview jumps to its start.
  const selectedSceneId = useEditorStore((s) => s.selectedSceneId);
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const idx = spec.scenes.findIndex((s) => s.id === selectedSceneId);
    if (idx < 0) return;
    const startSec = spec.scenes.slice(0, idx).reduce((a, s) => a + s.durationSec, 0);
    player.seekTo(Math.round(startSec * fps));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSceneId, fps]);

  // Click on the canvas: hit-test the selected scene's overlays (topmost first); select the hit
  // overlay or clear selection when clicking empty canvas.
  const onCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      const scene = selectSelectedScene(useEditorStore.getState());
      if (!scene) return;
      // Measure against the SCALED composition element (not the container wrapper): the
      // container centers the player, so its rect origin is offset and would mis-map clicks.
      const rect = scale.getCompRect();
      if (!rect || scale.scale === 0) return;
      const compX = (e.clientX - rect.left) / scale.scale;
      const compY = (e.clientY - rect.top) / scale.scale;
      // Topmost = last in the overlays array.
      for (let i = scene.overlays.length - 1; i >= 0; i--) {
        const ov = scene.overlays[i];
        if (compX >= ov.x && compX <= ov.x + ov.w && compY >= ov.y && compY <= ov.y + ov.h) {
          selectOverlay(scene.id, ov.id);
          return;
        }
      }
      selectOverlay(scene.id, null);
    },
    [scale, selectOverlay]
  );

  return (
    <div
      className="relative flex h-full w-full items-center justify-center overflow-hidden bg-neutral-950"
      onClick={onCanvasClick}
    >
      {/* The scale bridge container wraps the Player; its size feeds ResizeObserver. */}
      <div ref={scale.containerRef} className="relative" style={{ lineHeight: 0 }}>
        <Player
          ref={playerRef}
          component={Short16Formy}
          inputProps={{ spec }}
          durationInFrames={durationInFrames}
          fps={fps}
          compositionWidth={spec.format.width}
          compositionHeight={spec.format.height}
          controls
          loop
          autoPlay={false}
          clickToPlay
          spaceKeyToPlayOrPause
          doubleClickToFullscreen={false}
          style={{ maxWidth: '100%', maxHeight: 'calc(100vh - 260px)' }}
        />
        {/* Handle layer for the selected overlay. */}
        {selectedScene && selectedOverlay && (
          <OverlayHandles
            overlay={selectedOverlay}
            sceneId={selectedScene.id}
            scale={scale}
            canvasRef={scale.containerRef}
          />
        )}
      </div>
    </div>
  );
}
