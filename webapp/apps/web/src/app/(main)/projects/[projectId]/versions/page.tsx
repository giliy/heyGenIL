'use client';
// Versions page — the render-history timeline of a project's IMMUTABLE render_versions rows.
// Each row: revision, aspect (from format), duration, date, poster, Download (own mp4), SRT.
// "Restore spec" (writing version.specJson back to a NEW revision) is P1 — shown disabled.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Download, Film, History } from 'lucide-react';

interface Version {
  id: string;
  revision: number;
  format: { width: number; height: number } | null;
  durationSec: number | null;
  createdAt: string;
  hasVideo: boolean;
  hasPoster: boolean;
  downloadUrl: string | null;
  posterUrl: string | null;
}

function aspectLabel(format: { width: number; height: number } | null): string {
  if (!format) return '—';
  const ratio = format.width / format.height;
  const r = (t: number) => Math.abs(ratio - t) < 0.01;
  if (r(9 / 16)) return '9:16';
  if (r(1)) return '1:1';
  if (r(16 / 9)) return '16:9';
  return `${format.width}×${format.height}`;
}

export default function VersionsPage() {
  const { id } = useParams<{ id: string }>();
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/projects/${id}/versions`)
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => {
        if (!active) return;
        if (b && Array.isArray(b.versions)) setVersions(b.versions);
        else setError('Could not load versions.');
      })
      .catch(() => active && setError('Could not load versions.'));
    return () => {
      active = false;
    };
  }, [id]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/dashboard" className="flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} /> Dashboard
      </Link>

      <div className="flex items-center gap-2">
        <History size={20} className="text-accent" />
        <h1 className="font-display text-2xl font-bold text-ink">Render versions</h1>
      </div>
      <p className="text-sm text-muted">
        Each render you produce is stored as an immutable version. Restore-to-spec is coming soon.
      </p>

      {error && <p className="rounded-panel border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

      {versions === null && !error && <p className="text-sm text-muted">Loading versions…</p>}

      {versions !== null && versions.length === 0 && (
        <div className="rounded-card border border-line bg-paper p-8 text-center text-sm text-muted shadow-card">
          No renders yet. Render your project to create the first version.
        </div>
      )}

      <div className="space-y-3">
        {versions?.map((v) => (
          <div key={v.id} className="flex items-center gap-4 rounded-card border border-line bg-paper p-3 shadow-card">
            {/* Poster thumb */}
            <div className="h-24 w-14 shrink-0 overflow-hidden rounded-panel bg-ink/5">
              {v.posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={v.posterUrl} alt={`revision ${v.revision}`} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted">
                  <Film size={18} />
                </div>
              )}
            </div>

            {/* Meta */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-ink/70 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-paper">
                  rev {v.revision}
                </span>
                <span className="rounded-full bg-accent/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-accent">
                  {aspectLabel(v.format)}
                </span>
              </div>
              <p className="mt-1 font-mono text-xs text-muted">
                {v.durationSec != null ? `${v.durationSec.toFixed(1)}s` : '—'} ·{' '}
                {new Date(v.createdAt).toLocaleString()}
              </p>
            </div>

            {/* Actions */}
            <div className="flex shrink-0 flex-col gap-1.5">
              <a
                href={v.downloadUrl ?? '#'}
                download
                aria-disabled={!v.hasVideo}
                className={`flex items-center gap-1.5 rounded-panel px-3 py-1.5 text-xs font-semibold transition ${
                  v.hasVideo
                    ? 'bg-accent text-white hover:bg-accent/90'
                    : 'pointer-events-none bg-cream text-muted'
                }`}
              >
                <Download size={13} /> mp4
              </a>
              <a
                href={`/api/projects/${id}/srt`}
                className="flex items-center justify-center gap-1.5 rounded-panel border border-line px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-cream"
              >
                SRT
              </a>
              <button
                disabled
                title="Restore-to-spec is coming soon"
                className="cursor-not-allowed rounded-panel border border-line px-3 py-1.5 text-xs font-semibold text-muted"
              >
                Restore (soon)
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
