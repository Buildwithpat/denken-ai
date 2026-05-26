'use client';

import { useOnboarding, type JeeVariant } from '@/context/OnboardingContext';

interface Props {
  /** Label shown above the toggle. Pass null to hide. */
  label?: string | null;
  /** Extra class for the outer wrapper */
  className?: string;
  /** Size variant — 'sm' for compact headers, 'md' for panels (default) */
  size?: 'sm' | 'md';
}

/**
 * Global JEE Main / JEE Advanced toggle.
 * Only renders for JEE users (examType === 'jee'). Returns null for NEET/CBSE.
 * Reading and writing jeeVariant via OnboardingContext (localStorage-persisted).
 */
export default function JeeVariantToggle({ label, className = '', size = 'md' }: Props) {
  const { data, set } = useOnboarding();

  if (data.examType !== 'jee') return null;

  const VARIANTS: { key: JeeVariant; short: string; full: string }[] = [
    { key: 'JEE_MAIN',     short: 'JEE Main',     full: 'JEE Main'     },
    { key: 'JEE_ADVANCED', short: 'JEE Advanced',  full: 'JEE Advanced' },
  ];

  const textSm    = size === 'sm' ? 'text-xs'  : 'text-sm';
  const paddingBtn = size === 'sm' ? 'px-4 py-1.5' : 'px-5 py-2';

  return (
    <div className={className}>
      {label !== null && (
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-white/30">
          {label ?? 'Exam Type'}
        </p>
      )}
      <div className="flex gap-2">
        {VARIANTS.map(v => {
          const active = data.jeeVariant === v.key;
          return (
            <button
              key={v.key}
              onClick={() => set('jeeVariant', v.key)}
              className={[
                `cursor-pointer rounded-full border ${paddingBtn} ${textSm} font-medium transition-all duration-150`,
                active
                  ? 'border-[#8762F7]/50 bg-[#8762F7]/15 text-[#8762F7] shadow-[0_0_12px_rgba(135,98,247,0.15)]'
                  : 'border-white/[0.09] bg-white/[0.02] text-white/50 hover:border-[#8762F7]/30 hover:text-white/80',
              ].join(' ')}
            >
              {v.short}
            </button>
          );
        })}
      </div>
    </div>
  );
}
