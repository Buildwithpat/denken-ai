'use client';

import { useState, useEffect } from 'react';
import { useRouter }           from 'next/navigation';
import { X, FlaskConical }     from 'lucide-react';
import { useTestConfig, type TestExam } from '@/context/TestContext';
import { fetchFormulaChapters, subjectToSlug } from '@/lib/formulaApi';
import type { ChapterSummary } from '@/types/formula';

type ExamKey   = 'jee' | 'neet' | 'cbse' | 'custom';
type DrillMode = 'practice' | 'flashcard';

interface WeakEntry { subject: string; chapter: string; score: number }

interface Props {
  examType:    ExamKey;
  subjects:    string[];
  weakEntries: WeakEntry[];
  onClose:     () => void;
}

const SELECT_CLS =
  'w-full cursor-pointer appearance-none rounded border border-white/[0.08] bg-[#0f1117] px-3 py-2 text-xs text-white/65 focus:border-[#8762F7]/40 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40';

function pillCls(active: boolean) {
  return [
    'cursor-pointer rounded border px-3 py-1.5 text-xs font-medium transition-colors',
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

export default function FormulaPracticePanel({ examType, subjects, weakEntries, onClose }: Props) {
  const { setTestConfig } = useTestConfig();
  const router = useRouter();

  const [subject,  setSubject]  = useState(subjects[0] ?? '');
  const [chapters, setChapters] = useState<ChapterSummary[]>([]);
  const [chapSlug, setChapSlug] = useState('');
  const [chapName, setChapName] = useState('');
  const [chapLoading, setChapLoading] = useState(false);
  const [mode,     setMode]     = useState<DrillMode>('practice');

  // Fetch formula chapters whenever subject changes
  useEffect(() => {
    if (!subject) { setChapters([]); setChapSlug(''); setChapName(''); return; }
    setChapLoading(true);
    const slug = subjectToSlug(subject);
    const exam = examType === 'jee' ? 'jee' : examType === 'neet' ? 'neet' : undefined;
    fetchFormulaChapters(slug, exam)
      .then(chs => { setChapters(chs); setChapSlug(''); setChapName(''); })
      .catch(() => setChapters([]))
      .finally(() => setChapLoading(false));
  }, [subject, examType]);

  function handleSubjectChange(val: string) {
    setSubject(val);
  }

  function handleChapterChange(val: string) {
    setChapSlug(val);
    const found = chapters.find(c => c.slug === val);
    setChapName(found?.chapterName ?? '');
  }

  function handleStart() {
    const subSlug = subjectToSlug(subject);
    setTestConfig({
      mode:      'normal',
      exam:      examType.toUpperCase() as TestExam,
      subject,
      chapter:   chapName,
      questions: 20,
      time:      15,
    });
    const params = new URLSearchParams({ sub: subSlug });
    if (chapSlug) params.set('ch', chapSlug);
    router.push(`/revision/formula?${params}`);
  }

  return (
    <div className="mt-3 rounded-lg border border-[#8762F7]/20 bg-[#8762F7]/[0.04] p-4">

      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FlaskConical size={13} className="text-[#8762F7]/70" />
          <p className="text-xs font-semibold text-white/80">Formula Practice</p>
        </div>
        <button
          onClick={onClose}
          className="cursor-pointer rounded p-1 text-white/25 transition-colors hover:bg-white/[0.05] hover:text-white/60"
        >
          <X size={13} />
        </button>
      </div>

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
              value={chapSlug}
              onChange={e => handleChapterChange(e.target.value)}
              disabled={chapLoading || chapters.length === 0}
              className={SELECT_CLS}
            >
              <option value="">
                {chapLoading
                  ? 'Loading…'
                  : chapters.length === 0
                  ? 'No chapters available'
                  : 'Select chapter'}
              </option>
              {chapters.map(c => (
                <option key={c.slug} value={c.slug}>
                  {c.chapterName} ({c.formulaCount})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Mode toggle */}
        <div>
          <FieldLabel>Mode</FieldLabel>
          <div className="flex gap-1.5">
            <button onClick={() => setMode('practice')}  className={pillCls(mode === 'practice')}>
              Practice Mode
            </button>
            <button onClick={() => setMode('flashcard')} className={pillCls(mode === 'flashcard')}>
              Flashcard Mode
            </button>
          </div>
        </div>

        {/* Start */}
        <button
          onClick={handleStart}
          disabled={!subject}
          className="mt-0.5 w-full cursor-pointer rounded border border-[#8762F7]/30 bg-[#8762F7]/12 py-2 text-xs font-semibold text-[#8762F7] transition-colors hover:bg-[#8762F7]/22 disabled:cursor-not-allowed disabled:opacity-30"
        >
          {chapSlug ? 'Start Practice' : 'Browse All Formulas'}
        </button>

      </div>
    </div>
  );
}
