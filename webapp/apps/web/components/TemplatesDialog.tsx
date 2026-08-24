'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Loader2, Play } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { SpecMode } from '@shorts/spec';

export interface TemplateOption {
  id: string;
  title: string;
  engine: SpecMode;
  posterUrl: string;
}

export function TemplatesDialog({ templates }: { templates: TemplateOption[] }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function renderTemplate(t: TemplateOption) {
    setBusy(t.id);
    setError(null);
    try {
      // 1) seed a project from the template
      const projRes = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: t.id }),
      });
      if (!projRes.ok) {
        const j = await projRes.json().catch(() => ({}));
        throw new Error(j.error ?? 'failed to seed project');
      }
      const { project } = await projRes.json();

      // 2) enqueue a render job
      const jobRes = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id }),
      });
      if (!jobRes.ok) {
        const j = await jobRes.json().catch(() => ({}));
        throw new Error(j.error ?? 'failed to enqueue render');
      }
      const { jobId } = await jobRes.json();

      setOpen(false);
      // Navigate to dashboard; the new card will poll jobId via latestJob.
      router.refresh();
      router.push(`/dashboard?job=${jobId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to render template');
    } finally {
      setBusy(null);
    }
  }

  // Group into sections so the ad track (RTL-first Hebrew) can be presented
  // with the right directionality and its own header.
  const ads = templates.filter((t) => t.engine === 'ad');
  const others = templates.filter((t) => t.engine !== 'ad');

  const card = (t: TemplateOption) => {
    const rtl = t.engine === 'ad';
    return (
      <button
        key={t.id}
        onClick={() => renderTemplate(t)}
        disabled={busy !== null}
        dir={rtl ? 'rtl' : 'ltr'}
        className="group overflow-hidden rounded-card border border-line bg-cream text-left shadow-soft transition hover:border-accent disabled:opacity-60"
      >
        <div className="relative aspect-[9/16] w-full bg-ink/5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={t.posterUrl} alt={t.title} className="h-full w-full object-cover" />
          {busy === t.id && (
            <div className="absolute inset-0 flex items-center justify-center bg-ink/40">
              <Loader2 className="animate-spin text-white" size={28} />
            </div>
          )}
          <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-ink/60 to-transparent p-3 opacity-0 transition group-hover:opacity-100">
            <span className="flex items-center gap-2 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-white">
              <Play size={12} /> Render
            </span>
          </div>
        </div>
        <div className="p-3" dir={rtl ? 'rtl' : 'ltr'}>
          <div className="font-display text-sm font-semibold text-ink">{t.title}</div>
          <div className="mt-1 inline-block rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[10px] uppercase text-muted">
            {t.engine}
          </div>
        </div>
      </button>
    );
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="flex items-center gap-2 rounded-panel bg-accent px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-accent/90">
          <Play size={15} /> Render a template
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-card border border-line bg-paper p-6 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="font-display text-lg font-bold text-ink">
              Render a template
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="rounded-panel p-1 text-muted hover:bg-cream hover:text-ink">
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>

          {error && (
            <p className="mb-3 rounded-panel border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          {ads.length > 0 && (
            <div className="mb-5">
              <div
                dir="rtl"
                className="mb-2 flex items-center justify-between border-b border-line pb-1"
              >
                <span className="font-display text-sm font-semibold text-ink">
                  פרסומות — עברית
                </span>
                <span className="rounded-full bg-accent/10 px-2 py-0.5 font-mono text-[10px] uppercase text-accent">
                  Ad · RTL
                </span>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{ads.map(card)}</div>
            </div>
          )}

          {others.length > 0 && (
            <div>
              {ads.length > 0 && (
                <div className="mb-2 border-b border-line pb-1">
                  <span className="font-display text-sm font-semibold text-ink">Shorts</span>
                </div>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{others.map(card)}</div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
