'use client';

import { CalendarDays } from 'lucide-react';
import { useOnboarding } from '@/context/OnboardingContext';

const EXAM_LABELS: Record<string, string> = {
  jee:  'JEE',
  neet: 'NEET',
  cbse: 'CBSE Boards',
};

export default function ExamCountdown() {
  const { data } = useOnboarding();

  if (!data.examType || data.examType === 'custom') return null;

  const examLabel = EXAM_LABELS[data.examType] ?? data.examType.toUpperCase();
  const yearNum   = parseInt(data.targetYear || String(new Date().getFullYear() + 1));
  const examDate  = new Date(`${yearNum}-04-15`);
  const today     = new Date();
  const daysLeft  = Math.max(0, Math.ceil((examDate.getTime() - today.getTime()) / 86_400_000));

  const startDate  = new Date(`${yearNum - 1}-06-01`);
  const totalDays  = Math.max(1, Math.ceil((examDate.getTime() - startDate.getTime()) / 86_400_000));
  const elapsed    = Math.ceil((today.getTime() - startDate.getTime()) / 86_400_000);
  const progress   = Math.min(100, Math.max(0, (elapsed / totalDays) * 100));

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-md transition-shadow duration-200 hover:shadow-[0_0_24px_rgba(135,98,247,0.07)]">
      <div className="mb-4 flex items-center gap-2">
        <CalendarDays size={14} className="text-[#8762F7]" />
        <h2 className="text-sm font-semibold text-white">Exam Countdown</h2>
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-bold tabular-nums text-white">{daysLeft.toLocaleString()}</span>
        <span className="text-sm text-white/35">days left</span>
      </div>
      <p className="mt-0.5 text-xs text-white/35">{examLabel} {data.targetYear || yearNum}</p>

      {/* Timeline bar */}
      <div className="mt-5">
        <div className="mb-1.5 flex items-center justify-between text-[10px] text-white/25">
          <span>Prep start</span>
          <span>Exam day</span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-white/[0.08]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#8762F7] to-[#6D4AFF] transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <p className="mt-4 text-[11px] text-white/30">Stay consistent. Every day counts.</p>
    </div>
  );
}
