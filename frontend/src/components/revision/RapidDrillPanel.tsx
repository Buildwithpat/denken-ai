'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { X, Zap } from 'lucide-react';
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

const Q_PRESETS: string[]   = ['10', '20', '30'];
const TMR_PRESETS: string[] = ['5', '10'];

const MAX_QUESTIONS = 90;
const MAX_DURATION  = 180;

/* ─── Styles ─────────────────────────────────────────────────────────────── */

const SELECT_CLS =
  'w-full cursor-pointer appearance-none rounded border border-white/[0.08] bg-[#0f1117] px-3 py-2 text-xs text-white/65 focus:border-[#8762F7]/40 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40';

const INPUT_CLS =
  'rounded border border-white/[0.08] bg-[#0f1117] px-2 py-1.5 text-center text-xs text-white/65 tabular-nums focus:border-[#8762F7]/40 focus:outline-none placeholder:text-white/20';

function pillCls(active: boolean) {
  return [
    'cursor-pointer rounded border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap',
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

export default function RapidDrillPanel({ examType, subjects, weakEntries, onClose }: Props) {
  const { setTestConfig } = useTestConfig();
  const router = useRouter();

  const [subject,      setSubject]      = useState(subjects[0] ?? '');
  const [chapter,      setChapter]      = useState('');
  const [qPreset,      setQPreset]      = useState('20');
  const [customQ,      setCustomQ]      = useState('');
  const [timerPreset,  setTimerPreset]  = useState('10');
  const [customTimer,  setCustomTimer]  = useState('');

  /* Derive chapter list for selected subject */
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

  /* When subject changes, reset chapter */
  function handleSubjectChange(val: string) {
    setSubject(val);
    setChapter('');
  }

  const finalQ     = customQ     !== '' ? Number(customQ)     : Number(qPreset);
  const finalTimer = customTimer !== '' ? Number(customTimer) : Number(timerPreset);
  const isValid    = subject !== '' && finalQ > 0 && finalTimer > 0;

  function handleStart() {
    setTestConfig({
      mode:      'rapid',
      exam:      examType.toUpperCase() as TestExam,
      subject,
      chapter:   chapter,
      questions: finalQ,
      time:      finalTimer,
    });
    router.push('/attempt');
  }

  return (
    <div className="mt-3 rounded-lg border border-[#8762F7]/20 bg-[#8762F7]/[0.04] p-4">

      {/* ── Header ── */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap size={13} className="text-[#8762F7]/70" />
          <p className="text-xs font-semibold text-white/80">Rapid Drill</p>
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

        {/* Question count */}
        <div>
          <FieldLabel>Questions</FieldLabel>
          <div className="flex items-center gap-1.5">
            {Q_PRESETS.map(n => (
              <button
                key={n}
                onClick={() => { setQPreset(n); setCustomQ(''); }}
                className={pillCls(qPreset === n && customQ === '')}
              >
                {n}
              </button>
            ))}
            <input
              type="number"
              min={1}
              max={MAX_QUESTIONS}
              placeholder="Custom"
              value={customQ}
              onChange={e => {
                const v = e.target.value;
                const clamped = v === '' ? '' : String(Math.min(Number(v), MAX_QUESTIONS));
                setCustomQ(clamped); setQPreset('');
              }}
              className={INPUT_CLS + ' w-[72px]'}
            />
          </div>
        </div>

        {/* Timer */}
        <div>
          <FieldLabel>Timer</FieldLabel>
          <div className="flex items-center gap-1.5">
            {TMR_PRESETS.map(m => (
              <button
                key={m}
                onClick={() => { setTimerPreset(m); setCustomTimer(''); }}
                className={pillCls(timerPreset === m && customTimer === '')}
              >
                {m} min
              </button>
            ))}
            <div className="relative">
              <input
                type="number"
                min={1}
                max={MAX_DURATION}
                placeholder="min"
                value={customTimer}
                onChange={e => {
                  const v = e.target.value;
                  const clamped = v === '' ? '' : String(Math.min(Number(v), MAX_DURATION));
                  setCustomTimer(clamped); setTimerPreset('');
                }}
                className={INPUT_CLS + ' w-[72px] pr-7'}
              />
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-white/25">
                min
              </span>
            </div>
          </div>
        </div>

        {/* Start */}
        <button
          onClick={handleStart}
          disabled={!isValid}
          className="mt-0.5 w-full cursor-pointer rounded border border-[#8762F7]/30 bg-[#8762F7]/12 py-2 text-xs font-semibold text-[#8762F7] transition-colors hover:bg-[#8762F7]/22 disabled:cursor-not-allowed disabled:opacity-30"
        >
          Start Drill
        </button>

      </div>
    </div>
  );
}
