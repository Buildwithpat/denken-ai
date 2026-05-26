'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Check } from 'lucide-react';
import type { ExamType } from '@/context/OnboardingContext';
import { useOnboarding } from '@/context/OnboardingContext';
import { chapters as CHAPTERS } from '@/data/chapters';
import TestLoader from '@/components/TestLoader';
import JeeVariantToggle from '@/components/JeeVariantToggle';
import { useTestConfig, type BackendQuestion } from '@/context/TestContext';
import { api, ApiError } from '@/lib/api';
import { parseGateEvent, type GateEvent } from '@/lib/gateError';
import UpgradeModal from '@/components/upgrade/UpgradeModal';

/* ─── Props ─────────────────────────────────────────────────────────────── */

interface Props {
  subject:  string;
  examType: ExamType | null;
  subjects: string[];
  onClose:  () => void;
}

/* ─── Static data ────────────────────────────────────────────────────────── */

const Q_PRESETS = [10, 20, 30] as const;
const T_PRESETS = [15, 30, 60] as const;

const MAX_QUESTIONS = 90;
const MAX_DURATION  = 180;

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

function getQTypeOptions(examType: ExamType | null): string[] {
  switch (examType) {
    case 'jee':    return ['MCQs', 'Numerical', 'Mixed'];
    case 'neet':   return ['MCQs'];
    case 'cbse':   return ['MCQs', 'Theoretical', 'Mixed'];
    case 'custom': return ['Theoretical'];
    default:       return ['MCQs', 'Numerical', 'Mixed'];
  }
}

function chapterKey(subj: string, ch: string): string {
  return `${subj}::${ch}`;
}

function getExamChapters(examType: ExamType | null): Record<string, Record<string, string[]>> | null {
  if (examType === 'jee')  return CHAPTERS.JEE  as Record<string, Record<string, string[]>>;
  if (examType === 'neet') return CHAPTERS.NEET as Record<string, Record<string, string[]>>;
  return null;
}

function getCbseChapters(subject: string): string[] {
  const jee  = (CHAPTERS.JEE  as Record<string, Record<string, string[]>>)[subject];
  if (jee)  return [...(jee['11'] ?? []), ...(jee['12'] ?? [])];
  const neet = (CHAPTERS.NEET as Record<string, Record<string, string[]>>)[subject];
  if (neet) return [...(neet['11'] ?? []), ...(neet['12'] ?? [])];
  return ['Chapter 1', 'Chapter 2', 'Chapter 3', 'Chapter 4', 'Chapter 5'];
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-white/25">
      {children}
    </p>
  );
}

function Chip({
  label, active, disabled = false, onClick,
}: {
  label: string; active: boolean; disabled?: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors duration-100',
        disabled
          ? 'cursor-not-allowed border-white/[0.05] text-white/20'
          : active
            ? 'cursor-pointer border-[#8762F7]/40 bg-[#8762F7]/20 text-white'
            : 'cursor-pointer border-white/[0.08] bg-white/[0.03] text-white/45 hover:border-white/20 hover:text-white/75',
      ].join(' ')}
    >
      {label}
      {disabled && <span className="ml-1.5 text-[9px] text-white/20">soon</span>}
    </button>
  );
}

function CustomInput({
  value, onChange, active, suffix, max,
}: {
  value: string; onChange: (v: string) => void; active: boolean; suffix?: string; max: number;
}) {
  function handleChange(raw: string) {
    if (raw === '') { onChange(''); return; }
    const n = Number(raw);
    onChange(isNaN(n) ? raw : String(Math.min(n, max)));
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        min={1}
        max={max}
        placeholder="Custom"
        value={value}
        onChange={e => handleChange(e.target.value)}
        className={[
          'w-[72px] rounded-lg border bg-white/[0.04] px-2.5 py-1.5 text-xs text-white outline-none transition-colors placeholder-white/20',
          active ? 'border-[#8762F7]/40' : 'border-white/10 focus:border-[#8762F7]/30',
        ].join(' ')}
      />
      {suffix && <span className="text-xs text-white/30">{suffix}</span>}
    </div>
  );
}

