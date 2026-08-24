'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useJobsPoll, type JobStatus } from '@/lib/useJobsPoll';
import { StatusPill, type PillStatus } from '@/components/StatusPill';
import { ProgressBar } from '@/components/ProgressBar';
import { formatDuration } from '@/lib/utils';
import type { SpecMode } from '@shorts/spec';
import { Download, Film, PenLine, MoreVertical } from 'lucide-react';

export interface ProjectCardData {
  id: string;
  title: string;
  template: string;
  /** Content track (tsx|ad|kids|ai|vox) — the db engine/mode column value. */
  engine: SpecMode;
  status: 'draft' | 'generating' | 'ready' | 'failed';
  posterKey: string | null;
  outputKey: string | null;
  durationSec: number | null;
  updatedAt: string;
  latestJobId?: string | null;
  latestJobStatus?: 'queued' | 'running' | 'done' | 'failed' | null;
  latestJobProgress?: number | null;
  latestJobError?: string | null;
}

function pillFor(project: ProjectCardData, job: JobStatus | null): { status: PillStatus; progress?: number } {
  // Live job status wins when present.
  if (job) {
    if (job.status === 'running') return { status: 'running', progress: job.progress };
    if (job.status === 'queued') return { status: 'queued' };
    if (job.status === 'done') return { status: 'ready' };
    if (job.status === 'failed') return { status: 'failed' };
  }
  if (project.status === 'ready') return { status: 'ready' };
  if (project.status === 'failed') return { status: 'failed' };
  if (project.status === 'generating') return { status: 'generating', progress: project.latestJobProgress ?? undefined };
  return { status: 'draft' };
}

