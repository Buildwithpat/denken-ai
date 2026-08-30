'use client';

import { useRouter } from 'next/navigation';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useEffect } from 'react';
import { useAccess } from '@/context/AccessContext';
import { trackEvent } from '@/lib/trackEvent';

export default function GracePeriodBanner() {
  const router = useRouter();
  const { access } = useAccess();

  const ents = access?.entitlements;
  const isGrace   = ents?.status === 'grace_period';
  const isExpired = ents?.status === 'expired';

  useEffect(() => {
    if (isGrace || isExpired) {
      trackEvent('grace_period_banner_shown', { status: ents?.status });
    }
  }, [isGrace, isExpired, ents?.status]);

  if (!isGrace && !isExpired) return null;

  const daysLeft = ents?.remainingDays ?? 0;

  const title = isGrace
    ? daysLeft > 0
      ? `Your subscription expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`
      : 'Your subscription expires today'
    : 'Your subscription has expired';

  const body = isGrace
    ? 'Renew now to keep your preparation uninterrupted. Your data, roadmap, and AI mentor are all intact.'
    : 'Your access to premium features has ended. Renew to pick up exactly where you left off.';

  return (
    <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-5 py-4">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-500/25 bg-amber-500/15">
        <AlertTriangle size={14} className="text-amber-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white/90">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-white/50">{body}</p>
      </div>
      <button
        onClick={() => {
          trackEvent('renewal_started', { trigger: 'grace_banner' });
          router.push('/pricing');
        }}
        className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-amber-500/35 bg-amber-500/15 px-3.5 py-1.5 text-xs font-medium text-amber-300 transition-all hover:border-amber-500/55 hover:bg-amber-500/25"
      >
        <RefreshCw size={11} />
        Renew
      </button>
    </div>
  );
}
