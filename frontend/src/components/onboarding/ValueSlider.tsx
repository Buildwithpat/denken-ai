'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SLIDES = [
  {
    headline:    'Create your own exam',
    description: 'Build tests around your syllabus by uploading units and past questions, not a generic test series.',
  },
  {
    headline:    'Practice that adapts to you',
    description: 'Get questions that match your preparation level instead of fixed difficulty tests.',
  },
  {
    headline:    'Analyze your results clearly',
    description: "Understand why you made mistakes: concepts, accuracy, or time management.",
  },
  {
    headline:    'Find where you lack',
    description: 'Identify weak topics early and focus your effort where improvement matters most.',
  },
  {
    headline:    'Prepare with confidence',
    description: 'Track your progress over time and move forward with clarity instead of guesswork.',
  },
] as const;

const variants = {
  enter:  (dir: number) => ({ opacity: 0, y: dir * 14 }),
  center: { opacity: 1, y: 0 },
  exit:   (dir: number) => ({ opacity: 0, y: dir * -14 }),
};

export default function ValueSlider() {
  const [index, setIndex]         = useState(0);
  const [direction, setDirection] = useState(1);

  useEffect(() => {
    const id = setInterval(() => {
      setDirection(1);
      setIndex((i) => (i + 1) % SLIDES.length);
    }, 2800);
    return () => clearInterval(id);
  }, []);

  function goTo(i: number) {
    setDirection(i > index ? 1 : -1);
    setIndex(i);
  }

  return (
    <div className="relative flex min-h-[280px] flex-col items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#8762F7] to-[#6D4AFF] p-8 text-center">

      <div
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{ background: 'radial-gradient(ellipse at 60% 30%, rgba(255,255,255,0.08) 0%, transparent 65%)' }}
      />
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full border border-white/10" />
      <div className="pointer-events-none absolute -bottom-6 -left-6 h-24 w-24 rounded-full border border-white/10" />

      <div className="relative z-10 w-full">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={index}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.35, ease: 'easeOut' }}
          >
            <p className="text-xl font-semibold leading-snug text-white md:text-2xl">
              {SLIDES[index].headline}
            </p>
            <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-white/75">
              {SLIDES[index].description}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="relative z-10 mt-6 flex items-center gap-2">
        {SLIDES.map((_, i) => (
          <button key={i} onClick={() => goTo(i)} className="cursor-pointer">
            <motion.span
              animate={{ width: i === index ? '1.25rem' : '0.4rem', opacity: i === index ? 1 : 0.4 }}
              transition={{ duration: 0.3 }}
              className="block h-1.5 rounded-full bg-white"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
