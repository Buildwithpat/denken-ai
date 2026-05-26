'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, TrendingUp, TrendingDown, Target, Zap, Flame,
  Award, AlertTriangle, Play, BarChart3,
} from 'lucide-react';
import MobileRestricted from '@/components/MobileRestricted';
import UpgradeBanner from '@/components/upgrade/UpgradeBanner';
import {
  fetchAnalytics,
  type AnalyticsData,
  type SubjectAnalytics,
  type WeakTopic,
  type QuestionTypeAnalytics,
  type RecommendationItem,
  type RevisionItem,
} from '@/lib/analyticsApi';

/* ─── Colour maps ────────────────────────────────────────────────────────── */

const SUBJECT_TAG_COLOR: Record<string, string> = {
  Physics:     'text-[#3b82f6] bg-[#3b82f6]/[0.08] border-[#3b82f6]/20',
  Chemistry:   'text-[#22c55e] bg-[#22c55e]/[0.08] border-[#22c55e]/20',
  Mathematics: 'text-[#8762F7] bg-[#8762F7]/[0.08] border-[#8762F7]/20',
  Biology:     'text-[#f59e0b] bg-[#f59e0b]/[0.08] border-[#f59e0b]/20',
  English:     'text-[#fb923c] bg-[#fb923c]/[0.08] border-[#fb923c]/20',
};

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-white/25">
      {children}
    </p>
  );
}

function EmptySection({ icon: Icon, text }: { icon: React.FC<{ size: number; className?: string }>; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-white/[0.07] py-10 text-center">
      <Icon size={20} className="text-white/15" />
      <p className="text-xs text-white/25">{text}</p>
    </div>
  );
}

/* ─── Overview cards ─────────────────────────────────────────────────────── */

interface OverviewProps {
  testsTaken: number; avgScore: number; bestScore: number; currentStreak: number;
  scoreTrend: number[]; subjects: SubjectAnalytics[];
}

