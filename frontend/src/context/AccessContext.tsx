'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { api } from '@/lib/api';
import type { Entitlements, FeatureName } from '@/lib/subscriptionApi';

interface FeatureAccess {
  label:           string;
  allowed:         boolean;
  upgradeRequired: boolean;
}

interface UsageInfo {
  testsUsed:          number;
  testsLimit:         number | null;
  revisionsUsed:      number;
  revisionsLimit:     number | null;
  testsExhausted:     boolean;
  revisionsExhausted: boolean;
}

interface AccessData {
  entitlements: Entitlements;
  usage:        UsageInfo;
  features:     Record<FeatureName, FeatureAccess>;
  upgradeUrl:   string;
}

interface AccessCtx {
  access:             AccessData | null;
  isLoading:          boolean;
  /** True when the user has an active pro subscription (including grace period). */
  isPro:              boolean;
  testsExhausted:     boolean;
  revisionsExhausted: boolean;
  /** Returns false while loading — callers should treat isLoading as gating in UX. */
  canUseFeature:      (f: FeatureName) => boolean;
  /** Re-fetch after a purchase or quota change. */
  refresh:            () => Promise<void>;
}

const AccessContext = createContext<AccessCtx | null>(null);

export function AccessProvider({ children }: { children: ReactNode }) {
  const [access,    setAccess]    = useState<AccessData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await api.get<AccessData>('/access', { auth: true });
      setAccess(data);
    } catch {
      // Non-fatal — downstream components fall back to the most-restrictive defaults.
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const ents     = access?.entitlements;
  const isActive = ents?.status === 'active' || ents?.status === 'grace_period';
  const isPro    = (ents?.plan === 'pro') && isActive;

  const testsExhausted     = access?.usage.testsExhausted     ?? false;
  const revisionsExhausted = access?.usage.revisionsExhausted ?? false;

  function canUseFeature(f: FeatureName): boolean {
    return access?.features[f]?.allowed ?? false;
  }

  return (
    <AccessContext.Provider value={{
      access,
      isLoading,
      isPro,
      testsExhausted,
      revisionsExhausted,
      canUseFeature,
      refresh: load,
    }}>
      {children}
    </AccessContext.Provider>
  );
}

export function useAccess(): AccessCtx {
  const ctx = useContext(AccessContext);
  if (!ctx) throw new Error('useAccess must be used inside AccessProvider');
  return ctx;
}
