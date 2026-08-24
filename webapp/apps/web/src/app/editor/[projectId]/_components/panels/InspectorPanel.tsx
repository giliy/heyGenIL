'use client';
// Right panel — the inspector. Three tabs:
//   Style     — text content, font, size, color, weight, align; image alt/opacity
//   Timing    — scene-relative start/end (Fliki-style range slider) + geometry + rotation
//   Animation — rise / fade / pop / none
import React, { useEffect, useState } from 'react';
import { HexColorPicker } from 'react-colorful';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useEditorStore, selectSelectedOverlay, selectSelectedScene } from '../../_store/editorStore';
import { cn } from '@/lib/utils';
import type { Overlay, OverlayText } from '@shorts/spec';

const FONTS = ['hebrew', 'latin', 'display'] as const;
const ANIMATIONS = ['rise', 'fade', 'pop', 'none'] as const;

export function InspectorPanel() {
  const inspectorTab = useEditorStore((s) => s.inspectorTab);
  const setInspectorTab = useEditorStore((s) => s.setInspectorTab);
  const overlay = useEditorStore(selectSelectedOverlay);
  const scene = useEditorStore(selectSelectedScene);
  const updateOverlay = useEditorStore((s) => s.updateOverlay);
  const removeOverlay = useEditorStore((s) => s.removeOverlay);

  if (!scene) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-center text-xs text-muted">Select a scene to edit its overlays.</p>
      </div>
    );
  }

  if (!overlay) {
    return (
      <div className="flex h-full flex-col">
        <TabsHeader tab={inspectorTab} onTab={setInspectorTab} />
        <div className="flex flex-1 items-center justify-center p-4">
          <p className="text-center text-xs text-muted">
            Click an overlay on the canvas to select it.
            <br />
            Or add text/media from the left panel.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <TabsHeader tab={inspectorTab} onTab={setInspectorTab} />

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {inspectorTab === 'style' && (
          <StylePanel
            overlay={overlay}
            onChange={(patch) => updateOverlay(scene.id, overlay.id, patch)}
            onRemove={() => removeOverlay(scene.id, overlay.id)}
          />
        )}
        {inspectorTab === 'timing' && (
          <TimingPanel
            overlay={overlay}
            sceneDuration={scene.durationSec}
            onChange={(patch) => updateOverlay(scene.id, overlay.id, patch)}
          />
        )}
        {inspectorTab === 'animation' && (
          <AnimationPanel
            overlay={overlay}
            onChange={(patch) => updateOverlay(scene.id, overlay.id, patch)}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function TabsHeader({
  tab,
  onTab,
}: {
  tab: 'style' | 'timing' | 'animation';
  onTab: (tab: 'style' | 'timing' | 'animation') => void;
}) {
  return (
    <div className="flex border-b border-line">
      {(['style', 'timing', 'animation'] as const).map((t) => (
        <button
          key={t}
          onClick={() => onTab(t)}
          className={cn(
            'flex-1 border-b-2 px-2 py-2 text-xs font-medium capitalize transition-colors',
            tab === t
              ? 'border-signal text-ink'
              : 'border-transparent text-muted hover:text-ink'
          )}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Style tab
// ---------------------------------------------------------------------------

function StylePanel({
  overlay,
  onChange,
  onRemove,
}: {
  overlay: Overlay;
  onChange: (patch: Partial<Overlay>) => void;
  onRemove: () => void;
}) {
  const [colorOpen, setColorOpen] = useState(false);

  if (overlay.type === 'text') {
    const t = overlay as OverlayText;
    return (
      <div className="space-y-4">
        <Field label="Text">
          <textarea
            value={t.content}
            rows={3}
            onChange={(e) => onChange({ content: e.target.value })}
            className="w-full resize-none rounded-lg border border-line bg-paper p-2 text-sm text-ink"
          />
        </Field>

        <Field label="Font">
          <div className="flex gap-1">
            {FONTS.map((f) => (
              <button
                key={f}
                onClick={() => onChange({ style: { ...t.style, font: f } })}
                className={cn(
                  'rounded-md px-2 py-1 text-xs font-medium capitalize',
                  (t.style?.font ?? 'hebrew') === f
                    ? 'bg-signal text-white'
                    : 'bg-cream text-ink hover:bg-cream/70'
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </Field>

        <Field label={`Size ${t.style?.size ?? 72}px`}>
          <Slider
            value={[t.style?.size ?? 72]}
            min={24}
            max={180}
            step={1}
            onValueChange={([v]: number[]) => onChange({ style: { ...t.style, size: v } })}
          />
        </Field>

        <Field label={`Weight ${t.style?.weight ?? 700}`}>
          <Slider
            value={[t.style?.weight ?? 700]}
            min={100}
            max={900}
            step={100}
            onValueChange={([v]: number[]) => onChange({ style: { ...t.style, weight: v } })}
          />
        </Field>

        <Field label="Color">
          <button
            onClick={() => setColorOpen(!colorOpen)}
            className="flex items-center gap-2 rounded-lg border border-line bg-paper px-2 py-1"
          >
            <span
              className="h-5 w-5 rounded border border-line"
              style={{ background: t.style?.color ?? '#ffffff' }}
            />
            <span className="text-xs text-ink">{t.style?.color ?? '#ffffff'}</span>
          </button>
          {colorOpen && (
            <div className="mt-2">
              <HexColorPicker
                color={t.style?.color ?? '#ffffff'}
                onChange={(c) => onChange({ style: { ...t.style, color: c } })}
              />
            </div>
          )}
        </Field>

        <Field label="Align">
          <div className="flex gap-1">
            {['left', 'center', 'right'].map((a) => (
              <button
                key={a}
                onClick={() => onChange({ style: { ...t.style, align: a } })}
                className={cn(
                  'rounded-md px-2 py-1 text-xs font-medium capitalize',
                  (t.style?.align ?? 'center') === a
                    ? 'bg-signal text-white'
                    : 'bg-cream text-ink hover:bg-cream/70'
                )}
              >
                {a}
              </button>
            ))}
          </div>
        </Field>

        <Button variant="danger" size="sm" onClick={onRemove}>
          Delete overlay
        </Button>
      </div>
    );
  }

  // Image overlay style
  return (
    <div className="space-y-4">
      <Field label="Image">
        <div className="overflow-hidden rounded-lg border border-line bg-cream">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={overlay.src} alt="" className="h-24 w-full object-contain" />
        </div>
      </Field>

      <Field label={`Opacity ${Math.round((overlay.opacity ?? 1) * 100)}%`}>
        <Slider
          value={[(overlay.opacity ?? 1) * 100]}
          min={0}
          max={100}
          step={1}
          onValueChange={([v]: number[]) => onChange({ opacity: v / 100 })}
        />
      </Field>

      <Button variant="danger" size="sm" onClick={onRemove}>
        Delete overlay
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Timing tab — scene-relative start/end (Fliki-style range slider) + geometry
// ---------------------------------------------------------------------------

function TimingPanel({
  overlay,
  sceneDuration,
  onChange,
}: {
  overlay: Overlay;
  sceneDuration: number;
  onChange: (patch: Partial<Overlay>) => void;
}) {
  // Local slider state so drag feels smooth; commit on pointer-up.
  const [range, setRange] = useState<[number, number]>([overlay.start, overlay.end]);

  useEffect(() => {
    setRange([overlay.start, overlay.end]);
  }, [overlay.id, overlay.start, overlay.end]);

  const commit = (s: number, e: number) => {
    const start = Math.max(0, Math.min(s, sceneDuration));
    const end = Math.max(start + 0.1, Math.min(e, sceneDuration));
    onChange({ start, end });
  };

  return (
    <div className="space-y-4">
      <Field label={`In ${range[0].toFixed(2)}s · Out ${range[1].toFixed(2)}s`}>
        <Slider
          value={range}
          min={0}
          max={sceneDuration}
          step={0.05}
          minStepsBetweenThumbs={0.1}
          onValueChange={([s, e]: number[]) => setRange([s, e])}
          onValueCommit={([s, e]: number[]) => commit(s, e)}
        />
        <div className="mt-1 flex justify-between text-[11px] text-muted">
          <span>0s</span>
          <span>{sceneDuration.toFixed(1)}s (scene)</span>
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="X">
          <NumberInput value={overlay.x} onChange={(v) => onChange({ x: v })} />
        </Field>
        <Field label="Y">
          <NumberInput value={overlay.y} onChange={(v) => onChange({ y: v })} />
        </Field>
        <Field label="W">
          <NumberInput value={overlay.w} min={1} onChange={(v) => onChange({ w: Math.max(1, v) })} />
        </Field>
        <Field label="H">
          <NumberInput value={overlay.h} min={1} onChange={(v) => onChange({ h: Math.max(1, v) })} />
        </Field>
      </div>

      <Field label={`Rotation ${(overlay.rotation ?? 0).toFixed(1)}°`}>
        <Slider
          value={[overlay.rotation ?? 0]}
          min={-180}
          max={180}
          step={0.5}
          onValueChange={([v]: number[]) => onChange({ rotation: v })}
        />
      </Field>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Animation tab
// ---------------------------------------------------------------------------

function AnimationPanel({
  overlay,
  onChange,
}: {
  overlay: Overlay;
  onChange: (patch: Partial<Overlay>) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        How the overlay enters its window. Preview it live on the canvas.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {ANIMATIONS.map((a) => (
          <button
            key={a}
            onClick={() => onChange({ animation: a })}
            className={cn(
              'rounded-lg border px-3 py-2 text-xs font-medium capitalize transition-colors',
              (overlay.animation ?? 'none') === a
                ? 'border-signal bg-signal/10 text-ink'
                : 'border-line bg-paper text-muted hover:bg-cream'
            )}
          >
            {a}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">{label}</p>
      {children}
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  min,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
}) {
  return (
    <input
      type="number"
      value={Math.round(value * 100) / 100}
      min={min}
      onChange={(e) => {
        const v = parseFloat(e.target.value);
        if (!Number.isNaN(v)) onChange(v);
      }}
      className="h-8 w-full rounded-lg border border-line bg-paper px-2 text-sm text-ink"
    />
  );
}
