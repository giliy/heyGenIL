'use client';
// Debounced autosave. On any doc change:
//   1. immediately writes the spec to localStorage (crash-safe draft),
//   2. after a short debounce, PATCHes the server with the last-known revision
//      (last-write-wins; the server bumps meta.revision on success).
// A 409 means a newer version exists elsewhere -> we surface a conflict state and reload the
// server's spec (never silently overwrite). A persistent banner reports save status.
import { useEffect, useRef } from 'react';
import type { Spec } from '@shorts/spec';
import { useEditorStore } from '../_store/editorStore';

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'conflict' | 'error';

const DEBOUNCE_MS = 800;
const lsKey = (projectId: string) => `shorts:editor:draft:${projectId}`;

export function useAutosave(projectId: string, serverRevision: number) {
  const setStatus = useEditorStore((s) => s.setSaveStatus);
  const revisionRef = useRef(serverRevision);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    const unsub = useEditorStore.subscribe((state, prev) => {
      if (state.spec === prev.spec) return; // only react to doc changes
      // 1) crash-safe draft
      try {
        localStorage.setItem(lsKey(projectId), JSON.stringify(state.spec));
      } catch {
        /* storage full / unavailable — non-fatal */
      }
      setStatus('dirty');
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void save(state.spec), DEBOUNCE_MS);
    });
    return () => {
      unsub();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function save(spec: Spec) {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setStatus('saving');
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spec, revision: revisionRef.current }),
      });
      if (res.status === 409) {
        const body = await res.json().catch(() => null);
        setStatus('conflict');
        // Last-write-wins with a NEWER server version -> load the server's spec, never overwrite.
        const serverSpec = body?.serverSpec as Spec | undefined;
        if (serverSpec) {
          revisionRef.current = body.serverRevision ?? revisionRef.current;
          useEditorStore.getState().loadSpec(serverSpec);
        }
        return;
      }
      if (!res.ok) throw new Error(`save failed: ${res.status}`);
      const body = await res.json();
      const newRev = body?.project?.revision ?? body?.spec?.meta?.revision;
      if (typeof newRev === 'number') {
        revisionRef.current = newRev;
        useEditorStore.getState().markSaved(newRev);
      }
      setStatus('saved');
      try {
        localStorage.removeItem(lsKey(projectId));
      } catch {
        /* ignore */
      }
    } catch {
      setStatus('error');
    } finally {
      inFlightRef.current = false;
    }
  }
}
