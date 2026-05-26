'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { User, Sparkles, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useOnboarding } from '@/context/OnboardingContext';
import PrepOverviewChart  from '@/components/dashboard/PrepOverviewChart';
import FocusAreas         from '@/components/dashboard/FocusAreas';
import LastActivity       from '@/components/dashboard/LastActivity';
import ExamCountdown      from '@/components/dashboard/ExamCountdown';
import ActivityHeatmap    from '@/components/dashboard/ActivityHeatmap';
import QuickActions       from '@/components/dashboard/QuickActions';
import ConsistencyCard    from '@/components/dashboard/ConsistencyCard';
import GracePeriodBanner  from '@/components/upgrade/GracePeriodBanner';
import { fetchAnalytics, type AnalyticsData } from '@/lib/analyticsApi';

export default function DashboardPage() {
  const router = useRouter();
  const { data, loaded } = useOnboarding();
  const [analytics, setAnalytics]           = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics()
      .then(setAnalytics)
      .catch(() => {})
      .finally(() => setAnalyticsLoading(false));
  }, []);

  if (!loaded) return null;

  const isNew = !data.examType;
  const hasTests = !analyticsLoading && analytics !== null && analytics.overview.testsTaken > 0;
  const isNewUser = !analyticsLoading && !hasTests;

  const EXAM_NAMES: Record<string, string> = {
    jee:    'JEE',
    neet:   'NEET',
    cbse:   'CBSE Boards',
    custom: data.examName || 'Custom',
  };
  const examLabel = data.examType ? (EXAM_NAMES[data.examType] ?? data.examType.toUpperCase()) : '';

  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      {/* Greeting */}
      <div className="mb-7 flex items-center gap-4">
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/5">
          {data.avatar ? (
            <Image
              src={`/avatars/${data.avatar}.svg`}
              alt={data.name || 'Avatar'}
              fill
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <User size={20} className="text-white/25" />
            </div>
          )}
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">
            {isNew ? `Welcome${data.name ? `, ${data.name}` : ''}` : `Hi${data.name ? ` ${data.name}` : ''} 👋`}
          </h1>
          <p className="mt-1 text-sm text-white/40">
            {isNew
              ? "Let's begin your preparation journey."
              : `Welcome back to your ${examLabel} preparation`}
          </p>
        </div>
      </div>

      {/* Grace period / expired subscription banner */}
      <GracePeriodBanner />

      {/* Activation banner — shown until first test is taken */}
      {isNewUser && (
        <div className="mb-7 flex items-center justify-between gap-4 rounded-xl border border-[#8762F7]/20 bg-[#8762F7]/[0.06] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#8762F7]/30 bg-[#8762F7]/15">
              <Sparkles size={16} className="text-[#8762F7]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white/90">Generate your first test</p>
              <p className="mt-0.5 text-[12px] text-white/45">
                Your dashboard insights, focus areas, and study plan will come alive after your first test.
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push('/denkenstudio')}
            className="flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-[#8762F7]/35 bg-[#8762F7]/15 px-4 py-2 text-xs font-semibold text-[#8762F7] transition-all hover:border-[#8762F7]/55 hover:bg-[#8762F7]/25 hover:text-white"
          >
            Get started <ArrowRight size={12} />
          </button>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Left — 2 cols */}
        <div className="flex flex-col gap-5 lg:col-span-2">
          <PrepOverviewChart trends={analytics?.trends} />
          <FocusAreas        weakTopics={analytics?.weakTopics} />
          <LastActivity      lastTest={analytics?.lastTest} />
        </div>

        {/* Right — 1 col */}
        <div className="flex flex-col gap-5">
          <ExamCountdown />
          <ConsistencyCard overview={analytics?.overview ?? null} loading={analyticsLoading} />
          <ActivityHeatmap activity={analytics?.activity} />
          <div className="flex flex-col gap-4">
            <QuickActions />
          </div>
        </div>
      </div>
    </div>
  );
}
