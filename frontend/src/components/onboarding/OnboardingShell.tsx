'use client';

import { type ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import ParticlesBackground from '@/components/ui/ParticlesBackground';
import ValueSlider from './ValueSlider';

interface Props {
  title:     string;
  subtitle:  string;
  backHref?: string;
  children:  ReactNode;
}

export default function OnboardingShell({ title, subtitle, backHref, children }: Props) {
  return (
    <main className="relative flex h-screen flex-col overflow-hidden bg-[#0B0E14]">

      <ParticlesBackground />
      <div className="pointer-events-none absolute -left-32 -top-32 h-72 w-72 rounded-full bg-[#8762F7] opacity-[0.06] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-72 w-72 rounded-full bg-[#8762F7] opacity-[0.06] blur-3xl" />

      {/* Top logo bar */}
      <div className="relative z-20 flex h-12 shrink-0 items-center border-b border-white/[0.06] px-6">
        <Link href="/" className="inline-flex items-center gap-2">
          <Image src="/DenkenLogo.svg" alt="DenkenAI" width={24} height={24} priority />
          <span className="text-sm font-semibold">
            <span className="text-white">Denken</span>
            <span className="text-[#8762F7]">AI</span>
          </span>
        </Link>
      </div>

      {/* Scrollable content area — safety net for small screens */}
      <div className="relative z-10 flex flex-1 items-center justify-center overflow-y-auto md:overflow-hidden px-4 py-4">
        <div className="w-full max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="grid grid-cols-1 items-center gap-6 md:grid-cols-2 md:gap-10"
          >

            {/* Left card */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md max-h-[calc(100vh-5rem)] overflow-y-auto">

              {/* Back button */}
              {backHref && (
                <Link
                  href={backHref}
                  className="mb-3 flex w-fit cursor-pointer items-center gap-1.5 text-xs text-white/40 transition-colors hover:text-white/80"
                >
                  <ArrowLeft size={12} />
                  Back
                </Link>
              )}

              <h1 className="text-lg font-semibold text-white">{title}</h1>
              <p className="mt-1 text-xs text-white/55">{subtitle}</p>

              {children}
            </div>

            {/* Right panel — hidden on mobile */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.15, ease: 'easeOut' }}
              className="hidden md:block"
            >
              <ValueSlider />
            </motion.div>

          </motion.div>
        </div>
      </div>
    </main>
  );
}
