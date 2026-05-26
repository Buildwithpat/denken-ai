'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  fetchWeekPlan,
  type WeekPlan,
  type DayPlan,
  type StudySession,
  type PriorityLabel,
  type LoadLevel,
  type ActivityType,
  type BurnoutRisk,
  type StudyPhase,
  type IntensityChange,
  type AdaptiveTestSuggestion,
} from '@/lib/plannerApi';
import {
  CalendarDays, Flame, Clock, Target, BookOpen,
  FlaskConical, RotateCcw, Zap, RefreshCw,
  ChevronRight, AlertTriangle, CheckCircle2, TrendingUp,
  TrendingDown, Minus, ShieldCheck, Sparkles,
  Brain, BookMarked, Layers, BarChart3, ArrowRight,
} from 'lucide-react';
import { parseGateEvent, type GateEvent } from '@/lib/gateError';
import UpgradeModal from '@/components/upgrade/UpgradeModal';

// ── Colour helpers ────────────────────────────────────────────────────────────

const PRIORITY_STYLES: Record<PriorityLabel, { badge: string; dot: string; bar: string }> = {
  critical: { badge: 'bg-[#ef4444]/10 text-[#ef4444]/80 border-[#ef4444]/20', dot: 'bg-[#ef4444]',   bar: 'bg-[#ef4444]'   },
  high:     { badge: 'bg-[#f59e0b]/10 text-[#f59e0b]/80 border-[#f59e0b]/20', dot: 'bg-[#f59e0b]',   bar: 'bg-[#f59e0b]'   },
  medium:   { badge: 'bg-[#8762F7]/10 text-[#8762F7]/80 border-[#8762F7]/20', dot: 'bg-[#8762F7]',   bar: 'bg-[#8762F7]'   },
  low:      { badge: 'bg-white/[0.06] text-white/35 border-white/[0.08]',      dot: 'bg-white/30',    bar: 'bg-white/20'    },
};

const LOAD_STYLES: Record<LoadLevel, { bar: string; label: string }> = {
  heavy:    { bar: 'bg-[#ef4444]/40', label: 'Heavy'    },
  moderate: { bar: 'bg-[#f59e0b]/40', label: 'Moderate' },
  light:    { bar: 'bg-[#22c55e]/40', label: 'Light'    },
};

const ACTIVITY_ICONS: Record<ActivityType, React.FC<{ size: number; className?: string }>> = {
  theory:    BookOpen,
  practice:  Zap,
  review:    RotateCcw,
  mock_prep: FlaskConical,
};

const ACTIVITY_LABELS: Record<ActivityType, string> = {
  theory:    'Theory',
  practice:  'Practice',
  review:    'Review',
  mock_prep: 'Mock Prep',
};

const BURNOUT_STYLES: Record<BurnoutRisk, { color: string; label: string; icon: typeof AlertTriangle }> = {
  high:     { color: 'text-[#ef4444]/80', label: 'High burnout risk', icon: AlertTriangle  },
  moderate: { color: 'text-[#f59e0b]/80', label: 'Moderate risk',     icon: AlertTriangle  },
  low:      { color: 'text-[#f59e0b]/60', label: 'Low risk',          icon: AlertTriangle  },
  none:     { color: 'text-[#22c55e]/70', label: 'Good pace',         icon: CheckCircle2   },
};

const PHASE_COLORS: Record<StudyPhase, string> = {
  foundation:    'text-[#22c55e]/70',
  consolidation: 'text-[#8762F7]/70',
  intensive:     'text-[#f59e0b]/70',
  revision:      'text-[#ef4444]/70',
  final:         'text-[#ef4444]/90',
  'post-exam':   'text-white/40',
};

const URGENCY_COLOR: Record<string, string> = {
  critical: 'text-[#ef4444]',
  high:     'text-[#f59e0b]',
  medium:   'text-[#8762F7]',
  low:      'text-white/40',
};

// ── Shared sub-components ─────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-white/25">
      {children}
    </p>
  );
}

function StatCard({
  label, value, sub, icon: Icon, color = 'text-white/70',
}: {
  label: string; value: string; sub?: string;
  icon: React.FC<{ size: number; className?: string }>;
  color?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-white/[0.07] bg-white/[0.02] px-4 py-3">
      <div className="flex items-center gap-2">
        <Icon size={13} className="text-white/25" />
        <p className="text-[10px] text-white/30">{label}</p>
      </div>
      <p className={`text-base font-semibold tabular-nums ${color}`}>{value}</p>
      {sub && <p className="text-[10px] text-white/25">{sub}</p>}
    </div>
  );
}

