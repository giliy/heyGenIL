'use client';
// Captions panel — the voice.lines document edited inline (display-only; each edit sets
// captionsDirty so the divergence is always surfaced). Supports:
//   - inline text editing
//   - Enter-to-split at the caret (word-boundary aware)
//   - merge adjacent lines (Ctrl+Enter or the merge button)
//   - nudge the line window earlier/later
//   - presets (pop / pill / fade) — RTL is honored as FULL LINES (never token pops)
// A persistent banner (TopBar) reflects the preview-only state; Generate (Phase 3) re-bakes.
import React, { useRef } from 'react';
import { useEditorStore } from '../../_store/editorStore';
import { formatDuration } from '@/lib/utils';

const PRESETS = ['pop', 'pill', 'fade'] as const;

export function CaptionsPanel() {
  const lines = useEditorStore((s) => s.spec.voice?.lines ?? []);
  const preset = useEditorStore((s) => s.spec.captions?.preset ?? 'pill');
  const setCaptionLine = useEditorStore((s) => s.setCaptionLine);
  const splitCaption = useEditorStore((s) => s.splitCaption);
  const mergeCaptions = useEditorStore((s) => s.mergeCaptions);
  const nudgeCaption = useEditorStore((s) => s.nudgeCaption);
  const setCaptionPreset = useEditorStore((s) => s.setCaptionPreset);
  const refs = useRef<(HTMLTextAreaElement | null)[]>([]);

  if (lines.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <PanelHeader />
        <div className="flex flex-1 items-center justify-center p-4">
          <p className="text-center text-xs text-muted">
            This project has no voice lines yet.
            <br />
            Captions appear after voice generation.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <PanelHeader />

      {/* Presets */}
      <div className="flex items-center gap-1 border-b border-line px-3 py-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted">Preset</span>
        {PRESETS.map((p) => (
          <button
            key={p}
            onClick={() => setCaptionPreset(p)}
            className={`rounded-md px-2 py-0.5 text-xs font-medium transition-colors ${
              preset === p ? 'bg-signal text-white' : 'bg-cream text-ink hover:bg-cream/70'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <ul className="space-y-2">
          {lines.map((line, i) => (
            <li key={i} className="rounded-lg border border-line bg-paper p-2">
              <textarea
                ref={(el) => {
                  refs.current[i] = el;
                }}
                value={line.text}
                rows={2}
                onChange={(e) => setCaptionLine(i, e.target.value)}
                onKeyDown={(e) => {
                  // Enter without Shift -> split at caret; Ctrl+Enter -> merge with next.
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    const el = refs.current[i];
                    const caret = el?.selectionStart ?? line.text.length;
                    splitCaption(i, caret);
                  } else if (e.key === 'Enter' && e.shiftKey) {
                    // Shift+Enter = literal newline is prevented by split logic; treat as merge.
                    e.preventDefault();
                    mergeCaptions(i);
                  }
                }}
                className="w-full resize-none rounded-md border border-transparent bg-transparent p-1 text-sm leading-snug text-ink outline-none transition-colors focus:border-line focus:bg-cream"
                aria-label={`Caption line ${i + 1}`}
              />
              <div className="mt-1 flex items-center gap-1">
                <span className="text-[11px] text-muted">
                  {formatDuration(line.start)} – {formatDuration(line.end)}
                </span>
                <button
                  onClick={() => nudgeCaption(i, -0.25)}
                  className="rounded px-1.5 py-0.5 text-xs text-muted hover:bg-cream"
                  title="Nudge earlier"
                >
                  ←
                </button>
                <button
                  onClick={() => nudgeCaption(i, 0.25)}
                  className="rounded px-1.5 py-0.5 text-xs text-muted hover:bg-cream"
                  title="Nudge later"
                >
                  →
                </button>
                <button
                  onClick={() => splitCaption(i, line.text.length)}
                  className="ml-auto rounded px-1.5 py-0.5 text-xs text-muted hover:bg-cream"
                  title="Split line"
                >
                  Split
                </button>
                <button
                  onClick={() => mergeCaptions(i)}
                  disabled={i >= lines.length - 1}
                  className="rounded px-1.5 py-0.5 text-xs text-muted hover:bg-cream disabled:opacity-30"
                  title="Merge with next"
                >
                  Merge
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function PanelHeader() {
  return (
    <div className="flex items-center justify-between border-b border-line px-3 py-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Captions</h2>
      <span className="rounded-full bg-warn/15 px-2 py-0.5 text-[10px] font-medium text-warn">
        preview-only
      </span>
    </div>
  );
}
