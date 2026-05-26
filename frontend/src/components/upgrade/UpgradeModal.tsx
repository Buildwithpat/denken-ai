'use client';

import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, Lock } from 'lucide-react';
import type { GateEvent } from '@/lib/gateError';

const FEATURE_LABELS: Record<string, string> = {
  smartNotes:        'Smart Notes',
  aiRevision:        'AI Revision',
  advancedAnalytics: 'Advanced Analytics',
  unlimitedTests:    'Unlimited Tests',
  ocr:               'OCR Scanner',
};

interface Props {
  gate: GateEvent;
  onClose: () => void;
}

export default function UpgradeModal({ gate, onClose }: Props) {
  const router = useRouter();

  const isLimit   = gate.code === 'FREE_LIMIT_REACHED';
  const isMode    = gate.code === 'MODE_GATED';
  const isFeature = gate.code === 'FEATURE_GATED';

  const featureLabel = gate.feature ? (FEATURE_LABELS[gate.feature] ?? gate.feature) : null;
  const modeLabel    = gate.mode ? gate.mode.charAt(0).toUpperCase() + gate.mode.slice(1) : null;

  const title = isLimit
    ? 'Demo limit reached'
    : isMode
    ? `${modeLabel ?? 'This'} mode requires Pro`
    : featureLabel
    ? `${featureLabel} requires Pro`
    : 'Subscribe to DenkenAI Pro';

  const body = isLimit
    ? `You've used your free demo. Subscribe to generate unlimited tests and access all features.`
    : isMode
    ? `The ${modeLabel?.toLowerCase() ?? ''} test mode is available on Pro.`
    : `${featureLabel ?? 'This feature'} is available on Pro.`;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 12 }}
          transition={{ duration: 0.22, ease: 'easeOut' as const }}
          onClick={(e) => e.stopPropagation()}
          className="relative z-10 w-full max-w-sm rounded-2xl border border-white/10 bg-[#0F1117] p-6 shadow-2xl"
        >
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-white/30 transition-colors hover:text-white/70"
          >
            <X size={16} />
          </button>

          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#8762F7]/15 border border-[#8762F7]/25">
            <Lock size={20} className="text-[#8762F7]" />
          </div>

          <h2 className="text-base font-semibold text-white">{title}</h2>
          <p className="mt-1.5 text-sm text-white/55 leading-relaxed">{body}</p>

          {isLimit && gate.limit != null && gate.used != null && (
            <div className="mt-4">
              <div className="mb-1.5 flex justify-between text-[11px] text-white/35">
                <span>Demo tests used</span>
                <span>{gate.used} / {gate.limit}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/8">
                <div
                  className="h-full rounded-full bg-[#8762F7]"
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          )}

          <div className="mt-5 flex flex-col gap-2.5">
            <button
              onClick={() => { onClose(); router.push('/pricing'); }}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#8762F7] to-[#6D4AFF] py-2.5 text-sm font-medium text-white transition-all hover:brightness-110"
            >
              <Zap size={14} />
              Subscribe to DenkenAI Pro
            </button>
            <button
              onClick={onClose}
              className="w-full cursor-pointer rounded-lg border border-white/10 py-2.5 text-sm text-white/50 transition-colors hover:border-white/20 hover:text-white/80"
            >
              Maybe later
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
