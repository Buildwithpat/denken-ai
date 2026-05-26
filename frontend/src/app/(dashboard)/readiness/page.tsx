'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  fetchReadinessReport,
  type ReadinessReport,
  type SubjectReadiness,
  type WeaknessForecast,
  type ReadinessTrend,
  type IntensityChange,
  type BurnoutRisk,
  type StudyPhase,
} from '@/lib/readinessApi';
import {
  TrendingUp, TrendingDown, Minus, AlertTriangle,
  CheckCircle2, Flame, CalendarDays, Clock, Target,
  ChevronRight, RefreshCw, Zap, BarChart2, BookOpen,
  ArrowUp, ArrowDown,
} from 'lucide-react';
import { parseGateEvent, type GateEvent } from '@/lib/gateError';
import UpgradeModal from '@/components/upgrade/UpgradeModal';

// ── Visual helpers ────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 75) return 'text-[#22c55e]';
  if (score >= 50) return 'text-[#f59e0b]';
  return 'text-[#ef4444]';
}

function scoreBarColor(score: number): string {
  if (score >= 75) return 'bg-[#22c55e]';
  if (score >= 50) return 'bg-[#f59e0b]';
  return 'bg-[#ef4444]';
}

function scoreBg(score: number): string {
  if (score >= 75) return 'border-[#22c55e]/20 bg-[#22c55e]/[0.04]';
  if (score >= 50) return 'border-[#f59e0b]/20 bg-[#f59e0b]/[0.03]';
  return 'border-[#ef4444]/20 bg-[#ef4444]/[0.04]';
}

const RISK_STYLES: Record<WeaknessForecast['riskLevel'], { badge: string; dot: string }> = {
  critical: { badge: 'bg-[#ef4444]/10 text-[#ef4444]/80 border-[#ef4444]/25', dot: 'bg-[#ef4444]' },
  high:     { badge: 'bg-[#f59e0b]/10 text-[#f59e0b]/80 border-[#f59e0b]/25', dot: 'bg-[#f59e0b]' },
  medium:   { badge: 'bg-[#8762F7]/10 text-[#8762F7]/80 border-[#8762F7]/25', dot: 'bg-[#8762F7]' },
};

const TREND_ICON: Record<ReadinessTrend, React.FC<{ size: number; className?: string }>> = {
  improving: TrendingUp,
  declining: TrendingDown,
  stable:    Minus,
};

const TREND_COLOR: Record<ReadinessTrend, string> = {
  improving: 'text-[#22c55e]',
  declining: 'text-[#ef4444]',
  stable:    'text-white/30',
};

const BURNOUT_META: Record<BurnoutRisk, { label: string; color: string }> = {
  none:     { label: 'No risk',      color: 'text-[#22c55e]/70' },
  low:      { label: 'Low risk',     color: 'text-[#f59e0b]/60' },
  moderate: { label: 'Moderate risk', color: 'text-[#f59e0b]/80' },
  high:     { label: 'High risk',    color: 'text-[#ef4444]/80' },
};

const INTENSITY_META: Record<IntensityChange, { label: string; icon: typeof ArrowUp; color: string }> = {
  increase: { label: 'Increase intensity', icon: ArrowUp,   color: 'text-[#ef4444]/70' },
  maintain: { label: 'Maintain intensity', icon: Minus,     color: 'text-[#22c55e]/70' },
  reduce:   { label: 'Reduce intensity',   icon: ArrowDown, color: 'text-[#f59e0b]/70' },
};

const PHASE_COLOR: Record<StudyPhase, string> = {
  foundation:    'text-[#22c55e]/60',
  consolidation: 'text-[#8762F7]/70',
  intensive:     'text-[#f59e0b]/70',
  revision:      'text-[#ef4444]/70',
  final:         'text-[#ef4444]/90',
  'post-exam':   'text-white/35',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-white/25">
      {children}
    </p>
  );
}

function ReadinessGauge({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 52;
  const filled        = circumference * (score / 100);
  const color =
    score >= 75 ? '#22c55e' :
    score >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative flex h-32 w-32 items-center justify-center">
      <svg className="absolute -rotate-90" width="128" height="128" viewBox="0 0 128 128">
        <circle cx="64" cy="64" r="52" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
        <circle
          cx="64" cy="64" r="52"
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
      </svg>
      <div className="text-center">
        <p className={`text-2xl font-bold tabular-nums ${scoreColor(score)}`}>{score}</p>
        <p className="text-[9px] text-white/30">/ 100</p>
      </div>
    </div>
  );
}

