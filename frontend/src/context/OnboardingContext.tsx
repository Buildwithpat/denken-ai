'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export type ExamType    = 'jee' | 'neet' | 'cbse' | 'custom';
export type JeeVariant  = 'JEE_MAIN' | 'JEE_ADVANCED';

export interface OnboardingData {
  name:         string;
  email:        string;
  mobile:       string;
  avatar:       string;
  examType:     ExamType | null;
  targetYear:   string;
  currentClass: string;
  prepLevel:    string;
  subjects:     string[];
  examName:     string;
  /** JEE users only: which exam variant is active. Persists globally. */
  jeeVariant:   JeeVariant;
}

const DEFAULTS: OnboardingData = {
  name:         '',
  email:        '',
  mobile:       '',
  avatar:       '',
  examType:     null,
  targetYear:   '',
  currentClass: '',
  prepLevel:    '',
  subjects:     ['', '', ''],
  examName:     '',
  jeeVariant:   'JEE_MAIN',
};

const LS_KEY = 'denken_onboarding';

interface Ctx {
  data: OnboardingData;
  loaded: boolean;
  set: <K extends keyof OnboardingData>(k: K, v: OnboardingData[K]) => void;
  reset: () => void;
}

const OnboardingCtx = createContext<Ctx | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<OnboardingData>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setData((p) => ({ ...p, ...JSON.parse(raw) }));
    } catch {}
    setLoaded(true);
  }, []);

  function set<K extends keyof OnboardingData>(k: K, v: OnboardingData[K]) {
    setData((prev) => {
      const next = { ...prev, [k]: v };
      try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  function reset() {
    setData(DEFAULTS);
    try { localStorage.removeItem(LS_KEY); } catch {}
  }

  return (
    <OnboardingCtx.Provider value={{ data, loaded, set, reset }}>
      {children}
    </OnboardingCtx.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingCtx);
  if (!ctx) throw new Error('useOnboarding must be used inside OnboardingProvider');
  return ctx;
}
