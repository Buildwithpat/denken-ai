'use client';

/**
 * PrepInsightGate — intelligent premium conversion surface.
 *
 * Shown when a user hits the free trial limit. Instead of a generic paywall,
 * it shows personalized preparation insights: roadmap continuation preview,
 * top weak topics, AI mentor teaser, and preparation momentum before the CTA.
 *
 * This is the primary upgrade conversion surface for Denken AI.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { X, Zap, TrendingDown, MapPin, Bot, Lock } from 'lucide-react';
import { useAccess } from '@/context/AccessContext';
import { trackEvent } from '@/lib/trackEvent';
import type { WeakTopic } from '@/lib/analyticsApi';

interface Props {
  onClose: () => void;
  /** Context that explains WHY the gate appeared */
  trigger?: 'test_limit' | 'revision_limit' | 'feature_lock' | 'mentor_gate';
  /** Personalisation data — pass what you have, rest is hidden */
  weakTopics?:     WeakTopic[];
  currentStreak?:  number;
  testsTaken?:     number;
  avgAccuracy?:    number;
  roadmapPhase?:   string;
}

const PLANS = [
  { id: 'monthly',  label: '1 Month',  price: '₹449',  per: '/mo',    badge: null          },
  { id: 'quarter',  label: '3 Months', price: '₹1,287', per: '/3 mo', badge: '₹429/mo'    },
  { id: 'biannual', label: '6 Months', price: '₹2,514', per: '/6 mo', badge: '₹419/mo ✦'  },
] as const;

type PlanId = typeof PLANS[number]['id'];

const TRIGGER_COPY: Record<NonNullable<Props['trigger']>, { title: string; sub: string }> = {
  test_limit:     { title: 'Your free test is complete',       sub: 'Continue your preparation with a subscription.' },
  revision_limit: { title: 'Your free revision is complete',   sub: 'Access unlimited revisions with a subscription.' },
  feature_lock:   { title: 'This feature requires a plan',     sub: 'Unlock the full Denken AI experience.' },
  mentor_gate:    { title: 'AI Mentor requires a plan',        sub: 'Get unlimited mentor sessions with a subscription.' },
};

