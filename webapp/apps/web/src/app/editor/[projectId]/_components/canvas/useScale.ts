// useScale — the comp<->screen factor for overlaying moveable handles on the scaled Player.
//
// scale = playerRef.getScale() (composition px -> screen px). We also recompute on every
// `scalechange` event AND on container resize (ResizeObserver) so handles never go stale
// mid-drag. Guard: scale===0 / undefined before the Player is ready -> return 0 so callers
// hide handles (risk #1 in the plan).
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlayerRef } from '@remotion/player';

export interface ScaleBridge {
  /** The live comp->screen scale, or 0 if the Player isn't ready yet. */
  scale: number;
  /** Ref to attach to the container that wraps the Player (watched via ResizeObserver). */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /**
   * The live on-screen bounding rect of the SCALED composition (the `__remotion-player`
   * element), NOT the container wrapper. The container centers the player, so the container's
   * own rect is a larger, differently-offset box — measuring clicks/handles against it maps to
   * the wrong comp coordinates. Use this for hit-testing and handle placement.
   */
  getCompRect: () => DOMRect | null;
  /** Multiply a composition-px value by this to get screen px. */
  compToScreen: (comp: number) => number;
  /** Divide a screen-px value by this to get composition px. */
  screenToComp: (screen: number) => number;
}

export function useScale(playerRef: React.RefObject<PlayerRef | null>): ScaleBridge {
  const [scale, setScale] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Recompute from getScale() — safe to call once the Player has mounted.
  const refresh = useCallback(() => {
    const ref = playerRef.current;
    if (!ref || typeof ref.getScale !== 'function') return;
    const s = ref.getScale();
    // getScale() returns 0 before the first frame/measurement — guard (risk #1).
    if (typeof s === 'number' && s > 0) setScale(s);
  }, [playerRef]);

  // 1) Listen for the Player's own scalechange events.
  useEffect(() => {
    const ref = playerRef.current;
    if (!ref || !ref.addEventListener) return;
    const onScale = () => refresh();
    ref.addEventListener('scalechange', onScale);
    return () => ref.removeEventListener('scalechange', onScale);
  }, [playerRef, refresh]);

  // 2) Recompute on container resize (the Player's wrapper) so a panel resize re-scales
  //    the handles without a Player event necessarily firing.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') {
      refresh();
      return;
    }
    const ro = new ResizeObserver(() => refresh());
    ro.observe(el);
    refresh();
    return () => ro.disconnect();
  }, [refresh]);

  // The scaled composition element. The Player scales `.__remotion-player` via CSS transform,
  // so its getBoundingClientRect() is the true on-screen composition box (and rect.width /
  // compWidth === getScale()). Measured lazily per call so it stays correct across resizes.
  const getCompRect = useCallback((): DOMRect | null => {
    const container = containerRef.current;
    if (!container) return null;
    const playerEl = container.querySelector('.__remotion-player') as HTMLElement | null;
    if (!playerEl) return null;
    return playerEl.getBoundingClientRect();
  }, []);

  return {
    scale,
    containerRef,
    getCompRect,
    compToScreen: useCallback((comp: number) => comp * scale, [scale]),
    screenToComp: useCallback((screen: number) => (scale === 0 ? 0 : screen / scale), [scale]),
  };
}
