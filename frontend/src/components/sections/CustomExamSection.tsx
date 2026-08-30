'use client';

import { useState } from 'react';
import { motion, AnimatePresence, type Easing } from 'framer-motion';
import {
  PenLine, Upload, BookMarked, Target, Sparkles, BarChart2,
  X, ChevronDown,
} from 'lucide-react';

const ease: Easing = 'easeOut';

const STEPS = [
  {
    icon: PenLine,
    title: 'Name your exam',
    description: 'Give your exam a name and define its purpose.',
  },
  {
    icon: Upload,
    title: 'Upload your syllabus',
    description: 'Add topics, chapters, or full syllabus to generate questions.',
  },
  {
    icon: BookMarked,
    title: 'Add previous year questions',
    description: 'Include PYQs to make your exam pattern more accurate.',
  },
  {
    icon: Target,
    title: 'Choose focus areas',
    description: 'Select topics you want to prioritize or improve.',
  },
  {
    icon: Sparkles,
    title: 'Generate test & notes',
    description: 'AI creates adaptive tests and revision notes instantly.',
  },
  {
    icon: BarChart2,
    title: 'Analyze and improve',
    description: 'Get detailed insights and refine your preparation.',
  },
] as const;

const TAGS = ['Physics', 'Organic Chemistry', 'Algebra', 'Thermodynamics'];
const DIFFICULTIES = ['Easy', 'Medium', 'Hard'] as const;

/* ── Simulated UI preview ── */
function ExamBuilderPreview({ activeStep }: { activeStep: number | null }) {
  const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
  const [tags, setTags] = useState(TAGS);
  const [generated, setGenerated] = useState(false);

  function removeTag(tag: string) {
    setTags((t) => t.filter((x) => x !== tag));
  }

  function handleGenerate() {
    setGenerated(true);
    setTimeout(() => setGenerated(false), 2200);
  }

  const highlighted = activeStep !== null;

  return (
    <motion.div
      animate={{
        boxShadow: highlighted
          ? '0 0 50px rgba(135,98,247,0.3)'
          : '0 0 0px rgba(135,98,247,0)',
        borderColor: highlighted
          ? 'rgba(135,98,247,0.35)'
          : 'rgba(255,255,255,0.1)',
      }}
      whileHover={{
        scale: 1.01,
        boxShadow: '0 0 50px rgba(135,98,247,0.3)',
      }}
      transition={{ duration: 0.35 }}
      className="relative h-full min-h-[420px] overflow-hidden rounded-2xl border bg-white/5 p-6"
    >
      {/* Corner glow */}
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#8762F7]/15 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-[#8762F7]/10 blur-2xl" />

      {/* Window chrome */}
      <div className="mb-5 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="ml-3 text-xs text-white/30">custom-exam-builder.denken.ai</span>
      </div>

      {/* Exam name input */}
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2">
          <PenLine size={13} className="text-white/30" />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 py-2.5 pl-8 pr-3">
          <span className="text-sm text-white/70">JEE Mock 1</span>
          <span className="text-xs text-white/30">Exam name</span>
        </div>
      </div>

      {/* Syllabus dropdown */}
      <div className="mt-3 flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2.5">
        <span className="text-sm text-white/50">Syllabus: Full JEE 2025</span>
        <ChevronDown size={13} className="text-white/30" />
      </div>

      {/* Tags */}
      <div className="mt-4">
        <p className="mb-2 text-[11px] text-white/40">Topics</p>
        <div className="flex flex-wrap gap-2">
          <AnimatePresence>
            {tags.map((tag) => (
              <motion.span
                key={tag}
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.18 }}
                className="flex items-center gap-1.5 rounded-md border border-[#8762F7]/30 bg-[#8762F7]/10 px-2 py-1 text-[11px] font-medium text-[#8762F7]"
              >
                {tag}
                <button onClick={() => removeTag(tag)} className="opacity-60 hover:opacity-100">
                  <X size={9} />
                </button>
              </motion.span>
            ))}
          </AnimatePresence>
          <span className="rounded-md border border-dashed border-white/15 px-2 py-1 text-[11px] text-white/30 cursor-default">
            + Add topic
          </span>
        </div>
      </div>

      {/* Difficulty toggle */}
      <div className="mt-5">
        <p className="mb-2 text-[11px] text-white/40">Difficulty</p>
        <div className="inline-flex rounded-lg border border-white/10 bg-white/5 p-0.5">
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              onClick={() => setDifficulty(d)}
              className="relative rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors duration-150"
            >
              {difficulty === d && (
                <motion.span
                  layoutId="diff-pill"
                  className="absolute inset-0 rounded-md bg-[#8762F7]"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <span className={`relative z-10 ${difficulty === d ? 'text-white' : 'text-white/40'}`}>
                {d}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Question count */}
      <div className="mt-4 flex gap-3">
        {[['Questions', '40'], ['Duration', '90 min'], ['PYQs', 'On']].map(([label, val]) => (
          <div key={label} className="flex-1 rounded-lg bg-white/5 px-3 py-2 text-center">
            <p className="text-[10px] text-white/40">{label}</p>
            <p className="mt-0.5 text-sm font-semibold text-white/80">{val}</p>
          </div>
        ))}
      </div>

      {/* Generate button */}
      <div className="mt-5">
        <motion.button
          onClick={handleGenerate}
          whileTap={{ scale: 0.97 }}
          className="relative w-full overflow-hidden rounded-md bg-[#8762F7] px-4 py-2.5 text-sm font-medium text-white"
        >
          <AnimatePresence mode="wait">
            {generated ? (
              <motion.span
                key="done"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="flex items-center justify-center gap-2"
              >
                <Sparkles size={13} />
                Generating your test...
              </motion.span>
            ) : (
              <motion.span
                key="idle"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
              >
                Generate Test
              </motion.span>
            )}
          </AnimatePresence>
          {/* Shimmer */}
          <motion.span
            className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent"
            animate={{ translateX: ['−100%', '200%'] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 1.5, ease: 'easeInOut' }}
          />
        </motion.button>
      </div>
    </motion.div>
  );
}

