'use client';

import { Flame, TrendingUp, Calendar } from 'lucide-react';
import type { AnalyticsOverview } from '@/lib/analyticsApi';

interface Props {
  overview: AnalyticsOverview | null;
  loading:  boolean;
}

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-white/[0.06] ${className}`} />;
}

export default function ConsistencyCard({ overview, loading }: Props) {
  const streak        = overview?.currentStreak  ?? 0;
  const longestStreak = overview?.longestStreak  ?? 0;
  const testsTaken    = overview?.testsTaken     ?? 0;

  const streakLabel =
    streak === 0 ? 'No active streak' :
    streak === 1 ? '1 day streak' :
    `${streak} day streak`;

  const motivationLine =
    streak === 0
      ? 'Start a session today to begin your streak.'
      : streak < 3
      ? 'Good start. Keep going tomorrow.'
      : streak < 7
      ? 'Building momentum. Stay consistent.'
      : streak < 14
      ? 'Strong preparation habit forming.'
      : 'Exceptional consistency. Keep it up.';

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-md transition-shadow duration-200 hover:shadow-[0_0_24px_rgba(135,98,247,0.07)]">
      <div className="mb-4 flex items-center gap-2">
        <Flame size={14} className="text-[#8762F7]" />
        <h2 className="text-sm font-semibold text-white">Consistency</h2>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-3 w-40" />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Skeleton className="h-14 rounded-lg" />
            <Skeleton className="h-14 rounded-lg" />
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-bold tabular-nums text-white">{streak}</span>
            <span className="text-sm text-white/35">{streak === 1 ? 'day' : 'days'}</span>
          </div>
          <p className="mt-0.5 text-xs text-white/45">{streakLabel}</p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-[10px] text-white/35 mb-1">
                <TrendingUp size={10} />
                <span>Best streak</span>
              </div>
              <p className="text-base font-bold text-white tabular-nums">
                {longestStreak}
                <span className="ml-1 text-xs font-normal text-white/35">days</span>
              </p>
            </div>
            <div className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-[10px] text-white/35 mb-1">
                <Calendar size={10} />
                <span>Sessions</span>
              </div>
              <p className="text-base font-bold text-white tabular-nums">
                {testsTaken}
                <span className="ml-1 text-xs font-normal text-white/35">total</span>
              </p>
            </div>
          </div>

          <p className="mt-4 text-[11px] text-white/30">{motivationLine}</p>
        </>
      )}
    </div>
  );
}
