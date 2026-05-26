'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  CreditCard, Zap, Clock, AlertTriangle, CheckCircle2,
  XCircle, RefreshCw, ChevronDown, ChevronUp, X,
} from 'lucide-react';
import {
  getSubscription,
  getSubscriptionHistory,
  cancelSubscription,
  type Entitlements,
  type SubscriptionHistoryEntry,
  type Plan,
  type SubscriptionStatus,
} from '@/lib/subscriptionApi';

// ── Display helpers ───────────────────────────────────────────────────────────

const PLAN_LABEL: Record<Plan, string> = {
  free: 'Free',
  pro:  'Pro',
};

const STATUS_META: Record<SubscriptionStatus, {
  label: string;
  color: string;
  bg:    string;
  icon:  typeof CheckCircle2;
}> = {
  none:         { label: 'Inactive',     color: 'text-white/40',       bg: 'bg-white/[0.05] border-white/[0.08]',         icon: XCircle       },
  active:       { label: 'Active',       color: 'text-[#22c55e]',      bg: 'bg-[#22c55e]/10 border-[#22c55e]/25',         icon: CheckCircle2  },
  grace_period: { label: 'Grace Period', color: 'text-[#f59e0b]',      bg: 'bg-[#f59e0b]/10 border-[#f59e0b]/25',         icon: Clock         },
  expired:      { label: 'Expired',      color: 'text-[#ef4444]',      bg: 'bg-[#ef4444]/10 border-[#ef4444]/25',         icon: XCircle       },
  cancelled:    { label: 'Cancelled',    color: 'text-white/40',       bg: 'bg-white/[0.05] border-white/[0.08]',         icon: XCircle       },
};

const EVENT_META: Record<string, { label: string; dot: string }> = {
  activated: { label: 'Subscription started', dot: 'bg-[#22c55e]' },
  renewed:   { label: 'Renewed',              dot: 'bg-[#22c55e]' },
  cancelled: { label: 'Cancelled',            dot: 'bg-[#ef4444]' },
  expired:   { label: 'Expired',              dot: 'bg-white/25'  },
};

function fmt(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-white/30">
      {children}
    </p>
  );
}

// ── Cancel confirmation modal ─────────────────────────────────────────────────