function ConfidenceBandBar({ report }: { report: ReadinessReport }) {
  const { low, expected, high, note } = report.confidence;
  const range = Math.max(1, high - low);
  const expectedPct = Math.round(((expected - low) / range) * 100);

  return (
    <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-4 py-3">
      <div className="mb-2 flex items-center justify-between text-[10px] text-white/35">
        <span className="tabular-nums">{low}</span>
        <span className="font-semibold text-white/60">Expected: {expected}</span>
        <span className="tabular-nums">{high}</span>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/[0.07]">
        <div
          className={`h-2 rounded-full ${scoreBarColor(expected)}`}
          style={{ width: `${high}%` }}
        />
        <div
          className="absolute top-0 h-2 w-0.5 bg-white/70"
          style={{ left: `${expectedPct}%` }}
        />
      </div>
      <p className="mt-2 text-[10px] text-white/30">{note}</p>
    </div>
  );
}

function SubjectCard({ s, daysToExam }: { s: SubjectReadiness; daysToExam: number | null }) {
  const TrendIcon  = TREND_ICON[s.trend];
  const trendColor = TREND_COLOR[s.trend];

  return (
    <div className={`rounded-lg border p-4 ${scoreBg(s.score)}`}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white/85">{s.subject}</p>
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-white/30">Accuracy {s.accuracy}%</span>
            <span className="text-[10px] text-white/25">·</span>
            <span className="text-[10px] text-white/30">Retention {s.retentionHealth}%</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={`text-lg font-bold tabular-nums ${scoreColor(s.score)}`}>{s.score}</span>
          <TrendIcon size={11} className={trendColor} />
        </div>
      </div>

      {/* Score bar */}
      <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
        <div
          className={`h-1.5 rounded-full transition-all duration-700 ${scoreBarColor(s.score)}`}
          style={{ width: `${s.score}%` }}
        />
      </div>

      {/* Stats row */}
      <div className="mb-3 flex gap-3 text-[10px] text-white/30">
        <span>Consistency {s.consistencyScore}%</span>
        {s.weakTopicCount > 0 && (
          <span className="text-[#ef4444]/60">{s.weakTopicCount} weak topic{s.weakTopicCount > 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Critical topics */}
      {s.criticalTopics.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {s.criticalTopics.map((t) => (
            <span
              key={t}
              className="rounded border border-[#ef4444]/15 bg-[#ef4444]/[0.06] px-1.5 py-0.5 text-[9px] text-[#ef4444]/60"
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ForecastRow({ f }: { f: WeaknessForecast }) {
  const style = RISK_STYLES[f.riskLevel];
  const retentionDelta = f.examDateRetention !== null
    ? f.examDateRetention - f.currentRetention
    : null;

  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${style.badge}`}>
              {f.riskLevel}
            </span>
            <p className="text-xs font-medium text-white/75">{f.topic}</p>
          </div>
          <p className="mt-0.5 text-[10px] text-white/35">{f.subject}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] text-white/30 tabular-nums">
            Now <span className="text-white/55">{f.currentRetention}%</span>
          </p>
          {f.examDateRetention !== null && (
            <p className="text-[10px] text-white/30 tabular-nums">
              Exam{' '}
              <span className={retentionDelta !== null && retentionDelta < -15 ? 'text-[#ef4444]/70' : 'text-white/55'}>
                {f.examDateRetention}%
              </span>
            </p>
          )}
        </div>
      </div>
      <div className="mb-2 flex items-center gap-2 text-[10px] text-white/30">
        <span>Error rate: {Math.round(f.errorRate * 100)}%</span>
        {retentionDelta !== null && (
          <>
            <span>·</span>
            <span className={retentionDelta < 0 ? 'text-[#ef4444]/50' : 'text-[#22c55e]/50'}>
              {retentionDelta < 0 ? '↓' : '↑'} {Math.abs(retentionDelta)}% by exam
            </span>
          </>
        )}
      </div>
      <p className="text-[10px] leading-relaxed text-white/30">{f.recommendation}</p>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="mx-auto max-w-7xl animate-pulse px-6 py-6 space-y-6">
      <div className="h-7 w-48 rounded bg-white/[0.06]" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1,2,3,4].map((i) => <div key={i} className="h-20 rounded-lg bg-white/[0.04]" />)}
      </div>
      <div className="h-40 rounded-lg bg-white/[0.04]" />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReadinessPage() {
  const router               = useRouter();
  const [report, setReport]  = useState<ReadinessReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [gateEvent, setGateEvent]   = useState<GateEvent | null>(null);

  async function load() {
    try {
      const data = await fetchReadinessReport();
      setReport(data);
    } catch (err) {
      const gate = parseGateEvent(err);
      if (gate) setGateEvent(gate);
      /* keep previous / null state */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) return <Skeleton />;

  const r = report;
  const overall     = r?.overall ?? 0;
  const phase       = r?.studyPhase ?? 'foundation';
  const burnoutMeta = BURNOUT_META[r?.burnoutRisk ?? 'none'];
  const intensityMeta = INTENSITY_META[r?.plannerFeedback.intensityChange ?? 'maintain'];
  const IntensityIcon = intensityMeta.icon;

  return (
    <>
    {gateEvent && (
      <UpgradeModal gate={gateEvent} onClose={() => setGateEvent(null)} />
    )}
    <div className="mx-auto max-w-7xl px-6 py-6">

      {/* ── Header ── */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-white">Exam Readiness</h1>
            {r && (
              <span className={`text-[10px] font-medium ${PHASE_COLOR[phase]}`}>
                {r.phaseLabel}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-white/40">
            Predictive intelligence across your test history
          </p>
        </div>
        <button
          onClick={() => { setRefreshing(true); load(); }}
          disabled={refreshing}
          className="flex cursor-pointer items-center gap-2 self-start rounded-lg border border-[#8762F7]/30 bg-[#8762F7]/12 px-4 py-2 text-xs font-semibold text-[#8762F7] transition-colors hover:bg-[#8762F7]/22 disabled:opacity-50"
        >
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* ── No-data state ── */}
      {!r || r.subjects.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-white/[0.08] py-16 text-center">
          <Target size={28} className="text-white/15" />
          <p className="text-sm text-white/35">No test history found</p>
          <p className="text-xs text-white/20">Take a test to generate your exam readiness report.</p>
          <button
            onClick={() => router.push('/tests')}
            className="mt-2 cursor-pointer rounded-lg border border-[#8762F7]/30 bg-[#8762F7]/12 px-4 py-2 text-xs font-semibold text-[#8762F7] hover:bg-[#8762F7]/22 transition-colors"
          >
            Go to Tests
          </button>
        </div>
      ) : (
        <>
          {/* ── Critical message banner ── */}
          {r.plannerFeedback.criticalMessage && (
            <div className="mb-5 flex items-start gap-3 rounded-lg border border-[#ef4444]/20 bg-[#ef4444]/[0.06] px-4 py-3">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-[#ef4444]/70" />
              <p className="text-xs leading-relaxed text-[#ef4444]/80">
                {r.plannerFeedback.criticalMessage}
              </p>
            </div>
          )}

          {/* ── Stat row ── */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">

            {/* Gauge card */}
            <div className="col-span-2 flex items-center gap-5 rounded-lg border border-white/[0.07] bg-white/[0.02] px-5 py-4 sm:col-span-1">
              <ReadinessGauge score={overall} />
              <div>
                <p className="text-[10px] text-white/30">Overall Readiness</p>
                <p className={`mt-0.5 text-2xl font-bold tabular-nums ${scoreColor(overall)}`}>{overall}</p>
                <p className="text-[10px] text-white/25">out of 100</p>
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-lg border border-white/[0.07] bg-white/[0.02] px-4 py-3">
              <div className="flex items-center gap-2">
                <CalendarDays size={13} className="text-white/25" />
                <p className="text-[10px] text-white/30">Days to Exam</p>
              </div>
              <p className={`text-xl font-bold tabular-nums ${r.daysToExam !== null && r.daysToExam <= 30 ? 'text-[#ef4444]/80' : 'text-white/70'}`}>
                {r.daysToExam != null ? r.daysToExam : '—'}
              </p>
              <p className="text-[10px] text-white/25">
                {r.examDate ? new Date(r.examDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Set target year in profile'}
              </p>
            </div>

            <div className="flex flex-col justify-between rounded-lg border border-white/[0.07] bg-white/[0.02] px-4 py-3">
              <div className="flex items-center gap-2">
                <Flame size={13} className="text-white/25" />
                <p className="text-[10px] text-white/30">Study Streak</p>
              </div>
              <p className={`text-xl font-bold tabular-nums ${r.streakDays >= 7 ? 'text-[#f59e0b]/80' : 'text-white/70'}`}>
                {r.streakDays > 0 ? `${r.streakDays}d` : '—'}
              </p>
              <p className={`text-[10px] ${burnoutMeta.color}`}>{burnoutMeta.label}</p>
            </div>

            <div className="flex flex-col justify-between rounded-lg border border-white/[0.07] bg-white/[0.02] px-4 py-3">
              <div className="flex items-center gap-2">
                <Clock size={13} className="text-white/25" />
                <p className="text-[10px] text-white/30">Daily Target</p>
              </div>
              <p className="text-xl font-bold tabular-nums text-white/70">
                {r.plannerFeedback.adjustedDailyMin} min
              </p>
              <div className={`flex items-center gap-1 text-[10px] ${intensityMeta.color}`}>
                <IntensityIcon size={10} />
                {intensityMeta.label}
              </div>
            </div>
          </div>

          {/* ── Two-column body ── */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">

            {/* ═══ LEFT ═══════════════════════════════════════════════════════ */}
            <div className="space-y-6">

              {/* Confidence band */}
              <section>
                <SectionLabel>Performance Prediction Band</SectionLabel>
                <ConfidenceBandBar report={r} />
              </section>

              {/* Subject readiness */}
              <section>
                <SectionLabel>Subject Readiness</SectionLabel>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {r.subjects.map((s) => (
                    <SubjectCard key={s.subject} s={s} daysToExam={r.daysToExam} />
                  ))}
                </div>
              </section>

              {/* Weakness forecast */}
              {r.weaknessForecast.length > 0 && (
                <section>
                  <SectionLabel>Weakness Forecast</SectionLabel>
                  <div className="space-y-2">
                    {r.weaknessForecast.map((f, i) => (
                      <ForecastRow key={`${f.topic}-${i}`} f={f} />
                    ))}
                  </div>
                </section>
              )}
            </div>

            {/* ═══ RIGHT ══════════════════════════════════════════════════════ */}
            <div className="space-y-6">

              {/* Percentile estimate */}
              {r.percentile && (
                <section>
                  <SectionLabel>Estimated Percentile</SectionLabel>
                  <div className="rounded-lg border border-[#8762F7]/15 bg-[#8762F7]/[0.05] p-4">
                    <div className="mb-3 flex items-end gap-2">
                      <span className="text-3xl font-bold text-[#8762F7]">
                        {r.percentile.estimated}
                      </span>
                      <span className="mb-1 text-sm text-[#8762F7]/60">%ile</span>
                    </div>
                    <p className="mb-1 text-[10px] text-white/35">
                      Range: {r.percentile.rangeLow}–{r.percentile.rangeHigh} %ile · {r.percentile.exam}
                    </p>
                    <p className="text-[10px] leading-relaxed text-white/25">{r.percentile.caveat}</p>
                  </div>
                </section>
              )}

              {/* Planner feedback */}
              <section>
                <SectionLabel>Adaptive Study Recommendations</SectionLabel>

                {r.plannerFeedback.urgentSubjects.length > 0 && (
                  <div className="mb-3 rounded-lg border border-[#ef4444]/15 bg-[#ef4444]/[0.04] px-4 py-3">
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-[#ef4444]/50">
                      Urgent Focus
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {r.plannerFeedback.urgentSubjects.map((s) => (
                        <span key={s} className="rounded border border-[#ef4444]/20 bg-[#ef4444]/[0.08] px-2 py-0.5 text-[10px] text-[#ef4444]/70">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {r.plannerFeedback.topActions.map((action, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
                    >
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[#8762F7]/25 text-[8px] font-bold text-[#8762F7]/60">
                        {i + 1}
                      </span>
                      <p className="text-[11px] leading-relaxed text-white/55">{action}</p>
                    </div>
                  ))}
                </div>

                {r.plannerFeedback.restDaysRecommended > 0 && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg border border-[#f59e0b]/15 bg-[#f59e0b]/[0.04] px-3 py-2.5">
                    <CheckCircle2 size={12} className="shrink-0 text-[#f59e0b]/60" />
                    <p className="text-[11px] text-[#f59e0b]/70">
                      {r.plannerFeedback.restDaysRecommended} rest day{r.plannerFeedback.restDaysRecommended > 1 ? 's' : ''} recommended this week
                    </p>
                  </div>
                )}
              </section>

              {/* Quick actions */}
              <section>
                <SectionLabel>Quick Actions</SectionLabel>
                <div className="space-y-2">
                  <button
                    onClick={() => router.push('/planner')}
                    className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-[#8762F7]/20 bg-[#8762F7]/[0.06] px-4 py-3 text-left transition-colors hover:bg-[#8762F7]/12"
                  >
                    <div className="flex items-center gap-3">
                      <CalendarDays size={13} className="text-[#8762F7]/60" />
                      <span className="text-xs text-white/65">View Study Planner</span>
                    </div>
                    <ChevronRight size={12} className="text-white/25" />
                  </button>
                  <button
                    onClick={() => router.push('/revision')}
                    className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-left transition-colors hover:border-white/[0.12] hover:bg-white/[0.04]"
                  >
                    <div className="flex items-center gap-3">
                      <BookOpen size={13} className="text-white/30" />
                      <span className="text-xs text-white/55">Revision Center</span>
                    </div>
                    <ChevronRight size={12} className="text-white/25" />
                  </button>
                  <button
                    onClick={() => router.push('/analysis')}
                    className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-left transition-colors hover:border-white/[0.12] hover:bg-white/[0.04]"
                  >
                    <div className="flex items-center gap-3">
                      <BarChart2 size={13} className="text-white/30" />
                      <span className="text-xs text-white/55">Performance Analysis</span>
                    </div>
                    <ChevronRight size={12} className="text-white/25" />
                  </button>
                </div>
              </section>

            </div>
          </div>
        </>
      )}
    </div>
    </>
  );
}
