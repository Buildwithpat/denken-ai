'use client';

import { useState } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import MobileRestricted   from '@/components/MobileRestricted';
import { useOnboarding }  from '@/context/OnboardingContext';
import { useAccess }      from '@/context/AccessContext';
import { chapters as CHAPTERS } from '@/data/chapters';
import TestConfigCard      from '@/components/tests/TestConfigCard';
import SurpriseTestCard   from '@/components/tests/SurpriseTestCard';
import PrepInsightGate    from '@/components/upgrade/PrepInsightGate';
import { trackEvent }     from '@/lib/trackEvent';

/* ─── Types ─────────────────────────────────────────────────────────────── */

type Card = { title: string; description: string };

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function subjectDescription(exam: 'JEE' | 'NEET', subject: string): string {
  const data = (CHAPTERS[exam] as Record<string, Record<string, string[]>>)[subject];
  if (!data) return '';
  return "Adaptive tests based on your preparation level";
}

function getCards(examType: string | null, subjects: string[]): Card[] {
  const filled = subjects.filter(Boolean);
  switch (examType) {
    case 'jee':
      return Object.keys(CHAPTERS.JEE).map(s => ({
        title: s, description: subjectDescription('JEE', s),
      }));
    case 'neet':
      return Object.keys(CHAPTERS.NEET).map(s => ({
        title: s, description: subjectDescription('NEET', s),
      }));
    case 'cbse':
      return filled.map(s => ({ title: s, description: `Practice tests covering ${s} topics` }));
    case 'custom':
      return filled.map((s, i) => ({ title: `Unit ${i + 1}`, description: s }));
    default:
      return Object.keys(CHAPTERS.JEE).map(s => ({
        title: s, description: subjectDescription('JEE', s),
      }));
  }
}

/* ─── SubjectCard ────────────────────────────────────────────────────────── */

function SubjectCard({
  title,
  description,
  active,
  onSelect,
}: Card & { active: boolean; onSelect: () => void }) {
  return (
    <div
      onClick={onSelect}
      className={[
        'group relative cursor-pointer overflow-hidden rounded-xl border backdrop-blur-md transition-all duration-200',
        active
          ? 'border-[#8762F7]/40 bg-[#8762F7]/20 shadow-[0_0_32px_rgba(135,98,247,0.14)]'
          : 'border-white/10 bg-white/5 hover:scale-[1.015] hover:border-[#8762F7]/20 hover:shadow-[0_0_24px_rgba(135,98,247,0.07)]',
      ].join(' ')}
    >
      <div className={[
        'pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br transition-opacity duration-200',
        active
          ? 'from-[#8762F7]/[0.12] to-transparent opacity-100'
          : 'from-[#8762F7]/[0.06] to-transparent opacity-0 group-hover:opacity-100',
      ].join(' ')} />

      <div className="relative p-5">
        <h3 className={[
          'text-sm font-semibold transition-colors duration-150',
          active ? 'text-white' : 'text-white/80',
        ].join(' ')}>
          {title}
        </h3>
        <p className="mt-1.5 text-xs leading-relaxed text-white/40">{description}</p>

        <div className={[
          'mt-5 inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium transition-all duration-150',
          active
            ? 'bg-[#8762F7]/30 text-white'
            : 'bg-[#8762F7]/15 text-[#8762F7] hover:bg-[#8762F7]/25',
        ].join(' ')}>
          {active ? (
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-[#8762F7] shadow-[0_0_6px_#8762F7]" />
              Configuring
            </>
          ) : 'Create Test'}
        </div>
      </div>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function TestsPage() {
  const { data, loaded }                             = useOnboarding();
  const { testsExhausted, isLoading: accessLoading } = useAccess();
  const [activeSubject, setActiveSubject]            = useState<string | null>(null);
  const [showGate, setShowGate]                      = useState(false);

  if (!loaded) return null;

  const cards   = getCards(data.examType, data.subjects);
  const blocked = !accessLoading && testsExhausted;

  function handleSelect(title: string) {
    if (blocked) {
      trackEvent('trial_test_exhausted', { source: 'subject_card_click' });
      setShowGate(true);
      return;
    }
    setActiveSubject(prev => (prev === title ? null : title));
  }

  return (
    <MobileRestricted>
    <div className="mx-auto max-w-7xl px-6 py-6">

      {/* PrepInsightGate modal — shown when free trial is exhausted */}
      <AnimatePresence>
        {showGate && (
          <PrepInsightGate
            trigger="test_limit"
            onClose={() => setShowGate(false)}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="mb-7">
        <h1 className="text-xl font-semibold text-white">Tests</h1>
        <p className="mt-1 text-sm text-white/40">Create and manage your practice tests</p>
      </div>

      {/* Trial exhausted notice bar */}
      {blocked && (
        <div
          className="mb-6 flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-[#8762F7]/20 bg-[#8762F7]/[0.06] px-5 py-4"
          onClick={() => setShowGate(true)}
        >
          <div>
            <p className="text-sm font-semibold text-white/90">Free test used</p>
            <p className="mt-0.5 text-xs text-white/45">
              Subscribe to generate unlimited tests and unlock all exam modes.
            </p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setShowGate(true); }}
            className="flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-[#8762F7]/35 bg-[#8762F7]/15 px-4 py-2 text-xs font-semibold text-[#8762F7] transition-all hover:border-[#8762F7]/55 hover:bg-[#8762F7]/25"
          >
            View plans
          </button>
        </div>
      )}

      {/* Subject cards */}
      <div className={`grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 ${blocked ? 'opacity-50 pointer-events-none select-none' : ''}`}>
        {cards.map(card => (
          <SubjectCard
            key={card.title}
            {...card}
            active={activeSubject === card.title}
            onSelect={() => handleSelect(card.title)}
          />
        ))}
      </div>

      {/* Configuration card */}
      <AnimatePresence mode="wait">
        {activeSubject && !blocked && (
          <motion.div
            key={activeSubject}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="mt-6"
          >
            <TestConfigCard
              subject={activeSubject}
              examType={data.examType}
              subjects={data.subjects}
              onClose={() => setActiveSubject(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick test */}
      <div className={`mt-8 ${blocked ? 'opacity-50 pointer-events-none select-none' : ''}`}>
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-white">Quick Test</h2>
          <p className="mt-0.5 text-xs text-white/40">Jump straight in with a random set</p>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          <SurpriseTestCard examType={data.examType} subjects={data.subjects} />
        </div>
      </div>

    </div>
    </MobileRestricted>
  );
}
