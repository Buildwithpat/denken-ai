'use client';

import { Zap, RotateCcw, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';

const ACTIONS = [
  { label: 'Start Adaptive Test', icon: Zap,       accent: true,  href: '/tests'        },
  { label: 'Revise Weak Topics',  icon: RotateCcw,  accent: false, href: '/analysis'     },
  { label: 'Create Custom Test',  icon: Plus,       accent: false, href: '/denkenstudio' },
] as const;

export default function QuickActions() {
  const router = useRouter();

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-md transition-shadow duration-200 hover:shadow-[0_0_24px_rgba(135,98,247,0.07)]">
      <h2 className="mb-4 text-sm font-semibold text-white">Quick Actions</h2>
      <div className="flex flex-col gap-2">
        {ACTIONS.map(({ label, icon: Icon, accent, href }) => (
          <button
            key={label}
            onClick={() => router.push(href)}
            className={[
              'flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium transition-all duration-200',
              accent
                ? 'border-[#8762F7]/30 bg-[#8762F7]/10 text-white/80 hover:bg-[#8762F7]/18 hover:text-white'
                : 'border-white/[0.07] bg-white/[0.03] text-white/55 hover:border-[#8762F7]/20 hover:bg-[#8762F7]/8 hover:text-white/80',
            ].join(' ')}
          >
            <Icon size={14} className={accent ? 'text-[#8762F7]' : 'text-[#8762F7]/60'} />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
