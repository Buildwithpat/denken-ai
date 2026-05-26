'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useOnboarding } from '@/context/OnboardingContext';
import OnboardingShell from '@/components/onboarding/OnboardingShell';

const TARGET_YEARS = ['2027', '2028', '2029'];
const CLASSES      = ['Class 11', 'Class 12', 'Dropper', 'Other'];
const PREP_LEVELS  = ['Just Starting', 'Intermediate', 'Advanced'];

const EXAM_LABEL: Record<string, string> = {
  jee:  'JEE',
  neet: 'NEET',
  cbse: 'CBSE Boards',
};

function SelectField({
  label, value, onChange, options, placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  placeholder: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-white/50">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full cursor-pointer appearance-none rounded-md border border-white/10 bg-[#0B0E14] px-4 py-2 text-sm text-white outline-none transition-all duration-150 focus:border-[#8762F7] focus:ring-1 focus:ring-[#8762F7]/40"
        >
          <option value="" disabled>{placeholder}</option>
          {options.map((o) => (
            <option key={o} value={o} className="bg-[#0B0E14]">{o}</option>
          ))}
        </select>
        <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/30" />
      </div>
    </div>
  );
}

export default function TargetPage() {
  const router = useRouter();
  const { data, set } = useOnboarding();

  const examLabel = EXAM_LABEL[data.examType ?? ''] ?? 'your exam';
  const isReady   = !!data.targetYear && !!data.currentClass && !!data.prepLevel;

  function handleNext() {
    if (!isReady) return;
    router.push(data.examType === 'cbse' ? '/onboarding/subjects' : '/onboarding/loading');
  }

  return (
    <OnboardingShell
      title="When are you planning to appear?"
      subtitle={`Set your ${examLabel} preparation timeline and level.`}
      backHref="/onboarding/exam"
    >
      <motion.div
        className="mt-4 flex flex-col gap-3"
        variants={{ show: { transition: { staggerChildren: 0.09 } } }}
        initial="hidden"
        animate="show"
      >
        <motion.div
          variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } } }}
        >
          <SelectField
            label="Target Year"
            value={data.targetYear}
            onChange={(v) => set('targetYear', v)}
            options={TARGET_YEARS}
            placeholder="Select year"
          />
        </motion.div>

        <motion.div
          variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } } }}
        >
          <SelectField
            label="Current Class"
            value={data.currentClass}
            onChange={(v) => set('currentClass', v)}
            options={CLASSES}
            placeholder="Select class"
          />
        </motion.div>

        <motion.div
          variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } } }}
        >
          <SelectField
            label="Preparation Level"
            value={data.prepLevel}
            onChange={(v) => set('prepLevel', v)}
            options={PREP_LEVELS}
            placeholder="Select level"
          />
        </motion.div>

        <motion.button
          variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.3 } } }}
          onClick={handleNext}
          whileTap={{ scale: 0.97 }}
          disabled={!isReady}
          className={[
            'mt-1 w-full rounded-md py-2 text-sm font-medium text-white transition-all duration-200',
            isReady
              ? 'cursor-pointer bg-gradient-to-r from-[#8762F7] to-[#6D4AFF] hover:brightness-110 hover:shadow-[0_0_20px_rgba(135,98,247,0.45)]'
              : 'cursor-not-allowed bg-white/10 text-white/30',
          ].join(' ')}
        >
          {data.examType === 'cbse' ? 'Next' : 'Finish Setup'}
        </motion.button>
      </motion.div>
    </OnboardingShell>
  );
}
