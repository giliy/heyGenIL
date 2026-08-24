'use client';
// Top-bar credit meter — a pill showing ⚡ balance + tier badge + monthly render quota.
// Click → /billing. Uses useBilling() (GET /api/billing/me). Polls every 5s so the meter
// reflects render/generate deductions in near-real-time.
import { useEffect } from 'react';
import Link from 'next/link';
import { useBilling } from '@/lib/billing';

export function CreditMeter() {
  const b = useBilling();

  // Light polling so the meter updates after a render/generate without a full reload.
  useEffect(() => {
    const t = setInterval(() => void b.refetch(), 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tierBadge =
    b.tier === 'free'
      ? { label: 'Free', cls: 'bg-cream text-muted' }
      : b.tier === 'creator'
        ? { label: 'Creator', cls: 'bg-accent/15 text-accent' }
        : { label: 'Pro', cls: 'bg-accent-2/15 text-accent-2' };

  return (
    <Link
      href="/billing"
      className="flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1.5 transition-colors hover:border-accent/50 hover:bg-cream"
      title="Billing & credits"
    >
      <span className="flex items-center gap-1 font-display text-sm font-bold text-ink">
        <span className="text-accent">⚡</span>
        {b.loading ? '…' : b.creditsBalance}
      </span>
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tierBadge.cls}`}>
        {tierBadge.label}
      </span>
      {b.tier === 'free' && b.quotas.rendersMax != null && (
        <span className="text-[11px] text-muted">
          {b.quotas.rendersUsed}/{b.quotas.rendersMax} renders
        </span>
      )}
    </Link>
  );
}