// ── Today Focus Panel ─────────────────────────────────────────────────────────

function TodayFocusPanel({
  insight,
  syllabusProgress,
  isNewUser,
}: {
  insight: string;
  syllabusProgress: number;
  isNewUser: boolean;
}) {
  return (
    <div className="rounded-xl border border-[#8762F7]/20 bg-gradient-to-br from-[#8762F7]/[0.08] to-transparent px-5 py-4">
      <div className="mb-2 flex items-center gap-2">
        <Brain size={13} className="text-[#8762F7]/70" />
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8762F7]/50">
          {isNewUser ? "Getting Started" : "Today's Focus"}
        </p>
      </div>
      <p className="text-sm leading-6 text-white/75">{insight}</p>

      {!isNewUser && syllabusProgress > 0 && (
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-[10px] text-white/30">Syllabus coverage</p>
            <p className="text-[10px] font-semibold tabular-nums text-white/50">{syllabusProgress}%</p>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#8762F7] to-[#a78bfa] transition-all duration-700"
              style={{ width: `${syllabusProgress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Session Card ──────────────────────────────────────────────────────────────

function SessionCard({ session }: { session: StudySession }) {
  const router  = useRouter();
  const Icon    = ACTIVITY_ICONS[session.activity];
  const pStyle  = PRIORITY_STYLES[session.priority];
  const hasFormula = session.linkedFormulaSlug && session.linkedFormulaSubject;

  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Icon size={13} className="mt-0.5 shrink-0 text-white/30" />
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-white/75">{session.topic}</p>
            <p className="text-[10px] text-white/35">{session.subject}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${pStyle.badge}`}>
            {session.priority}
          </span>
          <span className="text-[10px] text-white/25 tabular-nums">{session.durationMin} min</span>
        </div>
      </div>

      {/* Meta row */}
      <div className="mt-2 flex items-center gap-2 flex-wrap">
        <span className="rounded border border-white/[0.07] bg-white/[0.03] px-2 py-0.5 text-[10px] text-white/40">
          {ACTIVITY_LABELS[session.activity]}
        </span>
        <span className="text-[10px] text-white/25 capitalize">{session.slot}</span>
        {session.mistakeType && (
          <span className="rounded border border-[#f59e0b]/20 bg-[#f59e0b]/[0.06] px-1.5 py-0.5 text-[9px] text-[#f59e0b]/60 capitalize">
            {session.mistakeType.replace('-', ' ')}
          </span>
        )}
      </div>

      {/* Mastery + retention bars */}
      {session.masteryScore > 0 && (
        <div className="mt-3 space-y-1.5">
          <div>
            <div className="mb-0.5 flex items-center justify-between">
              <span className="text-[9px] text-white/25">Mastery</span>
              <span className="text-[9px] tabular-nums text-white/35">{session.masteryScore}%</span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.05]">
              <div
                className={`h-full rounded-full transition-all ${pStyle.bar}`}
                style={{ width: `${session.masteryScore}%` }}
              />
            </div>
          </div>
          <div>
            <div className="mb-0.5 flex items-center justify-between">
              <span className="text-[9px] text-white/25">Retention</span>
              <span className="text-[9px] tabular-nums text-white/35">{session.retentionScore}%</span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.05]">
              <div
                className={`h-full rounded-full transition-all ${session.retentionScore < 50 ? 'bg-[#ef4444]/50' : 'bg-[#8762F7]/50'}`}
                style={{ width: `${session.retentionScore}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Reasoning */}
      <p className="mt-2 text-[10px] leading-relaxed text-white/30">{session.reasoning || session.rationale}</p>

      {/* Action buttons */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() =>
            router.push(`/revision/notes?subject=${encodeURIComponent(session.subject)}&chapter=${encodeURIComponent(session.topic)}`)
          }
          className="flex cursor-pointer items-center gap-1 rounded border border-white/[0.08] px-2.5 py-1 text-[11px] text-white/45 transition-colors hover:border-white/18 hover:text-white/80"
        >
          <BookOpen size={10} />
          Revise
        </button>
        {hasFormula && (
          <button
            onClick={() =>
              router.push(`/revision/formula?sub=${session.linkedFormulaSubject}&ch=${session.linkedFormulaSlug}`)
            }
            className="flex cursor-pointer items-center gap-1 rounded border border-[#38bdf8]/20 bg-[#38bdf8]/[0.05] px-2.5 py-1 text-[11px] text-[#38bdf8]/70 transition-colors hover:bg-[#38bdf8]/12"
          >
            <FlaskConical size={10} />
            Formulas
          </button>
        )}
        {session.suggestTest && (
          <button
            onClick={() =>
              router.push(`/denkenstudio?subject=${encodeURIComponent(session.subject)}&chapter=${encodeURIComponent(session.topic)}`)
            }
            className="flex cursor-pointer items-center gap-1 rounded border border-[#8762F7]/25 bg-[#8762F7]/[0.08] px-2.5 py-1 text-[11px] text-[#8762F7]/80 transition-colors hover:bg-[#8762F7]/18"
          >
            <Zap size={10} />
            Take Test
          </button>
        )}
      </div>
    </div>
  );
}

// ── Day Card ──────────────────────────────────────────────────────────────────

function DayCard({
  day, selected, onClick,
}: {
  day: DayPlan; selected: boolean; onClick: () => void;
}) {
  const load = LOAD_STYLES[day.loadLevel];
  return (
    <button
      onClick={onClick}
      className={[
        'flex flex-col items-center gap-1.5 rounded-lg border px-3 py-3 text-center transition-all cursor-pointer min-w-0',
        selected
          ? 'border-[#8762F7]/35 bg-[#8762F7]/10'
          : 'border-white/[0.07] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]',
      ].join(' ')}
    >
      <p className={`text-[11px] font-medium ${selected ? 'text-white/90' : 'text-white/50'}`}>
        {day.dayLabel}
      </p>

      {day.isRestDay ? (
        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.06]">
          <span className="text-xs text-white/20">–</span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1">
          <div className="flex gap-0.5">
            {day.sessions.map((s, i) => (
              <div key={i} className={`h-1.5 w-1.5 rounded-full ${PRIORITY_STYLES[s.priority].dot}`} />
            ))}
          </div>
          <p className="text-[9px] text-white/25 tabular-nums">{day.totalMin} min</p>
        </div>
      )}

      <div className={`h-0.5 w-6 rounded-full ${load.bar}`} />
      <p className="text-[9px] text-white/25">{load.label}</p>
    </button>
  );
}

// ── Mistake Insights Panel ────────────────────────────────────────────────────

function MistakeInsightsPanel({ insights }: { insights: string[] }) {
  if (insights.length === 0) return null;
  return (
    <section>
      <SectionLabel>Mistake Intelligence</SectionLabel>
      <div className="space-y-2">
        {insights.map((insight, i) => (
          <div
            key={i}
            className="flex items-start gap-3 rounded-lg border border-[#f59e0b]/15 bg-[#f59e0b]/[0.04] px-4 py-3"
          >
            <Brain size={12} className="mt-0.5 shrink-0 text-[#f59e0b]/50" />
            <p className="text-[11px] leading-5 text-white/55">{insight}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Adaptive Test Suggestion Card ─────────────────────────────────────────────

function AdaptiveTestCard({
  suggestion,
  router,
}: {
  suggestion: AdaptiveTestSuggestion;
  router: ReturnType<typeof useRouter>;
}) {
  const urgencyColor = URGENCY_COLOR[suggestion.urgency] ?? 'text-white/50';

  return (
    <section>
      <SectionLabel>Recommended Next Test</SectionLabel>
      <div className="rounded-xl border border-[#8762F7]/20 bg-[#8762F7]/[0.05] px-4 py-4">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-white/80">{suggestion.title}</p>
            <span className={`text-[10px] font-medium capitalize ${urgencyColor}`}>
              {suggestion.urgency} priority
            </span>
          </div>
          <Sparkles size={14} className="shrink-0 text-[#8762F7]/50" />
        </div>
        <p className="mb-4 text-[11px] leading-5 text-white/45">{suggestion.reason}</p>
        <button
          onClick={() => router.push('/denkenstudio')}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#8762F7]/30 bg-[#8762F7]/12 py-2 text-xs font-semibold text-[#8762F7] transition-colors hover:bg-[#8762F7]/22"
        >
          <Zap size={12} />
          Open DenkenStudio
          <ArrowRight size={11} />
        </button>
      </div>
    </section>
  );
}

// ── Top Priority Topics (enhanced with mastery/retention bars) ─────────────────

function TopPriorityTopics({
  topics,
  router,
}: {
  topics: WeekPlan['summary']['topPriorityTopics'];
  router: ReturnType<typeof useRouter>;
}) {
  if (topics.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-white/[0.07] py-8 text-center">
        <Target size={20} className="text-white/15" />
        <p className="text-xs text-white/25">No weak topics detected yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {topics.map((t, i) => (
        <div
          key={t.topic}
          className={[
            'rounded-lg border px-4 py-3',
            t.urgent
              ? 'border-[#ef4444]/20 bg-[#ef4444]/[0.03]'
              : 'border-white/[0.06] bg-white/[0.02]',
          ].join(' ')}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-semibold text-white/25 tabular-nums">#{i + 1}</span>
                <p className="truncate text-xs font-medium text-white/75">{t.topic}</p>
                {t.urgent && (
                  <span className="rounded border border-[#ef4444]/25 bg-[#ef4444]/10 px-1.5 py-0.5 text-[9px] font-semibold text-[#ef4444]/70">
                    URGENT
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[10px] text-white/35">{t.subject}</p>
            </div>
          </div>

          {/* Mastery bar */}
          {t.masteryScore != null && t.masteryScore > 0 && (
            <div className="mt-2.5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-white/25">Mastery</span>
                <span className="text-[9px] tabular-nums text-white/35">{t.masteryScore}%</span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.05]">
                <div
                  className={`h-full rounded-full ${(t.masteryScore ?? 0) < 40 ? 'bg-[#ef4444]/50' : (t.masteryScore ?? 0) < 60 ? 'bg-[#f59e0b]/50' : 'bg-[#8762F7]/50'}`}
                  style={{ width: `${t.masteryScore}%` }}
                />
              </div>
            </div>
          )}

          <p className="mt-1.5 text-[10px] leading-relaxed text-white/30">{t.reason}</p>

          {/* Quick-action link */}
          <button
            onClick={() =>
              router.push(`/revision/notes?subject=${encodeURIComponent(t.subject)}&chapter=${encodeURIComponent(t.topic)}`)
            }
            className="mt-2 flex cursor-pointer items-center gap-1 text-[10px] text-[#8762F7]/60 transition-colors hover:text-[#8762F7]"
          >
            Revise now <ChevronRight size={10} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Intensity indicator helper ────────────────────────────────────────────────

const INTENSITY_META: Record<IntensityChange, { icon: typeof TrendingUp; color: string; label: string }> = {
  increase: { icon: TrendingUp,   color: 'text-[#ef4444]/70', label: 'Increase recommended' },
  reduce:   { icon: TrendingDown, color: 'text-[#22c55e]/70', label: 'Reduce recommended'   },
  maintain: { icon: Minus,        color: 'text-white/35',     label: 'On track'              },
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PlannerPage() {
  const router    = useRouter();
  const [plan, setPlan]               = useState<WeekPlan | null>(null);
  const [loading, setLoading]         = useState(true);
  const [selectedDay, setSelectedDay] = useState(0);
  const [refreshing, setRefreshing]   = useState(false);
  const [gateEvent, setGateEvent]     = useState<GateEvent | null>(null);

  async function load() {
    try {
      const data = await fetchWeekPlan();
      setPlan(data);
    } catch (err) {
      const gate = parseGateEvent(err);
      if (gate) setGateEvent(gate);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);

  const summary     = plan?.summary ?? null;
  const days        = plan?.days    ?? [];
  const activeDay   = days[selectedDay];
  const burnout     = BURNOUT_STYLES[summary?.burnoutRisk ?? 'none'];
  const BurnoutIcon = burnout.icon;
  const intensity   = INTENSITY_META[summary?.intensityChange ?? 'maintain'];
  const IntensityIcon = intensity.icon;

  return (
    <>
    {gateEvent && <UpgradeModal gate={gateEvent} onClose={() => setGateEvent(null)} />}
    <div className="mx-auto max-w-7xl px-6 py-6">

      {/* ── Header ── */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-semibold text-white">Study Planner</h1>
            {!loading && summary && (
              <span className={`text-[10px] font-medium ${PHASE_COLORS[summary.studyPhase]}`}>
                {summary.phaseLabel}
              </span>
            )}
            {!loading && summary && summary.readinessScore > 0 && (
              <span className="flex items-center gap-1 rounded-full border border-[#8762F7]/20 bg-[#8762F7]/[0.07] px-2 py-0.5 text-[10px] text-[#8762F7]/70">
                <ShieldCheck size={9} />
                {summary.readinessScore}/100 ready
              </span>
            )}
            {!loading && summary?.isNewUser && (
              <span className="rounded-full border border-[#22c55e]/20 bg-[#22c55e]/[0.07] px-2 py-0.5 text-[10px] text-[#22c55e]/70">
                Getting started
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-white/40">
            {summary?.phaseDescription ?? 'Take your first test to generate a personalised study plan.'}
          </p>
        </div>
        <button
          onClick={() => { setRefreshing(true); load(); }}
          disabled={refreshing}
          className="flex cursor-pointer items-center gap-2 self-start rounded-lg border border-[#8762F7]/30 bg-[#8762F7]/12 px-4 py-2 text-xs font-semibold text-[#8762F7] transition-colors hover:bg-[#8762F7]/22 disabled:opacity-50"
        >
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          Regenerate Plan
        </button>
      </div>

      {/* ── Loading skeleton ── */}
      {loading && (
        <div className="space-y-4">
          <div className="h-20 animate-pulse rounded-xl bg-white/[0.03]" />
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-white/[0.03]" />
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-lg bg-white/[0.03]" />
            ))}
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && !plan && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03]">
            <CalendarDays size={24} className="text-white/20" />
          </div>
          <p className="text-base font-semibold text-white/50">No study plan yet</p>
          <p className="mt-2 max-w-[300px] text-sm leading-relaxed text-white/25">
            Generate your first test and Denken will build a personalised weekly study plan based on your performance.
          </p>
          <a
            href="/denkenstudio"
            className="mt-6 flex cursor-pointer items-center gap-2 rounded-lg border border-[#8762F7]/30 bg-[#8762F7]/12 px-5 py-2.5 text-sm font-semibold text-[#8762F7] transition-all hover:border-[#8762F7]/50 hover:bg-[#8762F7]/20 hover:text-white"
          >
            <Sparkles size={14} /> Generate your first test
          </a>
        </div>
      )}

      {/* ── Full plan UI ── */}
      {!loading && plan && summary && (<>

      {/* Critical message banner */}
      {summary.criticalMessage && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-[#ef4444]/25 bg-[#ef4444]/[0.05] px-4 py-3">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-[#ef4444]/70" />
          <p className="text-xs leading-relaxed text-[#ef4444]/80">{summary.criticalMessage}</p>
        </div>
      )}

      {/* Today Focus Panel */}
      <div className="mb-6">
        <TodayFocusPanel
          insight={summary.todayInsight}
          syllabusProgress={summary.syllabusProgress}
          isNewUser={summary.isNewUser}
        />
      </div>

      {/* Summary stat row */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Days to Exam"
          value={summary.daysToExam != null ? String(summary.daysToExam) : '—'}
          sub={summary.examDate
            ? new Date(summary.examDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
            : 'Set target year in profile'}
          icon={CalendarDays}
          color={summary.daysToExam != null && summary.daysToExam <= 30 ? 'text-[#ef4444]/80' : 'text-white/70'}
        />
        <div className="flex flex-col gap-1 rounded-lg border border-white/[0.07] bg-white/[0.02] px-4 py-3">
          <div className="flex items-center gap-2">
            <Clock size={13} className="text-white/25" />
            <p className="text-[10px] text-white/30">Daily Target</p>
          </div>
          <div className="flex items-center gap-1.5">
            <p className="text-base font-semibold tabular-nums text-white/70">
              {summary.dailyTargetMin} min
            </p>
            <IntensityIcon size={11} className={intensity.color} />
          </div>
          <p className="text-[10px] text-white/25">{intensity.label}</p>
        </div>
        <StatCard
          label="Study Streak"
          value={summary.streakDays > 0 ? `${summary.streakDays} days` : '—'}
          sub={summary.streakDays >= 7 ? 'Outstanding!' : summary.streakDays > 0 ? 'Keep it up' : 'Start today'}
          icon={Flame}
          color={summary.streakDays >= 7 ? 'text-[#f59e0b]/80' : 'text-white/70'}
        />
        <StatCard
          label="Burnout Risk"
          value={burnout.label}
          icon={BurnoutIcon}
          color={burnout.color}
        />
      </div>

      {/* Weekly goal banner */}
      <div className="mb-6 flex items-center gap-3 rounded-lg border border-[#8762F7]/15 bg-[#8762F7]/[0.05] px-4 py-3">
        <TrendingUp size={14} className="shrink-0 text-[#8762F7]/60" />
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25">Weekly Goal</p>
          <p className="truncate text-xs text-white/65">{summary.weeklyGoal}</p>
        </div>
      </div>

      {/* ── Two-column body ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">

        {/* ═══ LEFT — week grid + day detail ═══════════════════════════════════ */}
        <div className="space-y-6">

          <section>
            <SectionLabel>This Week</SectionLabel>
            <div className="grid grid-cols-7 gap-2">
              {days.map((day, i) => (
                <DayCard
                  key={day.date || i}
                  day={day}
                  selected={selectedDay === i}
                  onClick={() => setSelectedDay(i)}
                />
              ))}
            </div>
          </section>

          {activeDay && (
            <section>
              <SectionLabel>
                {activeDay.dayLabel} · {activeDay.isRestDay ? 'Rest Day' : `${activeDay.totalMin} min planned`}
              </SectionLabel>

              {activeDay.isRestDay || activeDay.sessions.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-white/[0.07] py-10 text-center">
                  <CalendarDays size={20} className="text-white/15" />
                  <p className="text-xs text-white/25">
                    {activeDay.isRestDay
                      ? 'Rest day — recovery builds long-term stamina'
                      : summary.isNewUser
                      ? 'Take a test today to unlock personalised sessions for this day'
                      : 'No sessions planned — take a test to improve your plan'}
                  </p>
                  {summary.isNewUser && (
                    <a
                      href="/denkenstudio"
                      className="mt-3 flex items-center gap-1.5 rounded border border-[#8762F7]/30 px-3 py-1.5 text-xs font-semibold text-[#8762F7] transition-colors hover:bg-[#8762F7]/10"
                    >
                      <Sparkles size={11} /> Start here
                    </a>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {activeDay.sessions.map((session, i) => (
                    <SessionCard key={`${session.topic}-${i}`} session={session} />
                  ))}
                </div>
              )}
            </section>
          )}
        </div>

        {/* ═══ RIGHT ════════════════════════════════════════════════════════════ */}
        <div className="space-y-6">

          {/* Adaptive test suggestion */}
          {summary.adaptiveTestSuggestion && (
            <AdaptiveTestCard suggestion={summary.adaptiveTestSuggestion} router={router} />
          )}

          {/* Mistake insights */}
          {summary.mistakeInsights.length > 0 && (
            <MistakeInsightsPanel insights={summary.mistakeInsights} />
          )}

          {/* Top priority topics */}
          <section>
            <SectionLabel>Top Priority Topics</SectionLabel>
            <TopPriorityTopics topics={summary.topPriorityTopics} router={router} />
          </section>

          {/* Phase guide */}
          <section>
            <SectionLabel>Study Phase Guide</SectionLabel>
            <div className="space-y-1.5">
              {(
                [
                  ['foundation',    'Foundation',    '>120 days'],
                  ['consolidation', 'Consolidation', '60–120 days'],
                  ['intensive',     'Intensive',     '30–60 days'],
                  ['revision',      'Revision',      '15–30 days'],
                  ['final',         'Final Sprint',  '<15 days'],
                ] as const
              ).map(([phase, label, range]) => (
                <div
                  key={phase}
                  className={[
                    'flex items-center justify-between rounded border px-3 py-2 text-[11px]',
                    summary.studyPhase === phase
                      ? 'border-[#8762F7]/25 bg-[#8762F7]/[0.07] text-white/80'
                      : 'border-white/[0.05] bg-transparent text-white/30',
                  ].join(' ')}
                >
                  <span className="font-medium">{label}</span>
                  <span className="tabular-nums text-white/25">{range}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Quick links */}
          <section>
            <SectionLabel>Quick Actions</SectionLabel>
            <div className="space-y-1.5">
              {[
                { label: 'View Revision Queue',  icon: RotateCcw,  href: '/revision' },
                { label: 'Performance Analytics', icon: BarChart3,  href: '/analysis' },
                { label: 'Formula Library',        icon: FlaskConical, href: '/revision/formula' },
                { label: 'DenkenStudio',           icon: Sparkles,  href: '/denkenstudio' },
              ].map(({ label, icon: Icon, href }) => (
                <a
                  key={label}
                  href={href}
                  className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 transition-colors hover:border-white/[0.12] hover:bg-white/[0.04]"
                >
                  <div className="flex items-center gap-2">
                    <Icon size={12} className="text-white/30" />
                    <span className="text-xs text-white/55">{label}</span>
                  </div>
                  <ChevronRight size={11} className="text-white/20" />
                </a>
              ))}
            </div>
          </section>

        </div>
      </div>

      </>)}
    </div>
    </>
  );
}
