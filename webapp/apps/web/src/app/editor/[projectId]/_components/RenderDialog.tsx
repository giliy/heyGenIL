'use client';
// Enqueues a render job with the EDITOR'S current spec (inputSpec) — the same JSON the Player
// previews — then polls the job to completion. When captionsDirty, we pass captionsDiverged so
// the render carries the divergence state and never silently ships caption text that disagrees
// with the muxed voice.
//
// Phase 4 additions: upfront quote (POST /api/quotes with the live spec), resolution selector
// (720p free / 1080p paid), balance readout, and a "Need credits" link when the quote exceeds the
// balance. Failed renders are always free — the reserve is refunded by the worker.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useEditorStore } from '../_store/editorStore';
import { useBilling } from '@/lib/billing';
import type { EditorProject } from './EditorShell';
import {
  aspectOfFormat,
  transformSpecForAspect,
  quoteSpec,
  type Aspect,
} from '@shorts/spec';

type JobState = 'idle' | 'queued' | 'rendering' | 'done' | 'error';

interface Quote {
  credits: number;
  breakdown: {
    tsxFlat: number;
    aiImages: { count: number; credits: number };
    aiVoiceLines: { count: number; credits: number };
    aiVideoSec: { seconds: number; credits: number };
  };
}

const ASPECTS: { id: Aspect; label: string; dims: string }[] = [
  { id: '9:16', label: '9:16', dims: '1080×1920' },
  { id: '1:1', label: '1:1', dims: '1080×1080' },
  { id: '16:9', label: '16:9', dims: '1920×1080' },
];

