'use client';

import { motion, type Variants, type Easing } from 'framer-motion';

const PROBLEMS = [
  {
    n: '01',
    title: 'Low scores without knowing why',
    description:
      "Students get marks, but don't understand whether they failed due to weak concepts, silly mistakes, or lack of revision.",
  },
  {
    n: '02',
    title: 'One-size-fits-all test series',
    description:
      'Everyone gets the same tests, even though preparation levels and weak areas are completely different.',
  },
  {
    n: '03',
    title: 'Fear of tests & growing backlog',
    description:
      'Inconsistent practice builds anxiety and leads to an ever-increasing backlog.',
  },
  {
    n: '04',
    title: 'Studying the wrong topics',
    description:
      'Students revise randomly without clarity on what actually matters for their exams.',
  },
  {
    n: '05',
    title: 'No personalized feedback',
    description:
      "Most platforms show marks, not insights. Students don't know what to fix.",
  },
  {
    n: '06',
    title: 'Wasted effort despite hard work',
    description:
      "Effort is high, but results don't improve due to lack of direction.",
  },
] as const;

const ease: Easing = 'easeOut';

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.4, ease } },
};

export default function ProblemsSection() {
  return (
    <section className="bg-[#0B0E14] py-20">
      <div className="mx-auto max-w-6xl px-4">

        {/* Header */}
        <div className="text-center">
          <h2 className="text-3xl font-semibold text-white md:text-4xl">
            Problems{' '}
            <span className="text-[#8762F7]">students</span>{' '}
            face today
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-white/60 md:text-base">
            Everyone faces common problems while studying. Here are the biggest ones.
          </p>
        </div>

        {/* Grid */}
        <motion.div
          className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
        >
          {PROBLEMS.map(({ n, title, description }) => (
            <motion.div
              key={n}
              variants={item}
              whileHover={{
                y: -4,
                borderColor: 'rgba(135,98,247,0.4)',
                boxShadow: '0 0 20px rgba(135,98,247,0.15)',
              }}
              transition={{ duration: 0.2 }}
              className="rounded-xl border border-white/10 bg-white/5 p-5"
            >
              <span className="inline-block rounded-md bg-[#8762F7] px-2 py-1 text-xs font-medium text-white">
                {n}
              </span>
              <p className="mt-3 font-medium text-white">{title}</p>
              <p className="mt-2 text-sm text-white/60">{description}</p>
            </motion.div>
          ))}
        </motion.div>

      </div>
    </section>
  );
}
