'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { X, BookMarked } from 'lucide-react';
import { chapters as CHAPTERS } from '@/data/chapters';
import { useTestConfig, type TestExam } from '@/context/TestContext';

/* ─── Types ──────────────────────────────────────────────────────────────── */

type ExamKey = 'jee' | 'neet' | 'cbse' | 'custom';
interface WeakEntry { subject: string; chapter: string; score: number }

interface Props {
  examType:    ExamKey;
  subjects:    string[];
  weakEntries: WeakEntry[];
  onClose:     () => void;
}

/* ─── Constants ──────────────────────────────────────────────────────────── */

const YEARS = ['2025', '2024', '2023', '2022', '2021', '2020'];

/* ─── Shared styles ──────────────────────────────────────────────────────── */

const SELECT_CLS =
  'w-full cursor-pointer appearance-none rounded border border-white/[0.08] bg-[#0f1117] px-3 py-2 text-xs text-white/65 focus:border-[#8762F7]/40 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40';

function pillCls(active: boolean) {
  return [
    'cursor-pointer rounded border px-3 py-1.5 text-xs font-medium tabular-nums transition-colors',
    active
      ? 'border-[#8762F7]/40 bg-[#8762F7]/15 text-[#8762F7]'
      : 'border-white/[0.08] bg-white/[0.02] text-white/45 hover:border-white/[0.15] hover:text-white/70',
  ].join(' ');
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/25">
      {children}
    </p>
  );
}

/* ─── Component ──────────────────────────────────────────────────────────── */

export default function PYQPanel({ examType, subjects, weakEntries, onClose }: Props) {
  const { setTestConfig } = useTestConfig();
  const router = useRouter();

  const [subject, setSubject] = useState(subjects[0] ?? '');
  const [chapter, setChapter] = useState('');
  const [year,    setYear]    = useState('2024');

  const chapters = useMemo<string[]>(() => {
    if (examType === 'jee') {
      const data = (CHAPTERS.JEE as Record<string, Record<string, string[]>>)[subject];
      return data ? [...(data['11'] ?? []), ...(data['12'] ?? [])] : [];
    }
    if (examType === 'neet') {
      const data = (CHAPTERS.NEET as Record<string, Record<string, string[]>>)[subject];
      return data ? [...(data['11'] ?? []), ...(data['12'] ?? [])] : [];
    }
    return weakEntries.filter(e => e.subject === subject).map(e => e.chapter);
  }, [examType, subject, weakEntries]);

  function handleSubjectChange(val: string) {
    setSubject(val);
    setChapter('');
  }

  function handleStart() {
    setTestConfig({
      mode:      'pyq',
      exam:      examType.toUpperCase() as TestExam,
      subject,
      chapter,
      questions: 20,
      time:      30,
      year,
    });
    router.push('/attempt');
  }

  return (
    <div className="mt-3 rounded-lg border border-[#8762F7]/20 bg-[#8762F7]/[0.04] p-4">

      {/* ── Header ── */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookMarked size={13} className="text-[#8762F7]/70" />
          <p className="text-xs font-semibold text-white/80">PYQ Mode</p>
        </div>
        <button
          onClick={onClose}
          className="cursor-pointer rounded p-1 text-white/25 transition-colors hover:bg-white/[0.05] hover:text-white/60"
        >
          <X size={13} />
        </button>
      </div>

      {/* ── Form ── */}
      <div className="space-y-3.5">

        {/* Subject + Chapter */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <FieldLabel>Subject</FieldLabel>
            <select
              value={subject}
              onChange={e => handleSubjectChange(e.target.value)}
              className={SELECT_CLS}
            >
              {subjects.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel>Chapter</FieldLabel>
            <select
              value={chapter}
              onChange={e => setChapter(e.target.value)}
              disabled={chapters.length === 0}
              className={SELECT_CLS}
            >
              <option value="">All Chapters</option>
              {chapters.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Year selector */}
        <div>
          <FieldLabel>Year</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {YEARS.map(y => (
              <button
                key={y}
                onClick={() => setYear(y)}
                className={pillCls(year === y)}
              >
                {y}
              </button>
            ))}
          </div>
        </div>

        {/* Start */}
        <button
          onClick={handleStart}
          disabled={subject === ''}
          className="mt-0.5 w-full cursor-pointer rounded border border-[#8762F7]/30 bg-[#8762F7]/12 py-2 text-xs font-semibold text-[#8762F7] transition-colors hover:bg-[#8762F7]/22 disabled:cursor-not-allowed disabled:opacity-30"
        >
          Start PYQ Practice
        </button>

      </div>
    </div>
  );
}
