/**
 * lottie.tsx — the one place shots get Lottie animations from.
 *
 * A thin, frame-exact wrapper around lottie-web (via @remotion/lottie's bundled
 * engine) that plays ONLY the curated CALM clips in media/library/lottie/ (see
 * media/library/lottie/catalog.json). Curated toward Linear-style vector accents
 * (brand.md forbids bouncy sticker looks) — reach for these as quiet accents
 * UNDER typography, not as characters.
 *
 * The wrapper guarantees (per the library contract):
 *  - (a) id → file resolution: takes a catalog `id`, resolves to the committed
 *        JSON under media/library/lottie/clips/ and loads it via staticFile().
 *  - (b) memoized animationData: the parsed Lottie JSON is fetched once per clip
 *        and memoized, so the animation never re-initializes mid-render.
 *  - (c) frame-exact seeking: motion is driven solely by useCurrentFrame() —
 *        each rendered frame goToAndStop()s the exact animation frame for that
 *        composition frame. No Date.now()/Math.random()/wall-clock anywhere.
 *  - (d) render delayed until loaded: the JSON fetch AND the animation's
 *        DOMLoaded are both held with delayRender()/continueRender(), so a frame
 *        is never captured before the animation is actually on screen.
 *
 * Usage:
 *   import { LibraryLottie } from '../lib/lottie';
 *
 *   <LibraryLottie id="checkmark-circle" size={220} />
 *   <LibraryLottie id="chart-up" size={480} loop />
 *   <LibraryLottie id="gear-spin" size={180} delay={10} playbackRate={1.4} />
 *
 * Adding a clip (library-first):
 *   1. put the .json in media/library/lottie/clips/<id>.json
 *   2. add a row to media/library/lottie/catalog.json (name, creator, source_url,
 *      license, tags — Lottie Simple License)
 *   3. add a row to LOTTIE_LIBRARY below (id → file + intrinsic size) so the id
 *      typechecks. LOTTIE_LIBRARY mirrors catalog.json — keep them in sync.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { continueRender, delayRender, staticFile, useCurrentFrame } from 'remotion';
import lottie, { type AnimationItem } from 'lottie-web';
import { getLottieMetadata } from '@remotion/lottie';
import type { LottieAnimationData } from '@remotion/lottie';

// ---------------------------------------------------------------------------
// Typed id → file + intrinsic canvas size. MIRRORS media/library/lottie/catalog.json.
// The intrinsic w/h let callers size by a single `size` with no layout jump.
// ---------------------------------------------------------------------------
export const LOTTIE_LIBRARY = {
  'checkmark-circle': { file: 'clips/checkmark-circle.json', width: 512, height: 512 },
  sparkles: { file: 'clips/sparkles.json', width: 600, height: 600 },
  'chart-up': { file: 'clips/chart-up.json', width: 1080, height: 1080 },
  'rocket-launch': { file: 'clips/rocket-launch.json', width: 1080, height: 1080 },
  'gear-spin': { file: 'clips/gear-spin.json', width: 500, height: 500 },
  'confetti-burst': { file: 'clips/confetti-burst.json', width: 800, height: 500 },
} as const;

/** The curated catalog ids — the only values <LibraryLottie id> accepts. */
export type LibraryLottieId = keyof typeof LOTTIE_LIBRARY;

/** Resolve a catalog id to its staticFile URL (media/library/lottie/<file>). */
export const lottieUrl = (id: LibraryLottieId): string =>
  staticFile(`library/lottie/${LOTTIE_LIBRARY[id].file}`);

/**
 * Fetch + parse a Lottie JSON, holding the render until it resolves. Returns the
 * parsed animationData (null while loading). Throws on unknown id / bad fetch /
 * non-Lottie JSON so the render errors loudly instead of capturing a blank frame.
 */
const useLottieData = (id: LibraryLottieId): LottieAnimationData | null => {
  const [data, setData] = useState<LottieAnimationData | null>(null);
  const [handle] = useState(() => delayRender(`Loading Lottie "${id}"`));

  useEffect(() => {
    const entry = LOTTIE_LIBRARY[id];
    if (!entry) {
      continueRender(handle);
      throw new Error(
        `LibraryLottie: unknown id "${id}". Known ids: ${Object.keys(LOTTIE_LIBRARY).join(', ')}`,
      );
    }
    let cancelled = false;
    fetch(lottieUrl(id))
      .then((res) => {
        if (!res.ok) {
          throw new Error(`LibraryLottie: failed to load ${entry.file} (HTTP ${res.status})`);
        }
        return res.json();
      })
      .then((json: unknown) => {
        const candidate = json as Partial<LottieAnimationData>;
        if (
          typeof candidate !== 'object' ||
          candidate === null ||
          typeof candidate.fr !== 'number' ||
          typeof candidate.op !== 'number'
        ) {
          throw new Error(`LibraryLottie: ${entry.file} is not a Lottie animation JSON`);
        }
        if (!cancelled) {
          setData(candidate as LottieAnimationData);
        }
        continueRender(handle);
      })
      .catch((err) => {
        continueRender(handle);
        throw err;
      });
    return () => {
      cancelled = true;
    };
  }, [id, handle]);

  return data;
};

