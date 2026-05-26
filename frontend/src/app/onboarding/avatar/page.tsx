'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import ParticlesBackground from '@/components/ui/ParticlesBackground';
import { useOnboarding } from '@/context/OnboardingContext';

const AVATARS = [
  'Avatar01', 'Avatar03', 'Avatar04', 'Avatar05',
  'Avatar08', 'Avatar09', 'Avatar10', 'Avatar11',
  'Avatar12', 'Avatar13', 'Avatar14', 'Avatar15',
  'Avatar16', 'Avatar17', 'Avatar18', 'Avatar19',
  'Avatar20', 'Avatar21',
] as const;

type Avatar = typeof AVATARS[number];

export default function AvatarSelectionPage() {
  const router = useRouter();
  const { set } = useOnboarding();
  const [selected, setSelected] = useState<Avatar | null>(null);

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

      {/* Content */}
      <div className="relative z-10 flex flex-1 items-center justify-center overflow-y-auto md:overflow-hidden px-4 py-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="w-full max-w-2xl rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md"
        >

          {/* Step indicator + back */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <span className="h-1.5 w-5 rounded-full bg-[#8762F7]/40" />
                <span className="h-1.5 w-5 rounded-full bg-[#8762F7]" />
              </div>
              <span className="text-xs text-white/40">Step 2 of 2</span>
            </div>
            <Link
              href="/"
              className="flex cursor-pointer items-center gap-1.5 text-xs text-white/40 transition-colors hover:text-white/80"
            >
              <ArrowLeft size={12} />
              Back
            </Link>
          </div>

          {/* Heading */}
          <h1 className="text-lg font-semibold text-white">Select an avatar</h1>
          <p className="mt-1 text-xs text-white/55">
            Pick the one that matches your personality.
          </p>

          {/* Avatar grid */}
          <motion.div
            className="mt-5 grid grid-cols-6 gap-2"
            variants={{ show: { transition: { staggerChildren: 0.03 } } }}
            initial="hidden"
            animate="show"
          >
            {AVATARS.map((name) => {
              const isSelected = selected === name;
              return (
                <motion.button
                  key={name}
                  variants={{
                    hidden: { opacity: 0, scale: 0.8 },
                    show:   { opacity: 1, scale: 1, transition: { duration: 0.2, ease: 'easeOut' } },
                  }}
                  onClick={() => setSelected(name)}
                  whileHover={{ scale: 1.07 }}
                  whileTap={{ scale: 0.93 }}
                  animate={isSelected ? { scale: 1.07 } : { scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  className={[
                    'relative aspect-square cursor-pointer overflow-hidden rounded-full transition-all duration-200',
                    isSelected
                      ? 'opacity-100 ring-2 ring-[#8762F7] ring-offset-2 ring-offset-[#0B0E14]'
                      : 'opacity-65 hover:opacity-100',
                  ].join(' ')}
                >
                  <Image
                    src={`/avatars/${name}.svg`}
                    alt={name}
                    fill
                    className="object-cover"
                    sizes="10vw"
                  />
                  <AnimatePresence>
                    {isSelected && (
                      <motion.div
                        key="glow"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="pointer-events-none absolute inset-0 rounded-full"
                        style={{ boxShadow: '0 0 16px rgba(135,98,247,0.55)' }}
                      />
                    )}
                  </AnimatePresence>
                </motion.button>
              );
            })}
          </motion.div>

          {/* Continue button */}
          <div className="mt-5 flex justify-center">
            <motion.button
              whileTap={{ scale: 0.97 }}
              disabled={!selected}
              onClick={() => { if (selected) { set('avatar', selected); router.push('/onboarding/exam'); } }}
              className={[
                'rounded-md px-8 py-2.5 text-sm font-medium text-white transition-all duration-200',
                selected
                  ? 'cursor-pointer bg-gradient-to-r from-[#8762F7] to-[#6D4AFF] hover:brightness-110 hover:shadow-[0_0_20px_rgba(135,98,247,0.45)]'
                  : 'cursor-not-allowed bg-white/10 text-white/30',
              ].join(' ')}
            >
              Continue
            </motion.button>
          </div>

        </motion.div>
      </div>
    </main>
  );
}
