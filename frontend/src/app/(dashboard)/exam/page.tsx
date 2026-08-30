'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, FileText, BarChart2, Brain, BookOpen, Layers, Lock } from 'lucide-react';
import { useOnboarding } from '@/context/OnboardingContext';
import { useAccess } from '@/context/AccessContext';
import { useTestConfig } from '@/context/TestContext';
import TestLoader from '@/components/TestLoader';
import MobileRestricted from '@/components/MobileRestricted';
import PremiumLock from '@/components/upgrade/PremiumLock';
import JeeVariantToggle from '@/components/JeeVariantToggle';

/* ─── Constants ──────────────────────────────────────────────────────────── */

const EXAM_CONFIG: Record<string, { questions: number; time: number; marking: string }> = {
  JEE_MAIN:     { questions: 75,  time: 180, marking: '+4 / −1' },
  JEE_ADVANCED: { questions: 54,  time: 180, marking: '+4 / −2' },
  NEET:         { questions: 180, time: 180, marking: '+4 / −1' },
};

const PYQ_PREVIEWS = [
  { icon: FileText,  label: 'JEE Main 2024 Jan Shift 1',    tag: 'JEE Main'     },
  { icon: BookOpen,  label: 'NEET 2023 Full Paper',          tag: 'NEET'         },
  { icon: Layers,    label: 'JEE Advanced 2023 Paper 2',     tag: 'JEE Advanced' },
  { icon: BarChart2, label: 'Session-wise Analytics',        tag: 'Analytics'    },
  { icon: Brain,     label: 'Adaptive PYQ Review',           tag: 'AI Feature'   },
] as const;

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function ExamModePage() {
  const router            = useRouter();
  const { data }          = useOnboarding();
  const { setTestConfig } = useTestConfig();
  const { testsExhausted, isLoading: accessLoading } = useAccess();

  const isJee     = data.examType === 'jee';
  const examKey   = isJee ? data.jeeVariant : 'NEET';
  const [loading, setLoading] = useState(false);

  const cfg       = EXAM_CONFIG[examKey] ?? EXAM_CONFIG['JEE_MAIN'];
  const examLabel = isJee
    ? (data.jeeVariant === 'JEE_ADVANCED' ? 'JEE Advanced' : 'JEE Main')
    : 'NEET';

  const pageLocked = !accessLoading && testsExhausted;

  function handleStart() {
    setTestConfig({
      mode:      'normal',
      exam:      examKey as import('@/context/TestContext').TestExam,
      subject:   '',
      chapter:   '',
      questions: cfg.questions,
      time:      cfg.time,
    });
    setLoading(true);
  }

  return (
    <MobileRestricted>
    <PremiumLock
      locked={pageLocked}
      title="Free test used"
      description="You've used your free demo test. Subscribe to run full-length exams without limits."
    >
    <div className="mx-auto max-w-6xl px-6 py-10">
      {loading && <TestLoader onDone={() => router.push('/attempt')} />}

      {/* ── Header ── */}
      <div className="mb-10">
        <h1 className="text-2xl font-bold text-white">Exam Mode</h1>
        <p className="mt-1.5 text-sm text-white/40">
          Attempt full-length exams in real conditions
        </p>
      </div>

      {/* ── Two-column grid (active mock section) ── */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-start">

        {/* LEFT: Controls */}
        <div className="space-y-8">

          {/* Exam Type — JEE only (uses global persisted variant) */}
          {isJee && (
            <JeeVariantToggle label="Select Exam Type" />
          )}

          {/* Mode — Full Mock Test (only active mode) */}
          <div>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-white/30">
              Mode
            </p>
            <div className="rounded-xl border border-[#8762F7]/40 bg-[#8762F7]/[0.07] px-5 py-4">
              <p className="text-sm font-semibold text-white">Full Mock Test</p>
              <p className="mt-0.5 text-xs text-white/35">Simulated full exam experience</p>
            </div>
          </div>

        </div>

        {/* RIGHT: Summary + Info + CTA */}
        <div className="space-y-6">

          {/* Summary Card */}
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.015] px-5 py-4">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-white/25">
              Summary
            </p>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/35">Exam</span>
                <span className="text-xs font-medium text-white/70">{examLabel}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/35">Mode</span>
                <span className="text-xs font-medium text-white/70">Full Mock Test</span>
              </div>
            </div>
          </div>

          {/* Exam Info */}
          <div className="flex items-center gap-6 rounded-lg border border-white/[0.07] bg-white/[0.02] px-5 py-4">
            <div>
              <p className="text-base font-bold tabular-nums text-white">{cfg.questions}</p>
              <p className="mt-0.5 text-[11px] text-white/30">Questions</p>
            </div>
            <div className="h-7 w-px bg-white/[0.07]" />
            <div>
              <p className="text-base font-bold tabular-nums text-white">{cfg.time} min</p>
              <p className="mt-0.5 text-[11px] text-white/30">Duration</p>
            </div>
            <div className="h-7 w-px bg-white/[0.07]" />
            <div>
              <p className="text-base font-bold tabular-nums text-white">{cfg.marking}</p>
              <p className="mt-0.5 text-[11px] text-white/30">Marking</p>
            </div>
          </div>

          {/* Start CTA */}
          <button
            onClick={handleStart}
            className="w-full cursor-pointer rounded-xl border border-[#8762F7]/35 bg-[#8762F7]/15 px-12 py-3.5 text-sm font-semibold text-[#8762F7] transition-colors hover:bg-[#8762F7]/25"
          >
            Start Exam
          </button>

        </div>
      </div>

      {/* ── PYQ Coming Soon Section ── */}
      <div className="relative mt-12 overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.015]">

        {/* Ambient glow */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#8762F7] opacity-[0.06] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-[#8762F7] opacity-[0.04] blur-3xl" />

        {/* Top accent line */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-[#8762F7]/30 to-transparent" />

        <div className="relative px-6 py-8 sm:px-8">

          {/* Header row */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">

              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#8762F7]/25 bg-[#8762F7]/[0.08] px-3 py-1">
                <Clock size={10} className="shrink-0 text-[#8762F7]/60" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[#8762F7]/60">
                  Under Development
                </span>
              </div>

              <h2 className="text-xl font-bold text-white sm:text-2xl">
                Attempt Any Real PYQ Paper
              </h2>
              <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-white/40">
                Soon you'll be able to attempt any JEE Main, JEE Advanced, or NEET paper by year,
                shift, and session, with full exam simulation, detailed analytics, adaptive review,
                and AI-powered performance breakdowns.
              </p>
            </div>

            <div className="hidden shrink-0 items-center gap-1.5 self-start rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2 sm:flex">
              <Lock size={11} className="text-white/20" />
              <span className="text-[11px] text-white/25">Future Feature</span>
            </div>
          </div>

          {/* Divider */}
          <div className="my-6 border-t border-white/[0.06]" />

          {/* Preview cards */}
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-white/20">
            What's coming
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {PYQ_PREVIEWS.map(({ icon: Icon, label, tag }) => (
              <div
                key={label}
                className="group flex flex-col gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-4 transition-colors hover:border-white/[0.1] hover:bg-white/[0.03]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03]">
                    <Icon size={13} className="text-white/25" />
                  </div>
                  <span className="rounded-full border border-[#8762F7]/15 bg-[#8762F7]/[0.06] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#8762F7]/50">
                    {tag}
                  </span>
                </div>
                <p className="text-xs font-medium leading-snug text-white/45 group-hover:text-white/55">
                  {label}
                </p>
              </div>
            ))}
          </div>

          {/* Footer note */}
          <p className="mt-6 text-[11px] text-white/20">
            Previous year paper simulation is currently in development. Existing exam simulation and adaptive mock generation are fully available above.
          </p>

        </div>
      </div>

    </div>
    </PremiumLock>
    </MobileRestricted>
  );
}