/** Map a composition frame onto an animation frame (loop/reverse/clamp). */
const animationFrameFor = (
  currentFrame: number,
  totalFrames: number,
  loop: boolean,
  direction: 'forward' | 'backward',
): number => {
  const clamped = loop
    ? ((currentFrame % totalFrames) + totalFrames) % totalFrames
    : Math.min(currentFrame, totalFrames - 1);
  return direction === 'backward' ? totalFrames - clamped : clamped;
};

export type LibraryLottieProps = {
  /** Catalog id from LOTTIE_LIBRARY / media/library/lottie/catalog.json. */
  id: LibraryLottieId;
  /**
   * Rendered width in px. Height follows the animation's intrinsic aspect ratio,
   * so a single number sizes it without distortion. Defaults to intrinsic width.
   */
  size?: number;
  /** Frames to hold on animation frame 0 before playing. Default 0. */
  delay?: number;
  /**
   * Play once (default) or loop. Loop only calm clips; brand prefers single,
   * resolved motions over perpetual bounce.
   */
  loop?: boolean;
  /** Speed multiplier. Default 1 (the animation's own pacing). */
  playbackRate?: number;
  /** Play backward. Default forward. */
  direction?: 'forward' | 'backward';
  /** Extra style merged onto the container (position, opacity, etc.). */
  style?: React.CSSProperties;
  className?: string;
  /** Called once the animation has been initialized and is ready to seek. */
  onAnimationLoaded?: (animation: AnimationItem) => void;
};

/**
 * A curated library Lottie animation, sized by `size` and driven by the frame
 * clock. Nothing renders until the clip is loaded (delayRender), and once loaded
 * the visible frame is always the frame-exact one for useCurrentFrame().
 */
export const LibraryLottie: React.FC<LibraryLottieProps> = ({
  id,
  size,
  delay = 0,
  loop = false,
  playbackRate = 1,
  direction = 'forward',
  style,
  className,
  onAnimationLoaded,
}) => {
  const animationData = useLottieData(id);
  const frame = useCurrentFrame();
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<AnimationItem | null>(null);
  const [loadedHandle] = useState(() =>
    delayRender(`Waiting for Lottie "${id}" to initialize`),
  );
  const onAnimationLoadedRef = useRef(onAnimationLoaded);
  onAnimationLoadedRef.current = onAnimationLoaded;

  // Memoize so the load effect below sees a stable animationData reference.
  const data = useMemo(() => animationData, [animationData]);

  // Initialize the animation once per clip; hold the render until DOMLoaded.
  useEffect(() => {
    if (!data || !containerRef.current) {
      return;
    }
    const animation = lottie.loadAnimation({
      container: containerRef.current,
      renderer: 'svg', // crispest for these vector-only clips
      autoplay: false, // we seek manually per frame
      animationData: data,
    });
    animationRef.current = animation;
    const onReady = () => {
      onAnimationLoadedRef.current?.(animation);
      continueRender(loadedHandle);
    };
    animation.addEventListener('DOMLoaded', onReady);
    return () => {
      animation.removeEventListener('DOMLoaded', onReady);
      animation.destroy();
      animationRef.current = null;
    };
  }, [data, loadedHandle]);

  // Frame-exact seek: every rendered frame parks the playhead on the exact
  // animation frame for this composition frame (clamped at the ends).
  useEffect(() => {
    const animation = animationRef.current;
    if (!animation) {
      return;
    }
    const localFrame = Math.max(0, frame - delay) * playbackRate;
    const target = animationFrameFor(localFrame, animation.totalFrames, loop, direction);
    animation.goToAndStop(Math.max(0, target), true);
  }, [data, frame, delay, playbackRate, loop, direction]);

  const intrinsic = LOTTIE_LIBRARY[id];
  const width = size ?? intrinsic.width;
  const height = Math.round((width / intrinsic.width) * intrinsic.height);

  if (!data) {
    // useLottieData's delayRender is holding the render; render nothing yet.
    return null;
  }

  return <div ref={containerRef} style={{ width, height, ...style }} className={className} />;
};

/** Re-export metadata helper for callers that need duration/framerate pre-render. */
export { getLottieMetadata };
export type { LottieAnimationData };
