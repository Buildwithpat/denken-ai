'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOnboarding } from '@/context/OnboardingContext';
import { useAccess } from '@/context/AccessContext';
import { chapters as CHAPTERS } from '@/data/chapters';
import Link from 'next/link';
import PrepInsightGate from '@/components/upgrade/PrepInsightGate';
import { trackEvent }   from '@/lib/trackEvent';
import RevisionPlanModal  from '@/components/revision/RevisionPlanModal';
import RapidDrillPanel      from '@/components/revision/RapidDrillPanel';
import FormulaPracticePanel  from '@/components/revision/FormulaPracticePanel';
import PYQPanel                  from '@/components/revision/PYQPanel';
import MistakeRevisionPanel      from '@/components/revision/MistakeRevisionPanel';
import {
  fetchRevision,
  type RevisionData,
  type MistakeLogItem,
} from '@/lib/revisionApi';
import {
  fetchRevisionQueue,
  type RevisionQueueItem,
  type MistakeType,
} from '@/lib/mistakeApi';
import {
  BookOpen, ClipboardX, Target,
  FileText, Layers, FlaskConical, Brain,
  ListChecks, ChevronRight, X,
  Zap, RotateCcw, BookMarked, Shuffle, AlertTriangle,
} from 'lucide-react';
import UpgradeBanner from '@/components/upgrade/UpgradeBanner';

/* ─── Helpers ────────────────────────────────────────────────────────────── */

type ExamKey = 'jee' | 'neet' | 'cbse' | 'custom';

function getSubjects(examType: ExamKey | null, userSubjects: string[]): string[] {
  if (examType === 'jee')  return Object.keys(CHAPTERS.JEE);
  if (examType === 'neet') return Object.keys(CHAPTERS.NEET);
  return userSubjects.filter(Boolean);
}

function chapterCount(examType: ExamKey | null, subject: string): number {
  if (examType === 'jee') {
    const data = (CHAPTERS.JEE as Record<string, Record<string, string[]>>)[subject];
    return data ? (data['11']?.length ?? 0) + (data['12']?.length ?? 0) : 0;
  }
  if (examType === 'neet') {
    const data = (CHAPTERS.NEET as Record<string, Record<string, string[]>>)[subject];
    return data ? (data['11']?.length ?? 0) + (data['12']?.length ?? 0) : 0;
  }
  return 0;
}

/* ─── WeakEntry shape (used by all mode panels) ──────────────────────────── */

export interface WeakEntry { subject: string; chapter: string; score: number }

function groupBySubject(entries: WeakEntry[]): Map<string, WeakEntry[]> {
  return entries.reduce((map, entry) => {
    const list = map.get(entry.subject) ?? [];
    map.set(entry.subject, [...list, entry]);
    return map;
  }, new Map<string, WeakEntry[]>());
}

const SCORE_LABEL: Record<ExamKey, string> = {
  jee:    'Accuracy',
  neet:   'Accuracy',
  cbse:   'Concept Clarity',
  custom: 'Unit Strength',
};

function barColor(score: number): string {
  if (score < 50) return 'bg-[#ef4444]';
  if (score < 65) return 'bg-[#f59e0b]';
  return 'bg-[#22c55e]';
}

function scoreColor(score: number): string {
  if (score < 50) return 'text-[#ef4444]';
  if (score < 65) return 'text-[#f59e0b]';
  return 'text-[#22c55e]';
}

/* ─── Mistake log helpers ────────────────────────────────────────────────── */

const DAY = 86_400_000;

function timeAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / DAY);
  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  if (days < 7)   return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
}

const SOLUTION_LABEL: Record<ExamKey, string> = {
  jee:    'View Solution',
  neet:   'View Solution',
  cbse:   'View Suggested Answer',
  custom: 'View Suggested Answer',
};

/* ─── Static config ──────────────────────────────────────────────────────── */

const SUBTITLE: Record<ExamKey, string> = {
  jee:    'Improve weak areas and strengthen concepts',
  neet:   'Improve weak areas and strengthen concepts',
  cbse:   'Revise concepts and practice subjective answers',
  custom: 'Revise concepts and practice subjective answers',
};

interface RevMode {
  icon:      React.FC<{ size: number; className?: string }>;
  label:     string;
  desc:      string;
  disabled?: boolean;
}

