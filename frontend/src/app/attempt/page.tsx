'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Bookmark } from 'lucide-react';
import { ArrowLeft } from 'lucide-react';
import QuestionPanel   from '@/components/attempt/QuestionPanel';
import QuestionPalette from '@/components/attempt/QuestionPalette';
import SubmitModal     from '@/components/attempt/SubmitModal';
import type { QStatus } from '@/components/attempt/QuestionPalette';
import { useTestConfig, type TestResult, type BackendResult } from '@/context/TestContext';
import { api } from '@/lib/api';

/* ─── Question builders (mock fallback) ──────────────────────────────────── */

function buildObjectiveQuestions() {
  return Array.from({ length: 30 }, (_, i) => {
    const isNumerical = i % 5 === 4;
    return {
      id:      i + 1,
      subject: i < 10 ? 'Physics' : i < 20 ? 'Chemistry' : 'Mathematics',
      type:    isNumerical ? 'numerical' as const : 'mcq' as const,
      text:    isNumerical
        ? `Question ${i + 1}: Find the numerical value of the given expression. Enter your answer correct to two decimal places.`
        : `This is question ${i + 1}. Consider the following scenario and select the most appropriate option from the choices given below.`,
      options: isNumerical ? [] : [
        'First option — a plausible but incorrect statement about the phenomenon',
        'Second option — another plausible but incorrect interpretation',
        'Third option — the correct answer with proper justification',
        'Fourth option — a common misconception students often select',
      ],
    };
  });
}

function buildSubjectiveQuestions(subject: string) {
  return Array.from({ length: 10 }, (_, i) => ({
    id:      i + 1,
    subject,
    type:    'subjective' as const,
    text:    `Question ${i + 1}: ${i % 3 === 0
      ? 'Explain the concept in detail with appropriate examples and diagrams where necessary.'
      : i % 3 === 1
        ? 'Derive the expression and state all the assumptions made during the derivation.'
        : 'Write a detailed note on the given topic covering all important aspects.'}`,
    options: [],
  }));
}

function buildRapidDrillQuestions(subject: string, chapter: string, count: number) {
  const ctx = chapter || subject;
  return Array.from({ length: count }, (_, i) => {
    const isNumerical = i % 5 === 4;
    return {
      id:      i + 1,
      subject,
      type:    isNumerical ? 'numerical' as const : 'mcq' as const,
      text:    isNumerical
        ? `Question ${i + 1} [${ctx}]: Find the numerical value of the expression. Enter your answer correct to two decimal places.`
        : `Question ${i + 1} [${ctx}]: Consider the following and select the most appropriate option.`,
      options: isNumerical ? [] : [
        'First option — a plausible but incorrect statement',
        'Second option — another plausible interpretation',
        'Third option — the correct answer with justification',
        'Fourth option — a common misconception',
      ],
    };
  });
}

function buildPYQQuestions(subject: string, chapter: string, year: string, count: number) {
  const ctx = chapter || subject;
  return Array.from({ length: count }, (_, i) => ({
    id:      i + 1,
    subject,
    type:    'mcq' as const,
    text:    `[PYQ ${year}] Q${i + 1} [${ctx}]: Select the correct option from the choices below.`,
    options: [
      'Option A — first choice with explanation',
      'Option B — second choice with explanation',
      'Option C — correct answer with justification',
      'Option D — a common distractor',
    ],
  }));
}

