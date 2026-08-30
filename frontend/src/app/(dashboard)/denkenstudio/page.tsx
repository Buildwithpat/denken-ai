'use client';

import { useState, useEffect, type ElementType } from 'react';
import TestLoader from '@/components/TestLoader';
import MobileRestricted from '@/components/MobileRestricted';
import { useRouter } from 'next/navigation';
import {
  Sparkles, Lock, ArrowRight, TrendingUp, Brain, Gauge,
  X, RotateCcw, Wand2, RefreshCw, Zap, Shuffle,
  AlertTriangle, CheckCircle, Clock, Target, FlaskConical, BookOpen,
} from 'lucide-react';
import { useOnboarding } from '@/context/OnboardingContext';
import { useAccess } from '@/context/AccessContext';
import { useTestConfig } from '@/context/TestContext';
import { chapters as CHAPTERS } from '@/data/chapters';
import PremiumLock from '@/components/upgrade/PremiumLock';
import JeeVariantToggle from '@/components/JeeVariantToggle';
import {
  fetchTestRecommendations,
  type TestRecommendation,
  type AdaptiveRecommendationResponse,
  type AdaptiveMode,
} from '@/lib/adaptiveApi';

/* ─── Types ──────────────────────────────────────────────────────────────── */

type StudioMode = 'weakness' | 'revision' | 'weightage' | 'difficulty' | 'balanced-mock' | 'surprise' | 'high-roi' | 'crash-course' | 'formula-heavy';
type Difficulty = 'easy' | 'medium' | 'hard' | 'mixed';

interface ModalConfig {
  subjects:   string[];
  chapter:    string;
  difficulty: Difficulty;
  count:      number;
}

const MAX_QUESTIONS = 90;

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function flatChapters(exam: string, subject: string): string[] {
  const key  = exam.toUpperCase() as 'JEE' | 'NEET';
  const data = (CHAPTERS[key] as Record<string, Record<string, string[]>>)[subject];
  if (!data) return [];
  return Object.values(data).flat();
}

function subjectsForExam(exam: string): string[] {
  return exam === 'neet'
    ? ['Physics', 'Chemistry', 'Biology']
    : ['Physics', 'Chemistry', 'Mathematics'];
}

function adaptiveModeFor(studio: StudioMode): AdaptiveMode | undefined {
  switch (studio) {
    case 'weakness':      return 'weak-topic';
    case 'revision':      return 'revision';
    case 'balanced-mock': return 'balanced-mock';
    case 'surprise':      return 'surprise';
    case 'high-roi':      return 'high-roi';
    case 'crash-course':  return 'crash-course';
    case 'formula-heavy': return 'formula-heavy';
    default:              return undefined;
  }
}

function urgencyColor(urgency?: string): string {
  switch (urgency) {
    case 'critical': return 'text-red-400 border-red-500/20 bg-red-500/[0.05]';
    case 'high':     return 'text-amber-400 border-amber-400/20 bg-amber-400/[0.05]';
    case 'medium':   return 'text-blue-400 border-blue-400/20 bg-blue-400/[0.05]';
    default:         return 'text-white/40 border-white/[0.08] bg-white/[0.02]';
  }
}

function urgencyDot(urgency?: string): string {
  switch (urgency) {
    case 'critical': return 'bg-red-500 animate-pulse';
    case 'high':     return 'bg-amber-400 animate-pulse';
    case 'medium':   return 'bg-blue-400';
    default:         return 'bg-white/20';
  }
}

/* ─── Mode config ────────────────────────────────────────────────────────── */