const REVISION_MODES: Record<ExamKey, RevMode[]> = {
  jee: [
    { icon: Zap,         label: 'Rapid Drill',          desc: 'Timed MCQ bursts by chapter'       },
    { icon: FlaskConical,label: 'Formula Practice',     desc: 'Recall and apply key formulae'     },
    { icon: BookMarked,  label: 'PYQ Mode',             desc: 'Practice from past year questions' },
    { icon: RotateCcw,   label: 'Mistake Revision',     desc: 'Reattempt your past mistakes'      },
  ],
  neet: [
    { icon: Zap,         label: 'Rapid Drill',          desc: 'Timed MCQ bursts by chapter'       },
    { icon: FlaskConical,label: 'Formula Practice',     desc: 'Recall and apply key formulae'     },
    { icon: BookMarked,  label: 'PYQ Mode',             desc: 'Practice from past year questions' },
    { icon: RotateCcw,   label: 'Mistake Revision',     desc: 'Reattempt your past mistakes'      },
  ],
  cbse: [
    { icon: Brain,       label: 'Theory Practice',      desc: 'Subjective concept reinforcement'  },
    { icon: ListChecks,  label: 'Important Questions',  desc: 'High-weightage board Q&A'          },
    { icon: FileText,    label: 'Case-based Questions', desc: 'Passage and application problems'  },
    { icon: RotateCcw,   label: 'Mistake Revision',     desc: 'Revisit evaluation feedback'       },
  ],
  custom: [
    { icon: Layers,      label: 'Unit Practice',        desc: 'Focus on one unit at a time'                   },
    { icon: Shuffle,     label: 'Mixed Questions',      desc: 'Random questions across units'                 },
    { icon: RotateCcw,   label: 'Mistake Revision',     desc: 'Reattempt your past mistakes'                  },
    { icon: BookMarked,  label: 'PYQ Mode',             desc: 'Not available for custom exams', disabled: true },
  ],
};

/* ─── Panel content (for generic modes) ─────────────────────────────────── */

interface PanelContent { heading: string; items: string[]; cta: string }

function getPanelContent(
  mode:        RevMode,
  examType:    ExamKey,
  weakEntries: WeakEntry[],
): PanelContent {
  const weakChapters = weakEntries.map(e => e.chapter);

  switch (mode.label) {
    case 'Rapid Drill':
      return {
        heading: 'Topics to drill',
        items:   weakChapters.length > 0 ? weakChapters : ['No weak chapters found'],
        cta:     'Start Drill',
      };
    case 'Formula Practice':
      return {
        heading: 'Select a formula group',
        items:   examType === 'jee'
          ? ['Mechanics & Kinematics', 'Electrostatics & Magnetism', 'Organic Reactions', 'Integral Calculus', 'Thermodynamics']
          : ['Mechanics & Waves', 'Electromagnetic Waves', 'Coordination Chemistry', 'Cell Biology', 'Genetics'],
        cta: 'Start Practice',
      };
    case 'PYQ Mode': {
      const p = examType === 'neet' ? 'NEET' : 'JEE';
      return {
        heading: 'Select a year',
        items:   [`${p} 2024`, `${p} 2023`, `${p} 2022`, `${p} 2021`, `${p} 2020`],
        cta:     'Start PYQ',
      };
    }
    case 'Mistake Revision':
      return {
        heading: 'Your mistakes to retry',
        items:   weakChapters.length > 0 ? weakChapters : ['No mistakes recorded yet'],
        cta:     'Start Revision',
      };
    case 'Theory Practice':
      return {
        heading: 'Choose a chapter',
        items:   weakChapters.length > 0 ? weakChapters : ['Integrals', 'Electromagnetic Induction', 'Electrochemistry'],
        cta:     'Start Writing',
      };
    case 'Important Questions':
      return {
        heading: 'Select a topic',
        items:   ['Integrals · 5 marks', 'Differential Equations · 5 marks', 'Electromagnetic Induction · 5 marks', 'Electrochemistry · 3 marks'],
        cta:     'Start Practice',
      };
    case 'Case-based Questions':
      return {
        heading: 'Select passage type',
        items:   ['Applied Mathematics · 5 marks', 'Electrochemistry passage · 4 marks', 'Current Electricity · 5 marks', 'Genetics passage · 5 marks'],
        cta:     'Start Practice',
      };
    case 'Unit Practice':
      return {
        heading: 'Select a unit',
        items:   weakChapters.length > 0
          ? weakEntries.map(e => `${e.subject} — ${e.chapter}`)
          : ['Unit 1: Foundational Concepts', 'Unit 2: Applied Principles', 'Unit 3: Advanced Topics'],
        cta: 'Start Practice',
      };
    case 'Mixed Questions':
      return {
        heading: 'Configure your mix',
        items:   ['All units · 20 questions', 'Weak areas only · 10 questions', 'Random shuffle · 25 questions'],
        cta:     'Start Mixed Set',
      };
    default:
      return {
        heading: 'Choose how to proceed',
        items:   weakChapters.length > 0 ? weakChapters : ['No content available'],
        cta:     'Start',
      };
  }
}

