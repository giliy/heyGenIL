'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2, Download, Film, ArrowLeft, PenLine } from 'lucide-react';

const STAGES = ['story', 'voice', 'pixel', 'build', 'qa', 'mix', 'render'] as const;

interface JobStatus {
  id: string;
  projectId: string;
  status: 'queued' | 'running' | 'done' | 'failed';
  stage: string | null;
  progress: number;
  error: string | null;
  outputKey: string | null;
  posterKey: string | null;
  durationSec: number | null;
  title: string | null;
}

const STAGE_LABEL: Record<string, string> = {
  story: 'Story — drafting the beat sheet',
  voice: 'Voice — synthesizing the narration',
  pixel: 'Pixels — preparing visuals (TSX)',
  build: 'Build — rendering the silent master',
  qa: 'QA — checking frames + audio',
  mix: 'Mix — muxing voice onto the video',
  render: 'Finalize — saving your short',
};

function stageIndex(stage: string | null): number {
  const i = STAGES.indexOf(stage as never);
  return i < 0 ? -1 : i;
}

export default function ProgressPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const search = useSearchParams();
  const jobIdParam = search.get('job') ?? null;
  const [job, setJob] = useState<JobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobIdParam) return;
    let active = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const poll = async () => {
      try {
        const res = await fetch(`/api/jobs/${jobIdParam}`);
        if (!res.ok) {
          if (active) setError(`status ${res.status}`);
          return;
        }
        const data: JobStatus = await res.json();
        if (!active) return;
        setJob(data);
        setError(null);
        if (data.status === 'done' || data.status === 'failed') {
          if (timer) clearInterval(timer);
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'poll failed');
      }
    };

    void poll();
    timer = setInterval(poll, 2000);
    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, [jobIdParam]);

  const terminal = job?.status === 'done' || job?.status === 'failed';
  const currentIdx = stageIndex(job?.stage ?? null);

  const stageState = (i: number): 'done' | 'current' | 'pending' => {
    if (job?.status === 'done') return i < STAGES.length ? 'done' : 'pending';
    if (i < currentIdx) return 'done';
    if (i === currentIdx) return 'current';
    return 'pending';
  };

  const posterUrl = job?.posterKey ? `/media/${job.posterKey}` : null;
  const downloadUrl = job?.outputKey ? `/media/${job.outputKey}` : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/dashboard" className="flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} /> Dashboard
      </Link>

      <div>
        <h1 className="font-display text-2xl font-bold text-ink">{job?.title ?? 'Generating your short'}</h1>
        <p className="text-sm text-muted">
          {job?.status === 'done'
            ? 'Your short is ready.'
            : job?.status === 'failed'
            ? 'Generation failed.'
            : 'Working through the pipeline — this takes a minute or two.'}
        </p>
      </div>

      {/* Stage list */}
      <div className="space-y-2 rounded-card border border-line bg-paper p-4 shadow-card">
        {STAGES.map((s, i) => {
          const st = stageState(i);
          const pct = st === 'done' ? 100 : st === 'current' ? Math.round((job?.progress ?? 0) * 100) : 0;
          return (
            <div key={s} className="flex items-center gap-3">
              <div className="flex w-6 justify-center">
                {st === 'done' ? (
                  <CheckCircle2 size={18} className="text-signal" />
                ) : st === 'current' ? (
                  <Loader2 size={18} className="animate-spin text-accent" />
                ) : (
                  <div className="h-[18px] w-[18px] rounded-full border-2 border-line" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-medium ${st === 'current' ? 'text-ink' : st === 'done' ? 'text-signal' : 'text-muted'}`}>
                    {STAGE_LABEL[s]}
                  </span>
                  {st === 'current' && <span className="font-mono text-xs text-accent">{pct}%</span>}
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
                  <div
                    className={`h-full rounded-full transition-all ${st === 'done' ? 'bg-signal' : 'bg-accent'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {error && !job && <p className="rounded-panel border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

      {job?.status === 'failed' && (
        <div className="rounded-panel border border-danger/30 bg-danger/10 px-4 py-3">
          <p className="text-sm font-medium text-danger">Generation failed</p>
          <p className="mt-1 text-sm text-ink/80">{job.error ?? 'Unknown error'}</p>
        </div>
      )}

      {job?.status === 'done' && (
        <div className="rounded-card border border-line bg-paper p-4 shadow-card space-y-3">
          <div className="aspect-[9/16] w-full max-w-xs overflow-hidden rounded-panel bg-ink/5">
            {posterUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={posterUrl} alt="poster" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted"><Film size={40} /></div>
            )}
          </div>
          {downloadUrl && (
            <div className="flex flex-wrap gap-2">
              <a
                href={downloadUrl}
                download
                className="flex items-center gap-2 rounded-panel bg-accent px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-accent/90"
              >
                <Download size={15} /> Download mp4
              </a>
              <Link
                href={`/editor/${projectId}`}
                className="flex items-center gap-2 rounded-panel border border-line px-4 py-2 text-sm font-semibold text-ink transition hover:bg-cream"
              >
                <PenLine size={15} /> Open in editor
              </Link>
            </div>
          )}
        </div>
      )}

      {terminal && (
        <Link href="/dashboard" className="text-sm text-accent hover:underline">
          Back to dashboard
        </Link>
      )}
    </div>
  );
}