export function RenderDialog({
  project,
  open,
  onOpenChange,
}: {
  project: EditorProject;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const spec = useEditorStore((s) => s.spec);
  const captionsDirty = useEditorStore((s) => s.captionsDirty);
  const billing = useBilling();

  const [state, setState] = useState<JobState>('idle');
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [resolution, setResolution] = useState<'720p' | '1080p'>('720p');
  const [aspect, setAspect] = useState<Aspect>('9:16');
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!open) {
      if (pollTimer.current) clearInterval(pollTimer.current);
      setState('idle');
      setJobId(null);
      setProgress(0);
      setOutputUrl(null);
      setError(null);
      setQuote(null);
      setQuoteLoading(false);
    }
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [open]);

  // The spec's CURRENT aspect (used to decide normal render vs resize).
  const currentAspect = aspectOfFormat(spec.format);
  // Whether the selected aspect is a RESIZE (differs from the current spec) — default '9:16'
  // but if the current spec is already 9:16 that's the normal render path.
  const isResize = currentAspect !== 'custom' && currentAspect !== aspect;

  // Re-quote at the TARGET aspect (transformSpecForAspect is pure + shared; quoteSpec is pure).
  const aspectQuote = useMemo(() => {
    const transformed = transformSpecForAspect(spec, aspect);
    const q = quoteSpec(transformed, billing.tier as 'free' | 'creator' | 'pro');
    return { transformed, quote: q };
  }, [spec, aspect, billing.tier]);

  const targetDims = ASPECTS.find((a) => a.id === aspect)?.dims ?? '';

  // Upfront quote: fetch whenever the dialog opens (and whenever the spec/tier changes).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setQuoteLoading(true);
    void fetch('/api/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: project.id, inputSpec: spec }),
    })
      .then(async (res) => {
        if (!res.ok) return null;
        const body = await res.json();
        return body as Quote | undefined;
      })
      .then((q) => {
        if (cancelled) return;
        setQuote(q ?? null);
        setQuoteLoading(false);
        // Default resolution: paid users see 1080p, free users 720p.
        setResolution(billing.isPaid ? '1080p' : '720p');
      })
      .catch(() => {
        if (cancelled) return;
        setQuote(null);
        setQuoteLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, spec, billing.isPaid]);

  async function startResizeRender() {
    // Resize & render: POST /api/projects/[id]/resize. The server quotes+reserves at the target
    // resolution, enqueues a render job with the transformed spec, and the worker reuses the
    // cached bundle (no re-bundle) + records a render_versions row on done.
    setState('queued');
    setError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/resize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aspect }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        if (res.status === 402) {
          throw new Error(
            body?.error === 'insufficient_credits'
              ? `Not enough credits (need ${body?.credits}, have ${body?.balance}).`
              : (body?.error ?? 'insufficient credits')
          );
        }
        throw new Error(body?.error ?? `resize failed: ${res.status}`);
      }
      const id = body?.jobId;
      if (!id) throw new Error('no job id returned');
      setJobId(id);
      setState('rendering');
      pollTimer.current = setInterval(() => void poll(id), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to enqueue resize');
      setState('error');
    }
  }

  async function startRender() {
    setState('queued');
    setError(null);
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          inputSpec: spec,
          captionsDiverged: captionsDirty,
          resolution,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        if (res.status === 402) {
          throw new Error(
            body?.error === 'insufficient credits'
              ? `Not enough credits (need ${body?.needed}, have ${body?.balance}). Credits are refunded if a render fails.`
              : (body?.error ?? 'insufficient credits'),
          );
        }
        throw new Error(body?.error ?? `enqueue failed: ${res.status}`);
      }
      const id = body?.jobId;
      if (!id) throw new Error('no job id returned');
      setJobId(id);
      setState('rendering');
      pollTimer.current = setInterval(() => void poll(id), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to enqueue render');
      setState('error');
    }
  }

  async function poll(id: string) {
    try {
      const res = await fetch(`/api/jobs/${id}`);
      if (!res.ok) return;
      const job = await res.json();
      const status: string = job?.status ?? '';
      const prog: number = job?.progress ?? 0;
      setProgress(Math.round(prog * 100));
      if (status === 'done') {
        if (pollTimer.current) clearInterval(pollTimer.current);
        setState('done');
        const key: string | null = job?.outputKey ?? null;
        setOutputUrl(key ? `/media/${key}` : null);
        void billing.refetch();
      } else if (status === 'error' || status === 'failed') {
        if (pollTimer.current) clearInterval(pollTimer.current);
        setError(job?.error ?? 'render failed');
        setState('error');
        void billing.refetch();
      }
    } catch {
      /* transient poll failure — keep polling */
    }
  }

  const shortfall =
    quote != null && quote.credits > billing.creditsBalance ? quote.credits - billing.creditsBalance : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle>Render video</DialogTitle>
        <DialogDescription>
          Renders the exact spec you see in the preview into an mp4.
        </DialogDescription>

        {captionsDirty && (
          <div className="rounded-lg bg-warn/15 p-3 text-xs text-warn">
            Captions were edited for preview only — they may not match the muxed voice. The render
            is flagged as diverged; re-generate voice in Generate to bake caption text into audio.
          </div>
        )}

        {/* Upfront quote */}
        <div className="mt-2 rounded-lg border border-line bg-cream/50 p-3">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">
              Cost (upfront)
            </span>
            <span className="font-mono text-sm font-bold text-ink">
              {quoteLoading ? '…' : quote ? `${quote.credits} ⚡` : '—'}
            </span>
          </div>
          {quote && (
            <ul className="mt-2 space-y-0.5 text-xs text-muted">
              <li className="flex justify-between">
                <span>TSX render (flat)</span>
                <span className="font-mono">{quote.breakdown.tsxFlat} ⚡</span>
              </li>
              {quote.breakdown.aiImages.count > 0 && (
                <li className="flex justify-between">
                  <span>AI images × {quote.breakdown.aiImages.count}</span>
                  <span className="font-mono">{quote.breakdown.aiImages.credits} ⚡</span>
                </li>
              )}
              {quote.breakdown.aiVoiceLines.count > 0 && (
                <li className="flex justify-between">
                  <span>AI voice lines × {quote.breakdown.aiVoiceLines.count}</span>
                  <span className="font-mono">{quote.breakdown.aiVoiceLines.credits} ⚡</span>
                </li>
              )}
            </ul>
          )}
          <div className="mt-2 flex items-center justify-between border-t border-line pt-2 text-xs">
            <span className="text-muted">Balance</span>
            <span className="font-mono font-semibold text-ink">{billing.creditsBalance} ⚡</span>
          </div>
          {shortfall > 0 && (
            <div className="mt-2 rounded-lg bg-warn/15 p-2 text-xs text-warn">
              You need <span className="font-semibold">{shortfall} more ⚡</span>.{' '}
              <Link href="/billing" className="font-medium underline">
                Get credits
              </Link>
            </div>
          )}
          <p className="mt-2 text-[11px] text-muted">
            Failed renders are always free — credits are auto-refunded.
          </p>
        </div>

        {/* Resolution selector */}
        <div className="mt-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Resolution</span>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setResolution('720p')}
              className={`rounded-lg border p-2.5 text-left text-xs transition ${
                resolution === '720p'
                  ? 'border-accent bg-accent/10'
                  : 'border-line bg-paper hover:border-accent/40'
              }`}
            >
              <div className="font-semibold text-ink">720p</div>
              <div className="text-muted">{billing.isPaid ? 'Clean' : 'Free · watermark'}</div>
            </button>
            <button
              type="button"
              onClick={() => billing.isPaid && setResolution('1080p')}
              disabled={!billing.isPaid}
              className={`rounded-lg border p-2.5 text-left text-xs transition ${
                resolution === '1080p'
                  ? 'border-accent bg-accent/10'
                  : 'border-line bg-paper hover:border-accent/40'
              } ${!billing.isPaid ? 'opacity-50' : ''}`}
            >
              <div className="font-semibold text-ink">1080p</div>
              <div className="text-muted">
                {billing.isPaid ? 'Clean, no watermark' : 'Paid only'}
              </div>
            </button>
          </div>
          {!billing.isPaid && (
            <p className="mt-1.5 text-[11px] text-muted">
              Free renders are 720p with a watermark.{' '}
              <Link href="/billing" className="font-medium text-accent hover:underline">
                Upgrade for 1080p
              </Link>
            </p>
          )}
        </div>

        {/* Aspect resize */}
        <div className="mt-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Aspect</span>
          <div className="mt-1 grid grid-cols-3 gap-2">
            {ASPECTS.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setAspect(a.id)}
                className={`rounded-lg border p-2.5 text-left text-xs transition ${
                  aspect === a.id
                    ? 'border-accent bg-accent/10'
                    : 'border-line bg-paper hover:border-accent/40'
                }`}
              >
                <div className="font-semibold text-ink">{a.label}</div>
                <div className="text-muted">{a.dims}</div>
              </button>
            ))}
          </div>
          {isResize ? (
            <p className="mt-1.5 text-[11px] text-muted">
              Resizes to <span className="font-medium text-ink">{targetDims}</span> (scale + center,
              no crop). Cost at the target aspect:{' '}
              <span className="font-mono font-semibold text-ink">
                {aspectQuote.quote.credits} ⚡
              </span>
            </p>
          ) : (
            <p className="mt-1.5 text-[11px] text-muted">
              Already {aspect === currentAspect ? 'at' : ''} this aspect ({targetDims}).
            </p>
          )}
        </div>

        <div className="mt-3 space-y-3">
          {state === 'idle' && (
            <Button
              variant="signal"
              onClick={() => void (isResize ? startResizeRender() : startRender())}
              disabled={quoteLoading || shortfall > 0}
            >
              {shortfall > 0
                ? 'Insufficient credits'
                : isResize
                ? `Resize & render at ${aspect}`
                : 'Start render'}
            </Button>
          )}

          {(state === 'queued' || state === 'rendering') && (
            <div>
              <div className="mb-1 flex justify-between text-xs text-muted">
                <span>{state === 'queued' ? 'Queued…' : 'Rendering…'}</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-cream">
                <div
                  className="h-full bg-signal transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {state === 'done' && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-signal">Render complete.</p>
              {outputUrl && (
                <a
                  href={outputUrl}
                  download
                  className="inline-block rounded-lg bg-signal px-3 py-2 text-sm font-medium text-white hover:bg-signal/90"
                >
                  Download mp4
                </a>
              )}
            </div>
          )}

          {state === 'error' && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-danger">Render failed.</p>
              {error && <p className="text-xs text-muted">{error}</p>}
              <p className="text-[11px] text-signal">Credits were auto-refunded.</p>
              <Button variant="outline" size="sm" onClick={() => void startRender()}>
                Retry
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
