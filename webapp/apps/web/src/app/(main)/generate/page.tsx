'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Type, ListVideo, Mic, Rocket, CheckCircle2, Lock, Unlock, Plus, Trash2, Loader2, Layers,
} from 'lucide-react';
import { toast } from 'sonner';
import { CREDIT_TABLE } from '@shorts/spec';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type TrackMode = 'tsx' | 'ad' | 'kids' | 'ai' | 'vox' | 'avatar';
interface Track {
  id: TrackMode;
  name: string;
  blurb: string;
  language: 'en' | 'he';
  rtl: boolean;
  exposesCta: boolean;
  minTier: 'free' | 'creator' | 'pro';
  creditBand: { min: number; max: number };
  ready: boolean;
  templates: { id: string; name: string; compId: string }[];
}
interface TemplateCard {
  id: string;
  name: string;
  compId: string;
  engine: 'tsx' | 'ai' | 'vox';
  previewUrl: string;
}
interface CharacterOption {
  id: string;
  name: string;
  status: 'minting' | 'ready' | 'failed';
  refImageUrl: string | null;
  specJson?: { video_model?: string; locked?: boolean } | null;
}
interface AvatarOption {
  id: string;
  kind: 'stock' | 'photo' | 'twin';
  name: string;
  nameHe?: string;
  premium: boolean;
  faceImageUrl: string | null;
  talkModel: string | null;
  source: 'stock' | 'mine';
}
interface VoiceOption {
  id: string;
  engine: 'kokoro' | 'edge';
  name: string;
  tier: 'free';
}
interface BeatLine {
  text: string;
  start: number;
  end: number;
}

const STEPS = [
  { id: 0, label: 'Track', icon: Layers },
  { id: 1, label: 'Input', icon: Type },
  { id: 2, label: 'Script', icon: ListVideo },
  { id: 3, label: 'Style & voice', icon: Mic },
  { id: 4, label: 'Generate', icon: Rocket },
];