const MODE_META: Record<StudioMode, {
  icon:        ElementType;
  title:       string;
  description: string;
  buttonLabel: string;
  accentColor: string;
  isAdaptive:  boolean;
  hint?:       string;
}> = {
  weakness: {
    icon:        Brain,
    title:       'Weakness Targeted',
    description: 'AI pinpoints your lowest-mastery topics from real performance data and builds a focused test to close those gaps.',
    buttonLabel: 'Target Weaknesses',
    accentColor: '#f59e0b',
    isAdaptive:  true,
    hint:        'AI Recommended',
  },
  revision: {
    icon:        RefreshCw,
    title:       'Revision Boost',
    description: 'Identify topics your brain has started forgetting using the Ebbinghaus curve, and revive them before retention drops further.',
    buttonLabel: 'Revise Now',
    accentColor: '#8b5cf6',
    isAdaptive:  true,
    hint:        'Forgetting Curve',
  },
  weightage: {
    icon:        TrendingUp,
    title:       'High Weightage',
    description: 'Target chapters most likely to appear in your exam. Maximise score by focusing where marks are concentrated.',
    buttonLabel: 'Build Test',
    accentColor: '#8762F7',
    isAdaptive:  false,
  },
  difficulty: {
    icon:        Gauge,
    title:       'Difficulty Based',
    description: 'Select your challenge level and train across the full difficulty spectrum to build confident exam readiness.',
    buttonLabel: 'Select Difficulty',
    accentColor: '#14b8a6',
    isAdaptive:  false,
  },
  'balanced-mock': {
    icon:        Zap,
    title:       'Balanced Mock Test',
    description: 'Full exam-pattern simulation with proper subject distribution and mixed difficulty. Benchmarks your real readiness.',
    buttonLabel: 'Start Mock',
    accentColor: '#22c55e',
    isAdaptive:  true,
  },
  surprise: {
    icon:        Shuffle,
    title:       'Surprise Test',
    description: 'Random balanced selection across all topics, revealing gaps you didn\'t know existed.',
    buttonLabel: 'Surprise Me',
    accentColor: '#fb923c',
    isAdaptive:  false,
  },
  'high-roi': {
    icon:        Target,
    title:       'High ROI Focus',
    description: 'Concentrate on chapters with the highest exam weightage and frequency score, for maximum marks in minimum revision time.',
    buttonLabel: 'Maximise ROI',
    accentColor: '#f43f5e',
    isAdaptive:  true,
    hint:        'Strategic',
  },
  'crash-course': {
    icon:        Zap,
    title:       'Crash Course',
    description: 'Last-minute prep strategy: high revision-value topics with manageable difficulty, optimised for rapid score improvement.',
    buttonLabel: 'Start Crash Course',
    accentColor: '#f59e0b',
    isAdaptive:  true,
    hint:        'Last 30 Days',
  },
  'formula-heavy': {
    icon:        FlaskConical,
    title:       'Formula Drill',
    description: 'Focused practice on formula-heavy and numerical chapters where structured drilling yields the fastest accuracy improvement.',
    buttonLabel: 'Drill Formulas',
    accentColor: '#06b6d4',
    isAdaptive:  false,
  },
};

const MODE_ORDER: StudioMode[] = ['weakness', 'revision', 'balanced-mock', 'high-roi', 'crash-course', 'formula-heavy', 'weightage', 'difficulty', 'surprise'];

/* ─── Restricted view ────────────────────────────────────────────────────── */

function RestrictedView() {
  const router = useRouter();
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04]">
          <Lock size={22} className="text-white/30" />
        </div>
        <h2 className="text-lg font-semibold text-white">Denken Studio not available</h2>
        <p className="mt-2.5 text-sm leading-relaxed text-white/45">
          Smart test generation is only available for JEE and NEET
        </p>
        <button
          onClick={() => router.push('/tests')}
          className="mx-auto mt-7 flex cursor-pointer items-center gap-2 rounded-lg border border-white/[0.09] bg-white/[0.03] px-5 py-2.5 text-sm font-medium text-white/65 transition-colors hover:border-white/20 hover:text-white/90"
        >
          Go to Tests
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

