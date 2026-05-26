'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { useOnboarding, type ExamType } from '@/context/OnboardingContext';
import OnboardingShell from '@/components/onboarding/OnboardingShell';

const EXAMS: { id: ExamType; title: string; description: string; plus?: true }[] = [
  {
    id:          'jee',
    title:       'JEE',
    description: 'For students preparing for JEE Main & Advanced with Physics, Chemistry, and Mathematics.',
  },
  {
    id:          'neet',
    title:       'NEET',
    description: 'For aspirants preparing for NEET with Physics, Chemistry, and Biology.',
  },
  {
    id:          'cbse',
    title:       'CBSE Boards',
    description: 'For school-level preparation across Science and Commerce subjects.',
  },
  {
    id:          'custom',
    title:       'Create Your Own Exam',
    description: 'Build custom exams using your own syllabus, PYQs, and focus areas.',
    plus:        true,
  },
];

export default function ExamSelectionPage() {
  const router = useRouter();
  const { set } = useOnboarding();
  const [selected, setSelected] = useState<ExamType | null>(null);

  function handleNext() {
    if (!selected) return;
    set('examType', selected);
    router.push(selected === 'custom' ? '/onboarding/upload' : '/onboarding/target');
  }

  return (
    <OnboardingShell
      title="Let's set up your preparation"
      subtitle="Tell us a few details so we can personalize your experience."
      backHref="/onboarding/avatar"
    >
      <p className="mt-4 text-sm font-medium text-white">Choose the exam</p>

      <motion.div
        className="mt-3 flex flex-col gap-2"
        variants={{ show: { transition: { staggerChildren: 0.07 } } }}
        initial="hidden"
        animate="show"
      >
        {EXAMS.map(({ id, title, description, plus }) => {
          const isSelected = selected === id;
          return (
            <motion.button
              key={id}
              variants={{
                hidden: { opacity: 0, x: -12 },
                show:   { opacity: 1, x: 0, transition: { duration: 0.3, ease: 'easeOut' } },
              }}
              onClick={() => setSelected(id)}
              whileTap={{ scale: 0.99 }}
              className={[
                'flex cursor-pointer items-start gap-3 rounded-md border p-3 text-left transition-all duration-200',
                isSelected
                  ? 'border-[#8762F7] bg-white/10'
                  : 'border-white/10 bg-[#0B0E14] hover:border-[#8762F7]/40 hover:bg-white/5',
              ].join(' ')}
            >
              {/* Radio dot */}
              <div className={[
                'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-all duration-200',
                isSelected ? 'border-[#8762F7] bg-[#8762F7]' : 'border-white/25',
              ].join(' ')}>
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                    className="h-1.5 w-1.5 rounded-full bg-white"
                  />
                )}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  {plus && <Plus size={13} className="shrink-0 text-[#8762F7]" />}
                  <p className={`text-sm font-medium transition-colors duration-200 ${isSelected ? 'text-white' : 'text-white/80'}`}>
                    {title}
                  </p>
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-white/50">{description}</p>
              </div>
            </motion.button>
          );
        })}
      </motion.div>

      <motion.button
        onClick={handleNext}
        whileTap={{ scale: 0.97 }}
        disabled={!selected}
        className={[
          'mt-4 w-full rounded-md py-2.5 text-sm font-medium text-white transition-all duration-200',
          selected
            ? 'cursor-pointer bg-gradient-to-r from-[#8762F7] to-[#6D4AFF] hover:brightness-110 hover:shadow-[0_0_20px_rgba(135,98,247,0.45)]'
            : 'cursor-not-allowed bg-white/10 text-white/30',
        ].join(' ')}
      >
        Next
      </motion.button>
    </OnboardingShell>
  );
}
