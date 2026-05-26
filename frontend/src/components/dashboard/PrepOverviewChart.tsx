'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { useOnboarding } from '@/context/OnboardingContext';
import type { TrendPoint } from '@/lib/analyticsApi';

type Toggle = { key: string; label: string };

function getToggles(examType: string | null, subjects: string[]): Toggle[] {
  const overall: Toggle = { key: 'overall', label: 'Overall' };
  const filled = subjects.filter(Boolean);

  switch (examType) {
    case 'jee':
      return [
        overall,
        { key: 'physics',     label: 'Physics'     },
        { key: 'chemistry',   label: 'Chemistry'   },
        { key: 'mathematics', label: 'Mathematics' },
      ];
    case 'neet':
      return [
        overall,
        { key: 'physics',   label: 'Physics'   },
        { key: 'chemistry', label: 'Chemistry' },
        { key: 'biology',   label: 'Biology'   },
        { key: 'zoology',   label: 'Zoology'   },
      ];
    case 'cbse':
      return [overall, ...filled.map(s => ({ key: s.toLowerCase(), label: s }))];
    case 'custom':
      return [overall, ...filled.map((s, i) => ({ key: s.toLowerCase(), label: `Unit ${i + 1}` }))];
    default:
      return [overall];
  }
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-[#111520] px-3 py-2 text-xs shadow-xl">
      <p className="text-white/40">{label}</p>
      <p className="mt-0.5 font-semibold text-[#8762F7]">{payload[0].value}%</p>
    </div>
  );
}

interface Props {
  trends?: TrendPoint[] | null;
}

export default function PrepOverviewChart({ trends }: Props) {
  const { data }    = useOnboarding();
  const [activeKey, setActiveKey] = useState('overall');
  const hasTrends   = trends && trends.length > 0;

  const toggles = useMemo(
    () => getToggles(data.examType, data.subjects),
    [data.examType, data.subjects],
  );

  useEffect(() => {
    setActiveKey('overall');
  }, [data.examType]);

  const chartData = useMemo(() => {
    if (!hasTrends) return [];
    return trends.map((t, i) => ({
      week:  i === trends.length - 1 ? 'Now' : `T${i + 1}`,
      score: t.accuracy,
    }));
  }, [hasTrends, trends]);

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-md transition-shadow duration-200 hover:shadow-[0_0_24px_rgba(135,98,247,0.07)]">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="shrink-0 text-sm font-semibold text-white">Preparation Overview</h2>

        {hasTrends && (
          <div className="flex min-w-0 items-center gap-1 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden">
            {toggles.map(({ key, label }) => {
              const active = key === activeKey;
              return (
                <button
                  key={key}
                  onClick={() => setActiveKey(key)}
                  className={[
                    'shrink-0 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors duration-100',
                    active
                      ? 'bg-[#8762F7]/20 text-white'
                      : 'text-white/40 hover:text-white',
                  ].join(' ')}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {!hasTrends ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03]">
            <TrendingUp size={20} className="text-white/20" />
          </div>
          <p className="text-sm font-medium text-white/40">No score data yet</p>
          <p className="mt-1 max-w-[220px] text-[11px] leading-relaxed text-white/25">
            Your score trends will appear here after your first test.
          </p>
        </div>
      ) : (
        <>
          <p className="mb-3 text-[10px] text-white/20">
            {trends.length} test{trends.length !== 1 ? 's' : ''} recorded
          </p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis
                dataKey="week"
                tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                domain={[0, 100]}
                tickFormatter={(v: number) => `${v}%`}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(135,98,247,0.15)', strokeWidth: 1 }} />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#8762F7"
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 3.5, fill: '#8762F7', stroke: '#0B0E14', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
}
