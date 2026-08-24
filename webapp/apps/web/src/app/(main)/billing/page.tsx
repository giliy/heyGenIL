'use client';
// /billing — plan cards (Free / Creator / Pro), Manage/Cancel via portal, credit ledger table,
// and the transparent pricing explainer (incl. "Failed renders are always free").
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useBilling } from '@/lib/billing';

interface LedgerRow {
  id: string;
  delta: number;
  reason: string;
  balanceAfter: number;
  createdAt: string;
}

interface TierCard {
  id: 'free' | 'creator' | 'pro';
  name: string;
  nameHe: string;
  price: string;
}

const CREDIT_TABLE = [
  { item: 'TSX render', cost: '2–4 ⚡' },
  { item: 'AI image', cost: '3–5 ⚡' },
  { item: 'AI voice line (ElevenLabs)', cost: '1–2 ⚡' },
  { item: 'AI video (per second)', cost: '6–8 ⚡ · pro' },
  { item: 'Vox collage layer', cost: '3 ⚡ · pro' },
  { item: 'Talking avatar (per second)', cost: '4 ⚡ · creator+' },
  { item: 'Talking avatar premium (per second)', cost: '24 ⚡ · pro' },
  { item: 'Generated SFX cue', cost: '2 ⚡ · creator+' },
  { item: 'Generated music bed', cost: '4 ⚡ · creator+' },
];

/** Build the pricing rows from the SHARED creditBasis (GET /api/billing/tiers) — the live
 * per-block prices, so the table reflects the server's truth rather than a hardcoded copy. */
function pricingRows(cb: Record<string, number>) {
  return [
    { item: 'TSX render', cost: `${cb.tsxFlat ?? 2} ⚡` },
    { item: 'AI image', cost: `${cb.aiImage ?? 3} ⚡` },
    { item: 'AI voice line (ElevenLabs)', cost: `${cb.elevenVoiceLine ?? 1} ⚡` },
    { item: 'AI video (per second)', cost: `${cb.aiVideoSec ?? 6} ⚡ · pro` },
    { item: 'Vox collage layer', cost: `${cb.voxLayer ?? 3} ⚡ · pro` },
    { item: 'Talking avatar (per second)', cost: `${cb.talkSec ?? 4} ⚡ · creator+` },
    { item: 'Talking avatar premium (per second)', cost: `${cb.talkSecPremium ?? 24} ⚡ · pro` },
    { item: 'Generated SFX cue', cost: `${cb.sfxGen ?? 2} ⚡ · creator+` },
    { item: 'Generated music bed', cost: `${cb.musicGen ?? 4} ⚡ · creator+` },
  ];
}

