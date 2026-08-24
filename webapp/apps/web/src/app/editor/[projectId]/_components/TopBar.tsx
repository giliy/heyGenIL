'use client';
// Top bar: back link, editable title (debounced PATCH .../title), save-status pill, captions
// divergence banner trigger, and the Render button (opens the RenderDialog).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useEditorStore, undo, redo } from '../_store/editorStore';
import { validateAdSpec } from '@shorts/spec';
import type { EditorProject } from './EditorShell';
import { RenderDialog } from './RenderDialog';

const TITLE_DEBOUNCE_MS = 600;

export function TopBar({ project }: { project: EditorProject }) {
  const title = useEditorStore((s) => s.spec.title);
  const setTitle = useEditorStore((s) => s.setTitle);
  const saveStatus = useEditorStore((s) => s.saveStatus);
  const captionsDirty = useEditorStore((s) => s.captionsDirty);
  const spec = useEditorStore((s) => s.spec);
  const adIssues = useMemo(
    () => (spec.mode === 'ad' ? validateAdSpec(spec) : []),
    [spec]
  );

  const [value, setValue] = useState(project.title);
  const [renderOpen, setRenderOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the input in sync if the spec is reloaded (conflict / initial load).
  useEffect(() => setValue(title), [title]);

  function onTitleChange(next: string) {
    setValue(next);
    setTitle(next); // updates spec.title + the hook overlay live on canvas
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void fetch(`/api/projects/${project.id}/title`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: next }),
      });
    }, TITLE_DEBOUNCE_MS);
  }

  const statusLabel: Record<string, { text: string; cls: string }> = {
    idle: { text: 'Up to date', cls: 'text-muted' },
    dirty: { text: 'Unsaved changes', cls: 'text-warn' },
    saving: { text: 'Saving…', cls: 'text-muted' },
    saved: { text: 'Saved', cls: 'text-signal' },
    conflict: { text: 'Newer version loaded', cls: 'text-danger' },
    error: { text: 'Save failed', cls: 'text-danger' },
  };
  const st = statusLabel[saveStatus] ?? statusLabel.idle;

  // Download the captions as an SRT file (Phase 5). Fetches the route and saves the blob as
  // <title>.srt. 404 means no voice captions yet.
  async function downloadSrt() {
    const res = await fetch(`/api/projects/${project.id}/srt`);
    if (!res.ok) {
      toast.error(res.status === 404 ? 'No voice captions to export yet.' : 'SRT export failed.');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(project.title ?? 'short').replace(/[^\w-]+/g, '_')}.srt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success('SRT downloaded.');
  }

  return (
    <>
      <header className="flex h-14 items-center gap-3 border-b border-line bg-paper px-4">
        <Link
          href="/dashboard"
          className="rounded-lg px-2 py-1 text-sm text-muted hover:bg-cream hover:text-ink"
        >
          ← Dashboard
        </Link>

        <input
          value={value}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Project title"
          className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm font-semibold outline-none transition-colors focus:border-line focus:bg-cream"
          aria-label="Project title"
        />

        {captionsDirty && (
          <span
            className="rounded-full bg-warn/15 px-3 py-1 text-xs font-medium text-warn"
            title="Caption edits are preview-only. Re-generate voice in Generate to bake them into audio."
          >
            Captions preview-only
          </span>
        )}

        {adIssues.length > 0 && (
          <span
            className="rounded-full bg-warn/15 px-3 py-1 text-xs font-medium text-warn"
            title={adIssues.map((i) => i.message).join('\n')}
          >
            Ad checklist: {adIssues.length} {adIssues.length === 1 ? 'item' : 'items'}
          </span>
        )}

        <span className={`text-xs ${st.cls}`} role="status">
          {st.text}
        </span>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => undo()} title="Undo (Ctrl+Z)">
            Undo
          </Button>
          <Button variant="ghost" size="sm" onClick={() => redo()} title="Redo (Ctrl+Shift+Z)">
            Redo
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void downloadSrt()}
            title="Download captions as SRT"
          >
            SRT
          </Button>
          <Button variant="signal" size="sm" onClick={() => setRenderOpen(true)}>
            Render
          </Button>
        </div>
      </header>

      <RenderDialog project={project} open={renderOpen} onOpenChange={setRenderOpen} />
    </>
  );
}
