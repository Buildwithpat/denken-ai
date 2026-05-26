'use client';

import { motion, type Variants, type Easing } from 'framer-motion';
import { Check } from 'lucide-react';

const ease: Easing = 'easeOut';

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 28 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.45, ease } },
};

const FEATURES = [
  'Adaptive AI-generated tests',
  'Performance analytics',
  'Personalized revision insights',
  'Syllabus-based question generation',
] as const;

const PLANS = [
  {
    name:       "1 Month",
    perMonth:   "₹449",
    total:      null,
    totalNote:  "Billed ₹449 monthly",
    saving:     null,
    badge:      null,
    cta:        "Get Started",
    highlight:  false,
  },
  {
    name:       "3 Months",
    perMonth:   "₹429",
    total:      "₹1,287",
    totalNote:  "Billed ₹1,287 once",
    saving:     "Save 4%",
    badge:      "Most Popular",
    cta:        "Get Started",
    highlight:  true,
  },
  {
    name:       "6 Months",
    perMonth:   "₹419",
    total:      "₹2,514",
    totalNote:  "Billed ₹2,514 once",
    saving:     "Save 7%",
    badge:      "Best Value",
    cta:        "Get Started",
    highlight:  false,
  },
] as const;

export default function PricingSection() {
  return (
    <section className="relative overflow-hidden bg-[#0B0E14] py-24 scroll-mt-20"
    id="pricing-section">

      {/* Background glow */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.06] blur-3xl"
        style={{ background: 'radial-gradient(ellipse, #8762F7, transparent 70%)' }}
      />

      <div className="relative z-10 mx-auto max-w-6xl px-4 text-center">

        {/* Heading */}
        <h2 className="text-3xl font-semibold text-white md:text-4xl">
          Simple,{' '}
          <span className="text-[#8762F7]">transparent</span>{' '}
          pricing
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-white/60 md:text-base">
          Choose a plan that fits your preparation journey.
        </p>

        {/* Cards */}
        <motion.div
          className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3"
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
        >
          {PLANS.map(({ name, perMonth, total, totalNote, saving, badge, cta, highlight }) => (
            <motion.div
              key={name}
              variants={item}
              whileHover={{
                y: -6,
                borderColor: 'rgba(135,98,247,0.5)',
                boxShadow: highlight
                  ? '0 0 50px rgba(135,98,247,0.35)'
                  : '0 0 35px rgba(135,98,247,0.2)',
              }}
              transition={{ duration: 0.2 }}
              className={[
                'relative flex flex-col justify-between rounded-xl border p-7 text-left transition-all duration-300',
                highlight
                  ? 'border-[#8762F7]/40 bg-white/[0.07] shadow-[0_0_40px_rgba(135,98,247,0.25)] md:scale-[1.05]'
                  : 'border-white/10 bg-white/5',
              ].join(' ')}
            >
              {/* Corner glow for highlighted */}
              {highlight && (
                <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[#8762F7]/20 blur-2xl" />
              )}

              {/* Badge */}
              {badge && (
                <span className={[
                  'absolute right-4 top-4 rounded-md px-2 py-1 text-xs font-semibold',
                  highlight ? 'bg-[#8762F7] text-white' : 'bg-white/10 text-white/60',
                ].join(' ')}>
                  {badge}
                </span>
              )}

              {/* Top */}
              <div>
                {/* Duration + savings row */}
                <div className="flex items-center justify-between pr-20">
                  <p className="text-lg font-medium text-white">{name}</p>
                  {saving && (
                    <span className="rounded-md border border-[#22c55e]/25 bg-[#22c55e]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#22c55e]/90">
                      {saving}
                    </span>
                  )}
                </div>

                {/* Per-month price */}
                <div className="mt-4 flex items-end gap-1.5">
                  <span className="text-4xl font-semibold text-white">{perMonth}</span>
                  <span className="mb-1.5 text-sm text-white/40">/mo</span>
                </div>

                {/* Total billing note */}
                <p className="mt-1 text-xs text-white/40">{totalNote}</p>

                {/* Divider */}
                <div className="my-6 h-px bg-white/8" />

                {/* Features */}
                <ul className="space-y-2.5">
                  {FEATURES.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-white/70">
                      <Check
                        size={14}
                        className={`mt-0.5 shrink-0 ${highlight ? 'text-[#8762F7]' : 'text-white/40'}`}
                      />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              {/* CTA */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                className={[
                  'relative mt-8 w-full cursor-pointer overflow-hidden rounded-md px-4 py-2.5 text-sm font-medium transition-all duration-200',
                  highlight
                    ? 'bg-[#8762F7] text-white hover:brightness-110'
                    : 'border border-white/15 bg-white/5 text-white/80 hover:border-white/30 hover:bg-white/10',
                ].join(' ')}
              >
                {highlight && (
                  <motion.span
                    className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent"
                    animate={{ translateX: ['-100%', '200%'] }}
                    transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 1.8, ease: 'easeInOut' }}
                  />
                )}
                <span className="relative z-10">{cta}</span>
              </motion.button>
            </motion.div>
          ))}
        </motion.div>

        {/* Trust line */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-10 text-sm text-white/50"
        >
          No hidden charges.
        </motion.p>

      </div>
    </section>
  );
}
