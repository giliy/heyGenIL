'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  UserCircle2, Plus, Trash2, Loader2, RefreshCw, Lock, AlertTriangle, X,
} from 'lucide-react';

interface Character {
  id: string;
  name: string;
  status: 'minting' | 'ready' | 'failed';
  sourceImageKey: string | null;
  refImageKey: string | null;
  refImageUrl: string | null;
  specJson: { video_model?: string; locked?: boolean } | null;
  createdAt: string;
}

const VIDEO_MODELS = [
  { id: 'seedance', label: 'Seedance (default)' },
  { id: 'veo', label: 'Veo' },
  { id: 'kling', label: 'Kling' },
];

export default function CharactersPage() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [videoModel, setVideoModel] = useState('seedance');
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/characters');
      const data = await res.json();
      setCharacters(data.characters ?? []);
    } catch {
      toast.error('Failed to load characters');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Poll while any character is minting (the lock image is being generated).
  useEffect(() => {
    if (!characters.some((c) => c.status === 'minting')) return;
    const t = setInterval(() => void load(), 3000);
    return () => clearInterval(t);
  }, [characters, load]);

  function pickFile(f: File | null) {
    setFile(f);
    if (filePreview) URL.revokeObjectURL(filePreview);
    setFilePreview(f ? URL.createObjectURL(f) : null);
  }

  async function create() {
    if (!name.trim()) { toast.error('Name the character first'); return; }
    if (!file) { toast.error('Upload a reference portrait'); return; }
    setBusy(true);
    try {
      const form = new FormData();
      form.append('name', name.trim());
      form.append('videoModel', videoModel);
      form.append('file', file);
      const res = await fetch('/api/characters', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'create failed');
        return;
      }
      toast.success(`Minting "${name}"… locking the reference (${data.costCredits}⚡ on success).`);
      setName(''); setFile(null); setFilePreview(null); setShowForm(false);
      if (fileRef.current) fileRef.current.value = '';
      await load();
    } catch {
      toast.error('create failed');
    } finally {
      setBusy(false);
    }
  }

  async function remove(c: Character) {
    setBusy(true);
    try {
      const res = await fetch(`/api/characters/${c.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.status === 409) {
        toast.error(`"${c.name}" is in use by ${data.projects?.length ?? 1} project(s). Remove it there first.`);
        return;
      }
      if (!res.ok) { toast.error(data.error ?? 'delete failed'); return; }
      toast.success(`Deleted "${c.name}".`);
      await load();
    } catch {
      toast.error('delete failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Characters</h1>
          <p className="text-sm text-muted">
            Locked recurring characters. Every AI scene image is conditioned on the locked reference,
            so the face stays consistent across the whole video.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className="flex items-center gap-2 rounded-panel bg-accent px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-accent/90"
        >
          <Plus size={15} /> New character
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="rounded-card border border-line bg-paper p-6 shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-ink">New character</h2>
            <button type="button" onClick={() => setShowForm(false)} className="text-muted hover:text-ink">
              <X size={18} />
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. The blue man"
                className="w-full rounded-panel border border-line bg-cream px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">Video model</label>
              <select
                value={videoModel}
                onChange={(e) => setVideoModel(e.target.value)}
                className="w-full rounded-panel border border-line bg-cream px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              >
                {VIDEO_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">Reference portrait</label>
            <p className="mb-2 text-xs text-muted">
              One clear portrait. We lock it into a canonical reference — that single lock is what every
              scene image is conditioned on, and it's never re-derived from text.
            </p>
            <div className="flex items-center gap-4">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-muted file:mr-3 file:rounded-panel file:border-0 file:bg-accent file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-accent/90"
              />
              {filePreview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={filePreview} alt="preview" className="h-20 w-20 rounded-panel border border-line object-cover" />
              )}
            </div>
          </div>
          <div className="rounded-panel border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-warn">
            Minting locks the reference as one generated image (~3⚡, charged only on success). This is a paid feature.
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={create}
              disabled={busy || !name.trim() || !file}
              className="flex items-center gap-2 rounded-panel bg-accent px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-accent/90 disabled:opacity-50"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Lock size={15} />}
              Mint & lock reference
            </button>
          </div>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-20 text-muted"><Loader2 className="animate-spin" size={24} /></div>
      ) : characters.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-line bg-cream/50 py-20 text-center">
          <UserCircle2 className="mb-3 text-muted" size={40} />
          <p className="font-display font-medium text-ink">No characters yet</p>
          <p className="mt-1 max-w-sm text-sm text-muted">
            Create a locked recurring character, then pick it in the wizard so every scene shares the same face.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {characters.map((c) => (
            <div key={c.id} className="overflow-hidden rounded-card border border-line bg-paper shadow-card">
              <div className="relative aspect-square bg-ink/5">
                {c.refImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.refImageUrl} alt={c.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted">
                    {c.status === 'minting' ? (
                      <>
                        <Loader2 className="animate-spin" size={22} />
                        <span className="text-xs">Locking reference…</span>
                      </>
                    ) : c.status === 'failed' ? (
                      <>
                        <AlertTriangle size={22} className="text-danger" />
                        <span className="text-xs text-danger">Mint failed</span>
                      </>
                    ) : (
                      <UserCircle2 size={28} />
                    )}
                  </div>
                )}
                {c.status === 'ready' && (
                  <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-signal/90 px-2 py-0.5 text-[10px] font-semibold text-white">
                    <Lock size={10} /> locked
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between px-3 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-ink">{c.name}</div>
                  <div className="text-[11px] text-muted">{c.specJson?.video_model ?? 'seedance'}</div>
                </div>
                <div className="flex items-center gap-1">
                  {c.status === 'failed' && (
                    <button
                      type="button"
                      onClick={() => void load()}
                      title="Refresh"
                      className="rounded-panel p-1.5 text-muted hover:bg-cream hover:text-ink"
                    >
                      <RefreshCw size={15} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => remove(c)}
                    disabled={busy}
                    title="Delete"
                    className="rounded-panel p-1.5 text-muted hover:bg-danger/10 hover:text-danger disabled:opacity-50"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
