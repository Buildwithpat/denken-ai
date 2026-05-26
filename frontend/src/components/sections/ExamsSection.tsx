'use client';

import { motion, type Variants, type Easing } from 'framer-motion';
import { Activity, HeartPulse, BookOpen, Plus } from 'lucide-react';

const ease: Easing = 'easeOut';

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 24 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.45, ease } },
};

function ProgressBar({ label, value, color = '#8762F7' }: { label: string; value: number; color?: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] text-white/50">{label}</span>
        <span className="text-[11px] font-medium text-white/70">{value}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color, width: `${value}%` }}
          initial={{ width: 0 }}
          whileInView={{ width: `${value}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease: 'easeOut', delay: 0.2 }}
        />
      </div>
    </div>
  );
}

const EXAMS = [
  {
    icon: Activity,
    title: 'JEE',
    accent: '#8762F7',
    bars: [
      { label: 'Physics',   value: 80 },
      { label: 'Chemistry', value: 65 },
      { label: 'Math',      value: 75 },
    ],
    description: 'Engineering entrance preparation with adaptive tests and performance tracking.',
  },
  {
    icon: HeartPulse,
    title: 'NEET',
    accent: '#3B82F6',
    bars: [
      { label: 'Biology',   value: 85 },
      { label: 'Chemistry', value: 70 },
      { label: 'Physics',   value: 60 },
    ],
    description: 'Medical entrance preparation with topic-wise practice and detailed insights.',
  },
  {
    icon: BookOpen,
    title: 'CBSE',
    accent: '#10B981',
    bars: [
      { label: 'Chapter Progress', value: 72 },
      { label: 'Revision Coverage', value: 58 },
    ],
    stat: '78%',
    description: 'School-level preparation with chapter-based tests and smart revision.',
  },
] as const;

export default function ExamsSection() {
  return (
    <section className="bg-[#0B0E14] py-20 scroll-mt-20"
    id="exams">
      <div className="mx-auto max-w-5xl px-4 text-center">

        {/* Heading */}
        <h2 className="text-3xl font-semibold text-white md:text-4xl">
          Exams we{' '}
          <span className="text-[#8762F7]">cover</span>
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-white/60 md:text-base">
          Prepare for major exams or create your own personalized test series.
        </p>

        {/* Cards */}
        <motion.div
          className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3"
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
        >
          {EXAMS.map(({ icon: Icon, title, accent, bars, description, ...rest }) => {
            const stat = 'stat' in rest ? rest.stat : undefined;
            return (
              <motion.div
                key={title}
                variants={item}
                whileHover={{
                  y: -5,
                  borderColor: `${accent}66`,
                  boxShadow: '0 0 30px rgba(135,98,247,0.2)',
                }}
                transition={{ duration: 0.2 }}
                className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-white/10 bg-white/5 p-6 text-left transition-all duration-300"
              >
                {/* Bottom glow */}
                <div
                  className="pointer-events-none absolute bottom-0 left-0 right-0 h-28 blur-xl"
                  style={{
                    background: `linear-gradient(to top, ${accent}22, transparent)`,
                  }}
                />

                {/* Top: icon + title */}
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
                    style={{
                      backgroundColor: `${accent}22`,
                      boxShadow: `0 0 16px ${accent}44`,
                    }}
                  >
                    <Icon size={16} style={{ color: accent }} />
                  </div>
                  <p className="text-lg font-semibold text-white">{title}</p>
                </div>

                {/* Middle: progress bars + optional stat */}
                <div className="relative z-10 mt-5 space-y-3">
                  {bars.map((bar) => (
                    <ProgressBar
                      key={bar.label}
                      label={bar.label}
                      value={bar.value}
                      color={accent}
                    />
                  ))}
                  {stat && (
                    <div className="mt-3 inline-flex items-center gap-2 rounded-md bg-white/5 px-3 py-2">
                      <span className="text-xs text-white/50">Test Score</span>
                      <span className="text-xs font-semibold text-white/80">{stat}</span>
                    </div>
                  )}
                </div>

                {/* Bottom: description */}
                <p className="relative z-10 mt-5 text-sm text-white/60">{description}</p>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Custom exam row */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.4, ease }}
          whileHover={{ borderColor: 'rgba(135,98,247,0.4)' }}
          className="mt-6 flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-5 transition-all duration-300 sm:flex-row sm:gap-4"
        >
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#8762F7]/15">
            <Plus size={16} className="text-[#8762F7]" />
          </div>
          <div className="text-center sm:text-left">
            <p className="font-medium text-white/80">Create your own exam</p>
            <p className="mt-0.5 text-sm text-white/50">
              Upload your syllabus and generate custom tests tailored exactly to your needs.
            </p>
          </div>
        </motion.div>

      </div>
    </section>
  );
}