/* ─── Shared chip ────────────────────────────────────────────────────────── */

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={[
        'rounded-lg border px-4 py-2 text-xs font-medium transition-all duration-150 cursor-pointer',
        active
          ? 'border-[#8762F7]/50 bg-[#8762F7]/22 text-white shadow-[0_0_12px_rgba(135,98,247,0.18)]'
          : 'border-white/[0.09] bg-white/[0.02] text-white/50 hover:border-[#8762F7]/30 hover:bg-[#8762F7]/08 hover:text-white/80',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-white/30">
      {children}
    </p>
  );
}

/* ─── Reasoning panel ────────────────────────────────────────────────────── */

function ReasoningPanel({ rec }: { rec: TestRecommendation }) {
  const urgencyIcon =
    rec.urgency === 'critical' || rec.urgency === 'high'
      ? <AlertTriangle size={13} className="shrink-0 text-amber-400" />
      : <CheckCircle size={13} className="shrink-0 text-emerald-400" />;

  return (
    <div className={['rounded-xl border px-4 py-4', urgencyColor(rec.urgency)].join(' ')}>
      <div className="mb-2.5 flex items-start gap-2">
        {urgencyIcon}
        <p className="text-[11px] font-semibold leading-snug text-white/75">{rec.headline}</p>
      </div>
      <ul className="space-y-1.5 pl-5">
        {rec.reasoning.map((r, i) => (
          <li key={i} className="text-[10px] leading-relaxed text-white/45 list-disc">
            {r}
          </li>
        ))}
      </ul>
      {rec.topicFocus.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {rec.topicFocus.map((t) => (
            <span
              key={t}
              className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[9px] font-medium text-white/45"
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── New-user onboarding panel ──────────────────────────────────────────── */

function NoDataPanel() {
  return (
    <div className="rounded-xl border border-dashed border-white/[0.07] px-5 py-5 text-center">
      <Clock size={16} className="mx-auto mb-2 text-white/20" />
      <p className="text-[11px] font-semibold text-white/40">No performance data yet</p>
      <p className="mt-1 text-[10px] leading-relaxed text-white/25">
        Complete your first test and AI-driven recommendations will appear here automatically.
      </p>
    </div>
  );
}

/* ─── Smart Test Panel (right-side panel) ────────────────────────────────── */

function SmartTestModal({
  open, mode, exam, examKey, recommendation, hasData, onClose,
}: {
  open:           boolean;
  mode:           StudioMode | null;
  exam:           string;
  examKey:        string;
  recommendation: TestRecommendation | null;
  hasData:        boolean;
  onClose:        () => void;
}) {
  const router            = useRouter();
  const { setTestConfig } = useTestConfig();
  const allSubjects       = subjectsForExam(exam);
  const meta              = mode ? MODE_META[mode] : null;
  const isAdaptiveDriven  = mode ? META_ADAPTIVE_MODES.has(mode) : false;

  // Pre-fill from recommendation for adaptive modes
  const recSubjects = isAdaptiveDriven && recommendation?.subjects?.length
    ? recommendation.subjects.filter(s => allSubjects.includes(s))
    : allSubjects;

  const defaultConfig: ModalConfig = {
    subjects:   recSubjects.length > 0 ? recSubjects : allSubjects,
    chapter:    isAdaptiveDriven && recommendation?.suggestedChapters?.[0] ? recommendation.suggestedChapters[0] : '',
    difficulty: (isAdaptiveDriven && recommendation?.difficulty) ? recommendation.difficulty as Difficulty : 'mixed',
    count:      isAdaptiveDriven && recommendation?.questionCount ? recommendation.questionCount : 25,
  };

  const [config, setConfig] = useState<ModalConfig>(defaultConfig);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setConfig(defaultConfig);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, recommendation]);

  const chapterSubject = config.subjects[0] ?? null;
  const chapterList    = chapterSubject ? flatChapters(exam, chapterSubject) : [];

  function toggleSubject(s: string) {
    setConfig(prev => ({
      ...prev,
      subjects: prev.subjects.includes(s)
        ? prev.subjects.filter(x => x !== s)
        : [...prev.subjects, s],
      chapter: '',
    }));
  }

  const DIFFICULTIES: { value: Difficulty; label: string }[] = [
    { value: 'easy',   label: 'Easy'   },
    { value: 'medium', label: 'Medium' },
    { value: 'hard',   label: 'Hard'   },
    { value: 'mixed',  label: 'Mixed'  },
  ];

  function handleStart() {
    if (!mode) return;
    const finalSubjects = config.subjects.length > 0 ? config.subjects : allSubjects;
    setTestConfig({
      mode:               'smart',
      exam:               examKey as import('@/context/TestContext').TestExam,
      subject:            finalSubjects.join(', '),
      chapter:            config.chapter,
      questions:          config.count,
      time:               Math.max(30, Math.round(config.count * 1.5)),
      studioType:         mode as import('@/context/TestContext').StudioType,
      difficulty:         config.difficulty,
      adaptiveReasoning:  recommendation?.reasoning,
    });
    setLoading(true);
  }

  return (
    <>
      <div
        onClick={onClose}
        className={[
          'fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] transition-opacity duration-300',
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
        ].join(' ')}
      />

      <div
        className={[
          'fixed right-0 top-0 z-50 flex h-screen w-full max-w-[460px] flex-col border-l border-white/[0.08] bg-[#0d1018] shadow-[-40px_0_100px_rgba(0,0,0,0.7)] transition-transform duration-300 ease-in-out',
          open ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between border-b border-white/[0.07] px-7 py-6">
          <div>
            <div className="mb-1.5 flex items-center gap-1.5">
              <Sparkles size={12} className="text-[#8762F7]/80" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[#8762F7]/70">
                Smart Test
              </span>
            </div>
            <h2 className="text-base font-semibold text-white">{meta?.title ?? 'Configure Test'}</h2>
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer rounded-lg p-2 text-white/30 transition-colors hover:bg-white/[0.06] hover:text-white/70"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-7 overflow-y-auto px-7 py-7">

          {/* AI Reasoning panel (adaptive modes only) */}
          {isAdaptiveDriven && (
            hasData && recommendation
              ? <ReasoningPanel rec={recommendation} />
              : <NoDataPanel />
          )}

          {/* Subjects */}
          <div>
            <FieldLabel>Subjects</FieldLabel>
            <div className="mb-3 flex flex-wrap gap-2">
              {allSubjects.map(s => (
                <Chip
                  key={s}
                  label={s}
                  active={config.subjects.includes(s)}
                  onClick={() => toggleSubject(s)}
                />
              ))}
            </div>

            <select
              value={config.chapter}
              onChange={e => setConfig(prev => ({ ...prev, chapter: e.target.value }))}
              className="w-full cursor-pointer rounded-xl border border-white/[0.09] bg-[#0B0E14] px-4 py-2.5 text-xs text-white/70 outline-none transition-colors hover:border-white/20 focus:border-[#8762F7]/40"
            >
              {chapterList.length === 0
                ? <option value="">Select a subject first</option>
                : <>
                    <option value="">All Chapters</option>
                    {chapterList.map((ch, i) => (
                      <option key={`${ch}-${i}`} value={ch}>{ch}</option>
                    ))}
                  </>
              }
            </select>
            {config.subjects.length > 1 && chapterList.length > 0 && (
              <p className="mt-1.5 text-[10px] text-white/25">
                Showing chapters for {chapterSubject}
              </p>
            )}
          </div>

          {/* Difficulty */}
          <div>
            <FieldLabel>Difficulty</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {DIFFICULTIES.map(({ value, label }) => (
                <Chip
                  key={value}
                  label={label}
                  active={config.difficulty === value}
                  onClick={() => setConfig(prev => ({ ...prev, difficulty: value }))}
                />
              ))}
            </div>
          </div>

          {/* Question Count */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <FieldLabel>Question Count</FieldLabel>
              <span className="text-lg font-bold tabular-nums text-white">{config.count}</span>
            </div>
            <input
              type="range"
              min={10}
              max={MAX_QUESTIONS}
              step={5}
              value={config.count}
              onChange={e => setConfig(prev => ({ ...prev, count: Math.min(Number(e.target.value), MAX_QUESTIONS) }))}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/[0.08] accent-[#8762F7]"
            />
            <div className="mt-2 flex justify-between text-[9px] text-white/25">
              <span>10</span><span>30</span><span>50</span><span>70</span><span>90</span>
            </div>
          </div>

          {/* Summary */}
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-5 py-4">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-white/25">Summary</p>
            <div className="space-y-2.5 text-xs">
              {config.subjects.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-white/35">Subjects</span>
                  <span className="font-medium text-white/70">{config.subjects.join(', ')}</span>
                </div>
              )}
              {config.chapter && (
                <div className="flex items-center justify-between">
                  <span className="text-white/35">Chapter</span>
                  <span className="max-w-[200px] truncate text-right font-medium text-white/70">{config.chapter}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-white/35">Difficulty</span>
                <span className="font-medium text-white/70">
                  {config.difficulty.charAt(0).toUpperCase() + config.difficulty.slice(1)}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-white/[0.06] pt-2.5">
                <span className="text-white/35">Questions</span>
                <span className="font-bold text-white">{config.count}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/35">Est. Duration</span>
                <span className="font-medium text-white/70">{Math.round(config.count * 1.5)} min</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-white/[0.07] px-7 py-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setConfig(defaultConfig)}
              className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-white/[0.09] px-4 py-3 text-xs font-medium text-white/45 transition-all duration-200 hover:border-white/22 hover:text-white/75"
            >
              <RotateCcw size={12} />
              Reset
            </button>
            {loading && <TestLoader onDone={() => { onClose(); router.push('/attempt'); }} />}
            <button
              onClick={handleStart}
              disabled={config.subjects.length === 0}
              className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#8762F7]/50 bg-[#8762F7]/25 px-4 py-3.5 text-sm font-bold text-white shadow-[0_0_24px_rgba(135,98,247,0.2)] transition-all duration-150 hover:bg-[#8762F7]/38 hover:shadow-[0_0_36px_rgba(135,98,247,0.32)] disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Wand2 size={14} />
              Start Test
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

const META_ADAPTIVE_MODES = new Set<StudioMode>(['weakness', 'revision', 'balanced-mock', 'high-roi', 'crash-course']);

/* ─── Mode card ──────────────────────────────────────────────────────────── */

function ModeCard({
  type,
  active,
  recommendation,
  isPrimary,
  onClick,
}: {
  type:           StudioMode;
  active:         boolean;
  recommendation: TestRecommendation | null;
  isPrimary:      boolean;
  onClick:        () => void;
}) {
  const { icon: Icon, title, description, buttonLabel, accentColor, hint } = MODE_META[type];
  const isAdaptive = META_ADAPTIVE_MODES.has(type);

  const urgency = recommendation?.urgency;
  const showUrgency = isAdaptive && recommendation && (urgency === 'critical' || urgency === 'high');

  return (
    <div
      onClick={onClick}
      className={[
        'group relative cursor-pointer overflow-hidden rounded-2xl border transition-all duration-300',
        active
          ? 'scale-[1.02] border-[#8762F7]/55 bg-[#8762F7]/[0.12] shadow-[0_0_50px_rgba(135,98,247,0.22)]'
          : 'border-white/[0.08] bg-white/[0.025] hover:scale-[1.02] hover:border-[#8762F7]/28 hover:bg-[#8762F7]/[0.05] hover:shadow-[0_8px_32px_rgba(135,98,247,0.12)]',
      ].join(' ')}
    >
      {active && (
        <div className="pointer-events-none absolute -right-10 -top-10 h-52 w-52 rounded-full bg-[#8762F7]/20 blur-3xl" />
      )}
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: `${accentColor}18` }}
      />

      <div className="relative flex h-full min-h-[300px] flex-col p-8">

        {/* Badges row */}
        <div className="mb-5 flex items-center gap-2">
          {isPrimary && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#8762F7]/35 bg-[#8762F7]/15 px-3 py-1 text-[9px] font-semibold uppercase tracking-wider text-[#8762F7]/85">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#8762F7]" />
              AI Pick
            </span>
          )}
          {hint && !isPrimary && (
            <span className={[
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[9px] font-semibold uppercase tracking-wider transition-all duration-300',
              active
                ? 'border-[#8762F7]/35 bg-[#8762F7]/15 text-[#8762F7]/85'
                : 'border-white/[0.08] bg-white/[0.025] text-white/35 group-hover:border-[#8762F7]/20 group-hover:text-white/50',
            ].join(' ')}>
              <span className={['h-1.5 w-1.5 rounded-full', active ? 'bg-[#8762F7]' : 'bg-white/30'].join(' ')} />
              {hint}
            </span>
          )}
          {showUrgency && (
            <span className={['flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold', urgencyColor(urgency)].join(' ')}>
              <span className={['h-1.5 w-1.5 rounded-full', urgencyDot(urgency)].join(' ')} />
              {urgency === 'critical' ? 'Critical' : 'Needs Attention'}
            </span>
          )}
        </div>

        {/* Icon */}
        <div className={[
          'mb-5 flex h-14 w-14 items-center justify-center rounded-xl border transition-all duration-300',
          active
            ? 'border-[#8762F7]/50 bg-[#8762F7]/25 shadow-[0_0_20px_rgba(135,98,247,0.2)]'
            : 'border-white/[0.09] bg-white/[0.04] group-hover:border-[#8762F7]/30 group-hover:bg-[#8762F7]/12',
        ].join(' ')}>
          <Icon
            size={24}
            className={['transition-colors duration-300', active ? 'text-[#8762F7]' : 'text-white/40 group-hover:text-[#8762F7]/80'].join(' ')}
          />
        </div>

        {/* Text */}
        <h3 className={['mb-3 text-base font-semibold transition-colors duration-200', active ? 'text-white' : 'text-white/80 group-hover:text-white'].join(' ')}>
          {title}
        </h3>

        {/* Real reasoning snippet for adaptive modes */}
        {isAdaptive && recommendation?.headline && (
          <p className="mb-2 text-[10px] font-medium leading-relaxed text-amber-400/70">
            {recommendation.headline.length > 90
              ? recommendation.headline.slice(0, 87) + '…'
              : recommendation.headline}
          </p>
        )}

        <p className="mb-8 flex-1 text-sm leading-relaxed text-white/40 transition-colors duration-200 group-hover:text-white/50">
          {description}
        </p>

        {/* Button */}
        <button
          onClick={e => { e.stopPropagation(); onClick(); }}
          className={[
            'w-full cursor-pointer rounded-xl border px-5 py-3 text-sm font-semibold transition-all duration-200',
            active
              ? 'border-[#8762F7]/55 bg-[#8762F7]/30 text-white shadow-[0_0_20px_rgba(135,98,247,0.2)]'
              : 'border-[#8762F7]/22 bg-[#8762F7]/08 text-[#8762F7]/70 hover:border-[#8762F7]/45 hover:bg-[#8762F7]/18 hover:text-white hover:shadow-[0_0_16px_rgba(135,98,247,0.15)]',
          ].join(' ')}
        >
          {active
            ? <span className="flex items-center justify-center gap-2">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#8762F7] shadow-[0_0_6px_#8762F7]" />
                Configuring…
              </span>
            : <span className="flex items-center justify-center gap-2">
                <Wand2 size={13} />
                {buttonLabel}
              </span>
          }
        </button>
      </div>
    </div>
  );
}

/* ─── Studio view ────────────────────────────────────────────────────────── */

function StudioView({ exam }: { exam: string }) {
  const [activeMode,    setActiveMode]    = useState<StudioMode | null>(null);
  const [modalOpen,     setModalOpen]     = useState(false);
  const [recData,       setRecData]       = useState<AdaptiveRecommendationResponse | null>(null);
  const [recLoading,    setRecLoading]    = useState(true);

  const { data: onboardingData } = useOnboarding();
  const allSubjects = subjectsForExam(exam);
  const examKey     = exam === 'jee' ? onboardingData.jeeVariant : 'NEET';

  useEffect(() => {
    setRecLoading(true);
    fetchTestRecommendations(examKey, allSubjects)
      .then(setRecData)
      .catch(() => setRecData(null))
      .finally(() => setRecLoading(false));
  }, [examKey]);

  // Build a map of mode → matching recommendation
  const recByMode = new Map<StudioMode, TestRecommendation>();
  if (recData?.hasData) {
    for (const rec of recData.allModes) {
      const studioMode: StudioMode | undefined =
        rec.mode === 'weak-topic'    ? 'weakness'      :
        rec.mode === 'revision'      ? 'revision'      :
        rec.mode === 'balanced-mock' ? 'balanced-mock' :
        rec.mode === 'surprise'      ? 'surprise'      :
        rec.mode === 'exam-adaptive' ? 'balanced-mock' : undefined;
      if (studioMode) recByMode.set(studioMode, rec);
    }
  }

  const primaryMode: StudioMode | undefined =
    recData?.primary?.mode === 'weak-topic'    ? 'weakness'      :
    recData?.primary?.mode === 'revision'      ? 'revision'      :
    recData?.primary?.mode === 'balanced-mock' ? 'balanced-mock' :
    undefined;

  function openModal(type: StudioMode) {
    setActiveMode(type);
    setModalOpen(true);
  }

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">

      {/* Header */}
      <div className="mb-10">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles size={18} className="text-[#8762F7]" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[#8762F7]/75">
            Powered by Analytics
          </span>
          {recLoading && (
            <span className="text-[10px] text-white/25 animate-pulse">Analysing your performance…</span>
          )}
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Denken Studio</h1>
            <p className="mt-1.5 text-sm text-white/45">
              {recData?.hasData
                ? `AI-driven test generation. Every mode adapts to your actual performance`
                : `Smart test generation. Take your first test to unlock AI recommendations`}
            </p>
          </div>
          <JeeVariantToggle size="sm" label={null} />
        </div>
      </div>

      <p className="mb-5 text-[10px] font-semibold uppercase tracking-widest text-white/30">
        Select Build Mode
      </p>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {MODE_ORDER.map((type) => {
          const adpMode = adaptiveModeFor(type);
          const rec = adpMode
            ? recData?.allModes.find(r => r.mode === adpMode) ?? null
            : null;
          return (
            <ModeCard
              key={type}
              type={type}
              active={activeMode === type && modalOpen}
              recommendation={rec}
              isPrimary={!recLoading && primaryMode === type && !!recData?.hasData}
              onClick={() => openModal(type)}
            />
          );
        })}
      </div>

      <SmartTestModal
        open={modalOpen}
        mode={activeMode}
        exam={exam}
        examKey={examKey}
        recommendation={activeMode ? (recByMode.get(activeMode) ?? null) : null}
        hasData={recData?.hasData ?? false}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function DenkenStudioPage() {
  const { data, loaded } = useOnboarding();
  const { isPro, isLoading: accessLoading } = useAccess();

  if (!loaded) return null;

  const exam         = data.examType ?? 'jee';
  const isRestricted = exam === 'cbse' || exam === 'custom';

  return (
    <MobileRestricted>
      <PremiumLock
        locked={!accessLoading && !isPro}
        title="DenkenStudio — Pro feature"
        description="Smart AI test generation requires a Pro subscription."
      >
        {isRestricted ? <RestrictedView /> : <StudioView exam={exam} />}
      </PremiumLock>
    </MobileRestricted>
  );
}
