'use client';

import { Clock, ArrowRight, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { LastTestInfo } from '@/lib/analyticsApi';

function relativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins  = Math.floor(diff / 60_000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? 's' : ''} ago`;
}

function examLabel(exam: string): string {
  const map: Record<string, string> = {
    JEE_MAIN: 'JEE Main', JEE_ADVANCED: 'JEE Advanced',
    NEET: 'NEET', CBSE: 'CBSE',
  };
  return map[exam] ?? exam;
}

interface Props {
  lastTest?: LastTestInfo | null;
}

export default function LastActivity({ lastTest }: Props) {
  const router = useRouter();

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-md transition-shadow duration-200 hover:shadow-[0_0_24px_rgba(135,98,247,0.07)]">
      <h2 className="mb-4 text-sm font-semibold text-white">Last Activity</h2>

      {!lastTest ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03]">
            <Clock size={18} className="text-white/20" />
          </div>
          <p className="text-sm font-medium text-white/40">No activity yet</p>
          <p className="mt-1 mb-4 max-w-[200px] text-[11px] leading-relaxed text-white/25">
            Your last test will appear here after you generate your first one.
          </p>
          <button
            onClick={() => router.push('/denkenstudio')}
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#8762F7]/30 bg-[#8762F7]/10 px-3.5 py-2 text-xs font-medium text-[#8762F7] transition-all hover:border-[#8762F7]/50 hover:bg-[#8762F7]/18 hover:text-white"
          >
            <Sparkles size={12} />
            Generate your first test
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3.5 rounded-lg bg-white/[0.03] p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#8762F7]/20 bg-[#8762F7]/10">
              <Clock size={15} className="text-[#8762F7]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white/90">
                {examLabel(lastTest.exam)} · {lastTest.subjects.join(', ')}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-white/35">
                {lastTest.accuracy}% accuracy · {relativeTime(lastTest.date)}
              </p>
            </div>
          </div>

          <button
            onClick={() => router.push('/tests')}
            className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/[0.08] py-2.5 text-sm font-medium text-white/55 transition-all duration-200 hover:border-[#8762F7]/30 hover:bg-[#8762F7]/10 hover:text-white/90"
          >
            Continue where you left off
            <ArrowRight size={13} />
          </button>
        </>
      )}
    </div>
  );
}
