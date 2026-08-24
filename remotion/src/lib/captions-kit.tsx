/**
 * captions-kit.tsx — unified per-word caption TIMING, built on
 * remotion-captions-kit (MIT, zero runtime deps, peers: @remotion/captions).
 *
 * The ONE thing this file standardizes is the per-word timing state every
 * caption style needs — `useTokenStates()` — so kinetic.tsx (word springs),
 * reading-render.tsx (sub-word highlight), and ads.tsx caption paths stop
 * re-deriving the same "is this word active / how far through it are we" math
 * by hand. This is a HEADLESS timing layer; it renders nothing itself.
 *
 * Determinism: remotion-captions-kit computes token states from
 * useCurrentFrame() against the page's absolute ms timings — pure function of
 * frame. The paging helpers (captionsFromWords / createCaptionPages) are pure
 * string/time transforms of the .words.json contract.
 *
 * The repo's native caption contract is TimedWord[] = [{w, start, end}, ...]
 * in SECONDS (lib/shorts.tsx). captionsFromWords expects {word,start,end} in
 * seconds and emits the Caption[] that @remotion/captions paginates into
 * TikTokPage[] — the input useTokenStates consumes. toTokenPages() below is the
 * one call that bridges TimedWord[] -> TikTokPage[].
 */
import React, { useMemo } from 'react';
import { createTikTokStyleCaptions, type TikTokPage, type TikTokToken } from '@remotion/captions';
import {
  captionsFromWords,
  createCaptionPages,
  useTokenStates,
  type TokenState,
} from 'remotion-captions-kit';
import type { TimedWord } from './shorts';

export type { TokenState };

/**
 * Bridge the repo's .words.json contract (TimedWord[], seconds) into the
 * TikTokPage[] that remotion-captions-kit's useTokenStates() consumes.
 * Pure — call inside a useMemo (see useWordStates).
 *
 * `chunkSize` bounds how many words land on one page; raise for longer lines.
 */
export const toTokenPages = (words: TimedWord[], chunkSize = 5): TikTokPage[] => {
  const { captions } = captionsFromWords({
    words: words.map((w) => ({ word: w.w, start: w.start, end: w.end })),
    timeUnit: 'seconds',
  });
  // Prefer the kit's sentence/pause-aware paginator; fall back to the stock
  // createTikTokStyleCaptions chunking if a page list comes back empty.
  const { pages } = createCaptionPages({
    captions,
    maxCharsPerPage: chunkSize * 8,
    maxDurationMs: 4000,
  });
  if (pages.length > 0) return pages;
  return createTikTokStyleCaptions({ captions, combineTokensWithinMilliseconds: 1200 }).pages;
};

export type WordState = {
  /** The word text (whitespace-trimmed). */
  text: string;
  /** Position of the word within its page. */
  index: number;
  /** The word is being spoken right now. */
  isActive: boolean;
  /** The word's start time has passed (active + finished). */
  hasAppeared: boolean;
  /** 0 before the word, 0→1 while spoken, 1 after. */
  progress: number;
};

/**
 * Per-word caption state for one page, driven by the current frame.
 * Drop-in replacement for the hand-rolled "active word" logic in
 * kinetic.tsx / reading-render.tsx / ads.tsx caption paths: instead of
 * comparing `t` against word.start/end yourself, consume these states.
 *
 * Usage:
 *   const pages = useMemo(() => toTokenPages(words), [words]);
 *   // inside a component rendering ONE page:
 *   const states = useWordStates(page);
 *   states.map(s => <span style={{opacity: s.hasAppeared?1:0.3, ...}}>{s.text}</span>)
 */
export const useWordStates = (page: TikTokPage): WordState[] => {
  const { tokens } = useTokenStates({ page });
  return tokens.map((t: TokenState) => ({
    text: (t.token as TikTokToken).text.trim(),
    index: t.index,
    isActive: t.isActive,
    hasAppeared: t.hasAppeared,
    progress: t.progress,
  }));
};

/**
 * Convenience: tokenize + paginate a TimedWord[] and return the pages, so a
 * shot can map each page to a caption block (paged across lines upstream, like
 * chunkLines does for the stock captions). Memoized on the words array.
 */
export const useCaptionPagesFromWords = (words: TimedWord[], chunkSize = 5): TikTokPage[] => {
  return useMemo(() => toTokenPages(words, chunkSize), [words, chunkSize]);
};
