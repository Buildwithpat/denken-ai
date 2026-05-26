'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check, Zap, BookOpen, BarChart3,
  FileText, Scan, AlertCircle, Loader2,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  getSubscription,
  createOrder,
  verifyPayment,
  type Entitlements,
} from '@/lib/subscriptionApi';
import { ApiError } from '@/lib/api';
import ParticlesBackground from '@/components/ui/ParticlesBackground';
import { useRazorpay, type RazorpayCheckoutResponse } from '@/hooks/useRazorpay';
import { trackEvent } from '@/lib/trackEvent';

// ── Plan definitions ──────────────────────────────────────────────────────────

interface PaidPlan {
  id:       string;
  label:    string;
  price:    number;
  perMonth: number;
  saving:   number | null;
  badge:    string | null;
  featured: boolean;
}

const PAID_PLANS: PaidPlan[] = [
  {
    id:       'pro_1m',
    label:    '1 Month',
    price:    449,
    perMonth: 449,
    saving:   null,
    badge:    null,
    featured: false,
  },
  {
    id:       'pro_3m',
    label:    '3 Months',
    price:    1287,
    perMonth: 429,
    saving:   4,
    badge:    'Most Popular',
    featured: true,
  },
  {
    id:       'pro_6m',
    label:    '6 Months',
    price:    2514,
    perMonth: 419,
    saving:   7,
    badge:    'Best Value',
    featured: false,
  },
];

// ── Feature list ──────────────────────────────────────────────────────────────

const PRO_FEATURES = [
  { icon: Zap,      text: 'Unlimited tests & all exam modes (PYQ, Mistake, Smart)' },
  { icon: BarChart3, text: 'Advanced analytics — weak topics, AI recommendations'  },
  { icon: BookOpen,  text: 'AI revision plans with Ebbinghaus-based prioritization' },
  { icon: FileText,  text: 'Smart Notes — AI-generated topic summaries'            },
  { icon: Scan,      text: 'OCR question scanner (coming soon)'                    },
];

// ── Animations ────────────────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
};
const stagger = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.07 } },
};

// ── Plan card ─────────────────────────────────────────────────────────────────

