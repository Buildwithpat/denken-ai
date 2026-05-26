'use client';

import { useRouter } from 'next/navigation';
import { Lock, Zap } from 'lucide-react';

interface Props {
  children:     React.ReactNode;
  locked:       boolean;
  title?:       string;
  description?: string;
}

/**
 * Wraps children in a blurred overlay when `locked` is true.
 * Renders children normally when `locked` is false so the component is safe
 * to use unconditionally — no layout shifts when the user subscribes.
 */
export default function PremiumLock({
  children,
  locked,
  title       = 'Pro feature',
  description = 'Subscribe to access this feature.',
}: Props) {
  const router = useRouter();

  if (!locked) return <>{children}</>;

  return (
    <div className="relative">
      {/* Blurred content underneath */}
      <div className="pointer-events-none select-none blur-sm opacity-40" aria-hidden>
        {children}
      </div>

      {/* Centered lock overlay */}
      <div className="absolute inset-0 z-10 flex items-center justify-center p-4">
        <div className="flex max-w-xs flex-col items-center gap-4 rounded-2xl border border-white/10 bg-[#0F1219]/90 px-8 py-7 text-center shadow-2xl backdrop-blur-md">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#8762F7]/25 bg-[#8762F7]/15">
            <Lock size={22} className="text-[#8762F7]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{title}</p>
            <p className="mt-1 text-xs leading-relaxed text-white/45">{description}</p>
          </div>
          <button
            onClick={() => router.push('/pricing')}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#8762F7] to-[#6D4AFF] px-5 py-2.5 text-sm font-medium text-white shadow-[0_0_20px_rgba(135,98,247,0.30)] transition-all hover:brightness-110"
          >
            <Zap size={13} />
            Subscribe to access
          </button>
        </div>
      </div>
    </div>
  );
}
