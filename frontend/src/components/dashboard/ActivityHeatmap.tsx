'use client';

import { useMemo } from 'react';
import type { ActivityPoint } from '@/lib/analyticsApi';

const WEEKS = 15;

function cellColor(count: number): string {
  if (count === 0) return 'bg-white/[0.05]';
  if (count <= 2)  return 'bg-[#8762F7]/20';
  if (count <= 4)  return 'bg-[#8762F7]/50';
  return 'bg-[#8762F7]';
}

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface Props {
  activity?: ActivityPoint[] | null;
}

export default function ActivityHeatmap({ activity }: Props) {
  const cells = useMemo(() => {
    const activityMap = new Map<string, number>();
    if (activity) {
      for (const pt of activity) {
        const key = pt.date.slice(0, 10);
        activityMap.set(key, (activityMap.get(key) ?? 0) + pt.count);
      }
    }

    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - (WEEKS * 7 - 1));

    return Array.from({ length: WEEKS * 7 }, (_, i) => {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const key = date.toISOString().slice(0, 10);
      return { date, count: activityMap.get(key) ?? 0 };
    });
  }, [activity]);

  const cols = useMemo(() => {
    const result: typeof cells[] = [];
    for (let w = 0; w < WEEKS; w++) result.push(cells.slice(w * 7, w * 7 + 7));
    return result;
  }, [cells]);

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-md transition-shadow duration-200 hover:shadow-[0_0_24px_rgba(135,98,247,0.07)]">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Activity</h2>
        <div className="flex items-center gap-1.5 text-[10px] text-white/25">
          <span>Less</span>
          <div className="flex gap-0.5">
            {(['bg-white/[0.05]', 'bg-[#8762F7]/20', 'bg-[#8762F7]/50', 'bg-[#8762F7]'] as const).map((cls) => (
              <div key={cls} className={`h-2.5 w-2.5 rounded-[2px] ${cls}`} />
            ))}
          </div>
          <span>More</span>
        </div>
      </div>

      <div className="flex gap-[3px]">
        {/* Day labels */}
        <div className="mr-0.5 flex flex-col gap-[3px]">
          {DAY_LABELS.map((d, i) => (
            <div key={i} className="flex h-[11px] w-3 items-center justify-end text-[8px] text-white/20">
              {i % 2 === 1 ? d : ''}
            </div>
          ))}
        </div>

        {/* Grid */}
        {cols.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {week.map((cell, di) => (
              <div
                key={di}
                title={`${cell.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: ${cell.count} session${cell.count !== 1 ? 's' : ''}`}
                className={`h-[11px] w-[11px] rounded-[2px] transition-opacity hover:opacity-75 ${cellColor(cell.count)}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