function CancelModal({
  endsAt,
  loading,
  onConfirm,
  onClose,
}: {
  endsAt:    string | null;
  loading:   boolean;
  onConfirm: () => void;
  onClose:   () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-sm rounded-2xl border border-white/10 bg-[#0F1117] p-6"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-white/30 hover:text-white/70"
        >
          <X size={15} />
        </button>

        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-[#ef4444]/25 bg-[#ef4444]/10">
          <AlertTriangle size={18} className="text-[#ef4444]" />
        </div>

        <h3 className="text-sm font-semibold text-white">Cancel subscription?</h3>
        <p className="mt-2 text-xs leading-relaxed text-white/50">
          You will lose access to Pro features immediately after cancelling.
          {endsAt && (
            <> Your current period ends on <span className="text-white/80">{fmt(endsAt)}</span>.</>
          )}
        </p>

        <div className="mt-5 flex gap-2.5">
          <button
            onClick={onClose}
            className="flex-1 cursor-pointer rounded-lg border border-white/10 py-2.5 text-sm text-white/55 transition-colors hover:border-white/20 hover:text-white/85"
          >
            Keep plan
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 cursor-pointer rounded-lg bg-[#ef4444]/80 py-2.5 text-sm font-medium text-white transition-all hover:bg-[#ef4444] disabled:opacity-60"
          >
            {loading ? 'Cancelling…' : 'Yes, cancel'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BillingCard() {
  const router = useRouter();

  const [ents,         setEnts]         = useState<Entitlements | null>(null);
  const [history,      setHistory]      = useState<SubscriptionHistoryEntry[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [showHistory,  setShowHistory]  = useState(false);
  const [showCancel,   setShowCancel]   = useState(false);
  const [cancelling,   setCancelling]   = useState(false);
  const [cancelDone,   setCancelDone]   = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [e, h] = await Promise.all([
        getSubscription(),
        getSubscriptionHistory(10),
      ]);
      setEnts(e);
      setHistory(h.history);
    } catch {
      setError('Could not load billing information.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCancel() {
    setCancelling(true);
    try {
      await cancelSubscription();
      setCancelDone(true);
      setShowCancel(false);
      await load();
    } catch {
      setError('Failed to cancel subscription. Please try again.');
    } finally {
      setCancelling(false);
    }
  }

  // ── Loading skeleton ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6">
        <div className="mb-5 h-3 w-24 animate-pulse rounded bg-white/[0.06]" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-white/[0.04]" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !ents) {
    return (
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6">
        <SectionLabel>Subscription</SectionLabel>
        <p className="text-xs text-white/35">{error ?? 'No subscription data available.'}</p>
      </div>
    );
  }

  const statusMeta  = STATUS_META[ents.status];
  const StatusIcon  = statusMeta.icon;
  const planLabel   = PLAN_LABEL[ents.plan];
  const isActive    = ents.status === 'active' || ents.status === 'grace_period';
  const isPaid      = ents.plan === 'pro';
  const isFree      = ents.plan === 'free';
  const isCancelled = ents.status === 'cancelled';
  const isExpired   = ents.status === 'expired';

  const activeEndsAt    = ents.subscriptionEndsAt;
  const remainingDays   = ents.remainingDays;
  const cycleDays       = ents.billingCycleDays;
  const progressPct     = (cycleDays > 0 && remainingDays != null)
    ? Math.max(0, Math.min(100, (remainingDays / cycleDays) * 100))
    : null;

  return (
    <>
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6">
        <SectionLabel>Subscription & Billing</SectionLabel>

        {/* Plan + status row */}
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#8762F7]/25 bg-[#8762F7]/10">
              <CreditCard size={15} className="text-[#8762F7]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{planLabel}</p>
              <p className="text-[11px] text-white/35">
                {isFree ? '1 demo test · 1 demo revision' : '₹449–₹2,514 / cycle'}
              </p>
            </div>
          </div>
          <span className={[
            'flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold',
            statusMeta.bg, statusMeta.color,
          ].join(' ')}>
            <StatusIcon size={10} />
            {statusMeta.label}
          </span>
        </div>

        {/* Cancelled notice */}
        {(isCancelled || cancelDone) && (
          <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-[#f59e0b]/20 bg-[#f59e0b]/[0.05] px-3 py-2.5">
            <AlertTriangle size={13} className="mt-0.5 shrink-0 text-[#f59e0b]/70" />
            <p className="text-[11px] leading-relaxed text-[#f59e0b]/80">
              Subscription cancelled.
              {activeEndsAt && <> Access continues until {fmt(activeEndsAt)}.</>}
            </p>
          </div>
        )}

        {/* Grace period notice */}
        {ents.status === 'grace_period' && (
          <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-[#f59e0b]/20 bg-[#f59e0b]/[0.05] px-3 py-2.5">
            <Clock size={13} className="mt-0.5 shrink-0 text-[#f59e0b]/70" />
            <p className="text-[11px] leading-relaxed text-[#f59e0b]/80">
              Your subscription has lapsed. You are in a 3-day grace period — renew to avoid losing access.
            </p>
          </div>
        )}

        {/* Dates */}
        {!isFree && (
          <div className="mb-5 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3">
              <p className="mb-1 text-[10px] text-white/30">Started</p>
              <p className="text-xs font-medium text-white/75">
                {fmt(ents.subscriptionStartedAt)}
              </p>
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3">
              <p className="mb-1 text-[10px] text-white/30">
                {isCancelled || isExpired ? 'Ended' : 'Expires'}
              </p>
              <p className="text-xs font-medium text-white/75">{fmt(activeEndsAt)}</p>
            </div>
          </div>
        )}

        {/* Remaining days bar */}
        {isActive && remainingDays != null && progressPct != null && (
          <div className="mb-5">
            <div className="mb-2 flex items-center justify-between text-[11px]">
              <span className="text-white/40">Time remaining</span>
              <span className={[
                'font-semibold tabular-nums',
                remainingDays <= 3 ? 'text-[#ef4444]' : remainingDays <= 7 ? 'text-[#f59e0b]' : 'text-white/70',
              ].join(' ')}>
                {remainingDays} day{remainingDays !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
              <div
                className={[
                  'h-full rounded-full transition-all duration-700',
                  remainingDays <= 3 ? 'bg-[#ef4444]' : remainingDays <= 7 ? 'bg-[#f59e0b]' : 'bg-[#8762F7]',
                ].join(' ')}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="mt-1.5 text-[10px] text-white/25">
              {cycleDays}-day billing cycle · expires {fmt(activeEndsAt)}
            </p>
          </div>
        )}

        {/* CTAs */}
        <div className="flex flex-wrap gap-2">
          {(isFree || isExpired || isCancelled) && (
            <button
              onClick={() => router.push('/pricing')}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#8762F7] to-[#6D4AFF] px-4 py-2 text-xs font-medium text-white transition-all hover:brightness-110"
            >
              <Zap size={12} />
              Subscribe to Pro
            </button>
          )}
          {(isPaid && (isActive || ents.status === 'grace_period') && !isCancelled) && (
            <button
              onClick={() => router.push('/pricing')}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#8762F7]/30 bg-[#8762F7]/12 px-4 py-2 text-xs font-medium text-[#8762F7] transition-colors hover:bg-[#8762F7]/22"
            >
              <RefreshCw size={12} />
              Renew
            </button>
          )}
          {isActive && !isFree && !isCancelled && (
            <button
              onClick={() => setShowCancel(true)}
              className="cursor-pointer rounded-lg border border-white/[0.08] px-4 py-2 text-xs text-white/40 transition-colors hover:border-[#ef4444]/30 hover:text-[#ef4444]/80"
            >
              Cancel subscription
            </button>
          )}
        </div>

        {/* History toggle */}
        {history.length > 0 && (
          <div className="mt-6 border-t border-white/[0.05] pt-5">
            <button
              onClick={() => setShowHistory(v => !v)}
              className="flex w-full cursor-pointer items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-white/30 hover:text-white/55 transition-colors"
            >
              <span>Billing History</span>
              {showHistory ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>

            {showHistory && (
              <div className="mt-3 space-y-2">
                {history.map((entry) => {
                  const meta = EVENT_META[entry.event];
                  return (
                    <div
                      key={entry.id}
                      className="flex items-start gap-3 rounded-lg border border-white/[0.05] px-3 py-2.5"
                    >
                      <span className={['mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', meta.dot].join(' ')} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-medium text-white/70">{meta.label}</p>
                          <span className="shrink-0 rounded border border-white/[0.07] px-1.5 py-0.5 text-[9px] font-semibold uppercase text-white/30">
                            {PLAN_LABEL[entry.plan]}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-white/30">
                          <span>{fmt(entry.createdAt)}</span>
                          {entry.periodEnd && (
                            <>
                              <span>·</span>
                              <span>until {fmt(entry.periodEnd)}</span>
                            </>
                          )}
                          {entry.amountPaid != null && entry.amountPaid > 0 && (
                            <>
                              <span>·</span>
                              <span className="text-[#22c55e]/70">
                                ₹{entry.amountPaid}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {showCancel && (
        <CancelModal
          endsAt={activeEndsAt}
          loading={cancelling}
          onConfirm={handleCancel}
          onClose={() => setShowCancel(false)}
        />
      )}
    </>
  );
}