/* ─── Mistake type display config ────────────────────────────────────────── */

const MISTAKE_META: Record<MistakeType, { label: string; color: string; bg: string; border: string }> = {
  conceptual:       { label: 'Conceptual',     color: 'text-[#a78bfa]', bg: 'bg-[#8762F7]/10', border: 'border-[#8762F7]/25' },
  careless:         { label: 'Careless',       color: 'text-[#f59e0b]', bg: 'bg-[#f59e0b]/10', border: 'border-[#f59e0b]/25' },
  formula:          { label: 'Formula',        color: 'text-[#38bdf8]', bg: 'bg-[#38bdf8]/10', border: 'border-[#38bdf8]/25' },
  'time-pressure':  { label: 'Time Pressure',  color: 'text-[#fb923c]', bg: 'bg-[#fb923c]/10', border: 'border-[#fb923c]/25' },
  'weak-retention': { label: 'Weak Retention', color: 'text-[#f472b6]', bg: 'bg-[#f472b6]/10', border: 'border-[#f472b6]/25' },
  guessing:         { label: 'Guessing',       color: 'text-[#facc15]', bg: 'bg-[#facc15]/10', border: 'border-[#facc15]/25' },
  repeated:         { label: 'Repeated',       color: 'text-[#ef4444]', bg: 'bg-[#ef4444]/10', border: 'border-[#ef4444]/25' },
};

const PRIORITY_META = {
  critical: { label: 'Critical', color: 'text-[#ef4444]', bg: 'bg-[#ef4444]/10', border: 'border-[#ef4444]/25' },
  high:     { label: 'High',     color: 'text-[#f59e0b]', bg: 'bg-[#f59e0b]/10', border: 'border-[#f59e0b]/25' },
  medium:   { label: 'Medium',   color: 'text-[#a78bfa]', bg: 'bg-[#8762F7]/10', border: 'border-[#8762F7]/25' },
};

/* ─── Smart revision queue component ─────────────────────────────────────── */

