'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Zap, BookOpen, BarChart2, AlertCircle,
  Target, Sparkles,
} from 'lucide-react';
import { useOnboarding } from '@/context/OnboardingContext';
import { useAccess } from '@/context/AccessContext';
import { useTestConfig } from '@/context/TestContext';
import MobileRestricted from '@/components/MobileRestricted';
import PremiumLock from '@/components/upgrade/PremiumLock';
import { fetchAnalytics, type AnalyticsData, type WeakTopic, type StrongTopic } from '@/lib/analyticsApi';
import { type TestExam } from '@/context/TestContext';

/* ─── Types ──────────────────────────────────────────────────────────────── */

type Priority = 'high' | 'medium';

interface WeakTopic2 {
  id:             number;
  name:           string;
  subject:        string;
  accuracy:       number;
  masteryScore:   number;
  retentionScore: number;
  attempts:       number;
  priority:       Priority;
  lastSeenAt:     string;
}

interface StrongTopic2 {
  id:           number;
  name:         string;
  subject:      string;
  accuracy:     number;
  masteryScore: number;
  attempts:     number;
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function priorityFor(masteryScore: number): Priority {
  return masteryScore < 55 ? 'high' : 'medium';
}

function toWeakTopics(weakTopics: WeakTopic[]): WeakTopic2[] {
  return weakTopics.map((wt, i) => ({
    id:             i + 1,
    name:           wt.topic,
    subject:        wt.subject,
    accuracy:       wt.accuracy,
    masteryScore:   wt.masteryScore,
    retentionScore: wt.retentionScore,
    attempts:       wt.totalAttempted,
    lastSeenAt:     wt.lastSeenAt,
    priority:       priorityFor(wt.masteryScore),
  }));
}

function toStrongTopics(strengths: StrongTopic[]): StrongTopic2[] {
  return strengths.map((s, i) => ({
    id:           i + 1,
    name:         s.topic,
    subject:      s.subject,
    accuracy:     s.accuracy,
    masteryScore: s.masteryScore,
    attempts:     s.totalAttempted,
  }));
}

/* ─── Priority config ────────────────────────────────────────────────────── */

const PRIORITY_META: Record<Priority, {
  label: string; dot: string; ring: string; bg: string; text: string;
}> = {
  high:   { label: 'High Priority',   dot: 'bg-red-500',   ring: 'border-red-500/20',   bg: 'bg-red-500/[0.04]',   text: 'text-red-400'   },
  medium: { label: 'Medium Priority', dot: 'bg-amber-400', ring: 'border-amber-400/20', bg: 'bg-amber-400/[0.03]', text: 'text-amber-400' },
};

/* ─── Weak topic card ────────────────────────────────────────────────────── */

function WeakTopicCard({ topic, examKey }: { topic: WeakTopic2; examKey: TestExam }) {
  const router            = useRouter();
  const { setTestConfig } = useTestConfig();
  const meta     = PRIORITY_META[topic.priority];
  const accColor = topic.accuracy >= 50 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className={[
      'group rounded-xl border p-4 transition-all duration-150 hover:border-white/[0.12]',
      meta.ring, meta.bg,
    ].join(' ')}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white/85">{topic.name}</p>
          <span className="mt-0.5 inline-block rounded border border-white/[0.07] bg-white/[0.03] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-white/35">
            {topic.subject}
          </span>
        </div>
        <span className={['shrink-0 text-[10px] font-bold tabular-nums', accColor].join(' ')}>
          {topic.accuracy}%
        </span>
      </div>

      {/* Mastery bar */}
      <div className="mb-1 flex items-center justify-between text-[9px] text-white/30">
        <span>Mastery</span>
        <span className="tabular-nums">{topic.masteryScore}/100</span>
      </div>
      <div className="mb-1 h-1 overflow-hidden rounded-full bg-white/[0.07]">
        <div
          className={topic.masteryScore < 45 ? 'h-full rounded-full bg-red-500' : 'h-full rounded-full bg-amber-400'}
          style={{ width: `${topic.masteryScore}%` }}
        />
      </div>

      {/* Retention bar */}
      <div className="mb-1 flex items-center justify-between text-[9px] text-white/25">
        <span>Retention</span>
        <span className="tabular-nums">{topic.retentionScore}%</span>
      </div>
      <div className="mb-3 h-0.5 overflow-hidden rounded-full bg-white/[0.05]">
        <div className="h-full rounded-full bg-white/20" style={{ width: `${topic.retentionScore}%` }} />
      </div>

      <p className="mb-3 text-[10px] text-white/25">{topic.attempts} attempts</p>

      <div className="flex gap-1.5">
        <button
          onClick={() => {
            setTestConfig({ mode: 'normal', exam: examKey, subject: topic.subject, chapter: topic.name, questions: 20, time: 30 });
            router.push('/tests');
          }}
          className="flex cursor-pointer items-center gap-1 rounded-lg border border-[#8762F7]/22 bg-[#8762F7]/08 px-2.5 py-1 text-[10px] font-medium text-[#8762F7]/70 transition-colors hover:bg-[#8762F7]/15 hover:text-white"
        >
          <Zap size={9} /> Practice
        </button>
        <button
          onClick={() => router.push('/revision')}
          className="flex cursor-pointer items-center gap-1 rounded-lg border border-white/[0.07] px-2.5 py-1 text-[10px] font-medium text-white/40 transition-colors hover:border-white/15 hover:text-white/70"
        >
          <BookOpen size={9} /> Revise
        </button>
        <button
          onClick={() => router.push('/analysis')}
          className="flex cursor-pointer items-center gap-1 rounded-lg border border-white/[0.07] px-2.5 py-1 text-[10px] font-medium text-white/40 transition-colors hover:border-white/15 hover:text-white/70"
        >
          <BarChart2 size={9} /> Analysis
        </button>
      </div>
    </div>
  );
}

