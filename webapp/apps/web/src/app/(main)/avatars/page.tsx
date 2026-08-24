'use client';

// /avatars — the HeyGen-IL talking-head avatar manager. Three surfaces:
//   1. The STOCK marketplace (shared Hebrew-market faces) you can pick in the wizard.
//   2. Create a PHOTO avatar: upload one clear portrait → the standard lip-sync engine drives it.
//   3. Create a DIGITAL TWIN (pro): upload a 2-min driver video + record your spoken Hebrew
//      consent phrase (anti-impersonation) before the twin is usable.
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { UserCircle2, Plus, Loader2, X, Mic, Video, CheckCircle2, AlertTriangle, Trash2, RefreshCw } from 'lucide-react';

interface StockAvatar {
  id: string;
  kind: 'stock' | 'photo' | 'twin';
  nameHe: string;
  premium: boolean;
  faceImageUrl: string | null;
  talkModel: string | null;
}
interface MineAvatar {
  id: string;
  kind: 'photo' | 'twin';
  name: string;
  status: 'minting' | 'ready' | 'failed';
  faceImageUrl: string | null;
  talkModel: string | null;
  consentVerified: boolean;
}

const VIDEO_MIME = ['video/mp4', 'video/quicktime', 'video/webm'];

export default function AvatarsPage() {
  const [stock, setStock] = useState<StockAvatar[]>([]);
  const [mine, setMine] = useState<MineAvatar[]>([]);
  const [loading, setLoading] = useState(true);

  const [showPhoto, setShowPhoto] = useState(false);
  const [photoName, setPhotoName] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  const [showTwin, setShowTwin] = useState(false);
  const [twinName, setTwinName] = useState('');
  const [twinVideo, setTwinVideo] = useState<File | null>(null);
  const [consentPhrase, setConsentPhrase] = useState<string>('');
  const [consentVideo, setConsentVideo] = useState<File | null>(null);
  const [consentCharId, setConsentCharId] = useState<string>('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/avatars');
      const d = await res.json();
      setStock(d.stock ?? []);
      setMine(d.mine ?? []);
    } catch {
      toast.error('Failed to load avatars');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function pickPhotoFile(f: File | null) {
    setPhotoFile(f);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(f ? URL.createObjectURL(f) : null);
  }

  async function createPhoto() {
    if (!photoName.trim()) { toast.error('Name the avatar first'); return; }
    if (!photoFile) { toast.error('Upload a portrait'); return; }
    setBusy(true);
    try {
      const form = new FormData();
      form.append('name', photoName.trim());
      form.append('file', photoFile);
      const res = await fetch('/api/avatars', { method: 'POST', body: form });
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error ?? 'create failed');
        return;
      }
      toast.success(`Photo avatar "${photoName}" ready — pick it in the wizard.`);
      setPhotoName(''); setPhotoFile(null); setPhotoPreview(null); setShowPhoto(false);
      if (photoRef.current) photoRef.current.value = '';
      await load();
    } catch {
      toast.error('create failed');
    } finally {
      setBusy(false);
    }
  }

  // Digital twin: (1) upload the driver video + create the twin row, (2) get a consent
  // challenge phrase, (3) record the phrase on camera, (4) submit for verification.
  async function startTwin() {
    if (!twinName.trim()) { toast.error('Name the twin first'); return; }
    if (!twinVideo) { toast.error('Upload a 2-min driver video'); return; }
    setBusy(true);
    try {
      // Create the twin characters row (kind 'twin', status 'minting' → 'ready' on consent).
      const form = new FormData();
      form.append('name', twinName.trim());
      form.append('kind', 'twin');
      form.append('file', twinVideo);
      const res = await fetch('/api/avatars', { method: 'POST', body: form });
      const d = await res.json();
      if (!res.ok) { toast.error(d.error ?? 'twin create failed'); return; }
      const charId = d.avatar?.id;
      if (!charId) { toast.error('twin create failed'); return; }
      setConsentCharId(charId);

      // Issue the spoken-consent challenge.
      const ch = await fetch(`/api/consent?characterId=${encodeURIComponent(charId)}`);
      const chd = await ch.json();
      if (!ch.ok) { toast.error(chd.error ?? 'consent challenge failed'); return; }
      setConsentPhrase(chd.phrase ?? '');
      toast.success(`Twin created. Record yourself speaking the consent phrase.`);
    } catch {
      toast.error('twin create failed');
    } finally {
      setBusy(false);
    }
  }

  async function deleteAvatar(a: MineAvatar) {
    if (!confirm(`Delete avatar "${a.name}"? This cannot be undone.`)) return;
    setDeletingId(a.id);
    try {
      const res = await fetch(`/api/avatars/${encodeURIComponent(a.id)}`, { method: 'DELETE' });
      const d = await res.json();
      if (res.status === 409) {
        toast.error(d.error ?? 'avatar is in use by a project');
        return;
      }
      if (!res.ok) { toast.error(d.error ?? 'delete failed'); return; }
      toast.success(`Deleted "${a.name}".`);
      await load();
    } catch {
      toast.error('delete failed');
    } finally {
      setDeletingId(null);
    }
  }

  // A failed twin (consent rejected) can retry: open the twin form in consent-step mode,
  // issue a fresh challenge phrase, and reuse the recording UI.
  async function retryConsent(a: MineAvatar) {
    setBusy(true);
    try {
      const res = await fetch(`/api/consent?characterId=${encodeURIComponent(a.id)}`);
      const d = await res.json();
      if (!res.ok) { toast.error(d.error ?? 'consent challenge failed'); return; }
      setConsentCharId(a.id);
      setConsentPhrase(d.phrase ?? '');
      setConsentVideo(null);
      setShowTwin(true);
      setShowPhoto(false);
      toast.success('Record yourself speaking the new consent phrase.');
    } catch {
      toast.error('consent challenge failed');
    } finally {
      setBusy(false);
    }
  }

  async function submitConsent() {
    if (!consentVideo) { toast.error('Record the consent clip first'); return; }
    setBusy(true);
    try {
      const form = new FormData();
      form.append('characterId', consentCharId);
      form.append('file', consentVideo);
      const res = await fetch('/api/consent', { method: 'POST', body: form });
      const d = await res.json();
      if (!res.ok) { toast.error(d.error ?? 'consent upload failed'); return; }
      toast.success('Consent clip stored. Verification is automatic; the twin unlocks once confirmed.');
      setConsentCharId(''); setConsentPhrase(''); setConsentVideo(null);
      setTwinName(''); setTwinVideo(null); setShowTwin(false);
      await load();
    } catch {
      toast.error('consent upload failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Avatars</h1>
          <p className="text-sm text-muted">
            Talking heads for the avatar track. Pick a stock face, or make your own photo avatar
            (Creator) / digital twin (Pro).
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowPhoto((s) => !s)}
            className="flex items-center gap-2 rounded-panel bg-accent px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-accent/90"
          >
            <UserCircle2 size={15} /> Photo avatar
          </button>
          <button
            type="button"
            onClick={() => setShowTwin((s) => !s)}
            className="flex items-center gap-2 rounded-panel border border-accent px-4 py-2 text-sm font-semibold text-accent transition hover:bg-accent/10"
          >
            <Video size={15} /> Digital twin
          </button>
        </div>
      </div>

      {/* Photo avatar create form */}
      {showPhoto && (
        <div className="rounded-card border border-line bg-paper p-6 shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-ink">New photo avatar</h2>
            <button type="button" onClick={() => setShowPhoto(false)} className="text-muted hover:text-ink"><X size={18} /></button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">Name</label>
              <input value={photoName} onChange={(e) => setPhotoName(e.target.value)} placeholder="e.g. Dana — מרצה"
                className="w-full rounded-panel border border-line bg-cream px-3 py-2 text-sm text-ink outline-none focus:border-accent" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">Portrait</label>
              <input ref={photoRef} type="file" accept="image/png,image/jpeg,image/webp"
                onChange={(e) => pickPhotoFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-muted file:mr-3 file:rounded-panel file:border-0 file:bg-accent file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-accent/90" />
            </div>
          </div>
          {photoPreview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoPreview} alt="preview" className="h-28 w-28 rounded-panel border border-line object-cover" />
          )}
          <div className="rounded-panel border border-line bg-cream px-3 py-2 text-xs text-muted">
            The photo rides the standard lip-sync engine (Creator · {`4⚡/s`}). The face IS the locked ref — no mint pass needed.
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={createPhoto} disabled={busy || !photoName.trim() || !photoFile}
              className="flex items-center gap-2 rounded-panel bg-accent px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-accent/90 disabled:opacity-50">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Create photo avatar
            </button>
          </div>
        </div>
      )}

      {/* Digital twin create form */}
      {showTwin && (
        <div className="rounded-card border border-accent/40 bg-accent/5 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-ink">New digital twin <span className="ml-1 rounded-full bg-warn/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-warn">pro</span></h2>
            <button type="button" onClick={() => setShowTwin(false)} className="text-muted hover:text-ink"><X size={18} /></button>
          </div>
          {!consentCharId ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-ink">Name</label>
                  <input value={twinName} onChange={(e) => setTwinName(e.target.value)} placeholder="e.g. הדיגיטל שלי"
                    className="w-full rounded-panel border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-accent" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-ink">Driver video (2-min)</label>
                  <input type="file" accept={VIDEO_MIME.join(',')} onChange={(e) => setTwinVideo(e.target.files?.[0] ?? null)}
                    className="block w-full text-sm text-muted file:mr-3 file:rounded-panel file:border-0 file:bg-accent file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-accent/90" />
                </div>
              </div>
              <div className="rounded-panel border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-warn">
                A 2-min video of you talking gives the premium photoreal engine enough reference to drive a lifelike twin. You MUST record a spoken consent phrase — we never synthesize your face without it.
              </div>
              <div className="flex justify-end">
                <button type="button" onClick={startTwin} disabled={busy || !twinName.trim() || !twinVideo}
                  className="flex items-center gap-2 rounded-panel bg-accent px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-accent/90 disabled:opacity-50">
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <Video size={15} />} Create twin & get consent phrase
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="rounded-panel border border-signal/30 bg-signal/10 px-3 py-3 text-sm">
                <div className="flex items-center gap-2 font-medium text-ink"><Mic size={15} className="text-signal" /> Speak this phrase on camera:</div>
                <div className="mt-1 text-lg font-bold text-ink" dir="rtl">{consentPhrase}</div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-ink">Consent recording</label>
                <input type="file" accept={VIDEO_MIME.join(',')} onChange={(e) => setConsentVideo(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-muted file:mr-3 file:rounded-panel file:border-0 file:bg-accent file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-accent/90" />
                <p className="mt-1 text-[11px] text-muted">Record yourself saying the phrase above. We store the clip as your consent record and verify it.</p>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setConsentCharId('')} className="rounded-panel border border-line px-4 py-2 text-sm text-muted hover:bg-cream">Back</button>
                <button type="button" onClick={submitConsent} disabled={busy || !consentVideo}
                  className="flex items-center gap-2 rounded-panel bg-signal px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-signal/90 disabled:opacity-50">
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Submit consent
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20 text-muted"><Loader2 className="animate-spin" size={24} /></div>
      ) : (
        <>
          {/* Stock marketplace */}
          <div>
            <h2 className="mb-2 font-display text-lg font-semibold text-ink">Stock marketplace</h2>
            {stock.length === 0 ? (
              <p className="rounded-card border border-dashed border-line bg-cream/50 p-6 text-sm text-muted">
                No stock avatars seeded yet. (Seed via INSERT INTO avatars or the admin seed script.)
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {stock.map((a) => (
                  <div key={a.id} className="overflow-hidden rounded-card border border-line bg-paper shadow-card">
                    <div className="relative aspect-square bg-ink/5">
                      {a.faceImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.faceImageUrl} alt={a.nameHe} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted"><UserCircle2 size={28} /></div>
                      )}
                      {a.premium && (
                        <span className="absolute left-2 top-2 rounded-full bg-warn/90 px-2 py-0.5 text-[10px] font-semibold text-white">premium</span>
                      )}
                    </div>
                    <div className="px-3 py-2 text-sm font-medium text-ink" dir="rtl">{a.nameHe}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* My avatars */}
          <div>
            <h2 className="mb-2 font-display text-lg font-semibold text-ink">My avatars</h2>
            {mine.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-line bg-cream/50 py-16 text-center">
                <UserCircle2 className="mb-3 text-muted" size={40} />
                <p className="font-display font-medium text-ink">No avatars yet</p>
                <p className="mt-1 max-w-sm text-sm text-muted">Create a photo avatar (Creator) or a consented digital twin (Pro), then pick it in the generate wizard.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {mine.map((a) => (
                  <div key={a.id} className="overflow-hidden rounded-card border border-line bg-paper shadow-card">
                    <div className="relative aspect-square bg-ink/5">
                      {a.faceImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.faceImageUrl} alt={a.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted">
                          {a.status === 'minting' ? <><Loader2 className="animate-spin" size={22} /><span className="text-xs">pending consent…</span></>
                            : a.status === 'failed' ? <AlertTriangle size={22} className="text-danger" />
                            : <UserCircle2 size={28} />}
                        </div>
                      )}
                      <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white ${
                        a.kind === 'twin' ? 'bg-warn/90' : 'bg-accent/90'}`}>{a.kind}</span>
                    </div>
                    <div className="flex items-center justify-between gap-1 px-3 py-2">
                      <span className="truncate text-sm font-semibold text-ink">{a.name}</span>
                      <div className="flex items-center gap-2">
                        {a.kind === 'twin' && a.status === 'failed' && (
                          <button
                            type="button"
                            onClick={() => retryConsent(a)}
                            disabled={busy}
                            title="Consent rejected — record a new consent clip"
                            className="flex items-center gap-1 rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-semibold text-danger transition hover:bg-danger/20 disabled:opacity-50"
                          >
                            <RefreshCw size={10} /> retry consent
                          </button>
                        )}
                        {a.consentVerified && (
                          <span className="flex items-center gap-1 text-[10px] font-medium text-signal"><CheckCircle2 size={11} /> consent</span>
                        )}
                        <button
                          type="button"
                          onClick={() => deleteAvatar(a)}
                          disabled={deletingId === a.id}
                          title="Delete avatar"
                          className="text-muted transition hover:text-danger disabled:opacity-50"
                        >
                          {deletingId === a.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
