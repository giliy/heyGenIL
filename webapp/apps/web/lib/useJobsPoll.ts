'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface JobStatus {
  id: string;
  projectId: string;
  type: 'generate' | 'render';
  status: 'queued' | 'running' | 'done' | 'failed';
  stage: string | null;
  progress: number;
  error: string | null;
  outputKey: string | null;
  posterKey: string | null;
  durationSec: number | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  title: string | null;
}

const POLL_INTERVAL = 2000;

// The SSE upgrade (Phase 5) is flag-gated server-side: GET /api/jobs/[id]/events returns 404
// unless SSE_ENABLED=true. We probe with EventSource; on ANY error (including that 404) we fall
// back to the existing 2s polling. No UI change — same JobStatus shape either way.

export function useJobsPoll(jobId: string | null) {
  const [job, setJob] = useState<JobStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    if (!jobId) return;
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError('job not found');
        } else {
          setError(`status ${res.status}`);
        }
        return;
      }
      const data: JobStatus = await res.json();
      setJob(data);
      setError(null);

      // Stop polling on terminal states.
      if (data.status === 'done' || data.status === 'failed') {
        if (timer.current) {
          clearInterval(timer.current);
          timer.current = null;
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'poll failed');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      return;
    }
    setLoading(true);

    // Try SSE first. On the first event we disarm the polling fallback; on ANY error (404 when
    // the flag is off, or a drop) we fall back to polling.
    const source = new EventSource(`/api/jobs/${jobId}/events`);
    let sseActive = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (pollTimer) return;
      void poll();
      pollTimer = setInterval(poll, POLL_INTERVAL);
    };

    source.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as {
          status: string;
          stage: string | null;
          progress: number;
          result: { outputKey?: string | null; posterKey?: string | null; durationSec?: number | null } | null;
          error: string | null;
        };
        sseActive = true;
        // Disarm the polling fallback once the stream is live.
        if (pollTimer) {
          clearInterval(pollTimer);
          pollTimer = null;
        }
        setJob({
          id: jobId,
          projectId: '',
          type: 'render',
          status: (data.status as JobStatus['status']) ?? 'queued',
          stage: data.stage,
          progress: data.progress,
          error: data.error,
          outputKey: data.result?.outputKey ?? null,
          posterKey: data.result?.posterKey ?? null,
          durationSec: data.result?.durationSec ?? null,
          width: null,
          height: null,
          fps: null,
          title: null,
        });
        setError(null);
        setLoading(false);
        if (data.status === 'done' || data.status === 'failed') source.close();
      } catch {
        /* malformed event — ignore */
      }
    };
    source.onerror = () => {
      // The events endpoint is flag-gated (404 when SSE_ENABLED=false) or dropped — fall back.
      source.close();
      if (!sseActive) {
        // Never received a real event (flag off): use polling.
        startPolling();
      } else if (!pollTimer) {
        // Stream dropped mid-job: resume polling from the last-known state.
        startPolling();
      }
    };
    // If SSE never connects within a grace period, fall back to polling too.
    const grace = setTimeout(() => {
      if (!sseActive && !pollTimer) startPolling();
    }, 4000);

    return () => {
      source.close();
      clearTimeout(grace);
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [jobId, poll]);

  return { job, loading, error };
}