export default function BillingPage() {
  const b = useBilling();
  const [ledger, setLedger] = useState<LedgerRow[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [creditBasis, setCreditBasis] = useState<Record<string, number> | null>(null);
  // Shared TIERS (₪ + Hebrew names) so the plan cards reflect the server's truth.
  const [tiers, setTiers] = useState<Record<string, TierCard> | null>(null);

  useEffect(() => {
    void fetch('/api/billing/ledger')
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => setLedger(body?.rows ?? []))
      .catch(() => setLedger([]));
    // The pricing table + plan cards are data-driven (tier math is never hardcoded client-side).
    void fetch('/api/billing/tiers')
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        setCreditBasis(body?.creditBasis ?? null);
        setTiers(Object.fromEntries((body?.tiers ?? []).map((t: TierCard) => [t.id, t])));
      })
      .catch(() => setCreditBasis(null));
  }, []);

  async function startCheckout(plan: 'creator' | 'pro') {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const body = await res.json().catch(() => null);
      if (res.ok && body?.url) {
        window.location.href = body.url;
        return;
      }
      setMsg(body?.error ?? 'checkout unavailable');
    } catch {
      setMsg('checkout unavailable');
    } finally {
      setBusy(false);
    }
  }

  async function openPortal() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const body = await res.json().catch(() => null);
      if (res.ok && body?.url) {
        window.location.href = body.url;
        return;
      }
      setMsg(body?.error ?? 'portal unavailable');
    } catch {
      setMsg('portal unavailable');
    } finally {
      setBusy(false);
    }
  }

  const planCards = [
    {
      name: tiers?.free?.nameHe ?? 'חינם',
      sub: 'Free',
      price: tiers?.free?.price ?? '₪0',
      plan: null as null,
      features: ['TSX templates', 'kokoro / edge voice', '720p + watermark', `${b.quotas.rendersMax ?? 10} renders/mo`, 'Keeps projects forever'],
      current: b.tier === 'free',
    },
    {
      name: tiers?.creator?.nameHe ?? 'יוצר',
      sub: 'Creator',
      price: tiers?.creator?.price ?? '₪39/חודש',
      plan: 'creator' as const,
      features: ['1080p, no watermark', 'ElevenLabs premium voices', 'AI image generation', 'Talking avatar (photo)', 'Generated SFX + music', 'Ad + kids tracks', '500 credits/mo'],
      current: b.tier === 'creator',
    },
    {
      name: tiers?.pro?.nameHe ?? 'פרו',
      sub: 'Pro',
      price: tiers?.pro?.price ?? '₪99/חודש',
      plan: 'pro' as const,
      features: ['AI video scenes', 'Vox collage explainers', 'Premium talking avatar (digital twin)', 'AI image + audio', 'Priority queue', 'Rollover'],
      current: b.tier === 'pro',
    },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink">Billing & credits</h1>
        <p className="text-sm text-muted">
          {b.tier === 'free' ? 'You are on the Free plan.' : `You are on the ${b.tier} plan.`}{' '}
          Balance: <span className="font-semibold text-ink">{b.creditsBalance} ⚡</span>
          {b.tier !== 'free' && b.currentPeriodEnd && (
            <span className="text-muted"> · renews {new Date(b.currentPeriodEnd).toLocaleDateString()}</span>
          )}
        </p>
        <p className="mt-1 text-xs text-muted">מחירים בשקלים חדשים · Pricing in Israeli shekels (₪)</p>
      </div>

      {msg && (
        <div className="mb-4 rounded-lg bg-warn/15 p-3 text-xs text-warn">{msg}</div>
      )}

      {/* Plan cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {planCards.map((p) => (
          <div
            key={p.name}
            className={`rounded-card border bg-paper p-5 ${
              p.current ? 'border-accent ring-2 ring-accent/20' : 'border-line'
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-ink">
                {p.name}
                <span className="ml-2 text-xs font-normal text-muted">{p.sub}</span>
              </h3>
              {p.current && (
                <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent">
                  Current
                </span>
              )}
            </div>
            <p className="mt-1 font-display text-xl font-bold text-accent">{p.price}</p>
            <ul className="mt-3 space-y-1.5 text-xs text-muted">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-1.5">
                  <span className="mt-0.5 text-signal">✓</span> {f}
                </li>
              ))}
            </ul>
            <div className="mt-4">
              {p.current && b.tier !== 'free' && (
                <Button variant="outline" size="sm" className="w-full" onClick={() => void openPortal()} disabled={busy}>
                  Manage
                </Button>
              )}
              {!p.current && p.plan && (
                <Button variant="signal" size="sm" className="w-full" onClick={() => void startCheckout(p.plan!)} disabled={busy}>
                  {b.tier === 'free' ? 'Upgrade' : 'Switch plan'}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Cancel action */}
      {b.tier !== 'free' && (
        <div className="mt-4 flex items-center justify-between rounded-card border border-line bg-paper p-4">
          <div>
            <p className="text-sm font-semibold text-ink">Cancel subscription</p>
            <p className="text-xs text-muted">
              One-click cancel in the portal. Your projects and leftover credits are kept forever.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void openPortal()} disabled={busy}>
            Cancel
          </Button>
        </div>
      )}

      {/* Pricing explainer */}
      <div className="mt-8 rounded-card border border-line bg-paper p-5">
        <h2 className="font-display text-lg font-bold text-ink">Transparent flat pricing</h2>
        <p className="mt-1 text-xs text-muted">
          1 credit ≈ $0.01 of our cost. You see the exact cost upfront before any render — no credit
          surprises.
        </p>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="py-2">Item</th>
              <th className="py-2 text-right">Credits</th>
            </tr>
          </thead>
          <tbody>
            {(creditBasis ? pricingRows(creditBasis) : CREDIT_TABLE).map((row) => (
              <tr key={row.item} className="border-b border-line/60">
                <td className="py-2 text-ink">{row.item}</td>
                <td className="py-2 text-right font-mono text-ink">{row.cost}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 rounded-lg bg-signal/10 p-3 text-xs font-medium text-signal">
          Failed renders are always free — credits are auto-refunded. Failed AI generations are
          never charged.
        </p>
        <Link href="/dashboard" className="mt-3 inline-block text-xs font-medium text-accent hover:underline">
          ← Back to dashboard
        </Link>
      </div>

      {/* Credit ledger */}
      <div className="mt-8">
        <h2 className="mb-2 font-display text-lg font-bold text-ink">Credit ledger</h2>
        {!ledger ? (
          <p className="text-xs text-muted">Loading…</p>
        ) : ledger.length === 0 ? (
          <p className="rounded-card border border-line bg-paper p-4 text-xs text-muted">
            No activity yet. Renders show their reserve, charge, and refunds here.
          </p>
        ) : (
          <div className="overflow-hidden rounded-card border border-line bg-paper">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-cream text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Reason</th>
                  <th className="px-3 py-2 text-right">Delta</th>
                  <th className="px-3 py-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((r) => (
                  <tr key={r.id} className="border-b border-line/60">
                    <td className="px-3 py-2 text-xs text-muted">
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-ink">{r.reason}</td>
                    <td className={`px-3 py-2 text-right font-mono text-xs ${r.delta >= 0 ? 'text-signal' : 'text-ink'}`}>
                      {r.delta >= 0 ? `+${r.delta}` : r.delta}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-ink">{r.balanceAfter}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