function buildMistakeQuestions(subject: string, count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id:      i + 1,
    subject,
    type:    'mcq' as const,
    text:    `Revision Q${i + 1} [${subject}]: Based on your past mistakes, select the correct answer.`,
    options: [
      'Option A — a common incorrect approach',
      'Option B — another incorrect interpretation',
      'Option C — the correct answer',
      'Option D — a misconception you previously selected',
    ],
  }));
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function AttemptPage() {
  const searchParams = useSearchParams();
  const {
    testConfig, setTestResult,
    testId, backendQuestions, setBackendResult,
  } = useTestConfig();
  const router = useRouter();

  /* testConfig takes priority when an active mode has been set */
  const hasConfig    = testConfig.mode !== 'normal' || testConfig.subject !== '';
  const examTypeRaw  = hasConfig
    ? testConfig.exam.toLowerCase()
    : (searchParams.get('exam') ?? 'jee');
  const subjectParam = hasConfig
    ? testConfig.subject
    : (searchParams.get('subject') ?? 'Physics');

  const isSubjective = examTypeRaw === 'cbse' || examTypeRaw === 'custom';

  /* Build mock questions (used when no backend questions available) */
  const mockQuestions = (() => {
    if (isSubjective) return buildSubjectiveQuestions(subjectParam);
    switch (testConfig.mode) {
      case 'rapid':
        return buildRapidDrillQuestions(
          testConfig.subject || subjectParam,
          testConfig.chapter,
          testConfig.questions,
        );
      case 'pyq':
        return buildPYQQuestions(
          testConfig.subject || subjectParam,
          testConfig.chapter,
          testConfig.year ?? '2024',
          testConfig.questions,
        );
      case 'mistake':
        return buildMistakeQuestions(
          testConfig.subject || subjectParam,
          testConfig.questions,
        );
      case 'smart':
        return buildRapidDrillQuestions(
          testConfig.subject.split(',')[0].trim() || subjectParam,
          testConfig.chapter || 'Smart Mix',
          testConfig.questions,
        );
      default:
        return buildObjectiveQuestions();
    }
  })();

  /* Normalise backend questions to the internal AttemptQuestion shape */
  const questions = backendQuestions?.length
    ? backendQuestions.map((q, i) => ({
        id:                 i + 1,
        subject:            q.subject,
        type:               q.type,
        text:               q.question,
        options:            q.options ? [...q.options] : [] as string[],
        diagramDescription: q.diagramDescription,
      }))
    : mockQuestions;

  /* UUID list for submission — null when using mocks */
  const questionUuids: string[] | null = backendQuestions?.length
    ? backendQuestions.map(q => q.id)
    : null;

  const SUBJECTS = ['All', ...Array.from(new Set(questions.map(q => q.subject)))];

  /* Mode label shown in header */
  const modeLabel = (() => {
    if (!hasConfig) return '';
    switch (testConfig.mode) {
      case 'rapid':   return `Rapid Drill · ${testConfig.chapter || testConfig.subject}`;
      case 'pyq':     return `PYQ Mode · ${testConfig.year ?? '2024'}`;
      case 'mistake': return 'Mistake Revision';
      case 'smart': {
        const typeLabel: Record<string, string> = {
          weightage:       'High Weightage',
          weakness:        'Weakness Targeted',
          difficulty:      'Difficulty Based',
          revision:        'Revision Boost',
          'balanced-mock': 'Balanced Mock',
          surprise:        'Surprise Test',
          'high-roi':      'High ROI Focus',
          'crash-course':  'Crash Course',
          'formula-heavy': 'Formula Drill',
        };
        return `Smart Test · ${typeLabel[testConfig.studioType ?? ''] ?? 'Studio'}`;
      }
      default:        return '';
    }
  })();

  /* Timer — config.time is in minutes; fall back to 180 min */
  const initialTime = hasConfig && testConfig.time > 0 ? testConfig.time * 60 : 180 * 60;

  const [current,          setCurrent]          = useState(0);
  const [answers,          setAnswers]          = useState<Record<number, number>>({});
  const [numericalAnswers, setNumericalAnswers] = useState<Record<number, string>>({});
  const [marked,           setMarked]           = useState<Set<number>>(new Set());
  const [visited,          setVisited]          = useState<Set<number>>(new Set([0]));
  const [timeLeft,         setTimeLeft]         = useState(initialTime);
  const [palFilter,        setPalFilter]        = useState('All');
  const [showSubmit,       setShowSubmit]       = useState(false);
  const [savedQuestions,   setSavedQuestions]   = useState<Set<number>>(new Set());
  const [toast,            setToast]            = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Countdown */
  useEffect(() => {
    const id = setInterval(() => setTimeLeft(t => Math.max(0, t - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  /* Helpers */
  function goTo(idx: number) {
    setCurrent(idx);
    setVisited(prev => new Set(prev).add(idx));
  }

  function getStatus(idx: number): QStatus {
    const q         = questions[idx];
    const hasAns    = q.type === 'numerical'
      ? (numericalAnswers[idx] ?? '') !== ''
      : answers[idx] !== undefined;
    const isMarked  = marked.has(idx);
    const isVisited = visited.has(idx);
    if (hasAns && isMarked) return 'answered-marked';
    if (hasAns)             return 'answered';
    if (isMarked)           return 'marked';
    if (isVisited)          return 'not-answered';
    return 'not-visited';
  }

  const q = questions[current];

  function handleSelect(optIdx: number) {
    setAnswers(prev => ({ ...prev, [current]: optIdx }));
  }

  function handleClear() {
    if (q.type === 'numerical') {
      setNumericalAnswers(prev => { const n = { ...prev }; delete n[current]; return n; });
    } else {
      setAnswers(prev => { const n = { ...prev }; delete n[current]; return n; });
    }
  }

  function handleNumericalChange(val: string) {
    setNumericalAnswers(prev => ({ ...prev, [current]: val }));
  }

  function handleToggleMark() {
    setMarked(prev => {
      const n = new Set(prev);
      n.has(current) ? n.delete(current) : n.add(current);
      return n;
    });
  }

  function handleToggleSave() {
    setSavedQuestions(prev => {
      const n = new Set(prev);
      const wasSaved = n.has(current);
      wasSaved ? n.delete(current) : n.add(current);
      showToast(wasSaved ? 'Bookmark removed' : 'Question saved');
      return n;
    });
  }

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2000);
  }

  function handleSaveNext() {
    if (current < questions.length - 1) goTo(current + 1);
  }

  function handlePrev() {
    if (current > 0) goTo(current - 1);
  }

  async function handleConfirmSubmit() {
    if (testId && questionUuids) {
      const timeTaken = initialTime - timeLeft;
      const submittedAnswers = questions.map((sq, idx) => {
        const entry: {
          questionId: string;
          isMarked: boolean;
          selectedOption?: 'A' | 'B' | 'C' | 'D';
          numericalValue?: number;
        } = {
          questionId: questionUuids[idx],
          isMarked:   marked.has(idx),
        };
        if (sq.type === 'mcq' && answers[idx] !== undefined) {
          entry.selectedOption = OPTION_LETTERS[answers[idx]];
        } else if (sq.type === 'numerical' && numericalAnswers[idx] !== undefined) {
          const n = Number(numericalAnswers[idx]);
          if (!isNaN(n)) entry.numericalValue = n;
        }
        return entry;
      });

      try {
        const data = await api.post<{ result: BackendResult }>(
          '/test/submit',
          { testId, timeTaken, answers: submittedAnswers },
          { auth: true },
        );
        setBackendResult(data.result);
      } catch {
        // Navigate to result page with fallback display even on failure
      }
    } else {
      const result: TestResult = {
        exam:    examTypeRaw,
        mode:    testConfig.mode,
        subject: testConfig.subject || subjectParam,
        chapter: testConfig.chapter,
        questions: questions.map(sq => ({
          id:      sq.id,
          subject: sq.subject,
          type:    sq.type as 'mcq' | 'numerical' | 'subjective',
        })),
        answers,
        numericalAnswers,
      };
      setTestResult(result);
    }
    router.push('/test/result');
  }

  /* Timer display — MM:SS */
  const timerMM  = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const timerSS  = String(timeLeft % 60).padStart(2, '0');
  const timerStr = `${timerMM}:${timerSS}`;

  /* Palette questions with live status */
  const paletteQuestions = questions.map((pq, idx) => ({
    id:      pq.id,
    subject: pq.subject,
    status:  getStatus(idx) as QStatus,
  }));

  return (
    <div className="min-h-screen bg-[#0f1117] text-white">

      {/* ── Mobile fallback ───────────────────────────────────────────────────── */}
      <div className="flex min-h-screen flex-col items-center justify-center px-5 md:hidden">
        <div className="w-full max-w-sm rounded border border-white/[0.08] bg-white/[0.03] px-6 py-5">
          <p className="text-sm font-semibold text-white">Use Desktop for Test</p>
          <p className="mt-1.5 text-xs leading-relaxed text-white/40">
            Tests are best experienced on desktop. Please switch to a laptop or computer to attempt this test.
          </p>
        </div>
      </div>

      {/* ── Desktop exam UI ───────────────────────────────────────────────────── */}
      <div className="hidden h-screen flex-col md:flex">

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <header className="grid h-11 shrink-0 grid-cols-3 items-center border-b border-white/[0.08] bg-[#0b0e14] px-4">

          {/* Left: back + mode label */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => router.back()}
              className="flex cursor-pointer items-center gap-1.5 text-white/50 transition-colors hover:text-white"
            >
              <ArrowLeft size={13} />
              <span className="text-xs">Back</span>
            </button>
            {modeLabel && (
              <span className="rounded bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-white/40">
                {modeLabel}
              </span>
            )}
          </div>

          {/* Center: timer */}
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-semibold uppercase tracking-widest text-white/20">
              Time Left
            </span>
            <span className={[
              'font-mono text-sm font-bold tabular-nums leading-none',
              timeLeft < 300 ? 'text-red-400' : 'text-white',
            ].join(' ')}>
              {timerStr}
            </span>
          </div>

          {/* Right: submit */}
          <div className="flex justify-end">
            <button
              onClick={() => setShowSubmit(true)}
              className="cursor-pointer rounded border border-[#16a34a]/30 bg-[#16a34a]/10 px-4 py-1.5 text-xs font-semibold text-[#22c55e] transition-colors hover:bg-[#16a34a]/20"
            >
              Submit
            </button>
          </div>

        </header>

        {/* ── Body ──────────────────────────────────────────────────────────── */}
        <div className="flex min-h-0 flex-1">

          {/* Question panel */}
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <QuestionPanel
              question={q}
              questionNumber={current + 1}
              totalQuestions={questions.length}
              selectedOption={answers[current]}
              numericalAnswer={numericalAnswers[current] ?? ''}
              isMarked={marked.has(current)}
              isSaved={savedQuestions.has(current)}
              hasPrevious={current > 0}
              hasNext={current < questions.length - 1}
              onSelect={handleSelect}
              onNumericalChange={handleNumericalChange}
              onClear={handleClear}
              onMarkAndNext={() => { handleToggleMark(); if (current < questions.length - 1) goTo(current + 1); }}
              onSaveAndNext={handleSaveNext}
              onPrevious={handlePrev}
              onToggleSave={handleToggleSave}
            />
          </div>

          {/* Palette */}
          <div className="w-[252px] shrink-0">
            <QuestionPalette
              questions={paletteQuestions}
              currentIndex={current}
              subjects={SUBJECTS}
              activeSubject={palFilter}
              onJump={goTo}
              onSubject={setPalFilter}
            />
          </div>
        </div>

        {/* Bookmark toast */}
        <div className={[
          'pointer-events-none fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg border border-[#8762F7]/30 bg-[#0d1018] px-4 py-2.5 text-xs font-medium text-white shadow-lg transition-all duration-300',
          toast ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
        ].join(' ')}>
          <Bookmark size={12} className="fill-[#8762F7] stroke-[#8762F7]" />
          {toast}
        </div>

        {/* Submit confirmation */}
        {showSubmit && (
          <SubmitModal
            statuses={paletteQuestions.map(pq => pq.status)}
            onCancel={() => setShowSubmit(false)}
            onConfirm={() => { handleConfirmSubmit(); }}
          />
        )}

      </div>

    </div>
  );
}