export default function GeneratePage() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  // Step 0 — content track (drives language/RTL, template filter, tier/cost).
  const [tracks, setTracks] = useState<Track[]>([]);
  const [trackId, setTrackId] = useState<TrackMode>('tsx');

  // Step 1 — input
  const [topic, setTopic] = useState('');
  const [title, setTitle] = useState('');
  const [template, setTemplate] = useState('form-card');
  const [templates, setTemplates] = useState<TemplateCard[]>([]);

  // Step 2 — script (review + edit + LOCK)
  const [lines, setLines] = useState<string[]>([]);
  const [draftedBeats, setDraftedBeats] = useState<BeatLine[]>([]);
  const [locked, setLocked] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Step 3 — style/voice
  const [voiceEngine, setVoiceEngine] = useState<'kokoro' | 'edge'>('kokoro');
  const [voiceId, setVoiceId] = useState('af_bella');
  const [captionPreset, setCaptionPreset] = useState<'pop' | 'pill' | 'fade'>('pill');
  const [accent, setAccent] = useState('#6366F1');
  const [voices, setVoices] = useState<VoiceOption[]>([]);

  // Phase 2 — locked recurring character (mandatory for the AI-video track).
  const [characters, setCharacters] = useState<CharacterOption[]>([]);
  const [characterId, setCharacterId] = useState<string>('');

  // Phase 4 — AI-video options: per-scene clip length + the character's video model.
  // The fal pixel stage runs one clip per scene; cost = clipSeconds × sceneCount × aiVideoSec.
  const [clipSeconds, setClipSeconds] = useState(4);
  const [aiModel, setAiModel] = useState('seedance');

  // Phase 5 — vox options: a layer-budget slider. Each generated collage layer (a die-cut
  // subject or archival photo) is billed at CREDIT_TABLE.voxLayer. The slider sets how many
  // AI layers the worker's collage-layers pixel stage may mint across the whole short.
  const [voxLayers, setVoxLayers] = useState(6);

  // HeyGen-IL — avatar track: the talking head. `avatarId` is a STOCK marketplace id or one
  // of the caller's own photo/twin avatars (GET /api/avatars). `premium` selects the
  // photoreal lip-sync engine (talkSecPremium burn, pro-only). The face ref the talk stage
  // consumes is resolved server-side from the picked avatar.
  const [avatars, setAvatars] = useState<AvatarOption[]>([]);
  const [avatarId, setAvatarId] = useState<string>('');
  const [talkPremium, setTalkPremium] = useState(false);

  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch('/api/tracks').then((r) => r.json()).then((d) => setTracks(d.tracks ?? [])).catch(() => {});
    void fetch('/api/generate/templates').then((r) => r.json()).then((d) => setTemplates(d.templates ?? [])).catch(() => {});
    void fetch('/api/generate/voices').then((r) => r.json()).then((d) => setVoices(d.voices ?? [])).catch(() => {});
    void fetch('/api/characters').then((r) => r.json()).then((d) => setCharacters(d.characters ?? [])).catch(() => {});
    void fetch('/api/avatars').then((r) => r.json()).then((d) => {
      const stock = (d.stock ?? []).map((a: { id: string; kind: string; nameHe?: string; premium?: boolean; faceImageUrl?: string | null; talkModel?: string | null }) => ({
        id: a.id, kind: a.kind, name: a.nameHe ?? 'אווטאר', premium: a.premium ?? false, faceImageUrl: a.faceImageUrl ?? null, talkModel: a.talkModel ?? null, source: 'stock' as const,
      }));
      const mine = (d.mine ?? []).map((a: { id: string; kind: string; name: string; faceImageUrl?: string | null; talkModel?: string | null }) => ({
        id: a.id, kind: a.kind, name: a.name, premium: a.kind === 'twin', faceImageUrl: a.faceImageUrl ?? null, talkModel: a.talkModel ?? null, source: 'mine' as const,
      }));
      setAvatars([...stock, ...mine]);
    }).catch(() => {});
  }, []);

  // The currently-selected track — drives language/RTL, template filtering, tier/cost.
  const track = useMemo(() => tracks.find((t) => t.id === trackId), [tracks, trackId]);
  const isHe = track?.language === 'he';

  // When the track changes, snap the template to the first one the track offers.
  function pickTrack(id: TrackMode) {
    setTrackId(id);
    const t = tracks.find((x) => x.id === id);
    const first = t?.templates?.[0]?.id;
    if (first) setTemplate(first);
    // Hebrew tracks default to the Hebrew edge voice; English back to kokoro.
    if (t?.language === 'he') {
      setVoiceEngine('edge');
      setVoiceId('he-IL-HilaNeural');
    } else {
      setVoiceEngine('kokoro');
      setVoiceId('af_bella');
    }
  }

  // Step 1 -> 2: draft the beat sheet via POST /api/generate/script.
  async function draftScript() {
    if (!topic.trim()) {
      toast.error('Type a topic first');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/generate/script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, template, title, mode: trackId, language: track?.language ?? 'en' }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'script draft failed');
        return;
      }
      const vo = (data.vo ?? []) as BeatLine[];
      setDraftedBeats(vo);
      setLines(vo.map((l) => l.text));
      setLocked(false);
      setDirty(false);
      setStep(2);
    } catch (e) {
      toast.error('script draft failed');
    } finally {
      setBusy(false);
    }
  }

  function editLine(i: number, text: string) {
    setLines((ls) => ls.map((l, j) => (j === i ? text : l)));
    setLocked(false);
    setDirty(true);
  }
  function addLine() {
    setLines((ls) => [...ls, 'New line…']);
    setLocked(false);
    setDirty(true);
  }
  function removeLine(i: number) {
    setLines((ls) => ls.filter((_, j) => j !== i));
    setLocked(false);
    setDirty(true);
  }
  function lockScript() {
    if (lines.length === 0 || lines.some((l) => !l.trim())) {
      toast.error('Every line needs text before locking');
      return;
    }
    setLocked(true);
    setDirty(false);
    toast.success('Script locked — the video will speak exactly these lines.');
  }

  // Step 4: Generate.
  async function generate() {
    if (!locked) {
      toast.error('Lock the script first (step 2)');
      return;
    }
    // The AI-video track requires a locked recurring character (the fal clips are conditioned on it).
    if (trackId === 'ai' && !characterId) {
      toast.error('Pick a character first — AI-video needs a locked recurring face.');
      return;
    }
    // The avatar track requires a talking head (a stock face or one of your own).
    if (trackId === 'avatar' && !avatarId) {
      toast.error('Pick an avatar first — the talking head is the whole point.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          title,
          template,
          mode: trackId,
          language: track?.language ?? 'en',
          script: lines.map((text, i) => ({ text, start: draftedBeats[i]?.start, end: draftedBeats[i]?.end })),
          voice: { engine: voiceEngine, voiceId },
          captions: { preset: captionPreset, burnIn: true },
          theme: { accent },
          // Ad tracks carry the business config for the CTA end card / price badge.
          ...(trackId === 'ad' ? { ad: { business: title || topic } } : {}),
          // AI-video + consistent-face tracks carry the locked recurring character.
          ...(characterId ? { characterId } : {}),
          // AI-video options: per-scene clip seconds + the character's video model.
          ...(trackId === 'ai' ? { clipSeconds, aiModel } : {}),
          // Vox options: the layer budget (how many AI collage layers to mint).
          ...(trackId === 'vox' ? { voxLayers } : {}),
          // Avatar track: the talking head. faceAssetId is a stock avatar id OR the caller's
          // own characters-row id; the server resolves the face ref + talk model.
          ...(trackId === 'avatar' ? { avatar: { faceAssetId: avatarId, premium: talkPremium } } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'generate failed');
        return;
      }
      toast.success(`Generating… cost ${data.costCredits}cr (free tier)`);
      router.push(`/projects/${data.projectId}/progress?job=${data.jobId}`);
    } catch (e) {
      toast.error('generate failed');
    } finally {
      setBusy(false);
    }
  }

  const stepVoices = useMemo(
    () => voices.filter((v) => v.engine === voiceEngine),
    [voices, voiceEngine]
  );

  // Templates offered by the selected track. Falls back to all templates when the
  // track catalog hasn't loaded yet (keeps the page usable offline of /api/tracks).
  const trackTemplates = useMemo(() => {
    const ids = new Set(track?.templates?.map((t) => t.id) ?? []);
    return ids.size > 0 ? templates.filter((t) => ids.has(t.id)) : templates;
  }, [templates, track]);

  // Hebrew tracks show Hebrew voices first (voice list is language-annotated server-side).
  const tierLabel = track?.minTier === 'free' ? 'Free tier' : track?.minTier === 'creator' ? 'Creator tier' : 'Pro tier';
  const costLine = track && track.creditBand.max > 0
    ? `~${track.creditBand.min}–${track.creditBand.max}⚡ (~$${(track.creditBand.min / 100).toFixed(2)}–$${(track.creditBand.max / 100).toFixed(2)})`
    : 'Free · $0.00';

  // The selected character (drives the AI-video model + is mandatory for the AI track).
  const selectedCharacter = useMemo(
    () => characters.find((c) => c.id === characterId),
    [characters, characterId]
  );

  // Sync the AI-video model from the selected character's locked video_model.
  useEffect(() => {
    const m = selectedCharacter?.specJson?.video_model;
    if (trackId === 'ai' && m) setAiModel(m);
  }, [trackId, selectedCharacter]);

  // Phase 4 — live AI-video credit math: per-scene clip seconds × scene count × aiVideoSec.
  // Scene count tracks the locked-script line count when known (each line ≈ one scene beat),
  // else the chosen template's scene count. The fal pixel stage re-quotes server-side.
  const aiSceneCount = lines.length > 0 ? lines.length : 6;
  const aiVideoCredits =
    trackId === 'ai' ? clipSeconds * aiSceneCount * CREDIT_TABLE.aiVideoSec : 0;
  const aiCostLine =
    trackId === 'ai'
      ? `~${aiVideoCredits}⚡ (~$${(aiVideoCredits / 100).toFixed(2)}) — ${aiSceneCount} clip${aiSceneCount === 1 ? '' : 's'} × ${clipSeconds}s × ${CREDIT_TABLE.aiVideoSec}⚡/s`
      : null;

  // Phase 5 — live vox credit math: layer budget × voxLayer. The worker's collage-layers
  // pixel stage re-quotes server-side and refuses to exceed this.
  const voxVideoCredits = trackId === 'vox' ? voxLayers * CREDIT_TABLE.voxLayer : 0;
  const voxCostLine =
    trackId === 'vox'
      ? `~${voxVideoCredits}⚡ (~$${(voxVideoCredits / 100).toFixed(2)}) — ${voxLayers} collage layer${voxLayers === 1 ? '' : 's'} × ${CREDIT_TABLE.voxLayer}⚡`
      : null;

  // HeyGen-IL — live avatar credit math: total talking-head seconds × talk rate. The talk
  // stage re-quotes server-side; the premium engine burns talkSecPremium (the HeyGen 6× gap).
  const talkRate = talkPremium ? CREDIT_TABLE.talkSecPremium : CREDIT_TABLE.talkSec;
  const talkSeconds = lines.length > 0 ? draftedBeats.length * 3.2 : 9; // ~3.2s per spoken line
  const talkCredits = trackId === 'avatar' ? Math.ceil(talkSeconds) * talkRate : 0;
  const talkCostLine =
    trackId === 'avatar'
      ? `~${talkCredits}⚡ (~$${(talkCredits / 100).toFixed(2)}) — ${Math.ceil(talkSeconds)}s talking head × ${talkRate}⚡/s${talkPremium ? ' · premium' : ''}`
      : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Stepper header */}
      <div className="flex items-center gap-2">
        {STEPS.map((s) => {
          const Icon = s.icon;
          const active = step === s.id;
          const done = step > s.id;
          return (
            <div key={s.id} className="flex items-center gap-2">
              <div
                className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ${
                  active ? 'bg-accent text-white' : done ? 'bg-accent/15 text-accent' : 'bg-cream text-muted'
                }`}
              >
                {done ? <CheckCircle2 size={14} /> : <Icon size={14} />}
                {s.label}
              </div>
              {s.id < STEPS.length && <div className="h-px w-6 bg-line" />}
            </div>
          );
        })}
      </div>

      {/* STEP 0 — content track */}
      {step === 0 && (
        <div className="rounded-card border border-line bg-paper p-6 shadow-card space-y-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">What are you making?</h2>
            <p className="text-sm text-muted">Pick the content track. This sets the language, layout, and cost tier.</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {tracks.map((t) => {
              const selected = trackId === t.id;
              const lockedTier = t.minTier !== 'free';
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => t.ready && pickTrack(t.id)}
                  disabled={!t.ready}
                  className={`relative rounded-card border p-4 text-left transition ${
                    selected
                      ? 'border-accent ring-2 ring-accent/30 bg-accent/5'
                      : t.ready
                        ? 'border-line bg-cream hover:border-accent/50'
                        : 'border-line bg-cream opacity-55 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-ink">{t.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      t.minTier === 'free' ? 'bg-signal/15 text-signal' : t.minTier === 'creator' ? 'bg-accent/15 text-accent' : 'bg-warn/15 text-warn'
                    }`}>
                      {t.minTier}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted">{t.blurb}</p>
                  <div className="mt-2 flex items-center gap-2 text-[11px] text-muted">
                    <span className="rounded-full bg-ink/5 px-2 py-0.5">{t.language === 'he' ? 'עברית · RTL' : 'English · LTR'}</span>
                    {t.exposesCta && <span className="rounded-full bg-ink/5 px-2 py-0.5">CTA end card</span>}
                    {t.creditBand.max > 0 && <span className="rounded-full bg-ink/5 px-2 py-0.5">{t.creditBand.min}–{t.creditBand.max}⚡</span>}
                  </div>
                  {!t.ready && (
                    <span className="mt-2 inline-block rounded-full bg-warn/15 px-2 py-0.5 text-[10px] font-semibold text-warn">Coming soon</span>
                  )}
                  {lockedTier && t.ready && (
                    <span className="sr-only">Requires {t.minTier} tier</span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setStep(1)}
              disabled={!track?.ready}
              className="flex items-center gap-2 rounded-panel bg-accent px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-accent/90 disabled:opacity-50"
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* STEP 1 — input */}
      {step === 1 && (
        <div className="rounded-card border border-line bg-paper p-6 shadow-card space-y-4">
          {/* Track context — which track/language this script feeds. */}
          <div className="flex items-center gap-2 text-xs">
            <span className="rounded-full bg-accent/10 px-2.5 py-1 font-medium text-accent">{track?.name ?? 'Story short'}</span>
            <span className="rounded-full bg-ink/5 px-2.5 py-1 text-muted">{isHe ? 'עברית · RTL' : 'English · LTR'}</span>
            {track?.exposesCta && <span className="rounded-full bg-ink/5 px-2.5 py-1 text-muted">CTA end card</span>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">Topic</label>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={3}
              dir={isHe ? 'rtl' : 'ltr'}
              placeholder={isHe ? 'למשל: קורס בישול למתחילים' : 'e.g. how to make a form in Hebrew'}
              className="w-full rounded-panel border border-line bg-cream px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">Title (optional)</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Defaults to the topic"
              className="w-full rounded-panel border border-line bg-cream px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-ink">Template</label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {trackTemplates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTemplate(t.id)}
                  className={`overflow-hidden rounded-card border text-left transition ${
                    template === t.id ? 'border-accent ring-2 ring-accent/30' : 'border-line hover:border-accent/50'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={t.previewUrl} alt={t.name} className="aspect-[9/16] w-full bg-ink/5 object-cover" />
                  <div className="px-2 py-1.5 text-xs font-medium text-ink">{t.name}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-between">
            <button type="button" onClick={() => setStep(0)} className="rounded-panel border border-line px-4 py-2 text-sm text-muted hover:bg-cream">
              ← Track
            </button>
            <button
              type="button"
              onClick={draftScript}
              disabled={busy || !topic.trim()}
              className="flex items-center gap-2 rounded-panel bg-accent px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-accent/90 disabled:opacity-50"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : null}
              Draft script →
            </button>
          </div>
        </div>
      )}

      {/* STEP 2 — script review / edit / LOCK (the differentiator) */}
      {step === 2 && (
        <div className="rounded-card border border-line bg-paper p-6 shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-semibold text-ink">Review the script</h2>
              <p className="text-sm text-muted">The video will speak <span className="font-semibold text-ink">exactly</span> these lines.</p>
            </div>
            <button
              type="button"
              onClick={lockScript}
              className={`flex items-center gap-2 rounded-panel px-3 py-1.5 text-sm font-semibold transition ${
                locked ? 'bg-signal/15 text-signal' : 'bg-accent text-white hover:bg-accent/90'
              }`}
            >
              {locked ? <Lock size={14} /> : <Unlock size={14} />}
              {locked ? 'Locked' : 'Lock script'}
            </button>
          </div>

          {dirty && !locked && (
            <div className="rounded-panel border border-warn/30 bg-warn/10 px-3 py-1.5 text-xs text-warn">
              Unsaved edits — click “Lock script” to commit.
            </div>
          )}

          <div className="space-y-2">
            {lines.map((line, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="mt-2 w-7 shrink-0 text-center font-mono text-xs text-muted">{i + 1}</div>
                <textarea
                  value={line}
                  onChange={(e) => editLine(i, e.target.value)}
                  rows={1}
                  disabled={locked}
                  className={`flex-1 resize-none rounded-panel border px-3 py-2 text-sm outline-none transition ${
                    locked
                      ? 'border-signal/30 bg-signal/5 text-ink'
                      : 'border-line bg-cream text-ink focus:border-accent'
                  }`}
                />
                {!locked && (
                  <button type="button" onClick={() => removeLine(i)} className="mt-2 text-muted hover:text-danger">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {!locked && (
            <button
              type="button"
              onClick={addLine}
              className="flex items-center gap-2 rounded-panel border border-dashed border-line px-3 py-1.5 text-sm text-muted hover:border-accent hover:text-ink"
            >
              <Plus size={14} /> Add line
            </button>
          )}

          <div className="flex justify-between">
            <button type="button" onClick={() => setStep(1)} className="rounded-panel border border-line px-4 py-2 text-sm text-muted hover:bg-cream">
              ← Back
            </button>
            <button
              type="button"
              onClick={() => (locked ? setStep(3) : toast.error('Lock the script first'))}
              disabled={!locked}
              className="rounded-panel bg-accent px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-accent/90 disabled:opacity-50"
            >
              Style & voice →
            </button>
          </div>
        </div>
      )}

      {/* STEP 3 — style & voice */}
      {step === 3 && (
        <div className="rounded-card border border-line bg-paper p-6 shadow-card space-y-4">
          <h2 className="font-display text-lg font-semibold text-ink">Style & voice</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">Voice engine</label>
              <div className="flex gap-2">
                {(['kokoro', 'edge'] as const).map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => {
                      setVoiceEngine(e);
                      const first = voices.find((v) => v.engine === e);
                      if (first) setVoiceId(first.id);
                    }}
                    className={`flex-1 rounded-panel border px-3 py-2 text-sm font-medium transition ${
                      voiceEngine === e ? 'border-accent bg-accent/10 text-accent' : 'border-line bg-cream text-ink'
                    }`}
                  >
                    {e === 'kokoro' ? 'Kokoro (local, free)' : 'Edge (free)'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">Voice</label>
              <select
                value={voiceId}
                onChange={(e) => setVoiceId(e.target.value)}
                className="w-full rounded-panel border border-line bg-cream px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              >
                {stepVoices.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Character (locked recurring face) — required for the AI-video track. */}
          <div className={`rounded-panel border p-3 ${trackId === 'ai' ? 'border-accent/40 bg-accent/5' : 'border-line bg-cream'}`}>
            <label className="mb-1 flex items-center gap-2 text-sm font-medium text-ink">
              Character
              {trackId === 'ai' && <span className="rounded-full bg-warn/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-warn">required</span>}
            </label>
            <p className="mb-2 text-xs text-muted">
              A locked recurring face. Every scene image / clip is conditioned on it — choose one to keep the face consistent.
            </p>
            {characters.length === 0 ? (
              <div className="flex items-center gap-2 text-xs text-muted">
                <span>No characters yet.</span>
                <a href="/characters" className="font-medium text-accent underline">Create one →</a>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {characters.filter((c) => c.status === 'ready').map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCharacterId(characterId === c.id ? '' : c.id)}
                    className={`flex items-center gap-2 rounded-panel border px-2 py-1.5 text-sm transition ${
                      characterId === c.id ? 'border-accent bg-accent/10 text-accent' : 'border-line bg-paper text-ink hover:border-accent/50'
                    }`}
                  >
                    {c.refImageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.refImageUrl} alt={c.name} className="h-7 w-7 rounded-full object-cover" />
                    )}
                    <span className="font-medium">{c.name}</span>
                  </button>
                ))}
                {characters.some((c) => c.status === 'minting') && (
                  <span className="flex items-center gap-1 text-xs text-muted">
                    <Loader2 className="animate-spin" size={12} /> minting…
                  </span>
                )}
              </div>
            )}
          </div>

          {/* HeyGen-IL — avatar picker (the talking head). Required for the avatar track. */}
          {trackId === 'avatar' && (
            <div className="rounded-panel border border-accent/40 bg-accent/5 p-3 space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium text-ink">
                אווטאר — the talking head
                <span className="rounded-full bg-warn/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-warn">required</span>
              </label>
              <p className="text-xs text-muted">
                Pick a stock face from the marketplace or one of your own. The avatar lip-syncs your locked Hebrew script.
              </p>
              {avatars.length === 0 ? (
                <div className="flex items-center gap-2 text-xs text-muted">
                  <span>No avatars yet.</span>
                  <a href="/avatars" className="font-medium text-accent underline">Create a photo avatar →</a>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {avatars.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setAvatarId(avatarId === a.id ? '' : a.id)}
                      className={`flex items-center gap-2 rounded-panel border px-2 py-1.5 text-sm transition ${
                        avatarId === a.id ? 'border-accent bg-accent/10 text-accent' : 'border-line bg-paper text-ink hover:border-accent/50'
                      }`}
                    >
                      {a.faceImageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.faceImageUrl} alt={a.name} className="h-7 w-7 rounded-full object-cover" />
                      )}
                      <span className="font-medium">{a.name}</span>
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase ${
                        a.kind === 'twin' ? 'bg-warn/15 text-warn' : a.kind === 'stock' ? 'bg-ink/5 text-muted' : 'bg-accent/10 text-accent'
                      }`}>
                        {a.kind}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={talkPremium}
                  onChange={(e) => setTalkPremium(e.target.checked)}
                  className="accent-accent"
                />
                <span className="font-medium text-ink">Premium photoreal engine</span>
                <span className="text-xs text-muted">(pro · {CREDIT_TABLE.talkSecPremium}⚡/s vs {CREDIT_TABLE.talkSec}⚡/s)</span>
              </label>
            </div>
          )}

          {/* Phase 4 — AI-video options: clip length + the character's locked video model. */}
          {trackId === 'ai' && (
            <div className="rounded-panel border border-accent/40 bg-accent/5 p-3 space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium text-ink">
                AI-video options
                <span className="rounded-full bg-warn/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-warn">pro</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink">Video model</label>
                  <select
                    value={aiModel}
                    onChange={(e) => setAiModel(e.target.value)}
                    className="w-full rounded-panel border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                  >
                    {['seedance', 'veo', 'kling'].map((m) => (
                      <option key={m} value={m}>{m === 'seedance' ? 'Seedance (default)' : m === 'veo' ? 'Veo' : 'Kling'}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-muted">
                    {selectedCharacter?.specJson?.video_model
                      ? `Character locked to ${selectedCharacter.specJson.video_model}.`
                      : 'From the selected character’s video model.'}
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink">Clip length (sec)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={2}
                      max={10}
                      value={clipSeconds}
                      onChange={(e) => setClipSeconds(Math.max(2, Math.min(10, Number(e.target.value) || 4)))}
                      className="w-full rounded-panel border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                    />
                    <span className="text-xs text-muted">s</span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted">One fal clip per scene beat.</p>
                </div>
              </div>
              <div className="rounded-panel border border-line bg-paper px-3 py-2 text-xs">
                <span className="font-medium text-ink">AI-video cost: </span>
                <span className="font-semibold text-warn">{aiVideoCredits}⚡</span>
                <span className="text-muted"> (~${(aiVideoCredits / 100).toFixed(2)}) — {aiSceneCount} clips × {clipSeconds}s</span>
              </div>
            </div>
          )}

          {/* Phase 5 — vox options: layer-budget slider. */}
          {trackId === 'vox' && (
            <div className="rounded-panel border border-accent/40 bg-accent/5 p-3 space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium text-ink">
                Collage layers
                <span className="rounded-full bg-warn/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-warn">pro</span>
              </label>
              <p className="text-xs text-muted">
                How many AI-produced layers (die-cut subjects + archival photos) the worker mints onto the paper board. Style is locked to the vox DESIGN.md paper-collage look.
              </p>
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-ink">Layer budget</span>
                  <span className="font-semibold text-accent">{voxLayers} layer{voxLayers === 1 ? '' : 's'}</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={12}
                  value={voxLayers}
                  onChange={(e) => setVoxLayers(Number(e.target.value))}
                  className="w-full accent-accent"
                />
              </div>
              <div className="rounded-panel border border-line bg-paper px-3 py-2 text-xs">
                <span className="font-medium text-ink">Vox cost: </span>
                <span className="font-semibold text-warn">{voxVideoCredits}⚡</span>
                <span className="text-muted"> (~${(voxVideoCredits / 100).toFixed(2)}) — {voxLayers} layers × {CREDIT_TABLE.voxLayer}⚡</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">Caption preset</label>
              <div className="flex gap-2">
                {(['pop', 'pill', 'fade'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setCaptionPreset(p)}
                    className={`flex-1 rounded-panel border px-3 py-2 text-sm font-medium capitalize transition ${
                      captionPreset === p ? 'border-accent bg-accent/10 text-accent' : 'border-line bg-cream text-ink'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">Accent color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={accent}
                  onChange={(e) => setAccent(e.target.value)}
                  className="h-9 w-14 cursor-pointer rounded-panel border border-line"
                />
                <span className="font-mono text-xs text-muted">{accent}</span>
              </div>
            </div>
          </div>

          {/* Cost line — reflects the selected track's tier + credit band (live AI-video math). */}
          <div className="rounded-panel border border-line bg-cream px-3 py-2 text-sm">
            <span className="font-medium text-ink">Cost: </span>
            <span className="font-semibold text-signal">{tierLabel} · {talkCostLine ?? voxCostLine ?? aiCostLine ?? costLine}</span>
            <span className="text-muted"> ({track?.name ?? 'Story short'}{isHe ? ' · Hebrew/RTL' : ''})</span>
          </div>

          <div className="flex justify-between">
            <button type="button" onClick={() => setStep(2)} className="rounded-panel border border-line px-4 py-2 text-sm text-muted hover:bg-cream">
              ← Back
            </button>
            <button
              type="button"
              onClick={() => setStep(4)}
              className="rounded-panel bg-accent px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-accent/90"
            >
              Review & generate →
            </button>
          </div>
        </div>
      )}

      {/* STEP 4 — generate */}
      {step === 4 && (
        <div className="rounded-card border border-line bg-paper p-6 shadow-card space-y-4">
          <h2 className="font-display text-lg font-semibold text-ink">Ready to generate</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div><dt className="text-muted">Track</dt><dd className="font-medium text-ink">{track?.name ?? trackId}{isHe ? ' · עברית/RTL' : ''}</dd></div>
            <div><dt className="text-muted">Template</dt><dd className="font-medium text-ink">{templates.find((t) => t.id === template)?.name ?? template}</dd></div>
            <div><dt className="text-muted">Voice</dt><dd className="font-medium text-ink">{voiceEngine} · {voiceId}</dd></div>
            <div><dt className="text-muted">Captions</dt><dd className="font-medium text-ink capitalize">{captionPreset}</dd></div>
            <div><dt className="text-muted">Lines</dt><dd className="font-medium text-ink">{lines.length} (locked)</dd></div>
            {characterId && (
              <div><dt className="text-muted">Character</dt><dd className="font-medium text-ink">{characters.find((c) => c.id === characterId)?.name ?? 'locked'}</dd></div>
            )}
            {trackId === 'ai' && (
              <div><dt className="text-muted">AI-video</dt><dd className="font-medium text-ink">{aiModel} · {clipSeconds}s × {aiSceneCount} clips</dd></div>
            )}
            {trackId === 'vox' && (
              <div><dt className="text-muted">Collage</dt><dd className="font-medium text-ink">{voxLayers} layers</dd></div>
            )}
            {trackId === 'avatar' && avatarId && (
              <div><dt className="text-muted">Avatar</dt><dd className="font-medium text-ink">{avatars.find((a) => a.id === avatarId)?.name ?? 'picked'}{talkPremium ? ' · premium' : ''}</dd></div>
            )}
          </dl>
          <div className="rounded-panel border border-line bg-cream px-3 py-2">
            <div className="mb-1 text-xs font-medium text-muted">Locked script</div>
            <ol className="list-decimal space-y-0.5 pl-5 text-sm text-ink">
              {lines.map((l, i) => <li key={i}>{l}</li>)}
            </ol>
          </div>
          <div className="rounded-panel border border-line bg-cream px-3 py-2 text-sm">
            <span className="font-medium text-ink">Cost: </span>
            <span className="font-semibold text-signal">{tierLabel} · {talkCostLine ?? voxCostLine ?? aiCostLine ?? costLine}</span>
          </div>
          <div className="flex justify-between">
            <button type="button" onClick={() => setStep(3)} className="rounded-panel border border-line px-4 py-2 text-sm text-muted hover:bg-cream">
              ← Back
            </button>
            <button
              type="button"
              onClick={generate}
              disabled={busy}
              className="flex items-center gap-2 rounded-panel bg-accent px-5 py-2.5 text-sm font-bold text-white shadow-soft transition hover:bg-accent/90 disabled:opacity-50"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Rocket size={15} />}
              Generate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
