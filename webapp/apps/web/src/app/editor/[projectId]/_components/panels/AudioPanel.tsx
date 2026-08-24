'use client';
// Audio panel — the project's music bed + "Sync to beat". Quantizes scene durations to the bed's
// beats (mode 'nearest') or the honest grid fallback (mode 'grid'). The server returns a NEW
// diffed spec; we load it so the Player updates live, and toast the per-scene changes. Beat
// source honesty: ambient pads have no beats — the API reports source:'none' and we say so.
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useEditorStore } from '../../_store/editorStore';
import type { Spec } from '@shorts/spec';
import { Loader2, Music2 } from 'lucide-react';

interface SyncResp {
  revision: number;
  mode: 'nearest' | 'grid';
  beatSource: 'bpm-analyzed' | 'bpm-grid' | 'none';
  diff: { sceneId: string; from: number; to: number }[];
  spec: Spec;
}

export function AudioPanel({ projectId }: { projectId: string }) {
  const spec = useEditorStore((s) => s.spec);
  const loadSpec = useEditorStore((s) => s.loadSpec);

  const [beats, setBeats] = useState<{
    source: 'bpm-analyzed' | 'bpm-grid' | 'none';
    bpm: number | null;
    cached: boolean;
  } | null>(null);
  const [syncing, setSyncing] = useState(false);

  const bedId = spec.audio?.music?.id ?? null;

  // Load the honest beat state for the current bed (library-first).
  useEffect(() => {
    let active = true;
    setBeats(null);
    fetch(`/api/projects/${projectId}/beats`)
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => {
        if (!active) return;
        if (b?.beats) setBeats({ source: b.beats.source, bpm: b.beats.bpm ?? null, cached: b.cached });
      })
      .catch(() => active && undefined);
    return () => {
      active = false;
    };
  }, [projectId, bedId]);

  async function syncToBeat(mode: 'nearest' | 'grid') {
    setSyncing(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/beats/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(body?.error ?? 'Beat sync failed.');
        return;
      }
      const resp = body as SyncResp;
      // Load the server-returned diffed spec so the Player + timeline update live.
      if (resp.spec) loadSpec(resp.spec);
      if (resp.diff.length === 0) {
        toast.info(
          resp.beatSource === 'none'
            ? 'No beats detected in this bed — scene boundaries already on the grid.'
            : 'Scene boundaries already aligned to beats.'
        );
      } else {
        toast.success(
          `Synced ${resp.diff.length} scene${resp.diff.length > 1 ? 's' : ''} to the ${
            resp.beatSource === 'none' ? 'grid' : 'beat'
          }.`
        );
      }
    } catch {
      toast.error('Beat sync failed.');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Audio</h2>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        {/* Music bed */}
        <div className="rounded-lg border border-line bg-paper p-3">
          <div className="flex items-center gap-2">
            <Music2 size={16} className="text-accent" />
            <span className="text-xs font-semibold text-ink">
              {bedId ? bedId.split('/').pop() : 'No music bed'}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted">
            {bedId
              ? beats?.source === 'none'
                ? 'Ambient pad — no detected beats. Sync uses a grid fallback.'
                : beats?.source === 'bpm-analyzed'
                ? `Analyzed at ${beats?.bpm ?? '?'} BPM.`
                : 'Beat grid active.'
              : 'Add a music bed to sync scenes to a beat.'}
          </p>
        </div>

        {/* Sync to beat */}
        <div className="rounded-lg border border-line bg-paper p-3">
          <p className="text-xs font-semibold text-ink">Sync scene boundaries to beat</p>
          <p className="mt-1 text-[11px] text-muted">
            Trims each scene's end to the nearest beat (or grid point). Speech is never cut off.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => void syncToBeat('nearest')}
              disabled={syncing || !bedId}
              className="flex-1 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white transition hover:bg-accent/90 disabled:opacity-50"
            >
              {syncing ? <Loader2 size={14} className="mx-auto animate-spin" /> : 'Sync to beat'}
            </button>
            <button
              onClick={() => void syncToBeat('grid')}
              disabled={syncing || !bedId}
              className="flex-1 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink transition hover:bg-cream disabled:opacity-50"
            >
              Grid
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
