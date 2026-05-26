'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';

const MESSAGES = [
  'Analyzing your performance...',
  'Selecting best questions...',
  'Optimizing difficulty...',
  'Building your test...',
  'Almost ready...',
] as const;

const STEP_MS = 550;
const TOTAL_MS = 2400;

interface Props {
  onDone: () => void;
}

export default function TestLoader({ onDone }: Props) {
  const [msgIdx,    setMsgIdx]    = useState(0);
  const [progress,  setProgress]  = useState(0);

  useEffect(() => {
    /* Cycle messages */
    const msgInterval = setInterval(() => {
      setMsgIdx(i => Math.min(i + 1, MESSAGES.length - 1));
    }, STEP_MS);

    /* Smooth progress bar */
    const start = Date.now();
    const progInterval = setInterval(() => {
      const elapsed = Date.now() - start;
      setProgress(Math.min((elapsed / TOTAL_MS) * 100, 98));
    }, 30);

    /* Navigate after total duration */
    const done = setTimeout(() => {
      setProgress(100);
      setTimeout(onDone, 200);
    }, TOTAL_MS);

    return () => {
      clearInterval(msgInterval);
      clearInterval(progInterval);
      clearTimeout(done);
    };
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-[999] flex flex-col items-center justify-center overflow-hidden bg-[#0B0E14]">

      {/* Ambient glow */}
      <div className="pointer-events-none absolute h-80 w-80 rounded-full bg-[#8762F7] opacity-[0.07] blur-3xl" />

      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="mb-8"
      >
        <Image src="/DenkenLogo.svg" alt="DenkenAI" width={48} height={48} priority />
      </motion.div>

      {/* Spinner */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.15 }}
        className="relative mb-8"
      >
        <div className="absolute inset-0 rounded-full bg-[#8762F7] opacity-20 blur-xl" />
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
          className="relative h-14 w-14 rounded-full border-2 border-white/10 border-t-[#8762F7]"
        />
      </motion.div>

      {/* Heading */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mb-2 text-base font-semibold text-white"
      >
        DenkenAI is preparing your test…
      </motion.p>

      {/* Rotating messages */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mb-8 h-5 overflow-hidden text-center"
      >
        <AnimatePresence mode="wait">
          <motion.p
            key={msgIdx}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="text-xs text-white/45"
          >
            {MESSAGES[msgIdx]}
          </motion.p>
        </AnimatePresence>
      </motion.div>

      {/* Progress bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
        className="w-48 overflow-hidden rounded-full bg-white/[0.07]"
        style={{ height: 3 }}
      >
        <div
          className="h-full rounded-full bg-[#8762F7] transition-all duration-100 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </motion.div>

    </div>
  );
}