function OverviewCards({ testsTaken, avgScore, bestScore, currentStreak, scoreTrend, subjects }: OverviewProps) {
  const sorted  = [...subjects].sort((a, b) => b.accuracy - a.accuracy);
  const best    = sorted[0];
  const weakest = sorted[sorted.length - 1];

  const last  = scoreTrend[scoreTrend.length - 1] ?? 0;
  const prev  = scoreTrend[scoreTrend.length - 2] ?? last;
  const delta = last - prev;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">

      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-5 py-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25">Tests Taken</p>
          <Target size={13} className="text-[#8762F7]" />
        </div>
        <p className="text-2xl font-bold tabular-nums text-white">{testsTaken}</p>
        <p className="mt-1 text-[11px] text-white/35">All time</p>
      </div>

      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-5 py-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25">Avg Accuracy</p>
          {delta >= 0
            ? <TrendingUp size={13} className="text-[#22c55e]" />
            : <TrendingDown size={13} className="text-[#ef4444]" />
          }
        </div>
        <p className="text-2xl font-bold tabular-nums text-white">{avgScore}%</p>
        <p className={['mt-1 text-[11px]', delta >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'].join(' ')}>
          {delta >= 0 ? '+' : ''}{delta}% vs last test
        </p>
      </div>

      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-5 py-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25">Best Accuracy</p>
          <Zap size={13} className="text-[#f59e0b]" />
        </div>
        <p className="text-2xl font-bold tabular-nums text-white">{bestScore}%</p>
        <p className="mt-1 text-[11px] text-white/35">All time peak</p>
      </div>

      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-5 py-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25">Streak</p>
          <Flame size={13} className="text-[#fb923c]" />
        </div>
        <p className="text-2xl font-bold tabular-nums text-white">{currentStreak}d</p>
        <p className="mt-1 text-[11px] text-white/35">Keep it going!</p>
      </div>

      {best && (
        <div className="rounded-xl border border-[#22c55e]/15 bg-[#22c55e]/[0.03] px-5 py-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25">Best Subject</p>
            <Award size={13} className="text-[#22c55e]" />
          </div>
          <p className="text-lg font-bold text-white">{best.subject}</p>
          <p className="mt-1 text-[11px] text-[#22c55e]/70">{best.accuracy}% accuracy</p>
        </div>
      )}

      {weakest && weakest !== best && (
        <div className="rounded-xl border border-[#ef4444]/15 bg-[#ef4444]/[0.03] px-5 py-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25">Weakest Subject</p>
            <AlertTriangle size={13} className="text-[#ef4444]" />
          </div>
          <p className="text-lg font-bold text-white">{weakest.subject}</p>
          <p className="mt-1 text-[11px] text-[#ef4444]/70">{weakest.accuracy}% accuracy</p>
        </div>
      )}

    </div>
  );
}

/* ─── Score trend bar chart ──────────────────────────────────────────────── */

function ScoreTrend({ scores }: { scores: number[] }) {
  const max   = Math.max(...scores, 1);
  const last  = scores[scores.length - 1] ?? 0;
  const prev  = scores[scores.length - 2] ?? last;
  const delta = last - prev;

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-6 py-5">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <SectionLabel>Score Trend</SectionLabel>
          <p className="text-xl font-bold text-white">{last}%</p>
          <p className={['mt-0.5 text-xs', delta >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'].join(' ')}>
            {delta >= 0 ? '+' : ''}{delta}% from last test
          </p>
        </div>
        <p className="text-[10px] text-white/20">Last {scores.length} tests</p>
      </div>

      <div className="flex items-end gap-1.5" style={{ height: '80px' }}>
        {scores.map((score, i) => {
          const isLast = i === scores.length - 1;
          const pct    = (score / (max + 10)) * 100;
          return (
            <div key={i} className="group relative flex flex-1 flex-col items-center justify-end" style={{ height: '100%' }}>
              <div className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-white/10 px-2 py-0.5 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                {score}%
              </div>
              <div
                className={[
                  'w-full rounded-sm transition-all duration-300',
                  isLast ? 'bg-[#8762F7]' : 'bg-white/[0.12] group-hover:bg-white/[0.22]',
                ].join(' ')}
                style={{ height: `${pct}%` }}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex items-center gap-1.5">
        {scores.map((_, i) => (
          <div key={i} className="flex-1 text-center text-[9px] text-white/20">
            {i === scores.length - 1 ? 'Now' : `T${i + 1}`}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Subject performance ────────────────────────────────────────────────── */

function SubjectPerformance({ subjects }: { subjects: SubjectAnalytics[] }) {
  return (
    <div>
      <SectionLabel>Subject Breakdown</SectionLabel>
      <div className="space-y-2.5">
        {subjects.map(({ subject, accuracy, correct, wrong, unattempted, trend }) => (
          <div key={subject} className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-5 py-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-white/80">{subject}</p>
              <div className="flex items-center gap-3">
                {trend !== 0 && (
                  <span className={['text-[11px] font-semibold', trend >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'].join(' ')}>
                    {trend >= 0 ? '+' : ''}{trend}%
                  </span>
                )}
                <span className="text-sm font-bold tabular-nums text-white">{accuracy}%</span>
              </div>
            </div>
            <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className={[
                  'h-full rounded-full transition-all duration-500',
                  accuracy >= 70 ? 'bg-[#22c55e]' : accuracy >= 55 ? 'bg-[#f59e0b]' : 'bg-[#ef4444]',
                ].join(' ')}
                style={{ width: `${accuracy}%` }}
              />
            </div>
            <p className="text-[11px] text-white/30">
              {correct}C · {wrong}W · {unattempted}U
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Question type breakdown ────────────────────────────────────────────── */

function QuestionTypeBreakdown({ types }: { types: QuestionTypeAnalytics[] }) {
  const display = types.map(qt => ({
    label:    qt.type === 'mcq' ? 'MCQ' : qt.type === 'numerical' ? 'Numerical' : qt.type,
    accuracy: qt.accuracy,
    attempted: qt.attempted,
    correct:  qt.correct,
  }));

  return (
    <div>
      <SectionLabel>By Question Type</SectionLabel>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {display.map(({ label, accuracy, attempted, correct }) => (
          <div key={label} className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-5 py-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-white/75">{label}</p>
              <span className="text-xl font-bold tabular-nums text-white">{accuracy}%</span>
            </div>
            <div className="mb-2.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className={['h-full rounded-full', accuracy >= 65 ? 'bg-[#22c55e]' : 'bg-[#f59e0b]'].join(' ')}
                style={{ width: `${accuracy}%` }}
              />
            </div>
            <p className="text-[11px] text-white/30">{correct} correct / {attempted} attempted</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Weak topics ────────────────────────────────────────────────────────── */

function WeakTopics({ topics }: { topics: WeakTopic[] }) {
  const router = useRouter();

  function handleClick(topic: WeakTopic) {
    const params = new URLSearchParams({ chapter: topic.topic });
    if (topic.subject) params.set('subject', topic.subject);
    router.push(`/revision/notes?${params.toString()}`);
  }

  return (
    <div>
      <SectionLabel>Topics to Revisit</SectionLabel>
      {topics.length === 0 ? (
        <EmptySection icon={Target} text="No weak topics detected yet — keep taking tests" />
      ) : (
        <div className="flex flex-wrap gap-2">
          {topics.map(topic => (
            <button
              key={topic.topic}
              onClick={() => handleClick(topic)}
              className="cursor-pointer rounded-full border border-[#ef4444]/20 bg-[#ef4444]/[0.06] px-3 py-1.5 text-[11px] font-medium text-[#ef4444]/80 transition-all duration-150 hover:border-[#ef4444]/40 hover:bg-[#ef4444]/[0.1] hover:text-[#ef4444]"
              title={`${topic.accuracy}% accuracy · ${topic.wrongCount} wrong`}
            >
              {topic.topic}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Recommendations ────────────────────────────────────────────────────── */

const REC_STYLES: Record<string, { color: string; dot: string }> = {
  success: { color: 'border-[#22c55e]/20 bg-[#22c55e]/[0.04]', dot: 'bg-[#22c55e]' },
  warning: { color: 'border-[#f59e0b]/20 bg-[#f59e0b]/[0.04]', dot: 'bg-[#f59e0b]' },
  danger:  { color: 'border-[#ef4444]/20 bg-[#ef4444]/[0.04]', dot: 'bg-[#ef4444]' },
};

function Recommendations({ items }: { items: RecommendationItem[] }) {
  return (
    <div>
      <SectionLabel>Recommendations</SectionLabel>
      <div className="space-y-2.5">
        {items.map(({ title, body, sentiment }) => {
          const { color, dot } = REC_STYLES[sentiment] ?? REC_STYLES.success;
          return (
            <div key={title} className={`rounded-lg border px-5 py-4 ${color}`}>
              <div className="mb-1.5 flex items-center gap-2">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
                <p className="text-sm font-semibold text-white/80">{title}</p>
              </div>
              <p className="pl-3.5 text-xs leading-relaxed text-white/45">{body}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Revision roadmap ───────────────────────────────────────────────────── */

function RevisionRoadmap({ items }: { items: RevisionItem[] }) {
  const router = useRouter();

  return (
    <div>
      <SectionLabel>7-Day Revision Roadmap</SectionLabel>
      <div className="overflow-hidden rounded-xl border border-white/[0.07]">
        {items.map(({ day, topic, subject, duration }, i) => {
          const tagClass = SUBJECT_TAG_COLOR[subject] ?? 'text-white/50 bg-white/[0.06] border-white/[0.1]';
          return (
            <div
              key={day}
              className={[
                'flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-white/[0.02]',
                i < items.length - 1 ? 'border-b border-white/[0.05]' : '',
              ].join(' ')}
            >
              <span className="w-12 shrink-0 text-[11px] font-semibold text-white/30">{day}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white/80">{topic}</p>
              </div>
              <span className={['shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold', tagClass].join(' ')}>
                {subject}
              </span>
              <span className="w-14 shrink-0 text-right text-[11px] text-white/30">{duration}</span>
              <button
                onClick={() =>
                  router.push(`/revision/notes?subject=${encodeURIComponent(subject)}&chapter=${encodeURIComponent(topic)}`)
                }
                className="flex cursor-pointer shrink-0 items-center gap-1 rounded-lg border border-[#8762F7]/30 bg-[#8762F7]/[0.08] px-3 py-1.5 text-[11px] font-semibold text-[#8762F7] transition-colors hover:bg-[#8762F7]/[0.15]"
              >
                <Play size={9} className="fill-[#8762F7]" />
                Start
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Empty full-page state ──────────────────────────────────────────────── */

function NoDataState() {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-white/[0.07] py-20 text-center">
      <BarChart3 size={32} className="text-white/10" />
      <div>
        <p className="text-sm font-semibold text-white/50">No test history yet</p>
        <p className="mt-1 text-xs text-white/25">Take your first practice test to see your performance analysis here.</p>
      </div>
      <button
        onClick={() => router.push('/tests')}
        className="mt-2 cursor-pointer rounded-lg border border-[#8762F7]/30 bg-[#8762F7]/10 px-5 py-2.5 text-xs font-semibold text-[#8762F7] transition-colors hover:bg-[#8762F7]/20"
      >
        Start a Test
      </button>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function AnalysisPage() {
  const router = useRouter();

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    fetchAnalytics()
      .then(setAnalytics)
      .finally(() => setLoading(false));
  }, []);

  const hasData = (analytics?.overview.testsTaken ?? 0) > 0;

  return (
    <MobileRestricted>
    <div className="mx-auto max-w-4xl px-6 py-6">

      {/* Header */}
      <div className="mb-7">
        <button
          onClick={() => router.back()}
          className="mb-4 flex cursor-pointer items-center gap-1.5 text-white/40 transition-colors hover:text-white/75"
        >
          <ArrowLeft size={13} />
          <span className="text-xs">Back</span>
        </button>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-white">Performance Analysis</h1>
          {loading && (
            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-white/30">
              Loading…
            </span>
          )}
          {!loading && !hasData && (
            <span className="rounded-full border border-[#f59e0b]/20 bg-[#f59e0b]/[0.06] px-2 py-0.5 text-[10px] text-[#f59e0b]/70">
              No test history yet
            </span>
          )}
          {!loading && hasData && (
            <span className="rounded-full border border-[#22c55e]/20 bg-[#22c55e]/[0.06] px-2 py-0.5 text-[10px] text-[#22c55e]/70">
              Live data
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-white/40">
          Your progress across all tests — strengths, gaps, and next steps.
        </p>
      </div>

      {/* Body */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-white/[0.03]" />
          ))}
        </div>
      ) : !hasData ? (
        <NoDataState />
      ) : (
        <div className="space-y-6">
          <OverviewCards
            testsTaken={analytics!.overview.testsTaken}
            avgScore={analytics!.overview.avgAccuracy}
            bestScore={analytics!.overview.bestAccuracy}
            currentStreak={analytics!.overview.currentStreak}
            scoreTrend={analytics!.trends.map(t => t.accuracy)}
            subjects={analytics!.subjects}
          />
          {analytics!.trends.length > 0 && (
            <ScoreTrend scores={analytics!.trends.map(t => t.accuracy)} />
          )}
          {analytics!.subjects.length > 0 && (
            <SubjectPerformance subjects={analytics!.subjects} />
          )}
          {analytics!.questionTypes.length > 0 && (
            <QuestionTypeBreakdown types={analytics!.questionTypes} />
          )}
          {analytics!._tier === 'free' ? (
            <UpgradeBanner
              title="Topics to Revisit — Pro feature"
              description="Upgrade to see your personalised weak topics and targeted revision roadmap."
            />
          ) : (
            <>
              <WeakTopics topics={analytics!.weakTopics} />
              {analytics!.revisionRoadmap.length > 0 && (
                <RevisionRoadmap items={analytics!.revisionRoadmap} />
              )}
            </>
          )}
          {analytics!.recommendations.length > 0 && (
            <Recommendations items={analytics!.recommendations} />
          )}
        </div>
      )}

    </div>
    </MobileRestricted>
  );
}
