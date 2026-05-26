'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, RotateCcw } from 'lucide-react';
import { useTestConfig, type TestExam } from '@/context/TestContext';

/* ─── Types ──────────────────────────────────────────────────────────────── */

type ExamKey      = 'jee' | 'neet' | 'cbse' | 'custom';
type MistakeScope = 'recent' | 'all';
interface WeakEntry { subject: string; chapter: string; score: number }

interface Props {
  examType:    ExamKey;
  weakEntries: WeakEntry[];
  onClose:     () => void;
}

/* ─── Constants ──────────────────────────────────────────────────────────── */

const Q_PRESETS = ['10', '20'];
const MAX_QUESTIONS = 90;

/* ─── Shared styles ──────────────────────────────────────────────────────── */

function pillCls(active: boolean) {
  return [
    'cursor-pointer rounded border px-3 py-1.5 text-xs font-medium transition-colors',
    active
      ? 'border-[#8762F7]/40 bg-[#8762F7]/15 text-[#8762F7]'
      : 'border-white/[0.08] bg-white/[0.02] text-white/45 hover:border-white/[0.15] hover:text-white/70',
  ].join(' ');
}

function scoreColor(score: number) {
  if (score < 50) return 'text-[#ef4444]';
  if (score < 65) return 'text-[#f59e0b]';
  return 'text-[#22c55e]';
}

function dotColor(score: number) {
  if (score < 50) return 'bg-[#ef4444]';
  if (score < 65) return 'bg-[#f59e0b]';
  return 'bg-[#22c55e]';
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/25">
      {children}
    </p>
  );
}

/* ─── Component ──────────────────────────────────────────────────────────── */

export default function MistakeRevisionPanel({ examType, weakEntries, onClose }: Props) {
  const { setTestConfig } = useTestConfig();
  const router = useRouter();

  const [scope,   setScope]   = useState<MistakeScope>('recent');
  const [qPreset, setQPreset] = useState('10');
  const [customQ, setCustomQ] = useState('');

  /* Sort by score ascending — worst first */
  const sorted = [...weakEntries].sort((a, b) => a.score - b.score);
  const topics = scope === 'recent' ? sorted.slice(0, 3) : sorted;

  const finalQ  = customQ !== '' ? Number(customQ) : Number(qPreset);
  const isValid = topics.length > 0 && finalQ > 0;

  function handleStart() {
    const primarySubject = topics[0]?.subject ?? '';
    setTestConfig({
      mode:      'mistake',
      exam:      examType.toUpperCase() as TestExam,
      subject:   primarySubject,
      chapter:   '',
      questions: finalQ,
      time:      finalQ * 2,
    });
    router.push('/attempt');
  }

  return (
    /* Stronger border + background to visually distinguish this mode */
    <div className="mt-3 rounded-lg border border-[#8762F7]/30 bg-[#8762F7]/[0.06] p-4">

      {/* ── Header ── */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RotateCcw size={13} className="text-[#8762F7]" />
          <p className="text-xs font-semibold text-white/90">Mistake Revision</p>
        </div>
        <button
          onClick={onClose}
          className="cursor-pointer rounded p-1 text-white/30 transition-colors hover:bg-white/[0.05] hover:text-white/60"
        >
          <X size={13} />
        </button>
      </div>

      {/* ── Form ── */}
      <div className="space-y-3.5">

        {/* Scope filter */}
        <div>
          <FieldLabel>Scope</FieldLabel>
          <div className="flex gap-1.5">
            <button onClick={() => setScope('recent')} className={pillCls(scope === 'recent')}>
              Recent Mistakes
            </button>
            <button onClick={() => setScope('all')}    className={pillCls(scope === 'all')}>
              All Mistakes
            </button>
          </div>
        </div>

        {/* Topic list */}
        <div>
          <FieldLabel>Topics · {topics.length}</FieldLabel>
          {topics.length > 0 ? (
            <div className="space-y-1">
              {topics.map(({ chapter, subject, score }) => (
                <div
                  key={chapter}
                  className="flex items-center justify-between rounded border border-white/[0.07] bg-white/[0.02] px-3 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotColor(score)}`} />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-white/75">{chapter}</p>
                      <p className="text-[10px] text-white/30">{subject}</p>
                    </div>
                  </div>
                  <span className={`ml-3 shrink-0 text-xs font-semibold tabular-nums ${scoreColor(score)}`}>
                    {score}%
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-3 text-center text-xs text-white/25">No mistakes found</p>
          )}
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
              className="w-[72px] rounded border border-white/[0.08] bg-[#0f1117] px-2 py-1.5 text-center text-xs text-white/65 tabular-nums placeholder:text-white/20 focus:border-[#8762F7]/40 focus:outline-none"
            />
          </div>
        </div>

        {/* Start — stronger CTA to match the panel's visual weight */}
        <button
          onClick={handleStart}
          disabled={!isValid}
          className="mt-0.5 w-full cursor-pointer rounded border border-[#8762F7]/40 bg-[#8762F7]/18 py-2 text-xs font-semibold text-[#8762F7] transition-colors hover:bg-[#8762F7]/28 disabled:cursor-not-allowed disabled:opacity-30"
        >
          Start Revision
        </button>

      </div>
    </div>
  );
}