export function ProjectCard({ project }: { project: ProjectCardData }) {
  const [activeJobId, setActiveJobId] = useState<string | null>(project.latestJobId ?? null);
  const { job } = useJobsPoll(activeJobId);

  // When a job transitions to done/failed, refresh project state once.
  const [finalProject, setFinalProject] = useState<ProjectCardData>(project);

  useEffect(() => {
    setActiveJobId(project.latestJobId ?? null);
    setFinalProject(project);
  }, [project]);

  useEffect(() => {
    if (!job) return;
    if (job.status === 'done') {
      setFinalProject((p) => ({
        ...p,
        status: 'ready',
        outputKey: job.outputKey ?? p.outputKey,
        posterKey: job.posterKey ?? p.posterKey,
        durationSec: job.durationSec ?? p.durationSec,
      }));
    } else if (job.status === 'failed') {
      setFinalProject((p) => ({ ...p, status: 'failed', latestJobError: job.error }));
    } else if (job.status === 'running') {
      setFinalProject((p) => ({ ...p, status: 'generating', latestJobProgress: job.progress }));
    }
  }, [job]);

  const pill = pillFor(finalProject, job);
  const posterUrl = finalProject.posterKey ? `/media/${finalProject.posterKey}` : null;
  const downloadUrl = finalProject.outputKey ? `/media/${finalProject.outputKey}` : null;
  const pct = pill.progress != null ? Math.round(pill.progress * 100) : null;
  const ready = pill.status === 'ready';

  // ---- Phase 5: card menu (SRT / versions / resize / share stubs) ----
  const [menuOpen, setMenuOpen] = useState(false);
  const [versionCount, setVersionCount] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close the menu on outside click.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  // Lazy-load the version count when the menu first opens.
  useEffect(() => {
    if (!menuOpen || versionCount !== null) return;
    fetch(`/api/projects/${finalProject.id}/versions`)
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => setVersionCount(Array.isArray(b?.versions) ? b.versions.length : 0))
      .catch(() => setVersionCount(0));
  }, [menuOpen, finalProject.id, versionCount]);

  async function downloadSrt() {
    setMenuOpen(false);
    const res = await fetch(`/api/projects/${finalProject.id}/srt`);
    if (!res.ok) {
      toast.error(res.status === 404 ? 'No voice captions to export yet.' : 'SRT export failed.');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${finalProject.title.replace(/[^\w-]+/g, '_')}.srt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success('SRT downloaded.');
  }

  async function resizeRender(aspect: '9:16' | '1:1' | '16:9') {
    setMenuOpen(false);
    try {
      const res = await fetch(`/api/projects/${finalProject.id}/resize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aspect }),
      });
      const body = await res.json().catch(() => null);
      if (res.status === 409) {
        toast.info(`Already at ${aspect}.`);
        return;
      }
      if (res.status === 402) {
        toast.error(`Not enough credits (need ${body?.credits}, have ${body?.balance}).`);
        return;
      }
      if (!res.ok) {
        toast.error(body?.error ?? 'Resize failed.');
        return;
      }
      toast.success(`Resizing to ${aspect}… (${body?.credits}cr)`);
      if (body?.jobId) setActiveJobId(body.jobId);
    } catch {
      toast.error('Resize failed.');
    }
  }

  async function shareTo(platform: 'tiktok' | 'youtube') {
    setMenuOpen(false);
    try {
      const res = await fetch(`/api/publish/${platform}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: finalProject.id }),
      });
      if (res.status === 501) {
        const body = await res.json().catch(() => null);
        toast.error(
          `Publish to ${platform === 'tiktok' ? 'TikTok' : 'YouTube'} is not available yet (flag: ${body?.flag}).`
        );
        return;
      }
      // Flag on → dry-run echo → "coming soon".
      toast(`Publish to ${platform === 'tiktok' ? 'TikTok' : 'YouTube'} — coming soon.`);
    } catch {
      toast.error('Publish failed.');
    }
  }

  return (
    <div className="overflow-hidden rounded-card border border-line bg-cream shadow-card">
      {/* Poster */}
      <div className="relative aspect-[9/16] w-full bg-ink/5">
        {posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={posterUrl} alt={finalProject.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted">
            <Film size={40} />
          </div>
        )}
        <div className="absolute right-2 top-2 flex items-center gap-1">
          <span className="rounded-full bg-ink/70 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-paper">
            {finalProject.engine}
          </span>
          {ready && (
            <div ref={menuRef} className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex h-6 w-6 items-center justify-center rounded-full bg-ink/70 text-paper hover:bg-ink"
                title="More actions"
                aria-label="More actions"
              >
                <MoreVertical size={13} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-lg border border-line bg-paper py-1 text-left shadow-card">
                  <button
                    onClick={() => void downloadSrt()}
                    className="block w-full px-3 py-1.5 text-left text-xs text-ink hover:bg-cream"
                  >
                    Download SRT
                  </button>
                  <Link
                    href={`/projects/${finalProject.id}/versions`}
                    onClick={() => setMenuOpen(false)}
                    className="block w-full px-3 py-1.5 text-xs text-ink hover:bg-cream"
                  >
                    Versions{versionCount != null ? ` (${versionCount})` : ''}
                  </Link>
                  <div className="my-1 border-t border-line" />
                  {(['9:16', '1:1', '16:9'] as const).map((a) => (
                    <button
                      key={a}
                      onClick={() => void resizeRender(a)}
                      className="block w-full px-3 py-1.5 text-left text-xs text-ink hover:bg-cream"
                    >
                      Resize &amp; render {a}
                    </button>
                  ))}
                  <div className="my-1 border-t border-line" />
                  <button
                    onClick={() => void shareTo('tiktok')}
                    className="block w-full px-3 py-1.5 text-left text-xs text-ink hover:bg-cream"
                  >
                    Share → TikTok
                  </button>
                  <button
                    onClick={() => void shareTo('youtube')}
                    className="block w-full px-3 py-1.5 text-left text-xs text-ink hover:bg-cream"
                  >
                    Share → YouTube
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 font-display text-sm font-semibold leading-snug text-ink">
            {finalProject.title}
          </h3>
        </div>

        <div className="flex items-center justify-between">
          <StatusPill status={pill.status} progress={pill.progress} />
          <span className="font-mono text-xs text-muted">{formatDuration(finalProject.durationSec)}</span>
        </div>

        {(pill.status === 'running' || pill.status === 'generating') && (
          <div className="space-y-1">
            <ProgressBar progress={pill.progress ?? 0} />
            {pct != null && <div className="font-mono text-[11px] text-muted">{pct}%</div>}
          </div>
        )}

        {pill.status === 'failed' && (job?.error ?? finalProject.latestJobError) && (
          <p className="line-clamp-2 rounded-panel border border-danger/30 bg-danger/10 px-2 py-1 text-[11px] text-danger">
            {job?.error ?? finalProject.latestJobError}
          </p>
        )}

        {pill.status === 'ready' && downloadUrl && (
          <div className="mt-1 space-y-2">
            <a
              href={downloadUrl}
              download
              className="flex items-center justify-center gap-2 rounded-panel bg-accent px-3 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-accent/90"
            >
              <Download size={15} /> Download
            </a>
            <Link
              href={`/editor/${finalProject.id}`}
              className="flex items-center justify-center gap-2 rounded-panel border border-line px-3 py-2 text-sm font-semibold text-ink transition hover:bg-cream"
            >
              <PenLine size={15} /> Open in editor
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
