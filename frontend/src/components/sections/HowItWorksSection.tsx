'use client';

import { motion, type Variants, type Easing } from 'framer-motion';
import { BookOpen, FileText, TrendingUp, Clock, ArrowUp } from 'lucide-react';

const ease: Easing = 'easeOut';

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 24 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.45, ease } },
};

/* ── Card 1 mini UI ── */
function ChooseExamUI() {
  return (
    <div className="mt-5 space-y-3">
      {/* Dropdown */}
      <div className="flex items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-2">
        <span className="text-xs text-white/50">Select Exam</span>
        <span className="text-xs font-medium text-[#8762F7]">JEE ▾</span>
      </div>
      {/* Subject tags */}
      <div className="flex flex-wrap gap-2">
        {['Physics', 'Chemistry', 'Math'].map((tag) => (
          <span
            key={tag}
            className="rounded-md border border-[#8762F7]/30 bg-[#8762F7]/10 px-2 py-1 text-[11px] font-medium text-[#8762F7]"
          >
            {tag}
          </span>
        ))}
      </div>
      {/* Mock syllabus rows */}
      <div className="space-y-1.5">
        {['Full Syllabus', 'Chapter-wise', 'Weak Areas Only'].map((opt, i) => (
          <div
            key={opt}
            className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs ${
              i === 0 ? 'bg-[#8762F7]/15 text-[#8762F7]' : 'text-white/40'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${i === 0 ? 'bg-[#8762F7]' : 'bg-white/20'}`}
            />
            {opt}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Card 2 mini UI ── */
function AdaptiveTestUI() {
  return (
    <div className="mt-5 space-y-3">
      {/* Test card */}
      <div className="rounded-md border border-white/10 bg-white/5 p-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-white/80">Test 1: Mechanics</p>
            <p className="mt-0.5 text-[11px] text-white/40">30 questions · 60 min</p>
          </div>
          <span className="rounded bg-[#8762F7]/15 px-1.5 py-0.5 text-[10px] font-medium text-[#8762F7]">
            Active
          </span>
        </div>
        {/* Progress */}
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-[10px] text-white/40">
            <span>Progress</span>
            <span>18 / 30</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full rounded-full bg-[#8762F7]"
              initial={{ width: 0 }}
              whileInView={{ width: '60%' }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, ease: 'easeOut', delay: 0.3 }}
            />
          </div>
        </div>
      </div>
      {/* Timer row */}
      <div className="flex items-center gap-2 rounded-md bg-white/5 px-3 py-2">
        <Clock size={11} className="text-white/40" />
        <span className="text-[11px] text-white/50">Time remaining</span>
        <span className="ml-auto text-[11px] font-semibold text-white/70">38:22</span>
      </div>
    </div>
  );
}

/* ── Card 3 mini UI ── */
function AnalyzeUI() {
  return (
    <div className="mt-5 space-y-3">
      {/* Score box */}
      <div className="flex items-center gap-3 rounded-md border border-white/10 bg-white/5 px-3 py-2.5">
        <div>
          <p className="text-[10px] text-white/40">Overall Score</p>
          <p className="text-xl font-bold text-white">78%</p>
        </div>
        <div className="ml-auto flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-1">
          <ArrowUp size={10} className="text-emerald-400" />
          <span className="text-[11px] font-medium text-emerald-400">+6%</span>
        </div>
      </div>
      {/* Weak topics */}
      <div>
        <p className="mb-1.5 text-[10px] text-white/40">Weak Topics</p>
        <div className="space-y-1.5">
          {[
            { topic: 'Thermodynamics', pct: 42 },
            { topic: 'Algebra',        pct: 55 },
          ].map(({ topic, pct }) => (
            <div key={topic} className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-[11px] text-white/60">{topic}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full rounded-full bg-rose-400/70"
                  initial={{ width: 0 }}
                  whileInView={{ width: `${pct}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.9, ease: 'easeOut', delay: 0.3 }}
                />
              </div>
              <span className="text-[11px] text-white/40">{pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const STEPS = [
  {
    step:        'Step 1',
    icon:        BookOpen,
    title:       'Choose Your Exam',
    description: 'Pick your target exam and subjects. DenkenAI tailors everything to your syllabus from day one.',
    ui:          <ChooseExamUI />,
  },
  {
    step:        'Step 2',
    icon:        FileText,
    title:       'Attempt Adaptive Tests',
    description: 'Take tests that adapt in real-time to your performance, targeting exactly what needs work.',
    ui:          <AdaptiveTestUI />,
  },
  {
    step:        'Step 3',
    icon:        TrendingUp,
    title:       'Analyze & Improve',
    description: 'See your score, identify weak topics, and get a revision plan built around your mistakes.',
    ui:          <AnalyzeUI />,
  },
] as const;

export default function HowItWorksSection() {
  return (
    <section className="relative overflow-hidden bg-[#0B0E14] py-20 scroll-mt-20 " 
    id="how-it-works">

      {/* Background glow */}
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-72 w-[600px] -translate-x-1/2 rounded-full opacity-10 blur-3xl"
        style={{ background: 'radial-gradient(ellipse, #8762F7 0%, transparent 70%)' }}
      />

      <div className="relative z-10 mx-auto max-w-5xl px-4 text-center">

        {/* Heading */}
        <h2 className="text-3xl font-semibold text-white md:text-4xl">
          How to use{' '}
          <span className="text-[#8762F7]">DenkenAI</span>
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-white/60 md:text-base">
          A simple workflow from signup to improvement.
        </p>

        {/* Grid + connectors */}
        <div className="relative mt-12">

          {/* Desktop connector line */}
          <div className="pointer-events-none absolute left-[16.67%] right-[16.67%] top-[2.6rem] hidden h-px bg-gradient-to-r from-transparent via-white/10 to-transparent md:block" />

          <motion.div
            className="grid grid-cols-1 gap-6 md:grid-cols-3"
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
          >
            {STEPS.map(({ step, icon: Icon, title, description, ui }) => (
              <motion.div
                key={step}
                variants={item}
                whileHover={{
                  y: -5,
                  borderColor: 'rgba(135,98,247,0.4)',
                  boxShadow: '0 0 30px rgba(135,98,247,0.2)',
                }}
                transition={{ duration: 0.2 }}
                className="relative flex flex-col overflow-hidden rounded-xl border border-white/10 bg-white/5 p-6 text-left transition-all duration-300"
              >
                {/* Bottom glow */}
                <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-24 blur-xl"
                  style={{ background: 'linear-gradient(to top, rgba(135,98,247,0.08), transparent)' }}
                />

                {/* Step badge */}
                <span className="inline-block self-start rounded-md bg-[#8762F7] px-2 py-1 text-xs font-medium text-white">
                  {step}
                </span>

                {/* Icon + title */}
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#8762F7]/15"
                    style={{ boxShadow: '0 0 16px rgba(135,98,247,0.25)' }}>
                    <Icon size={16} className="text-[#8762F7]" />
                  </div>
                  <p className="text-lg font-semibold text-white">{title}</p>
                </div>

                {/* Mini UI */}
                <div className="relative z-10">{ui}</div>

                {/* Description */}
                <p className="relative z-10 mt-4 text-sm text-white/60">{description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>

      </div>
    </section>
  );
}
