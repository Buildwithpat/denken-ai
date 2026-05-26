'use client';

import { useState } from 'react';
import { ArrowLeft, Zap } from 'lucide-react';
import type { ExamType } from '@/context/OnboardingContext';
import { chapters as CHAPTERS } from '@/data/chapters';

/* ─── Props ─────────────────────────────────────────────────────────────── */

interface Props {
  examType: ExamType | null;
  subjects: string[];
}

/* ─── Static data ────────────────────────────────────────────────────────── */

const Q_PRESETS = [10, 20, 30] as const;
const T_PRESETS = [15, 30, 60] as const;

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function getSubjectList(examType: ExamType | null, subjects: string[]): string[] {
  const filled = subjects.filter(Boolean);
  switch (examType) {
    case 'jee':    return Object.keys(CHAPTERS.JEE);
    case 'neet':   return Object.keys(CHAPTERS.NEET);
    case 'cbse':   return filled;
    case 'custom': return filled.map((_, i) => `Unit ${i + 1}`);
    default:       return Object.keys(CHAPTERS.JEE);
  }
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-white/25">
      {children}
    </p>
  );
}

function PresetChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'flex-1 cursor-pointer rounded-md py-1.5 text-xs font-medium transition-colors duration-100',
        active
          ? 'bg-[#8762F7]/20 text-white'
          : 'bg-white/[0.04] text-white/40 hover:bg-white/[0.07] hover:text-white/75',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

/* ─── Main component ─────────────────────────────────────────────────────── */

export default function SurpriseTestCard({ examType, subjects }: Props) {
  const subjectList = getSubjectList(examType, subjects);

  const [active,   setActive]   = useState<string | null>(null);
  const [jeeMode,  setJeeMode]  = useState<'main' | 'advanced'>('main');
  const [qPreset,  setQPreset]  = useState<number | null>(10);
  const [tPreset,  setTPreset]  = useState<number | null>(15);

  function handleSubjectClick(s: string) {
    if (active === s) { setActive(null); return; }
    setActive(s);
    setQPreset(10);
    setTPreset(15);
    setJeeMode('main');
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-white/5 backdrop-blur-md">
      {/* Distinguishing gradient — blue-shifted vs main card */}
      <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-tr from-[#4F8BF7]/[0.06] via-[#8762F7]/[0.04] to-transparent" />

      <div className="relative p-5">

        {/* Header */}
        <div className="mb-4 flex items-start gap-2.5">
          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#8762F7]/15">
            <Zap size={12} className="text-[#8762F7]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Surprise Test</h3>
            <p className="mt-0.5 text-xs text-white/40">Get a quick adaptive test instantly.</p>
          </div>
        </div>

        {/* Subject buttons */}
        <div className="flex flex-col gap-1.5">
          {subjectList.map(s => (
            <button
              key={s}
              onClick={() => handleSubjectClick(s)}
              className={[
                'w-full cursor-pointer rounded-md px-4 py-2.5 text-left text-xs font-medium transition-all duration-150',
                active === s
                  ? 'bg-[#8762F7]/20 text-white shadow-[0_0_14px_rgba(135,98,247,0.18)]'
                  : 'bg-white/[0.04] text-white/50 hover:bg-[#8762F7]/12 hover:text-white/85 hover:shadow-[0_0_10px_rgba(135,98,247,0.1)]',
              ].join(' ')}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Inline config — expands when a subject is chosen */}
        {active && (
          <div className="mt-4 space-y-4 border-t border-white/[0.06] pt-4">

            {/* Back button */}
            <button
              onClick={() => setActive(null)}
              className="flex cursor-pointer items-center gap-1.5 text-xs text-white/50 transition-colors hover:text-white"
            >
              <ArrowLeft size={12} />
              Back
            </button>

            {/* JEE only: Main / Advanced toggle */}
            {examType === 'jee' && (
              <div>
                <SectionLabel>Exam Type</SectionLabel>
                <div className="flex gap-2">
                  {(['main', 'advanced'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setJeeMode(mode)}
                      className={[
                        'flex-1 cursor-pointer rounded-md py-2 text-xs font-medium transition-colors duration-100',
                        jeeMode === mode
                          ? 'bg-[#8762F7]/20 text-white'
                          : 'bg-white/[0.04] text-white/40 hover:bg-white/[0.07] hover:text-white/75',
                      ].join(' ')}
                    >
                      {mode === 'main' ? 'JEE Main' : 'Advanced'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Number of questions */}
            <div>
              <SectionLabel>Questions</SectionLabel>
              <div className="flex gap-2">
                {Q_PRESETS.map(n => (
                  <PresetChip
                    key={n}
                    label={String(n)}
                    active={qPreset === n}
                    onClick={() => setQPreset(n)}
                  />
                ))}
              </div>
            </div>

            {/* Duration */}
            <div>
              <SectionLabel>Duration</SectionLabel>
              <div className="flex gap-2">
                {T_PRESETS.map(t => (
                  <PresetChip
                    key={t}
                    label={`${t}m`}
                    active={tPreset === t}
                    onClick={() => setTPreset(t)}
                  />
                ))}
              </div>
            </div>

            {/* CTA */}
            <button className="w-full cursor-pointer rounded-lg bg-gradient-to-r from-[#8762F7] to-[#6D4AFF] py-2.5 text-xs font-semibold text-white transition-all duration-150 hover:opacity-90 hover:shadow-[0_4px_16px_rgba(135,98,247,0.3)]">
              Start Quick Test
            </button>

          </div>
        )}

      </div>
    </div>
  );
}
