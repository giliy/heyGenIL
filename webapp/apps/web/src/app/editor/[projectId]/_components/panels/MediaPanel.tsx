'use client';
// Left panel — Media. Upload assets via react-dropzone (to local disk + assets row), list them,
// and Add (insert a default overlay) or Replace (swap only src/assetId of the selected image
// overlay — keeps id/geometry/animation/timing). Delete requires no overlay to reference it.
import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { useEditorStore } from '../../_store/editorStore';
import { useBilling } from '@/lib/billing';
import { defaultImageOverlay } from '@shorts/spec';

interface AssetRow {
  id: string;
  kind: 'image' | 'video' | 'audio';
  url: string | null;
  storageKey: string;
  w: number | null;
  h: number | null;
  durationSec: number | null;
  createdAt: string;
}

const AI_IMAGE_COST = 3; // matches packages/spec quote.ts CREDIT_TABLE.aiImage

export function MediaPanel({ projectId }: { projectId: string }) {
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const billing = useBilling();

  const [aiPrompt, setAiPrompt] = useState('');
  const [aiModel, setAiModel] = useState<'fast' | 'pro' | 'lite'>('fast');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMsg, setAiMsg] = useState<string | null>(null);

  const selectedSceneId = useEditorStore((s) => s.selectedSceneId);
  const selectedOverlayId = useEditorStore((s) => s.selectedOverlayId);
  const addOverlay = useEditorStore((s) => s.addOverlay);
  const replaceOverlayAsset = useEditorStore((s) => s.replaceOverlayAsset);

  // Does the selected overlay reference this asset (for Replace)?
  const selectedOverlay = useEditorStore((s) => {
    const scene = s.spec.scenes.find((sc) => sc.id === s.selectedSceneId);
    return scene?.overlays.find((o) => o.id === s.selectedOverlayId);
  });

  useEffect(() => {
    void fetch(`/api/projects/${projectId}/assets`)
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (body?.assets) setAssets(body.assets);
      })
      .catch(() => setError('failed to load assets'))
      .finally(() => setLoading(false));
  }, [projectId]);

  const onDrop = useCallback(
    async (files: File[]) => {
      if (!files.length || !selectedSceneId) {
        if (!selectedSceneId) setError('Select a scene first to add media.');
        return;
      }
      setUploading(true);
      setError(null);
      try {
        for (const file of files) {
          const fd = new FormData();
          fd.append('file', file);
          const res = await fetch(`/api/projects/${projectId}/assets`, {
            method: 'POST',
            body: fd,
          });
          if (!res.ok) {
            const body = await res.json().catch(() => null);
            throw new Error(body?.error ?? `upload failed: ${res.status}`);
          }
          const { asset } = await res.json();
          // Only images become image overlays for now (video overlays are Phase 5).
          if (asset.kind === 'image') {
            const scene = useEditorStore
              .getState()
              .spec.scenes.find((sc) => sc.id === selectedSceneId);
            const dur = scene?.durationSec ?? 3;
            if (asset.url) {
              addOverlay(selectedSceneId, defaultImageOverlay(dur, asset.url, asset.id, asset.w, asset.h));
            }
          }
          setAssets((prev) => [asset, ...prev]);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'upload failed');
      } finally {
        setUploading(false);
      }
    },
    [projectId, selectedSceneId, addOverlay]
  );

  // react-dropzone v20's DropzoneOptions picks React.HTMLProps drag handlers, which React 19
  // marks required — cast the options object so the type check passes without changing runtime.
  const dropzoneOptions = {
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif'],
      'video/*': ['.mp4', '.mov', '.webm'],
    },
    multiple: true,
  } as unknown as Parameters<typeof useDropzone>[0];
  const { getRootProps, getInputProps, isDragActive } = useDropzone(dropzoneOptions);

  async function onDelete(asset: AssetRow) {
    const res = await fetch(`/api/projects/${projectId}/assets/${asset.id}`, { method: 'DELETE' });
    if (res.status === 409) {
      setError('This asset is still used by an overlay — remove the overlay first.');
      return;
    }
    if (res.ok) setAssets((prev) => prev.filter((a) => a.id !== asset.id));
    else setError('failed to delete asset');
  }

  const canReplace =
    selectedOverlay?.type === 'image' && assets.some((a) => a.id !== selectedOverlay.assetId);

  async function refreshAssets() {
    try {
      const r = await fetch(`/api/projects/${projectId}/assets`);
      const body = await r.json().catch(() => null);
      if (body?.assets) setAssets(body.assets);
    } catch {
      /* keep existing list */
    }
  }

  // Phase 4 — paid-only AI image generation. Reserves 3 credits server-side; the worker runs
  // gen_image.py, inserts the overlay, persists the spec (revision++), and deducts on success /
  // refunds on failure. We poll until the new asset appears.
  async function generateImage() {
    setAiMsg(null);
    setError(null);
    if (!selectedSceneId) {
      setError('Select a scene first.');
      return;
    }
    if (!aiPrompt.trim()) {
      setAiMsg('Describe the image first.');
      return;
    }
    setAiBusy(true);
    const sceneId = selectedSceneId;
    const before = new Set(assets.map((a) => a.id));
    try {
      const res = await fetch(`/api/projects/${projectId}/ai-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt, model: aiModel, sceneId }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        if (res.status === 403) {
          setAiMsg('AI images are a paid feature. Upgrade to Creator to generate.');
        } else if (res.status === 402) {
          setAiMsg(
            `Not enough credits (need ${body?.needed ?? AI_IMAGE_COST}, have ${body?.balance ?? '?'}).`,
          );
        } else {
          setAiMsg(body?.error ?? `generate failed: ${res.status}`);
        }
        return;
      }
      const jobId: string = body.jobId;
      const cost: number = body.costCredits ?? AI_IMAGE_COST;
      setAiMsg(`Generating… (${cost} ⚡ reserved)`);
      // Poll the job until done/failed, then refresh the asset list + billing.
      const start = Date.now();
      const timer = setInterval(async () => {
        try {
          const jr = await fetch(`/api/jobs/${jobId}`);
          const job = jr.ok ? await jr.json() : null;
          if (job?.status === 'done') {
            clearInterval(timer);
            setAiBusy(false);
            setAiMsg(`Done — ${cost} ⚡ charged.`);
            setAiPrompt('');
            await refreshAssets();
            void billing.refetch();
            // Auto-insert the freshest ai- image into the scene.
            const list = await (await fetch(`/api/projects/${projectId}/assets`)).json();
            const fresh = (list?.assets ?? []).find(
              (a: AssetRow) => !before.has(a.id) && a.kind === 'image',
            );
            if (fresh?.url && sceneId) {
              const scene = useEditorStore
                .getState()
                .spec.scenes.find((sc) => sc.id === sceneId);
              const dur = scene?.durationSec ?? 3;
              addOverlay(sceneId, defaultImageOverlay(dur, fresh.url, fresh.id, fresh.w, fresh.h));
            }
          } else if (job?.status === 'error' || job?.status === 'failed') {
            clearInterval(timer);
            setAiBusy(false);
            setAiMsg(`Generation failed — credits refunded. ${job?.error ?? ''}`);
            void billing.refetch();
          } else if (Date.now() - start > 120000) {
            clearInterval(timer);
            setAiBusy(false);
            setAiMsg('Still generating — refresh in a moment.');
            void refreshAssets();
            void billing.refetch();
          }
        } catch {
          /* keep polling */
        }
      }, 1500);
    } catch (e) {
      setAiBusy(false);
      setAiMsg(e instanceof Error ? e.message : 'generate failed');
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Media</h2>
        <span className="text-xs text-muted">{assets.length} files</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {!selectedSceneId && (
          <p className="mb-2 rounded-lg bg-warn/10 p-2 text-xs text-warn">
            Select a scene to add or replace media.
          </p>
        )}

        {/* Generate image (paid) */}
        <div className="mb-3 rounded-lg border border-line bg-paper p-2.5">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-semibold text-ink">Generate image</span>
            <span className="font-mono text-[11px] text-muted">{AI_IMAGE_COST} ⚡</span>
          </div>
          {!billing.canAiImages ? (
            <div className="rounded-lg bg-cream/60 p-2">
              <p className="text-[11px] text-muted">
                AI images are a paid feature. Generate a fresh 9:16 visual with Gemini and drop it
                into the scene.
              </p>
              <Button variant="signal" size="sm" className="mt-2 w-full" asChild>
                <Link href="/billing">Upgrade to Creator</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="A neon cyberpunk cityscape at dusk, cinematic…"
                rows={2}
                disabled={aiBusy}
                className="w-full resize-none rounded-lg border border-line bg-paper px-2 py-1.5 text-xs text-ink outline-none focus:border-accent"
              />
              <div className="flex items-center gap-2">
                <select
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value as 'fast' | 'pro' | 'lite')}
                  disabled={aiBusy}
                  className="h-8 flex-1 rounded-lg border border-line bg-paper px-2 text-xs text-ink outline-none focus:border-accent"
                >
                  <option value="fast">fast</option>
                  <option value="lite">lite</option>
                  <option value="pro">pro</option>
                </select>
                <Button
                  variant="signal"
                  size="sm"
                  onClick={() => void generateImage()}
                  disabled={aiBusy || !aiPrompt.trim() || !selectedSceneId}
                >
                  {aiBusy ? 'Generating…' : 'Generate'}
                </Button>
              </div>
              {aiMsg && (
                <p className="rounded-lg bg-accent/10 p-2 text-[11px] text-accent">{aiMsg}</p>
              )}
            </div>
          )}
        </div>

        {/* Dropzone */}
        <div
          {...getRootProps()}
          className={`mb-3 flex h-24 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed text-center transition-colors ${
            isDragActive
              ? 'border-signal bg-signal/10'
              : 'border-line bg-cream/50 hover:border-signal/60'
          }`}
        >
          <input {...(getInputProps() as React.InputHTMLAttributes<HTMLInputElement>)} />
          <p className="text-xs text-muted">
            {uploading ? 'Uploading…' : isDragActive ? 'Drop to upload' : 'Drop images here, or click to browse'}
          </p>
          <p className="mt-1 text-[11px] text-muted/70">PNG · JPG · WEBP · GIF · MP4</p>
        </div>

        {error && (
          <p className="mb-2 rounded-lg bg-danger/10 p-2 text-xs text-danger">{error}</p>
        )}

        {loading ? (
          <p className="text-xs text-muted">Loading…</p>
        ) : (
          <ul className="space-y-2">
            {assets.map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-2 rounded-lg border border-line bg-paper p-2"
              >
                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded bg-cream">
                  {a.kind === 'image' && a.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs text-muted">{a.kind}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-ink">{a.storageKey.split('/').pop()}</p>
                  <p className="text-[11px] text-muted">
                    {a.kind}
                    {a.w && a.h ? ` · ${a.w}×${a.h}` : ''}
                  </p>
                </div>
                <div className="flex flex-col gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (!selectedSceneId) return setError('Select a scene first.');
                      const scene = useEditorStore
                        .getState()
                        .spec.scenes.find((sc) => sc.id === selectedSceneId);
                      const dur = scene?.durationSec ?? 3;
                      if (a.url) {
                        addOverlay(
                          selectedSceneId,
                          defaultImageOverlay(dur, a.url, a.id, a.w, a.h)
                        );
                      }
                    }}
                  >
                    Add
                  </Button>
                  {a.kind === 'image' && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!canReplace}
                      onClick={() => {
                        if (selectedSceneId && selectedOverlayId && selectedOverlay?.type === 'image') {
                          replaceOverlayAsset(selectedSceneId, selectedOverlayId, a.id, a.url ?? '');
                        }
                      }}
                      title={
                        canReplace
                          ? 'Replace the selected overlay — keeps position/size/animation/timing'
                          : 'Select an image overlay to replace'
                      }
                    >
                      Replace
                    </Button>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void onDelete(a)}
                  className="text-danger"
                  title="Delete asset"
                >
                  ✕
                </Button>
              </li>
            ))}
            {assets.length === 0 && !loading && (
              <p className="text-center text-xs text-muted">No assets yet.</p>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
