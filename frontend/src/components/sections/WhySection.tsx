'use client';

import { motion, type Variants, type Easing } from 'framer-motion';
import { Zap, Search, Clock } from 'lucide-react';

const ease: Easing = 'easeOut';

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 24 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.45, ease } },
};

const FEATURES = [
  {
    icon: Zap,
    accent: '#8762F7',
    title: 'Adaptive preparation, not generic practice',
    description: 'DenkenAI adjusts to your level instead of forcing fixed difficulty tests.',
    points: [
      'Adapts to your current understanding in real-time',
      'Builds syllabus-focused tests based on weak areas',
      'Difficulty increases as you improve',
    ],
  },
  {
    icon: Search,
    accent: '#3B82F6',
    title: 'Clear diagnosis of mistakes',
    description: "It doesn't just show marks. It explains exactly where you're going wrong.",
    points: [
      'Understand whether mistakes are conceptual, careless, or time-based',
      'Identify weak topics across all subjects',
      'Know exactly what to fix next',
    ],
  },
  {
    icon: Clock,
    accent: '#10B981',
    title: 'Personalized revision that saves time',
    description: 'Your revision is built only around what actually needs improvement.',
    points: [
      'Revision is built around your mistakes, not generic lists',
      'Focus only on topics that actually need attention',
      'Avoid wasting time on already strong areas',
    ],
  },
] as const;

export default function WhySection() {
  return (
    <section className="relative overflow-hidden bg-[#0B0E14] py-20 scroll-mt-20"
    id="why">

      {/* Subtle background dots */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'radial-gradient(circle, #8762F7 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative z-10 mx-auto max-w-4xl px-4">

        {/* Heading */}
        <h2 className="text-center text-3xl font-semibold text-white md:text-4xl">
          Why use{' '}
          <span className="text-[#8762F7]">DenkenAI</span>
        </h2>

        {/* Cards */}
        <motion.div
          className="mt-12 flex flex-col gap-8"
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
        >
          {FEATURES.map(({ icon: Icon, accent, title, description, points }) => (
            <motion.div
              key={title}
              variants={item}
              whileHover={{
                scale: 1.01,
                borderColor: 'rgba(135,98,247,0.4)',
                boxShadow: '0 0 35px rgba(135,98,247,0.2)',
              }}
              transition={{ duration: 0.2 }}
              className="flex gap-5 rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-5"
            >
              {/* Left accent line */}
              <div
                className="hidden w-0.5 flex-shrink-0 rounded-full sm:block"
                style={{
                  background: `linear-gradient(to bottom, ${accent}, transparent)`,
                  boxShadow: `0 0 10px rgba(135,98,247,0.3)`,
                }}
              />

              {/* Icon */}
              <div
                className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-md"
                style={{
                  backgroundColor: `${accent}22`,
                  boxShadow: `0 0 20px ${accent}4D`,
                }}
              >
                <Icon size={22} style={{ color: accent }} />
              </div>

              {/* Content */}
              <div className="min-w-0 max-w-2xl flex-1">
                <p className="text-xl font-semibold text-white md:text-2xl">{title}</p>
                <p className="mt-2 text-base text-white/70">{description}</p>
                <ul className="mt-4 space-y-2">
                  {points.map((point) => (
                    <li key={point} className="flex items-start gap-2 text-[15px] leading-relaxed text-white/60">
                      <span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-white/30" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          ))}
        </motion.div>

      </div>
    </section>
  );
}