export default function CustomExamSection() {
  const [activeStep, setActiveStep] = useState<number | null>(null);

  return (
    <section className="relative overflow-hidden bg-[#0B0E14] py-24 scroll-mt-20"
    id="custom-exam-section">

      {/* Background glow */}
      <div className="pointer-events-none absolute right-0 top-1/2 h-[500px] w-[500px] -translate-y-1/2 translate-x-1/3 rounded-full opacity-[0.07] blur-3xl"
        style={{ background: 'radial-gradient(circle, #8762F7, transparent 70%)' }}
      />

      <div className="relative z-10 mx-auto max-w-6xl px-4">

        {/* Heading */}
        <div className="text-center">
          <h2 className="text-3xl font-semibold text-white md:text-4xl">
            Custom exam{' '}
            <span className="text-[#8762F7]">builder</span>
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-white/60 md:text-base">
            Create tests based on your own syllabus, topics, and difficulty, fully personalized.
          </p>
        </div>

        {/* Split layout */}
        <div className="mt-14 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-start lg:gap-16">

          {/* LEFT — Steps */}
          <motion.div
            className="flex flex-col gap-5"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-60px' }}
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.09 } } }}
          >
            {STEPS.map(({ icon: Icon, title, description }, i) => {
              const isActive = activeStep === i;
              return (
                <motion.div
                  key={title}
                  variants={{
                    hidden: { opacity: 0, x: -20 },
                    show:   { opacity: 1, x: 0, transition: { duration: 0.4, ease } },
                  }}
                  onHoverStart={() => setActiveStep(i)}
                  onHoverEnd={() => setActiveStep(null)}
                  className="group flex cursor-default items-start gap-4 rounded-xl p-3 transition-colors duration-200 hover:bg-white/5"
                >
                  {/* Circle + connector */}
                  <div className="flex flex-col items-center">
                    <motion.div
                      animate={{
                        backgroundColor: isActive ? '#8762F7' : 'rgba(135,98,247,0.15)',
                        boxShadow: isActive ? '0 0 16px rgba(135,98,247,0.5)' : '0 0 0px rgba(135,98,247,0)',
                      }}
                      transition={{ duration: 0.25 }}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                    >
                      <Icon size={14} className={isActive ? 'text-white' : 'text-[#8762F7]'} />
                    </motion.div>
                    {i < STEPS.length - 1 && (
                      <div className="mt-1 h-full w-px min-h-[1.5rem] bg-gradient-to-b from-white/10 to-transparent" />
                    )}
                  </div>

                  {/* Text */}
                  <div className="pb-2 pt-1">
                    <p className={`font-medium transition-colors duration-200 ${isActive ? 'text-white' : 'text-white/70'}`}>
                      {title}
                    </p>
                    <p className="mt-0.5 text-sm text-white/45">{description}</p>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>

          {/* RIGHT — Preview */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5, ease }}
          >
            <ExamBuilderPreview activeStep={activeStep} />
          </motion.div>

        </div>
      </div>
    </section>
  );
}
