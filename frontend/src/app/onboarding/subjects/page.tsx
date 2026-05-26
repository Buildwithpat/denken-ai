'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useOnboarding } from '@/context/OnboardingContext';
import OnboardingShell from '@/components/onboarding/OnboardingShell';

const CBSE_SUBJECTS = ['Physics', 'Chemistry', 'Mathematics', 'Biology'];

export default function SubjectsPage() {
  const router = useRouter();
  const { data, set } = useOnboarding();

  function toggle(subject: string) {
    const current = data.subjects;
    const next = current.includes(subject)
      ? current.filter((s) => s !== subject)
      : [...current, subject];
    set('subjects', next);
  }

  const isReady = data.subjects.some((s) => s.trim());

  return (
    <OnboardingShell
      title="Which subjects are you studying?"
      subtitle="Select your CBSE subjects below."
      backHref="/onboarding/target"
    >
      <div className="mt-4 flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {CBSE_SUBJECTS.map((subject) => {
            const active = data.subjects.includes(subject);
            return (
              <button
                key={subject}
                onClick={() => toggle(subject)}
                className={[
                  'cursor-pointer rounded-lg border px-4 py-2 text-sm font-medium transition-all duration-150',
                  active
                    ? 'border-[#8762F7]/50 bg-[#8762F7]/20 text-white shadow-[0_0_12px_rgba(135,98,247,0.2)]'
                    : 'border-white/10 bg-white/[0.03] text-white/50 hover:border-white/20 hover:text-white/80',
                ].join(' ')}
              >
                {subject}
              </button>
            );
          })}
        </div>

        <motion.button
          onClick={() => isReady && router.push('/onboarding/loading')}
          whileTap={{ scale: 0.97 }}
          disabled={!isReady}
          className={[
            'mt-2 w-full rounded-md py-2.5 text-sm font-medium text-white transition-all duration-200',
            isReady
              ? 'cursor-pointer bg-gradient-to-r from-[#8762F7] to-[#6D4AFF] hover:brightness-110 hover:shadow-[0_0_20px_rgba(135,98,247,0.45)]'
              : 'cursor-not-allowed bg-white/10 text-white/30',
          ].join(' ')}
        >
          Finish Setup
        </motion.button>
      </div>
    </OnboardingShell>
  );
}
