'use client';

import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import ParticlesBackground from '@/components/ui/ParticlesBackground';
import DashboardPreview from '@/components/landing/DashboardPreview';

export default function HeroSection() {
  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center bg-[#0B0E14] pb-20 pt-28 md:pt-32">
      {/* ── Particles ── */}
      <ParticlesBackground />

      {/* ── Ambient glow ── */}
      <motion.div
        className="pointer-events-none absolute inset-0 z-0"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        style={{
          background:
            "radial-gradient(ellipse at 50% 55%, rgba(135,98,247,0.09) 0%, transparent 65%)",
        }}
      />

      {/* ── Content ── */}
      <div className="relative z-10 mx-auto max-w-6xl px-4 text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#8762F7]/40 bg-[#8762F7]/10 px-4 py-1.5"
        >
          <Sparkles size={13} className="text-[#8762F7]" />
          <span className="text-xs font-medium tracking-wide text-[#8762F7]">
            AI-Powered Academic Intelligence
          </span>
        </motion.div>

        <h1 className="bg-gradient-to-r from-white to-[#8762F7] bg-clip-text text-5xl font-semibold tracking-tight text-transparent md:text-6xl">
          Prepare smarter. Not harder.
        </h1>

        <p className="mx-auto mt-4 max-w-xl text-base text-white/60 md:text-lg">
          DenkenAI analyzes your performance, identifies weak concepts, and
          builds a personalized progression path.
        </p>
        <p className="mx-auto mt-2 max-w-xl text-base text-white/60 md:text-lg">
          Prepare for JEE, NEET, CBSE, or create your own custom exam.
        </p>

        <motion.a
          href="/onboarding"
          whileTap={{ scale: 0.95 }}
          className="mt-6 inline-flex items-center justify-center rounded-md bg-[#8762F7] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:brightness-110"
        >
          Try it
        </motion.a>

        {/* ── Frame group ── */}
        <div className="relative mx-auto mt-16 w-full max-w-[90rem] px-4 pb-4">
          {/* Back-left layer */}
          <div
            className="absolute inset-0 hidden rounded-2xl border-2 border-white/25 bg-[#0B0E14] opacity-40 md:block"
            style={{ transform: "translateX(-60px) rotate(-6deg)" }}
          />

          {/* Back-right layer */}
          <div
            className="absolute inset-0 hidden rounded-2xl border-2 border-white/25 bg-[#0B0E14] opacity-40 md:block"
            style={{ transform: "translateX(60px) rotate(6deg)" }}
          />

          {/* Main frame */}
          <div className="relative z-20 h-[260px] w-full overflow-hidden rounded-2xl border-2 border-white/60 bg-[#0B0E14] transition-all duration-300 hover:shadow-[0_0_40px_rgba(135,98,247,0.25)] md:h-[500px]">
            <DashboardPreview />
          </div>
        </div>
      </div>
    </section>
  );
}