/* ─── Strong topic card ──────────────────────────────────────────────────── */

function StrongTopicCard({ topic }: { topic: StrongTopic2 }) {
  return (
    <div className="group rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] p-4 transition-all duration-150 hover:border-emerald-500/30">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white/85">{topic.name}</p>
          <span className="mt-0.5 inline-block rounded border border-white/[0.07] bg-white/[0.03] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-white/35">
            {topic.subject}
          </span>
        </div>
        <span className="shrink-0 text-[10px] font-bold tabular-nums text-emerald-400">
          {topic.accuracy}%
        </span>
      </div>
      <div className="mb-1 flex items-center justify-between text-[9px] text-white/30">
        <span>Mastery</span>
        <span className="tabular-nums">{topic.masteryScore}/100</span>
      </div>
      <div className="mb-3 h-1 overflow-hidden rounded-full bg-white/[0.07]">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${topic.masteryScore}%` }} />
      </div>
      <p className="text-[10px] text-white/25">{topic.attempts} attempts</p>
    </div>
  );
}

/* ─── Priority group ─────────────────────────────────────────────────────── */

function PriorityGroup({ priority, topics, examKey }: { priority: Priority; topics: WeakTopic2[]; examKey: TestExam }) {
  const meta = PRIORITY_META[priority];
  if (topics.length === 0) return null;

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className={['h-2 w-2 rounded-full', meta.dot].join(' ')} />
        <p className={['text-[11px] font-semibold uppercase tracking-widest', meta.text].join(' ')}>
          {meta.label}
        </p>
        <span className="ml-1 rounded-full border border-white/[0.07] bg-white/[0.03] px-1.5 py-0.5 text-[9px] text-white/35">
          {topics.length}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {topics.map(t => <WeakTopicCard key={t.id} topic={t} examKey={examKey} />)}
      </div>
    </div>
  );
}

function StrongGroup({ topics }: { topics: StrongTopic2[] }) {
  if (topics.length === 0) return null;
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-400">Strong Areas</p>
        <span className="ml-1 rounded-full border border-white/[0.07] bg-white/[0.03] px-1.5 py-0.5 text-[9px] text-white/35">
          {topics.length}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {topics.map(t => <StrongTopicCard key={t.id} topic={t} />)}
      </div>
    </div>
  );
}

/* ─── Empty state ────────────────────────────────────────────────────────── */

function EmptyState() {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03]">
        <Target size={24} className="text-white/20" />
      </div>
      <p className="text-base font-semibold text-white/50">No focus areas yet</p>
      <p className="mt-2 max-w-[300px] text-sm leading-relaxed text-white/25">
        Take your first test and Denken will pinpoint exactly which topics need your attention.
      </p>
      <button
        onClick={() => router.push('/denkenstudio')}
        className="mt-6 flex cursor-pointer items-center gap-2 rounded-lg border border-[#8762F7]/30 bg-[#8762F7]/12 px-5 py-2.5 text-sm font-semibold text-[#8762F7] transition-all hover:border-[#8762F7]/50 hover:bg-[#8762F7]/20 hover:text-white"
      >
        <Sparkles size={14} /> Generate your first test
      </button>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function FocusAreasPage() {
  const router = useRouter();
  const { data } = useOnboarding();
  const { canUseFeature, isLoading: accessLoading } = useAccess();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    fetchAnalytics()
      .then(setAnalytics)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const weakTopics   = analytics ? toWeakTopics(analytics.weakTopics) : [];
  const strongTopics = analytics ? toStrongTopics(analytics.strengths ?? []) : [];
  const hasData      = weakTopics.length > 0 || strongTopics.length > 0;
  const examKey      = (data.examType?.toUpperCase() ?? 'CUSTOM') as TestExam;

  const weakCount   = weakTopics.filter(t => t.priority === 'high').length;
  const strongCount = strongTopics.length;

  return (
    <MobileRestricted>
    <PremiumLock
      locked={!accessLoading && !canUseFeature('advancedAnalytics')}
      title="Focus Areas — Pro feature"
      description="Personalised weak-topic analysis and AI-driven suggestions require a Pro subscription."
    >
    <div className="mx-auto max-w-7xl px-6 py-8">

      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Target size={16} className="text-[#8762F7]" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[#8762F7]/70">
              Personalized
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white">Focus Areas</h1>
          <p className="mt-1 text-sm text-white/40">
            {hasData
              ? `Based on your recent performance: ${weakCount} weak area${weakCount !== 1 ? 's' : ''}, ${strongCount} strong chapter${strongCount !== 1 ? 's' : ''}`
              : 'Complete a test to generate your personalised focus analysis'}
          </p>
        </div>
      </div>

      {loading ? (
        /* Loading skeleton */
        <div className="space-y-8">
          {[3, 3, 3].map((n, gi) => (
            <div key={gi}>
              <div className="mb-3 h-4 w-32 animate-pulse rounded bg-white/[0.05]" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: n }).map((_, i) => (
                  <div key={i} className="h-36 animate-pulse rounded-xl bg-white/[0.03]" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : !hasData ? (
        <EmptyState />
      ) : (
        /* Two-column layout */
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">

          {/* Left: Priority groups */}
          <div className="space-y-8 min-w-0">
            <PriorityGroup priority="high"   topics={weakTopics.filter(t => t.priority === 'high')}   examKey={examKey} />
            <PriorityGroup priority="medium" topics={weakTopics.filter(t => t.priority === 'medium')} examKey={examKey} />
            <StrongGroup topics={strongTopics} />
          </div>

          {/* Right: Quick Actions */}
          <div className="space-y-5">
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
              <p className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-white/30">
                Quick Actions
              </p>
              <div className="space-y-2">
                <button
                  onClick={() => router.push('/denkenstudio')}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-[#8762F7]/22 bg-[#8762F7]/08 px-4 py-3 text-left text-sm font-medium text-white/75 transition-all hover:border-[#8762F7]/40 hover:bg-[#8762F7]/15 hover:text-white"
                >
                  <Sparkles size={14} className="text-[#8762F7] shrink-0" />
                  Generate Weakness Test
                </button>
                <button
                  onClick={() => router.push('/revision')}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-white/[0.07] px-4 py-3 text-left text-sm font-medium text-white/55 transition-all hover:border-white/15 hover:bg-white/[0.03] hover:text-white/80"
                >
                  <BookOpen size={14} className="shrink-0 text-white/30" />
                  Revise Weak Topics
                </button>
                <button
                  onClick={() => router.push('/profile')}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-white/[0.07] px-4 py-3 text-left text-sm font-medium text-white/55 transition-all hover:border-white/15 hover:bg-white/[0.03] hover:text-white/80"
                >
                  <AlertCircle size={14} className="shrink-0 text-white/30" />
                  Practice Saved Questions
                </button>
              </div>
            </div>

            {hasData && (
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Weak',   value: weakCount,   color: 'text-red-400'     },
                  { label: 'Strong', value: strongCount,  color: 'text-emerald-400' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.015] px-4 py-3 text-center">
                    <p className={['text-xl font-bold tabular-nums', color].join(' ')}>{value}</p>
                    <p className="text-[10px] text-white/30">{label} topics</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
    </PremiumLock>
    </MobileRestricted>
  );
}