export default function PrepInsightGate({
  onClose,
  trigger = 'test_limit',
  weakTopics     = [],
  currentStreak  = 0,
  testsTaken     = 0,
  avgAccuracy    = 0,
  roadmapPhase,
}: Props) {
  const router  = useRouter();
  const { access } = useAccess();

  const testsUsed  = access?.usage.testsUsed  ?? testsTaken;
  const copy       = TRIGGER_COPY[trigger];
  const topWeak    = weakTopics.slice(0, 3);
  const hasInsights = topWeak.length > 0 || avgAccuracy > 0 || currentStreak > 0;

  useEffect(() => {
    trackEvent('prep_insight_gate_shown', { trigger, testsUsed });
  }, [trigger, testsUsed]);

  function handleUpgrade(planId: PlanId) {
    trackEvent('checkout_started', { trigger, planId });
    onClose();
    router.push(`/pricing?plan=${planId}`);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 16 }}
        transition={{ duration: 0.24, ease: 'easeOut' }}
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-[#0D0F16] shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4 border-b border-white/[0.06]">
          <div className="pointer-events-none absolute -top-8 -right-8 h-32 w-32 rounded-full bg-[#8762F7] opacity-[0.12] blur-2xl" />
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-white/25 transition-colors hover:text-white/60"
          >
            <X size={16} />
          </button>

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#8762F7]/30 bg-[#8762F7]/15">
              <Lock size={18} className="text-[#8762F7]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">{copy.title}</h2>
              <p className="mt-0.5 text-xs text-white/45">{copy.sub}</p>
            </div>
          </div>
        </div>

        {/* Personalised preparation insights */}
        {hasInsights && (
          <div className="px-6 py-4 border-b border-white/[0.06]">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-white/30">
              Your preparation snapshot
            </p>

            <div className="space-y-2.5">
              {/* Weak topics preview */}
              {topWeak.length > 0 && (
                <div className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-3.5 py-3">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown size={12} className="text-rose-400" />
                    <span className="text-[11px] font-medium text-white/70">Topics needing attention</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {topWeak.map((t) => (
                      <span
                        key={t.topic}
                        className="rounded-md border border-rose-500/20 bg-rose-500/[0.08] px-2 py-0.5 text-[10px] text-rose-300"
                      >
                        {t.topic}
                      </span>
                    ))}
                    {weakTopics.length > 3 && (
                      <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/35">
                        +{weakTopics.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Roadmap phase */}
              {roadmapPhase && (
                <div className="flex items-center gap-2.5 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3.5 py-2.5">
                  <MapPin size={12} className="text-[#8762F7] shrink-0" />
                  <div>
                    <p className="text-[11px] text-white/65">
                      Roadmap phase: <span className="text-white/85 font-medium capitalize">{roadmapPhase.replace(/-/g, ' ')}</span>
                    </p>
                    <p className="text-[10px] text-white/35">Subscribe to continue your personalised roadmap.</p>
                  </div>
                </div>
              )}

              {/* Stats row */}
              {(currentStreak > 0 || avgAccuracy > 0) && (
                <div className="grid grid-cols-2 gap-2">
                  {avgAccuracy > 0 && (
                    <div className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2">
                      <p className="text-[10px] text-white/35">Avg accuracy</p>
                      <p className="text-sm font-bold text-white">{avgAccuracy}%</p>
                    </div>
                  )}
                  {currentStreak > 0 && (
                    <div className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2">
                      <p className="text-[10px] text-white/35">Prep streak</p>
                      <p className="text-sm font-bold text-white">{currentStreak} days</p>
                    </div>
                  )}
                </div>
              )}

              {/* Mentor teaser */}
              <div className="flex items-start gap-2.5 rounded-lg border border-[#8762F7]/15 bg-[#8762F7]/[0.05] px-3.5 py-2.5">
                <Bot size={12} className="text-[#8762F7] mt-0.5 shrink-0" />
                <p className="text-[11px] text-white/55 leading-relaxed">
                  Your AI mentor has identified{' '}
                  <span className="text-white/80">
                    {topWeak.length > 0 ? `patterns in ${topWeak[0]?.subject ?? 'your weak areas'}` : 'preparation patterns'}
                  </span>
                  {' '}and has a personalised study plan ready — subscribe to unlock it.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Plan selection */}
        <div className="px-6 py-4">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-white/30">
            Choose your plan
          </p>
          <div className="space-y-2">
            {PLANS.map((plan) => (
              <button
                key={plan.id}
                onClick={() => handleUpgrade(plan.id)}
                className="group flex w-full cursor-pointer items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-left transition-all hover:border-[#8762F7]/40 hover:bg-[#8762F7]/[0.06]"
              >
                <div>
                  <p className="text-sm font-medium text-white/85 group-hover:text-white">{plan.label}</p>
                  {plan.badge && (
                    <p className="text-[10px] text-[#8762F7]">{plan.badge} effective</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-white">{plan.price}</p>
                  <p className="text-[10px] text-white/35">{plan.per}</p>
                </div>
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              trackEvent('checkout_started', { trigger, planId: 'monthly', source: 'main_cta' });
              onClose();
              router.push('/pricing');
            }}
            className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#8762F7] to-[#6D4AFF] py-3 text-sm font-semibold text-white shadow-[0_0_24px_rgba(135,98,247,0.30)] transition-all hover:brightness-110"
          >
            <Zap size={14} />
            Subscribe to DenkenAI Pro
          </button>

          <p className="mt-2 text-center text-[10px] text-white/25">
            Cancel anytime · Secure payment via Razorpay
          </p>
        </div>
      </motion.div>
    </div>
  );
}
