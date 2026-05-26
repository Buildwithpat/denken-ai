'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bug, ChevronUp, ChevronDown, RefreshCw, Check } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { setPersona } from '@/lib/devApi';
import { api } from '@/lib/api';
import { setStoredUser, clearSessionState } from '@/lib/auth';
import type { Entitlements } from '@/lib/subscriptionApi';

// ── Persona catalog (mirrors backend) ────────────────────────────────────────

const PERSONAS = [
  { id: 'fresh-user',     label: 'Fresh User',      description: 'Onboarding incomplete',             color: 'bg-white/10 hover:bg-white/[0.15]'           },
  { id: 'free-demo',      label: 'Free Demo',        description: '0/1 test · 0/1 revision',           color: 'bg-sky-500/15 hover:bg-sky-500/25'           },
  { id: 'free-exhausted', label: 'Free Exhausted',   description: '1/1 test · 1/1 revision (full)',    color: 'bg-amber-500/15 hover:bg-amber-500/25'       },
  { id: 'pro-active',     label: 'Pro Active',       description: '30 days remaining',                 color: 'bg-emerald-500/15 hover:bg-emerald-500/25'  },
  { id: 'pro-grace',      label: 'Pro Grace',        description: 'Ended 1 day ago (in grace window)', color: 'bg-yellow-500/15 hover:bg-yellow-500/25'    },
  { id: 'pro-expired',    label: 'Pro Expired',      description: 'Ended 4 days ago (past grace)',     color: 'bg-red-500/15 hover:bg-red-500/25'          },
] as const;

type PersonaId = typeof PERSONAS[number]['id'];

// ── Status label helpers ──────────────────────────────────────────────────────

function statusColor(status: string | undefined): string {
  switch (status) {
    case 'active':       return 'text-emerald-400';
    case 'grace_period': return 'text-yellow-400';
    case 'expired':      return 'text-red-400';
    case 'cancelled':    return 'text-red-400/70';
    default:             return 'text-white/40';
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DevPersonaPanel() {
  const { user, isAuthenticated } = useAuth();

  const [isOpen,      setIsOpen]      = useState(false);
  const [applying,    setApplying]    = useState<PersonaId | null>(null);
  const [lastApplied, setLastApplied] = useState<PersonaId | null>(null);
  const [ents,        setEnts]        = useState<Entitlements | null>(null);
  const [applyError,  setApplyError]  = useState<string | null>(null);

  // Fetch current entitlements whenever the panel opens (or user changes).
  const fetchEnts = useCallback(async () => {
    if (!isAuthenticated) { setEnts(null); return; }
    try {
      const data = await api.get<{ entitlements: Entitlements }>('/access', { auth: true });
      setEnts(data.entitlements);
    } catch {
      setEnts(null);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isOpen) fetchEnts();
  }, [isOpen, fetchEnts]);

  const handleSetPersona = useCallback(async (personaId: PersonaId) => {
    setApplying(personaId);
    setApplyError(null);
    try {
      const result = await setPersona(personaId);
      // Persist to localStorage only — do NOT call updateUser() here.
      // updateUser() would mutate AuthContext.user mid-flight, triggering
      // AuthGuard.useEffect (which depends on `user`) before the reload
      // can stabilize state, causing competing router.replace + reload races.
      // The reload below re-hydrates AuthContext cleanly from localStorage.
      setStoredUser({ ...result.user });
      clearSessionState();
      setLastApplied(personaId);
      window.location.reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setApplyError(msg);
      setApplying(null);
    }
  }, []);

  const endsAt = ents?.subscriptionEndsAt
    ? new Date(ents.subscriptionEndsAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
    : null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] select-none font-mono text-xs">
      {/* Expanded panel */}
      {isOpen && (
        <div className="mb-2 w-72 overflow-hidden rounded-xl border border-white/15 bg-[#0B0E14]/95 shadow-2xl backdrop-blur-md">

          {/* Header row */}
          <div className="flex items-center justify-between border-b border-white/10 bg-[#8762F7]/10 px-3 py-2">
            <span className="font-semibold tracking-wide text-[#8762F7]">DEV PERSONA</span>
            {isAuthenticated ? (
              <span className={`font-medium ${statusColor(ents?.status)}`}>
                {ents ? `${ents.plan} · ${ents.status}` : '…'}
              </span>
            ) : (
              <span className="text-white/30">not signed in</span>
            )}
          </div>

          {/* Current state summary */}
          {isAuthenticated && ents && (
            <div className="space-y-0.5 border-b border-white/[0.06] px-3 py-2 text-white/40">
              <div className="flex justify-between">
                <span>tests</span>
                <span>{ents.testsUsed} / {ents.testsLimit ?? '∞'}</span>
              </div>
              <div className="flex justify-between">
                <span>revisions</span>
                <span>{ents.revisionsUsed} / {ents.revisionsLimit ?? '∞'}</span>
              </div>
              <div className="flex justify-between">
                <span>onboarding</span>
                <span className={user?.onboardingComplete ? 'text-emerald-400/70' : 'text-amber-400/70'}>
                  {user?.onboardingComplete ? '✓ done' : '✗ pending'}
                </span>
              </div>
              {endsAt && (
                <div className="flex justify-between">
                  <span>sub ends</span>
                  <span>{endsAt}</span>
                </div>
              )}
            </div>
          )}

          {/* Persona buttons */}
          <div className="space-y-1 p-2">
            {PERSONAS.map((p) => {
              const isBusy = applying === p.id;
              const isDone = lastApplied === p.id && !applying;
              return (
                <button
                  key={p.id}
                  onClick={() => handleSetPersona(p.id)}
                  disabled={!!applying || !isAuthenticated}
                  className={[
                    'flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left transition-all duration-150 disabled:opacity-40',
                    p.color,
                    isDone ? 'ring-1 ring-white/25' : '',
                  ].join(' ')}
                >
                  <div>
                    <div className="font-medium text-white/80">{p.label}</div>
                    <div className="text-[10px] text-white/35">{p.description}</div>
                  </div>
                  {isBusy && <RefreshCw size={12} className="shrink-0 animate-spin text-white/50" />}
                  {isDone  && <Check size={12} className="shrink-0 text-emerald-400" />}
                </button>
              );
            })}
          </div>

          {applyError && (
            <div className="mx-2 mb-1 rounded-md bg-red-500/15 px-2 py-1.5 text-[10px] text-red-400">
              {applyError}
            </div>
          )}

          <div className="border-t border-white/[0.06] px-3 py-1.5 text-center text-[10px] text-white/20">
            DEV MODE — never active in production
          </div>
        </div>
      )}

      {/* Toggle pill */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-[#8762F7]/35 bg-[#8762F7]/15 px-3 py-1.5 text-[#8762F7]/75 shadow-lg backdrop-blur-sm transition-all duration-150 hover:bg-[#8762F7]/25 hover:text-[#8762F7]"
      >
        <Bug size={13} />
        <span className="font-semibold">DEV</span>
        {isOpen ? <ChevronDown size={11} /> : <ChevronUp size={11} />}
      </button>
    </div>
  );
}
