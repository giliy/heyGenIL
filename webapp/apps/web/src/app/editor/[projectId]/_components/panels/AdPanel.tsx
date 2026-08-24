'use client';
// Left panel — Ad toolkit (Phase 3). Only mounted for ad-track projects (spec.mode==='ad').
// Edits the spec.ad{} block via the store (persisted through autosave → PATCH /api/projects/[id]):
//   business · ctaText · price/oldPrice/currency · endCardHoldSec · logoAssetId · phone · website.
// The logo picker reuses the MediaPanel upload path (POST /api/projects/[id]/assets) so a
// Hebrew SMB can drop their logo and render it on the CTA end card (AdEndCard → <Logo>).
// Inline CTA-hold feedback mirrors the worker's validate_ad_beats rule: the CTA line must be
// the FINAL spoken line and the end card must HOLD long enough to be readable.
import React, { useCallback, useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { useEditorStore } from '../../_store/editorStore';
import { validateAdSpec } from '@shorts/spec';
import { Upload } from 'lucide-react';

interface AssetRow {
  id: string;
  kind: 'image' | 'video' | 'audio';
  url: string | null;
  storageKey: string;
}

export function AdPanel({ projectId }: { projectId: string }) {
  const ad = useEditorStore((s) => s.spec.ad);
  const updateAd = useEditorStore((s) => s.updateAd);

  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAssets = useCallback(() => {
    void fetch(`/api/projects/${projectId}/assets`)
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => {
        if (b?.assets) setAssets(b.assets.filter((a: AssetRow) => a.kind === 'image'));
      })
      .catch(() => setError('failed to load assets'));
  }, [projectId]);

  useEffect(() => { loadAssets(); }, [loadAssets]);

  const onDrop = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      setUploading(true);
      setError(null);
      try {
        for (const file of files) {
          const fd = new FormData();
          fd.append('file', file);
          const res = await fetch(`/api/projects/${projectId}/assets`, { method: 'POST', body: fd });
          if (!res.ok) {
            const b = await res.json().catch(() => null);
            throw new Error(b?.error ?? `upload failed: ${res.status}`);
          }
          const { asset } = await res.json();
          if (asset.kind === 'image' && asset.url) {
            updateAd({ logoAssetId: asset.id });
          }
          loadAssets();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'upload failed');
      } finally {
        setUploading(false);
      }
    },
    [projectId, updateAd, loadAssets]
  );

  const dropzoneOptions = {
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif'] },
    multiple: false,
  } as unknown as Parameters<typeof useDropzone>[0];
  const { getRootProps, getInputProps, isDragActive } = useDropzone(dropzoneOptions);

  // The CTA end-card hold rule (mirrors validate_ad_beats): the end card must hold
  // long enough to read — flag < 2s. (Full beat-level validation runs in QA/worker.)
  const holdSec = ad?.endCardHoldSec;
  const issues = validateAdSpec({ mode: 'ad', ad: ad ?? {}, scenes: [] });
  const holdWarning = issues.some((i) => i.key === 'hold');
  const complete = issues.length === 0;

  const field = 'w-full rounded-lg border border-line bg-paper px-2 py-1.5 text-xs text-ink outline-none focus:border-accent';

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Ad · CTA end card</h2>
        <span className="text-xs text-muted">RTL · Heebo</span>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        {error && <p className="rounded-lg bg-danger/10 p-2 text-xs text-danger">{error}</p>}

        {/* Inline ad-beats validation (mirrors validate_ad_beats) */}
        {complete ? (
          <p className="rounded-lg bg-signal/10 p-2 text-[11px] text-signal">
            ✓ CTA end card complete — business, CTA, hold ≥ 2s all set.
          </p>
        ) : (
          <div className="rounded-lg border border-warn/30 bg-warn/10 p-2">
            <p className="mb-1 text-[11px] font-semibold text-warn">Ad checklist</p>
            <ul className="list-disc space-y-0.5 pl-4 text-[11px] text-warn">
              {issues.map((i) => <li key={i.key}>{i.message}</li>)}
            </ul>
          </div>
        )}

        {/* Business */}
        <div>
          <label className="mb-1 block text-xs font-medium text-ink">Business name</label>
          <input
            dir="rtl"
            value={ad?.business ?? ''}
            onChange={(e) => updateAd({ business: e.target.value })}
            placeholder="למשל: ליאת קוסמטיקה"
            className={field}
          />
        </div>

        {/* CTA text */}
        <div>
          <label className="mb-1 block text-xs font-medium text-ink">Call to action</label>
          <input
            dir="rtl"
            value={ad?.ctaText ?? ''}
            onChange={(e) => updateAd({ ctaText: e.target.value })}
            placeholder="להזמנת תור בוואטסאפ"
            className={field}
          />
          <p className="mt-1 text-[11px] text-muted">
            The CTA line should be the final spoken line, and the end card must hold after it.
          </p>
        </div>

        {/* Price badge */}
        <div>
          <label className="mb-1 block text-xs font-medium text-ink">Price badge</label>
          <div className="grid grid-cols-3 gap-2">
            <input
              type="number"
              value={ad?.price ?? ''}
              onChange={(e) => updateAd({ price: e.target.value === '' ? undefined : Number(e.target.value) })}
              placeholder="199"
              className={field}
            />
            <input
              type="number"
              value={ad?.oldPrice ?? ''}
              onChange={(e) => updateAd({ oldPrice: e.target.value === '' ? undefined : Number(e.target.value) })}
              placeholder="290 (was)"
              className={field}
            />
            <input
              value={ad?.currency ?? '₪'}
              onChange={(e) => updateAd({ currency: e.target.value })}
              placeholder="₪"
              className={field}
            />
          </div>
        </div>

        {/* Contact */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink">Phone</label>
            <input
              dir="rtl"
              value={ad?.phone ?? ''}
              onChange={(e) => updateAd({ phone: e.target.value })}
              placeholder="050-0000000"
              className={field}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink">Website</label>
            <input
              value={ad?.website ?? ''}
              onChange={(e) => updateAd({ website: e.target.value })}
              placeholder="example.co.il"
              className={field}
            />
          </div>
        </div>

        {/* End-card hold */}
        <div>
          <label className="mb-1 block text-xs font-medium text-ink">
            End-card hold (seconds) <span className="text-muted">— how long the CTA end card holds</span>
          </label>
          <input
            type="number"
            step="0.1"
            min="0"
            value={holdSec ?? ''}
            onChange={(e) =>
              updateAd({ endCardHoldSec: e.target.value === '' ? undefined : Number(e.target.value) })
            }
            placeholder="~20"
            className={field}
          />
          {holdWarning && (
            <p className="mt-1 rounded-lg bg-warn/10 p-2 text-[11px] text-warn">
              End card holds {holdSec ?? 0}s — needs ≥ 2s so the call-to-action is tappable (validate_ad_beats).
            </p>
          )}
        </div>

        {/* Logo */}
        <div>
          <label className="mb-1 block text-xs font-medium text-ink">Logo (CTA end card)</label>
          <div
            {...getRootProps()}
            className={`flex h-20 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed text-center transition-colors ${
              isDragActive ? 'border-signal bg-signal/10' : 'border-line bg-cream/50 hover:border-signal/60'
            }`}
          >
            <input {...(getInputProps() as React.InputHTMLAttributes<HTMLInputElement>)} />
            <Upload size={16} className="mb-1 text-muted" />
            <p className="text-[11px] text-muted">
              {uploading ? 'Uploading…' : isDragActive ? 'Drop to upload logo' : 'Drop logo here, or click to browse'}
            </p>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {assets.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => updateAd({ logoAssetId: a.id })}
                title={a.storageKey.split('/').pop()}
                className={`h-12 w-12 overflow-hidden rounded-lg border object-cover transition ${
                  ad?.logoAssetId === a.id
                    ? 'border-signal ring-2 ring-signal/30'
                    : 'border-line hover:border-signal/60'
                }`}
              >
                {a.url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.url} alt="" className="h-full w-full object-contain" />
                )}
              </button>
            ))}
            {assets.length === 0 && (
              <p className="text-[11px] text-muted">No logo yet — upload one above.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