function SmartRevisionQueue({
  queue,
  loading,
  isFreeTier,
  router,
}: {
  queue:      RevisionQueueItem[];
  loading:    boolean;
  isFreeTier: boolean;
  router:     ReturnType<typeof useRouter>;
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => <div key={i} className="h-20 animate-pulse rounded-lg bg-white/[0.03]" />)}
      </div>
    );
  }

  if (isFreeTier) {
    return (
      <UpgradeBanner
        title="Smart Revision Queue — Pro feature"
        description="Upgrade to access AI-ranked revision priorities based on your mistake patterns."
      />
    );
  }

  if (queue.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded border border-dashed border-white/[0.07] py-8 text-center">
        <AlertTriangle size={20} className="text-white/15" />
        <p className="text-xs text-white/25">No mistakes recorded yet. Take a test to build your revision queue</p>
      </div>
    );
  }

  const visible = queue.slice(0, 6);

  return (
    <div className="space-y-2">
      {visible.map(item => {
        const pMeta = PRIORITY_META[item.priority];
        const mMeta = MISTAKE_META[item.dominantType];
        return (
          <div
            key={item.topic}
            className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-4 py-3"
          >
            {/* Header row */}
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-white/75">{item.topic}</p>
                <p className="mt-0.5 text-[10px] text-white/30">{item.subject}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className={`rounded border ${pMeta.border} ${pMeta.bg} px-1.5 py-0.5 text-[9px] font-semibold ${pMeta.color}`}>
                  {pMeta.label}
                </span>
                <span className={`rounded border ${mMeta.border} ${mMeta.bg} px-1.5 py-0.5 text-[9px] ${mMeta.color}`}>
                  {mMeta.label}
                </span>
              </div>
            </div>

            {/* Reason */}
            <p className="mb-3 text-[11px] leading-4 text-white/40">{item.reason}</p>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  router.push(`/test?mode=mistake&subject=${encodeURIComponent(item.subject)}&chapter=${encodeURIComponent(item.topic)}`)
                }
                className="cursor-pointer rounded border border-white/[0.08] px-2.5 py-1 text-[11px] text-white/45 transition-colors hover:border-white/18 hover:text-white/80"
              >
                Retry
              </button>
              <button
                onClick={() =>
                  router.push(`/revision/notes?subject=${encodeURIComponent(item.subject)}&chapter=${encodeURIComponent(item.topic)}`)
                }
                className="cursor-pointer rounded border border-[#8762F7]/25 bg-[#8762F7]/08 px-2.5 py-1 text-[11px] text-[#8762F7]/80 transition-colors hover:bg-[#8762F7]/15 hover:text-[#8762F7]"
              >
                Revise
              </button>
              {item.linkedFormulaChapterSlug && item.linkedSubjectSlug && (
                <button
                  onClick={() =>
                    router.push(`/revision/formula?sub=${item.linkedSubjectSlug}&ch=${item.linkedFormulaChapterSlug}`)
                  }
                  className="cursor-pointer rounded border border-[#38bdf8]/25 bg-[#38bdf8]/08 px-2.5 py-1 text-[11px] text-[#38bdf8]/80 transition-colors hover:bg-[#38bdf8]/15"
                >
                  Formulas
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-white/25">
      {children}
    </p>
  );
}

function EmptyState({ icon: Icon, text }: { icon: React.FC<{ size: number; className?: string }>; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded border border-dashed border-white/[0.07] py-8 text-center">
      <Icon size={20} className="text-white/15" />
      <p className="text-xs text-white/25">{text}</p>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function RevisionPage() {
  const router           = useRouter();
  const { data, loaded } = useOnboarding();
  const { revisionsExhausted, isLoading: accessLoading } = useAccess();
  const [showPlan,    setShowPlan]    = useState(false);
  const [showGate,    setShowGate]    = useState(false);
  const [activeMode,  setActiveMode]  = useState<RevMode | null>(null);
  const [revision,    setRevision]    = useState<RevisionData | null>(null);
  const [queue,       setQueue]       = useState<RevisionQueueItem[]>([]);
  const [queueLoading, setQueueLoading] = useState(true);

  const [revisionLoading, setRevisionLoading] = useState(true);

  useEffect(() => {
    fetchRevision()
      .then(setRevision)
      .catch(() => {/* revision data unavailable — show empty states */})
      .finally(() => setRevisionLoading(false));

    fetchRevisionQueue()
      .then(setQueue)
      .catch(() => setQueue([]))
      .finally(() => setQueueLoading(false));
  }, []);

  if (!loaded) return null;

  const examType    = (data.examType ?? 'jee') as ExamKey;
  const subjects    = getSubjects(data.examType, data.subjects);
  const subtitle    = SUBTITLE[examType];
  const modes       = REVISION_MODES[examType];
  const isObjective = examType === 'jee' || examType === 'neet';
  const scoreLabel    = SCORE_LABEL[examType];
  const solutionLabel = SOLUTION_LABEL[examType];

  const blocked    = !accessLoading && revisionsExhausted;
  const isFreeTier      = revision?._tier === 'free';
  const hasRevisionData = (revision?.queue.length ?? 0) > 0;
  const weakEntries: WeakEntry[] = hasRevisionData
    ? revision!.queue.map(item => ({ subject: item.subject, chapter: item.topic, score: item.accuracy }))
    : [];

  const weakGroups = groupBySubject(weakEntries);

  const mistakeLog: MistakeLogItem[] = revision?.mistakeLog ?? [];

  return (
    <div className="mx-auto max-w-7xl px-6 py-6">

      {/* PrepInsightGate modal */}
      {showGate && (
        <PrepInsightGate
          trigger="revision_limit"
          onClose={() => setShowGate(false)}
          weakTopics={weakEntries.map(e => ({
            topic: e.chapter, subject: e.subject,
            wrongCount: 0, totalAttempted: 0,
            accuracy: e.score, masteryScore: e.score, retentionScore: e.score,
            lastSeenAt: new Date().toISOString(),
          }))}
        />
      )}

      {/* Trial exhausted notice bar */}
      {blocked && (
        <div
          className="mb-6 flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-[#8762F7]/20 bg-[#8762F7]/[0.06] px-5 py-4"
          onClick={() => setShowGate(true)}
        >
          <div>
            <p className="text-sm font-semibold text-white/90">Free revision used</p>
            <p className="mt-0.5 text-xs text-white/45">
              Subscribe to unlock unlimited AI-powered revision plans.
            </p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); trackEvent('trial_revision_exhausted', { source: 'revision_banner' }); setShowGate(true); }}
            className="flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-[#8762F7]/35 bg-[#8762F7]/15 px-4 py-2 text-xs font-semibold text-[#8762F7] transition-all hover:border-[#8762F7]/55 hover:bg-[#8762F7]/25"
          >
            View plans
          </button>
        </div>
      )}

      {/* ── Header ── */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-white">Revision Center</h1>
            {hasRevisionData && (
              <span className="rounded-full border border-[#22c55e]/20 bg-[#22c55e]/[0.06] px-2 py-0.5 text-[10px] text-[#22c55e]/70">
                Live data
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-white/40">{subtitle}</p>
        </div>
        <button
          onClick={() => setShowPlan(true)}
          className="cursor-pointer self-start rounded-lg border border-[#8762F7]/30 bg-[#8762F7]/12 px-4 py-2 text-xs font-semibold text-[#8762F7] transition-colors hover:bg-[#8762F7]/22 whitespace-nowrap"
        >
          Generate Smart Revision Plan
        </button>
      </div>

      {/* ── Two-column body ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* ═══ LEFT ═══════════════════════════════════════════════════════════ */}
        <div className="space-y-6">

          {/* Smart Notes */}
          <section>
            <SectionLabel>Smart Notes</SectionLabel>
            <div className="space-y-2">
              {subjects.length === 0 ? (
                <EmptyState icon={BookOpen} text="No subjects found. Complete onboarding to continue." />
              ) : (
                subjects.map(subj => {
                  const count = chapterCount(data.examType, subj);
                  return (
                    <div
                      key={subj}
                      className="flex items-center justify-between rounded-lg border border-white/[0.07] bg-white/[0.02] px-4 py-3 transition-colors hover:border-white/[0.12] hover:bg-white/[0.04]"
                    >
                      <div>
                        <p className="text-sm font-medium text-white/80">{subj}</p>
                        {count > 0 && (
                          <p className="mt-0.5 text-[11px] text-white/30">{count} chapters</p>
                        )}
                      </div>
                      <Link
                        href="/revision/notes"
                        className="flex items-center gap-1 text-[11px] text-white/30 transition-colors hover:text-white/65"
                      >
                        View Notes <ChevronRight size={12} />
                      </Link>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* Quick Revision Modes */}
          <section>
            <SectionLabel>Quick Revision Modes</SectionLabel>
            <div className="grid grid-cols-2 gap-2.5">
              {modes.map(({ icon: Icon, label, desc, disabled }) => {
                if (disabled) {
                  return (
                    <div
                      key={label}
                      title="Not available for custom exams"
                      className="cursor-not-allowed rounded-lg border border-white/[0.04] bg-white/[0.01] p-4 opacity-40"
                    >
                      <Icon size={16} className="mb-2.5 text-white/20" />
                      <p className="text-xs font-medium text-white/40">{label}</p>
                      <p className="mt-0.5 text-[10px] text-white/20">{desc}</p>
                    </div>
                  );
                }

                const isActive = activeMode?.label === label;
                return (
                  <button
                    key={label}
                    onClick={() => setActiveMode(isActive ? null : { icon: Icon, label, desc })}
                    className={[
                      'cursor-pointer rounded-lg border p-4 text-left transition-colors',
                      isActive
                        ? 'border-[#8762F7]/35 bg-[#8762F7]/10'
                        : 'border-white/[0.07] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]',
                    ].join(' ')}
                  >
                    <Icon
                      size={16}
                      className={[
                        'mb-2.5 transition-colors',
                        isActive ? 'text-[#8762F7]/80' : 'text-white/30',
                      ].join(' ')}
                    />
                    <p className={[
                      'text-xs font-medium',
                      isActive ? 'text-white/90' : 'text-white/70',
                    ].join(' ')}>
                      {label}
                    </p>
                    <p className="mt-0.5 text-[10px] text-white/30">{desc}</p>
                  </button>
                );
              })}
            </div>

            {/* ── Active mode panel ── */}
            {activeMode && (
              activeMode.label === 'Rapid Drill' ? (
                <RapidDrillPanel
                  examType={examType}
                  subjects={subjects}
                  weakEntries={weakEntries}
                  onClose={() => setActiveMode(null)}
                />
              ) : activeMode.label === 'Formula Practice' ? (
                <FormulaPracticePanel
                  examType={examType}
                  subjects={subjects}
                  weakEntries={weakEntries}
                  onClose={() => setActiveMode(null)}
                />
              ) : activeMode.label === 'PYQ Mode' ? (
                <PYQPanel
                  examType={examType}
                  subjects={subjects}
                  weakEntries={weakEntries}
                  onClose={() => setActiveMode(null)}
                />
              ) : activeMode.label === 'Mistake Revision' ? (
                <MistakeRevisionPanel
                  examType={examType}
                  weakEntries={weakEntries}
                  onClose={() => setActiveMode(null)}
                />
              ) : (() => {
                const panel = getPanelContent(activeMode, examType, weakEntries);
                const Icon  = activeMode.icon;
                return (
                  <div className="mt-3 rounded-lg border border-[#8762F7]/20 bg-[#8762F7]/[0.04] p-4">
                    {/* Panel header */}
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon size={13} className="text-[#8762F7]/70" />
                        <p className="text-xs font-semibold text-white/80">{activeMode.label}</p>
                      </div>
                      <button
                        onClick={() => setActiveMode(null)}
                        className="cursor-pointer rounded p-1 text-white/25 transition-colors hover:bg-white/[0.05] hover:text-white/60"
                      >
                        <X size={13} />
                      </button>
                    </div>

                    {/* Heading */}
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-white/25">
                      {panel.heading}
                    </p>

                    {/* Item list */}
                    <div className="space-y-1.5">
                      {panel.items.map(item => (
                        <button
                          key={item}
                          onClick={() => console.log(activeMode.label, item)}
                          className="flex w-full cursor-pointer items-center justify-between rounded border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-left transition-colors hover:border-white/[0.12] hover:bg-white/[0.04]"
                        >
                          <span className="text-xs text-white/60 hover:text-white/85">{item}</span>
                          <ChevronRight size={11} className="shrink-0 text-white/20" />
                        </button>
                      ))}
                    </div>

                    {/* CTA */}
                    <button
                      onClick={() => console.log('Start', activeMode.label, examType)}
                      className="mt-3 w-full cursor-pointer rounded border border-[#8762F7]/30 bg-[#8762F7]/12 py-2 text-xs font-semibold text-[#8762F7] transition-colors hover:bg-[#8762F7]/22"
                    >
                      {panel.cta}
                    </button>
                  </div>
                );
              })()
            )}
          </section>

        </div>

        {/* ═══ RIGHT ══════════════════════════════════════════════════════════ */}
        <div className="space-y-6">

          {/* Weak Areas */}
          <section>
            <SectionLabel>
              Weak Areas
              {hasRevisionData && (
                <span className="ml-2 rounded-full border border-[#22c55e]/20 bg-[#22c55e]/[0.06] px-1.5 py-0.5 text-[9px] font-semibold text-[#22c55e]/70 normal-case tracking-normal">
                  live
                </span>
              )}
            </SectionLabel>
            {revisionLoading ? (
              <div className="space-y-2">
                {[1,2,3].map(i => <div key={i} className="h-16 animate-pulse rounded-lg bg-white/[0.03]" />)}
              </div>
            ) : weakGroups.size === 0 ? (
              <EmptyState icon={Target} text="No weak areas detected yet. Take a test to identify topics that need work" />
            ) : (
            <div className="space-y-4">
              {Array.from(weakGroups.entries()).map(([subj, entries]) => {
                const visibleEntries = isFreeTier ? entries.slice(0, 3) : entries;
                return (
                <div key={subj}>
                  <p className="mb-2 text-[11px] font-semibold text-white/35">{subj}</p>
                  <div className="space-y-1.5">
                    {visibleEntries.map(({ chapter, score }) => (
                      <button
                        key={chapter}
                        onClick={() =>
                          router.push(
                            `/revision/notes?subject=${encodeURIComponent(subj)}&chapter=${encodeURIComponent(chapter)}`,
                          )
                        }
                        className="group w-full cursor-pointer rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-left transition-colors hover:border-white/[0.11] hover:bg-white/[0.04]"
                      >
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <span className="truncate text-xs text-white/65 group-hover:text-white/85">
                            {chapter}
                          </span>
                          <span className={`shrink-0 text-xs font-semibold tabular-nums ${scoreColor(score)}`}>
                            {score}%
                          </span>
                        </div>
                        <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
                          <div
                            className={`h-1 rounded-full transition-all duration-500 ${barColor(score)}`}
                            style={{ width: `${score}%` }}
                          />
                        </div>
                        <p className="mt-1.5 text-[10px] text-white/20">{scoreLabel}</p>
                      </button>
                    ))}
                  </div>
                </div>
                );
              })}
              {isFreeTier && (
                <UpgradeBanner
                  title="Full weak-area analysis locked"
                  description="Upgrade to see all weak topics and your complete AI-driven revision plan."
                />
              )}
            </div>
            )}
          </section>

          {/* Smart Revision Queue */}
          <section>
            <SectionLabel>
              Smart Revision Queue
              {queue.length > 0 && (
                <span className="ml-2 rounded-full border border-[#8762F7]/20 bg-[#8762F7]/[0.06] px-1.5 py-0.5 text-[9px] font-semibold text-[#8762F7]/70 normal-case tracking-normal">
                  AI ranked
                </span>
              )}
            </SectionLabel>
            <SmartRevisionQueue
              queue={queue}
              loading={queueLoading}
              isFreeTier={isFreeTier}
              router={router}
            />
          </section>

          {/* Mistake Log */}
          <section>
            <SectionLabel>Mistake Log</SectionLabel>
            {isFreeTier ? (
              <UpgradeBanner
                title="Mistake Log — Pro feature"
                description="Upgrade to track every wrong answer and revisit your past mistakes."
              />
            ) : mistakeLog.length === 0 ? (
              <EmptyState icon={ClipboardX} text="No mistakes recorded yet. Take a test to start tracking." />
            ) : (
              <div className="max-h-[420px] space-y-2 overflow-y-auto [&::-webkit-scrollbar]:hidden">
                {mistakeLog.map(({ topic, subject, wrongCount, lastSeen }, i) => (
                  <div
                    key={`${topic}-${i}`}
                    className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3"
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-white/70">{topic}</p>
                        <p className="mt-0.5 text-[10px] text-white/30">{subject}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-0.5">
                        <span className="text-[10px] text-white/25 tabular-nums">
                          {timeAgo(lastSeen)}
                        </span>
                        <span className="text-[10px] font-semibold text-[#ef4444]/60">
                          {wrongCount}✗
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          router.push(
                            `/test?mode=mistake&subject=${encodeURIComponent(subject)}&chapter=${encodeURIComponent(topic)}`,
                          )
                        }
                        className="cursor-pointer rounded border border-white/[0.08] px-3 py-1 text-[11px] text-white/45 transition-colors hover:border-white/18 hover:text-white/80"
                      >
                        Retry
                      </button>
                      <button
                        onClick={() =>
                          router.push(
                            `/revision/notes?subject=${encodeURIComponent(subject)}&chapter=${encodeURIComponent(topic)}`,
                          )
                        }
                        className="cursor-pointer rounded border border-[#8762F7]/25 bg-[#8762F7]/08 px-3 py-1 text-[11px] text-[#8762F7]/80 transition-colors hover:bg-[#8762F7]/15 hover:text-[#8762F7]"
                      >
                        {solutionLabel}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

        </div>
      </div>

      {showPlan && (
        <RevisionPlanModal
          examType={examType}
          weakEntries={weakEntries}
          plan={revision?.plan}
          onClose={() => setShowPlan(false)}
        />
      )}
    </div>
  );
}
