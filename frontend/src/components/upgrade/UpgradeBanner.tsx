'use client';

import { useRouter } from 'next/navigation';
import { Lock, Zap } from 'lucide-react';

interface Props {
  title?:       string;
  description?: string;
}

export default function UpgradeBanner({
  title       = 'Pro feature',
  description = 'Subscribe to unlock this section.',
}: Props) {
  const router = useRouter();

  return (
    <div className="relative overflow-hidden rounded-xl border border-[#8762F7]/20 bg-[#8762F7]/5 px-5 py-4">
      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-[#8762F7] opacity-[0.07] blur-2xl" />
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#8762F7]/15 border border-[#8762F7]/25">
          <Lock size={14} className="text-[#8762F7]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white/85">{title}</p>
          <p className="mt-0.5 text-xs text-white/45">{description}</p>
        </div>
        <button
          onClick={() => router.push('/pricing')}
          className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#8762F7] to-[#6D4AFF] px-3.5 py-1.5 text-xs font-medium text-white transition-all hover:brightness-110"
        >
          <Zap size={11} />
          Subscribe
        </button>
      </div>
    </div>
  );
}