function PlanCard({
  plan,
  loading,
  onBuy,
  highlighted = false,
}: {
  plan:        PaidPlan;
  loading:     boolean;
  onBuy:       (planId: string) => void;
  highlighted?: boolean;
}) {
  return (
    <div
      className={[
        'relative flex flex-col rounded-2xl border p-6 transition-all duration-200',
        plan.featured || highlighted
          ? 'border-[#8762F7]/50 bg-[#8762F7]/[0.06] shadow-[0_0_48px_rgba(135,98,247,0.12)]'
          : 'border-white/[0.08] bg-white/[0.03] hover:border-white/[0.14]',
      ].join(' ')}
    >
      {/* Badge pill */}
      {plan.badge && (
        <span
          className={[
            'absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-0.5 text-[11px] font-semibold',
            plan.featured ? 'bg-[#8762F7] text-white' : 'bg-white/10 text-white/60',
          ].join(' ')}
        >
          {plan.badge}
        </span>
      )}

      {/* Duration label + savings badge side-by-side */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-white/50">{plan.label}</p>
        {plan.saving !== null && (
          <span className="rounded-md bg-[#22c55e]/10 border border-[#22c55e]/20 px-1.5 py-0.5 text-[10px] font-semibold text-[#22c55e]/90">
            Save {plan.saving}%
          </span>
        )}
      </div>

      {/* Per-month price */}
      <div className="mt-3 flex items-end gap-1.5">
        <span className="text-3xl font-bold text-white">₹{plan.perMonth}</span>
        <span className="mb-1 text-sm text-white/35">/mo</span>
      </div>

      {/* Total / billing note */}
      {plan.saving !== null ? (
        <p className="mt-1 text-xs text-white/40">
          ₹{plan.price} billed once for {plan.label.toLowerCase()}
        </p>
      ) : (
        <p className="mt-1 text-xs text-white/30">Billed ₹{plan.price} monthly</p>
      )}

      {/* Spacer */}
      <div className="mt-5 flex-1" />

      <button
        onClick={() => onBuy(plan.id)}
        disabled={loading}
        className={[
          'mt-4 w-full rounded-lg py-2.5 text-sm font-medium transition-all duration-200',
          plan.featured
            ? 'bg-gradient-to-r from-[#8762F7] to-[#6D4AFF] text-white shadow-[0_0_20px_rgba(135,98,247,0.30)] hover:brightness-110 disabled:opacity-60'
            : 'border border-white/[0.12] bg-white/[0.05] text-white/70 hover:bg-white/[0.08] hover:text-white disabled:opacity-40',
        ].join(' ')}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 size={14} className="animate-spin" />
            Processing…
          </span>
        ) : (
          `Get ${plan.label}`
        )}
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PricingPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoaded, user } = useAuth();
  const { openCheckout } = useRazorpay();

  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [checkLoading, setCheckLoading] = useState(true);
  const [payingPlanId, setPayingPlanId] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [highlightPlan, setHighlightPlan] = useState<string | null>(null);

  // Auto-highlight plan from query param (e.g. /pricing?plan=monthly)
  useEffect(() => {
    const plan = searchParams.get('plan');
    if (plan) setHighlightPlan(plan);
  }, [searchParams]);

  useEffect(() => {
    if (isLoaded && !isAuthenticated) router.replace('/login');
  }, [isLoaded, isAuthenticated, router]);

  useEffect(() => {
    if (!isLoaded || !isAuthenticated) return;

    getSubscription()
      .then((ents) => {
        setEntitlements(ents);
        const isActive = ents.status === 'active' || ents.status === 'grace_period';
        if (isActive) router.replace('/dashboard');
      })
      .catch(() => {})
      .finally(() => setCheckLoading(false));
  }, [isLoaded, isAuthenticated, router]);

  async function handleBuyPlan(planId: string) {
    setPayingPlanId(planId);
    setPaymentError(null);
    trackEvent('checkout_started', { planId, source: 'pricing_page' });

    try {
      const order = await createOrder(planId);

      await openCheckout({
        key:         order.keyId,
        amount:      order.amount as number,
        currency:    order.currency,
        name:        'DenkenAI',
        description: `DenkenAI Pro — ${PAID_PLANS.find((p) => p.id === planId)?.label ?? planId}`,
        order_id:    order.orderId,
        prefill: {
          name:    user?.name,
          email:   user?.email,
          contact: user?.mobileNumber,
        },
        theme: { color: '#8762F7' },
        handler: async (response: RazorpayCheckoutResponse) => {
          try {
            await verifyPayment({
              razorpayOrderId:   response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              planId,
            });
            trackEvent('subscription_activated', { planId });
            router.replace('/dashboard');
          } catch {
            setPaymentError('Payment received but activation failed. Please contact support.');
            setPayingPlanId(null);
          }
        },
        modal: {
          ondismiss: () => setPayingPlanId(null),
        },
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setPaymentError(err.message);
      } else {
        setPaymentError('Could not initiate payment. Please try again.');
      }
      setPayingPlanId(null);
    }
  }

  function handleSkip() {
    router.replace('/dashboard');
  }

  if (!isLoaded || !isAuthenticated || checkLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0B0E14]">
        <Loader2 size={22} className="animate-spin text-[#8762F7]/60" />
      </div>
    );
  }

  const demoExhausted =
    entitlements !== null &&
    entitlements.testsLimit !== null &&
    entitlements.testsUsed >= entitlements.testsLimit;

  return (
    <main className="relative flex min-h-screen flex-col overflow-x-hidden bg-[#0B0E14]">
      <ParticlesBackground />

      <div className="pointer-events-none fixed -left-60 -top-60 h-[480px] w-[480px] rounded-full bg-[#8762F7] opacity-[0.04] blur-3xl" />
      <div className="pointer-events-none fixed -bottom-60 -right-60 h-[480px] w-[480px] rounded-full bg-[#8762F7] opacity-[0.04] blur-3xl" />

      {/* Logo bar */}
      <div className="relative z-20 flex h-12 shrink-0 items-center border-b border-white/[0.06] px-6">
        <Link href="/" className="inline-flex items-center gap-2">
          <Image src="/DenkenLogo.svg" alt="DenkenAI" width={24} height={24} priority />
          <span className="text-sm font-semibold">
            <span className="text-white">Denken</span>
            <span className="text-[#8762F7]">AI</span>
          </span>
        </Link>

        <div className="ml-auto">
          <button
            onClick={handleSkip}
            className="cursor-pointer rounded-md px-3 py-1.5 text-xs text-white/35 transition-colors hover:text-white/60"
          >
            Skip for now
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex-1 px-4 py-12 pb-20">
        <div className="mx-auto max-w-5xl">

          {/* Heading */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="text-center"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#8762F7]/25 bg-[#8762F7]/10 px-3 py-1 text-[11px] font-medium text-[#8762F7]/80">
              <Sparkles size={11} />
              DenkenAI Pro
            </span>

            <h1 className="mt-4 text-3xl font-bold tracking-tight text-white md:text-4xl">
              Unlock the full DenkenAI
            </h1>
            <p className="mx-auto mt-3 max-w-lg text-sm text-white/50">
              {demoExhausted
                ? "You've used your free demo. Subscribe to continue with unlimited tests and all Pro features."
                : "Try 1 free test and 1 free revision. Subscribe for unlimited access to everything."}
            </p>
          </motion.div>

          {/* Payment error */}
          <AnimatePresence>
            {paymentError && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-8 flex items-start gap-2 rounded-lg border border-[#ef4444]/20 bg-[#ef4444]/[0.06] p-3 text-sm text-[#ef4444]/80"
              >
                <AlertCircle size={15} className="mt-0.5 shrink-0" />
                {paymentError}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Plan cards */}
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-3"
          >
            {PAID_PLANS.map((plan) => (
              <motion.div key={plan.id} variants={fadeUp}>
                <PlanCard
                  plan={plan}
                  loading={payingPlanId === plan.id}
                  onBuy={handleBuyPlan}
                  highlighted={highlightPlan === plan.id}
                />
              </motion.div>
            ))}
          </motion.div>

          {/* Pro feature list */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.25 }}
            className="mt-10 rounded-2xl border border-[#8762F7]/15 bg-[#8762F7]/[0.04] p-6"
          >
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-[#8762F7]/60">
              Everything in Pro
            </p>
            <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {PRO_FEATURES.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-2 text-sm text-white/60">
                  <Icon size={14} className="mt-0.5 shrink-0 text-[#8762F7]/70" />
                  {text}
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Feature comparison */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.35 }}
            className="mt-10"
          >
            <p className="mb-5 text-center text-xs uppercase tracking-widest text-white/20">
              Demo vs Pro
            </p>

            <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02]">
              <div className="grid grid-cols-3 border-b border-white/[0.07] px-6 py-3">
                <span className="text-xs font-medium text-white/35">Feature</span>
                <span className="text-center text-xs font-medium text-white/35">Free Demo</span>
                <span className="text-center text-xs font-semibold text-[#8762F7]/80">Pro</span>
              </div>

              {[
                { label: 'Tests',           free: '1 total',      pro: 'Unlimited'    },
                { label: 'AI Revisions',    free: '1 total',      pro: 'Unlimited'    },
                { label: 'Test Modes',      free: 'Normal only',  pro: 'All modes'    },
                { label: 'Analytics',       free: 'Basic',        pro: 'Full + AI'    },
                { label: 'AI Revision Plan', free: '—',           pro: <GreenCheck /> },
                { label: 'Smart Notes',     free: '—',            pro: <GreenCheck /> },
                { label: 'OCR Scanner',     free: '—',            pro: 'Coming soon'  },
              ].map((row, i) => (
                <div
                  key={row.label}
                  className={[
                    'grid grid-cols-3 px-6 py-3.5',
                    i % 2 === 1 ? 'bg-white/[0.015]' : '',
                  ].join(' ')}
                >
                  <span className="text-sm text-white/60">{row.label}</span>
                  <span className="text-center text-sm text-white/30">{row.free}</span>
                  <span className="flex justify-center text-sm text-white/70">{row.pro}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Skip */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.4 }}
            className="mt-10 flex flex-col items-center gap-2"
          >
            <button
              onClick={handleSkip}
              className="cursor-pointer text-sm text-white/30 underline-offset-4 transition-colors hover:text-white/55 hover:underline"
            >
              Continue without subscribing →
            </button>
            <p className="text-xs text-white/20">
              You can subscribe anytime from your profile.
            </p>
          </motion.div>

        </div>
      </div>
    </main>
  );
}

function GreenCheck() {
  return <Check size={15} className="text-[#22c55e]/70" />;
}