function CheckRow({
  label, checked, onToggle,
}: {
  label: string; checked: boolean; onToggle: () => void;
}) {
  return (
    <label
      onClick={onToggle}
      className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-white/[0.04]"
    >
      <div className={[
        'flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-[3px] border transition-colors duration-100',
        checked ? 'border-[#8762F7] bg-[#8762F7]' : 'border-white/20 bg-transparent',
      ].join(' ')}>
        {checked && <Check size={9} className="text-white" strokeWidth={3} />}
      </div>
      <span className={[
        'text-xs transition-colors duration-100',
        checked ? 'text-white/90' : 'text-white/55',
      ].join(' ')}>
        {label}
      </span>
    </label>
  );
}

/* ─── Chapter Modal ──────────────────────────────────────────────────────── */

function ChapterModal({
  examType,
  selSubjects,
  selectedChapters,
  activeSubject,
  activeClass,
  onToggleChapter,
  onSetSubject,
  onSetClass,
  onClose,
}: {
  examType:         ExamType | null;
  selSubjects:      string[];
  selectedChapters: string[];
  activeSubject:    string;
  activeClass:      '11' | '12' | 'all';
  onToggleChapter:  (key: string) => void;
  onSetSubject:     (s: string) => void;
  onSetClass:       (c: '11' | '12' | 'all') => void;
  onClose:          () => void;
}) {
  const examChapters = getExamChapters(examType);
  if (!examChapters) return null;

  const subjectData  = examChapters[activeSubject] ?? {};
  const totalCount   = selectedChapters.length;

  const classOptions: { value: '11' | '12' | 'all'; label: string }[] = [
    { value: '11',  label: 'Class 11' },
    { value: '12',  label: 'Class 12' },
    { value: 'all', label: 'Both'     },
  ];

  function renderGroup(cls: '11' | '12') {
    const list = subjectData[cls] ?? [];
    if (list.length === 0) return null;
    return (
      <div>
        {activeClass === 'all' && (
          <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-white/25">
            Class {cls}
          </p>
        )}
        {list.map(ch => {
          const key = chapterKey(activeSubject, ch);
          return (
            <CheckRow
              key={key}
              label={ch}
              checked={selectedChapters.includes(key)}
              onToggle={() => onToggleChapter(key)}
            />
          );
        })}
      </div>
    );
  }

  return (
    /* Overlay */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Modal */}
      <div
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0D1017]"
        style={{ maxHeight: '80vh' }}
        onClick={e => e.stopPropagation()}
      >

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <h3 className="text-sm font-semibold text-white">Select Chapters</h3>
          <button
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1.5 text-white/30 transition-colors hover:bg-white/[0.05] hover:text-white/65"
          >
            <X size={15} />
          </button>
        </div>

        {/* Subject tabs (only when 2+ subjects) */}
        {selSubjects.length > 1 && (
          <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/[0.06] px-5 py-2.5 [&::-webkit-scrollbar]:hidden">
            {selSubjects.map(s => (
              <button
                key={s}
                onClick={() => onSetSubject(s)}
                className={[
                  'shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-100',
                  activeSubject === s
                    ? 'bg-[#8762F7]/20 text-white'
                    : 'text-white/40 hover:text-white/75',
                ].join(' ')}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Class filter */}
        <div className="flex shrink-0 gap-1 border-b border-white/[0.06] px-5 py-2.5">
          {classOptions.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => onSetClass(value)}
              className={[
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-100 cursor-pointer',
                activeClass === value
                  ? 'bg-[#8762F7]/20 text-white'
                  : 'text-white/40 hover:text-white/75',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Chapter list */}
        <div className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
          {(activeClass === '11' || activeClass === 'all') && renderGroup('11')}
          {activeClass === 'all' && <div className="h-3" />}
          {(activeClass === '12' || activeClass === 'all') && renderGroup('12')}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between border-t border-white/[0.06] px-5 py-3">
          <span className="text-xs text-white/35">
            {totalCount > 0 ? `${totalCount} chapter${totalCount !== 1 ? 's' : ''} selected` : 'None selected'}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => {
                selSubjects.forEach(s => {
                  const data = examChapters[s] ?? {};
                  ['11', '12'].forEach(cls => {
                    (data[cls] ?? []).forEach(ch => {
                      const key = chapterKey(s, ch);
                      if (selectedChapters.includes(key)) onToggleChapter(key);
                    });
                  });
                });
              }}
              className="cursor-pointer rounded-lg px-3 py-1.5 text-xs text-white/35 transition-colors hover:text-white/65"
            >
              Clear all
            </button>
            <button
              onClick={onClose}
              className="cursor-pointer rounded-lg bg-[#8762F7]/20 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#8762F7]/30"
            >
              Done
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

/* ─── CBSE Chapter Modal (flat list, no class filter) ───────────────────── */

function CbseChapterModal({
  selSubjects,
  selectedChapters,
  activeSubject,
  onToggleChapter,
  onSetSubject,
  onClose,
}: {
  selSubjects:      string[];
  selectedChapters: string[];
  activeSubject:    string;
  onToggleChapter:  (key: string) => void;
  onSetSubject:     (s: string) => void;
  onClose:          () => void;
}) {
  const chapList   = getCbseChapters(activeSubject);
  const totalCount = selectedChapters.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0D1017]"
        style={{ maxHeight: '80vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <h3 className="text-sm font-semibold text-white">Select Chapters</h3>
          <button
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1.5 text-white/30 transition-colors hover:bg-white/[0.05] hover:text-white/65"
          >
            <X size={15} />
          </button>
        </div>

        {/* Subject tabs (only when 2+ subjects) */}
        {selSubjects.length > 1 && (
          <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/[0.06] px-5 py-2.5 [&::-webkit-scrollbar]:hidden">
            {selSubjects.map(s => (
              <button
                key={s}
                onClick={() => onSetSubject(s)}
                className={[
                  'shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-100',
                  activeSubject === s
                    ? 'bg-[#8762F7]/20 text-white'
                    : 'text-white/40 hover:text-white/75',
                ].join(' ')}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Flat chapter list — no class filter */}
        <div className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
          {chapList.map(ch => {
            const key = chapterKey(activeSubject, ch);
            return (
              <CheckRow
                key={key}
                label={ch}
                checked={selectedChapters.includes(key)}
                onToggle={() => onToggleChapter(key)}
              />
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between border-t border-white/[0.06] px-5 py-3">
          <span className="text-xs text-white/35">
            {totalCount > 0
              ? `${totalCount} chapter${totalCount !== 1 ? 's' : ''} selected`
              : 'None selected'}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => {
                selSubjects.forEach(s =>
                  getCbseChapters(s).forEach(ch => {
                    const key = chapterKey(s, ch);
                    if (selectedChapters.includes(key)) onToggleChapter(key);
                  }),
                );
              }}
              className="cursor-pointer rounded-lg px-3 py-1.5 text-xs text-white/35 transition-colors hover:text-white/65"
            >
              Clear all
            </button>
            <button
              onClick={onClose}
              className="cursor-pointer rounded-lg bg-[#8762F7]/20 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#8762F7]/30"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function toExamKey(examType: ExamType | null, jeeVariant: string): string {
  switch (examType) {
    case 'jee':  return jeeVariant; // 'JEE_MAIN' | 'JEE_ADVANCED' from global context
    case 'neet': return 'NEET';
    case 'cbse': return 'CBSE';
    default:     return 'JEE_MAIN';
  }
}

/* ─── Main component ─────────────────────────────────────────────────────── */

export default function TestConfigCard({ subject, examType, subjects, onClose }: Props) {
  const router      = useRouter();
  const subjectList = getSubjectList(examType, subjects);
  const qTypeOpts   = getQTypeOptions(examType);
  const { setTestId, setBackendQuestions } = useTestConfig();
  const { data: onboardingData } = useOnboarding();

  /* State */
  const [selSubjects,      setSelSubjects]      = useState<string[]>([subject]);
  const [questionType,     setQType]            = useState(qTypeOpts[0]);
  const [qPreset,          setQPreset]          = useState<number | null>(20);
  const [qCustom,          setQCustom]          = useState('');
  const [tPreset,          setTPreset]          = useState<number | null>(30);
  const [tCustom,          setTCustom]          = useState('');
  const [chapterScope,     setChapterScope]     = useState('all');
  /* Chapter modal state */
  const [selectedChapters, setSelectedChapters] = useState<string[]>([]);
  const [modalOpen,        setModalOpen]        = useState(false);
  const [activeSubject,    setActiveSubject]    = useState(subject);
  const [selectedClass,    setSelectedClass]    = useState<'11' | '12' | 'all'>('all');
  const [loading,          setLoading]          = useState(false);
  const [apiError,         setApiError]         = useState<string | null>(null);
  const [gateEvent,        setGateEvent]        = useState<GateEvent | null>(null);

  const startUrl = `/attempt?exam=${examType ?? 'jee'}&subject=${encodeURIComponent(selSubjects[0] ?? subject)}`;

  async function handleStartTest() {
    setApiError(null);
    setGateEvent(null);
    setLoading(true);

    if (examType === 'custom') {
      router.push(startUrl);
      return;
    }

    const subjects_  = selSubjects.length > 0 ? selSubjects : [subject];
    const chapters_  = selectedChapters.length > 0
      ? selectedChapters.map(k => k.split('::').pop() ?? k)
      : undefined;

    // Map UI label → backend enum
    const questionTypeModeMap: Record<string, 'mcq' | 'numerical' | 'mixed'> = {
      'MCQs':        'mcq',
      'Numerical':   'numerical',
      'Mixed':       'mixed',
      'Theoretical': 'mcq',
    };
    const questionTypeMode = questionTypeModeMap[questionType] ?? 'mcq';

    try {
      const data = await api.post<{ testId: string; questions: BackendQuestion[] }>(
        '/test/generate',
        {
          exam:             toExamKey(examType, onboardingData.jeeVariant),
          subjects:         subjects_,
          questionCount:    questionCount ?? 20,
          questionTypeMode,
          ...(chapters_ && { chapters: chapters_ }),
          ...(examType === 'cbse' && { cbseClass: 'both' }),
        },
        { auth: true },
      );
      setTestId(data.testId);
      setBackendQuestions(data.questions);
      router.push(startUrl);
    } catch (err) {
      setLoading(false);
      const gate = parseGateEvent(err);
      if (gate) {
        setGateEvent(gate);
      } else {
        setApiError(err instanceof ApiError ? err.message : 'Failed to generate test. Please try again.');
      }
    }
  }

  /* Derived */
  const supportsChapters = examType === 'jee' || examType === 'neet';
  const questionCount    = qPreset !== null ? qPreset : (qCustom  ? Number(qCustom)  : null);
  const timeMinutes      = tPreset !== null ? tPreset : (tCustom  ? Number(tCustom)  : null);

  function toggleSubject(s: string) {
    setSelSubjects(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s],
    );
  }

  function toggleChapter(key: string) {
    setSelectedChapters(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key],
    );
  }

  function openModal() {
    setActiveSubject(selSubjects[0] ?? subject);
    setModalOpen(true);
  }

  const CHAPTER_OPTS = [
    { value: 'only11',   label: 'Only 11th',      disabled: false                  },
    { value: 'only12',   label: 'Only 12th',       disabled: false                  },
    { value: 'all',      label: 'All chapters',    disabled: false                  },
    { value: 'specific', label: selectedChapters.length > 0
        ? `${selectedChapters.length} chapters`
        : 'Select specific',
      disabled: !supportsChapters,
    },
  ] as const;

  const chapterSummary = examType === 'cbse'
    ? (selectedChapters.length > 0 ? `${selectedChapters.length} chapters` : 'All chapters')
    : chapterScope === 'specific' && selectedChapters.length > 0
      ? `${selectedChapters.length} chapters`
      : CHAPTER_OPTS.find(o => o.value === chapterScope)?.label ?? '—';

  const summaryRows = [
    { label: 'Subjects',      value: selSubjects.join(', ') || '—' },
    { label: 'Question type', value: questionType                  },
    { label: 'Questions',     value: questionCount ? `${questionCount} questions` : '—' },
    { label: 'Duration',      value: timeMinutes   ? `${timeMinutes} min`          : '—' },
    { label: 'Chapters',      value: chapterSummary },
  ];

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5 backdrop-blur-md">

        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Configure Test</h2>
            <p className="mt-0.5 text-xs text-white/35">{subject}</p>
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1.5 text-white/30 transition-colors hover:bg-white/[0.05] hover:text-white/65"
          >
            <X size={15} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px]">

          {/* Left: Configuration */}
          <div className="space-y-6 px-6 py-5">

            {/* Exam variant — JEE only */}
            {examType === 'jee' && (
              <section>
                <JeeVariantToggle label="Exam Type" />
              </section>
            )}

            {/* Subjects */}
            <section>
              <SectionLabel>Subjects</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {subjectList.map(s => (
                  <Chip
                    key={s}
                    label={s}
                    active={selSubjects.includes(s)}
                    onClick={() => toggleSubject(s)}
                  />
                ))}
              </div>
            </section>

            {/* Question type */}
            <section>
              <SectionLabel>Question Type</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {qTypeOpts.map(opt => (
                  <Chip
                    key={opt}
                    label={opt}
                    active={questionType === opt}
                    onClick={() => setQType(opt)}
                  />
                ))}
              </div>
            </section>

            {/* Question count */}
            <section>
              <SectionLabel>Number of Questions</SectionLabel>
              <div className="flex flex-wrap items-center gap-2">
                {Q_PRESETS.map(n => (
                  <Chip
                    key={n}
                    label={String(n)}
                    active={qPreset === n}
                    onClick={() => { setQPreset(n); setQCustom(''); }}
                  />
                ))}
                <CustomInput
                  value={qCustom}
                  active={qPreset === null && qCustom !== ''}
                  max={MAX_QUESTIONS}
                  onChange={v => { setQCustom(v); setQPreset(null); }}
                />
              </div>
            </section>

            {/* Duration */}
            <section>
              <SectionLabel>Duration</SectionLabel>
              <div className="flex flex-wrap items-center gap-2">
                {T_PRESETS.map(t => (
                  <Chip
                    key={t}
                    label={`${t} min`}
                    active={tPreset === t}
                    onClick={() => { setTPreset(t); setTCustom(''); }}
                  />
                ))}
                <CustomInput
                  value={tCustom}
                  active={tPreset === null && tCustom !== ''}
                  suffix="min"
                  max={MAX_DURATION}
                  onChange={v => { setTCustom(v); setTPreset(null); }}
                />
              </div>
            </section>

            {/* Chapters */}
            <section>
              <SectionLabel>Chapters</SectionLabel>
              {examType === 'cbse' ? (
                <Chip
                  label={selectedChapters.length > 0
                    ? `${selectedChapters.length} chapter${selectedChapters.length !== 1 ? 's' : ''} selected`
                    : 'Select Chapters'}
                  active={selectedChapters.length > 0}
                  onClick={openModal}
                />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {CHAPTER_OPTS.map(({ value, label, disabled }) => (
                    <Chip
                      key={value}
                      label={label}
                      active={chapterScope === value}
                      disabled={disabled}
                      onClick={() => {
                        setChapterScope(value);
                        if (value === 'specific') openModal();
                      }}
                    />
                  ))}
                </div>
              )}
            </section>

          </div>

          {/* Right: Summary + CTA */}
          <div className="flex flex-col border-t border-white/[0.06] px-6 py-5 lg:border-l lg:border-t-0">
            <SectionLabel>Summary</SectionLabel>

            <ul className="space-y-3">
              {summaryRows.map(({ label, value }) => (
                <li key={label} className="flex items-start justify-between gap-3">
                  <span className="shrink-0 text-xs text-white/35">{label}</span>
                  <span className="text-right text-xs font-medium text-white/80">{value}</span>
                </li>
              ))}
            </ul>

            <div className="mt-auto pt-6">
              {loading && <TestLoader onDone={() => {}} />}
              {apiError && (
                <p className="mb-3 rounded-lg border border-red-500/20 bg-red-500/[0.08] px-3 py-2 text-[11px] text-red-400">
                  {apiError}
                </p>
              )}
              <button
                onClick={handleStartTest}
                disabled={loading}
                className="w-full cursor-pointer rounded-lg bg-gradient-to-r from-[#8762F7] to-[#6D4AFF] py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:opacity-90 hover:shadow-[0_4px_20px_rgba(135,98,247,0.3)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Start Test
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Gate error modal */}
      {gateEvent && (
        <UpgradeModal gate={gateEvent} onClose={() => setGateEvent(null)} />
      )}

      {/* Chapter modal (rendered outside card to avoid overflow clipping) */}
      {modalOpen && (
        examType === 'cbse' ? (
          <CbseChapterModal
            selSubjects={selSubjects.length > 0 ? selSubjects : [subject]}
            selectedChapters={selectedChapters}
            activeSubject={activeSubject}
            onToggleChapter={toggleChapter}
            onSetSubject={setActiveSubject}
            onClose={() => setModalOpen(false)}
          />
        ) : supportsChapters ? (
          <ChapterModal
            examType={examType}
            selSubjects={selSubjects.length > 0 ? selSubjects : [subject]}
            selectedChapters={selectedChapters}
            activeSubject={activeSubject}
            activeClass={selectedClass}
            onToggleChapter={toggleChapter}
            onSetSubject={setActiveSubject}
            onSetClass={setSelectedClass}
            onClose={() => setModalOpen(false)}
          />
        ) : null
      )}
    </>
  );
}
