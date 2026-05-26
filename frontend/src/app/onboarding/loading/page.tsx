'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import ParticlesBackground from '@/components/ui/ParticlesBackground';

const MESSAGES = [
  'Analyzing your preparation profile...',
  'Setting up your personalized roadmap...',
  'Mapping your strengths and weak areas...',
  'Designing adaptive tests for you...',
  'Almost ready...',
] as const;

const STEP_MS = 1400;

export default function LoadingPage() {
  const router   = useRouter();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((i) => Math.min(i + 1, MESSAGES.length - 1));
    }, STEP_MS);

    const timeout = setTimeout(
      () => router.push('/onboarding/summary'),
      MESSAGES.length * STEP_MS + 500,
    );

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  return (
    <main className="relative flex h-screen flex-col items-center justify-center overflow-hidden bg-[#0B0E14]">

      <ParticlesBackground />

      {/* Ambient centre glow */}
      <div className="pointer-events-none absolute h-72 w-72 rounded-full bg-[#8762F7] opacity-[0.07] blur-3xl" />

      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="mb-8"
      >
        <Image src="/DenkenLogo.svg" alt="DenkenAI" width={54} height={54} priority />
      </motion.div>

      {/* Spinner */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="relative"
      >
        {/* Glow behind ring */}
        <div className="absolute inset-0 rounded-full bg-[#8762F7] opacity-20 blur-xl" />

        {/* Ring */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="relative h-16 w-16 rounded-full border-2 border-white/10 border-t-[#8762F7]"
        />
      </motion.div>

      {/* Rotating message */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-8 h-6 overflow-hidden text-center"
      >
        <AnimatePresence mode="wait">
          <motion.p
            key={index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="text-sm text-white/70"
          >
            {MESSAGES[index]}
          </motion.p>
        </AnimatePresence>
      </motion.div>

      {/* Micro text */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-2 text-xs text-white/35"
      >
        This will only take a few seconds
      </motion.p>

    </main>
  );
}
