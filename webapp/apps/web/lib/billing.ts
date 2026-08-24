'use client';
// useBilling() — the client-side billing state for the top-bar meter + every paid gate.
// Derived from GET /api/billing/me. Cached per-session, refetchable.
import { useCallback, useEffect, useState } from 'react';

export type Tier = 'free' | 'creator' | 'pro';

export interface Billing {
  tier: Tier;
  status: string;
  currentPeriodEnd: string | null;
  creditsBalance: number;
  creditsGranted: number;
  quotas: { rendersUsed: number; rendersMax: number | null };
}

export interface BillingDerived extends Billing {
  loading: boolean;
  /** Paid gates */
  isPaid: boolean;
  canAiImages: boolean;
  can1080: boolean;
  canEleven: boolean;
  refetch: () => Promise<void>;
}

const FREE_DEFAULT: Billing = {
  tier: 'free',
  status: 'active',
  currentPeriodEnd: null,
  creditsBalance: 0,
  creditsGranted: 0,
  quotas: { rendersUsed: 0, rendersMax: 10 },
};

export function useBilling(): BillingDerived {
  const [billing, setBilling] = useState<Billing>(FREE_DEFAULT);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch('/api/billing/me');
      if (res.ok) {
        const body = (await res.json()) as Billing;
        setBilling(body);
      }
    } catch {
      /* keep last-known billing state on transient failure */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const isPaid = billing.tier !== 'free';
  return {
    ...billing,
    loading,
    isPaid,
    canAiImages: isPaid,
    can1080: isPaid,
    canEleven: isPaid,
    refetch,
  };
}
