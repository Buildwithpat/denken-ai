'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  X, CheckCircle2, XCircle, ChevronRight, Loader2,
  Brain, Target, TrendingUp, MessageSquare, Zap, Timer,
} from 'lucide-react';
import {
  startSession, submitAnswer, getSessionSummary,
  type PracticeQuestion, type SessionSummary, type PracticeIntent,
} from '@/lib/practiceApi';

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  subject:   string;
  chapter?:  string;
  topic?:    string;
  exam?:     string;
  intent?:   PracticeIntent;
  title?:    string;
  onClose:   () => void;
  onComplete?: (summary: SessionSummary) => void;
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

function ProgressBar({ current, total, accuracy }: { current: number; total: number; accuracy: number }) {
  const pct = total > 0 ? (current / total) * 100 : 0;
  const accColor = accuracy >= 70 ? 'text-[#22c55e]' : accuracy >= 50 ? 'text-[#f59e0b]' : 'text-[#ef4444]';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-white/35">{current}/{total} questions</span>
        {current > 0 && <span className={`font-semibold ${accColor}`}>{accuracy}% accuracy</span>}
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.07]">
        <div
          className="h-full rounded-full bg-[#8762F7] transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function FeedbackBanner({ correct, message }: { correct: boolean; message: string }) {
  return (
    <div className={[
      'flex items-start gap-2.5 rounded-xl border px-4 py-3 animate-in slide-in-from-top-2 duration-200',
      correct
        ? 'border-[#22c55e]/25 bg-[#22c55e]/[0.06]'
        : 'border-[#ef4444]/20 bg-[#ef4444]/[0.05]',
    ].join(' ')}>
      {correct
        ? <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-[#22c55e]" />
        : <XCircle     size={15} className="mt-0.5 shrink-0 text-[#ef4444]" />}
      <p className={`text-xs leading-relaxed ${correct ? 'text-[#22c55e]/80' : 'text-[#ef4444]/80'}`}>
        {message}
      </p>
    </div>
  );
}

function SessionSummaryView({
  summary,
  onClose,
  onMentor,
}: {
  summary:   SessionSummary;
  onClose:   () => void;
  onMentor:  () => void;
}) {
  const { accuracy, masteryDelta, correctCount, totalQuestions, suggestedNextStep, weakConceptIds } = summary;

  const accColor  = accuracy >= 70 ? '#22c55e' : accuracy >= 50 ? '#f59e0b' : '#ef4444';
  const deltaSign = masteryDelta >= 0 ? '+' : '';

  const nextStepMsg: Record<string, string> = {
    advance:  'Excellent! You\'re ready to move to the next concept.',
    continue: 'Good progress. More practice will solidify your mastery.',
    mentor:   'Consider asking your AI Mentor to explain the concept in depth.',
    rest:     'Take a break, then revisit with fresh focus.',
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Score */}
      <div className="text-center">
        <p className="text-[10px] uppercase tracking-widest text-white/30 mb-1">Session Complete</p>
        <div className="text-4xl font-bold" style={{ color: accColor }}>{accuracy}%</div>
        <p className="mt-1 text-xs text-white/40">{correctCount} / {totalQuestions} correct</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-center">
          <p className="text-[10px] text-white/30 mb-0.5">Mastery change</p>
          <p className={`text-sm font-semibold ${masteryDelta >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
            {deltaSign}{masteryDelta}%
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-center">
          <p className="text-[10px] text-white/30 mb-0.5">Avg time/question</p>
          <p className="text-sm font-semibold text-white/70">
            {summary.averageSolvingTimeSec}s
          </p>
        </div>
      </div>

      {/* Weak concepts */}
      {weakConceptIds.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-widest text-white/25 mb-2">Concepts to revisit</p>
          <div className="flex flex-wrap gap-1.5">
            {weakConceptIds.map(c => (
              <span key={c} className="rounded-md border border-[#ef4444]/20 bg-[#ef4444]/[0.05] px-2 py-0.5 text-[10px] text-[#ef4444]/70">
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Suggestion */}
      <div className="rounded-xl border border-[#8762F7]/15 bg-[#8762F7]/[0.04] px-4 py-3">
        <p className="text-[10px] text-[#8762F7]/60 uppercase tracking-widest mb-1">Recommended next step</p>
        <p className="text-xs text-white/65 leading-relaxed">{nextStepMsg[suggestedNextStep]}</p>
      </div>

      {/* CTAs */}
      <div className="flex gap-2">
        {suggestedNextStep === 'mentor' && (
          <button
            onClick={onMentor}
            className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#8762F7] to-[#6D4AFF] py-2.5 text-xs font-medium text-white transition-all hover:brightness-110"
          >
            <Brain size={13} />
            Ask AI Mentor
          </button>
        )}
        <button
          onClick={onClose}
          className="flex-1 cursor-pointer rounded-lg border border-white/[0.08] py-2.5 text-xs text-white/50 transition-colors hover:border-white/15 hover:text-white/80"
        >
          Done
        </button>
      </div>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

export default function AdaptivePracticeModal({
  subject, chapter, topic, exam = 'JEE_MAIN', intent = 'concept-drill',
  title = 'Adaptive Practice', onClose, onComplete,
}: Props) {
  const router = useRouter();

  const [phase,        setPhase]       = useState<'loading' | 'question' | 'feedback' | 'summary'>('loading');
  const [sessionId,    setSessionId]   = useState('');
  const [question,     setQuestion]    = useState<PracticeQuestion | null>(null);
  const [totalPlanned, setTotalPlanned] = useState(0);
  const [progress,     setProgress]    = useState({ current: 0, total: 0, accuracy: 0 });
  const [selected,     setSelected]    = useState<string | null>(null);
  const [feedback,     setFeedback]    = useState('');
  const [wasCorrect,   setWasCorrect]  = useState(false);
  const [summary,      setSummary]     = useState<SessionSummary | null>(null);
  const [error,        setError]       = useState<string | null>(null);
  const startTime = useRef<number>(Date.now());

  // Start session on mount
  useEffect(() => {
    startSession({ subject, chapter, topic, exam, intent, questionCount: 8 })
      .then(result => {
        setSessionId(result.sessionId);
        setQuestion(result.firstQuestion);
        setTotalPlanned(result.totalPlanned);
        setProgress({ current: 0, total: result.totalPlanned, accuracy: 0 });
        setPhase('question');
        startTime.current = Date.now();
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Could not start practice session.');
        setPhase('question'); // show error in question phase
      });
  }, [subject, chapter, topic, exam, intent]);

  const handleSelect = useCallback(async (option: string) => {
    if (!question || phase !== 'question' || !sessionId) return;
    setSelected(option);

    const isCorrect     = option === question.correctOption;
    const solvingTime   = Math.round((Date.now() - startTime.current) / 1000);
    startTime.current   = Date.now(); // reset for next question

    try {
      const result = await submitAnswer(sessionId, question.id, isCorrect, solvingTime);

      setFeedback(result.feedback);
      setWasCorrect(result.isCorrect);
      setProgress(result.progress);
      setPhase('feedback');

      if (result.sessionDone) {
        // Fetch summary
        const s = await getSessionSummary(sessionId);
        setSummary(s);
        onComplete?.(s);
        setPhase('summary');
      } else {
        // Auto-advance after 2s
        setTimeout(() => {
          setQuestion(result.nextQuestion);
          setSelected(null);
          setPhase('question');
        }, 2000);
      }
    } catch {
      setError('Failed to submit answer. Please try again.');
    }
  }, [question, phase, sessionId, onComplete]);

  const optionLabel = ['A', 'B', 'C', 'D'] as const;
  const optionColor = (opt: string) => {
    if (phase !== 'feedback') {
      return selected === opt
        ? 'border-[#8762F7]/50 bg-[#8762F7]/10 text-white/90'
        : 'border-white/[0.08] bg-white/[0.02] text-white/70 hover:border-white/15 hover:bg-white/[0.04]';
    }
    if (opt === question?.correctOption) return 'border-[#22c55e]/40 bg-[#22c55e]/8 text-[#22c55e]/90';
    if (opt === selected && !wasCorrect) return 'border-[#ef4444]/30 bg-[#ef4444]/6 text-[#ef4444]/80';
    return 'border-white/[0.06] bg-white/[0.015] text-white/35';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" />

      <div
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#0F1117] shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#8762F7]/12 border border-[#8762F7]/20">
              <Target size={13} className="text-[#8762F7]" />
            </div>
            <span className="text-[13px] font-semibold text-white">{title}</span>
          </div>
          <button onClick={onClose} className="cursor-pointer text-white/25 transition-colors hover:text-white/55">
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5">

          {/* Loading */}
          {phase === 'loading' && (
            <div className="flex flex-col items-center gap-3 py-10">
              <Loader2 size={22} className="animate-spin text-[#8762F7]/60" />
              <p className="text-xs text-white/35">Selecting questions for you…</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-4 rounded-lg border border-[#ef4444]/20 bg-[#ef4444]/[0.05] px-4 py-2.5">
              <p className="text-xs text-[#ef4444]/80">{error}</p>
            </div>
          )}

          {/* Question phase */}
          {(phase === 'question' || phase === 'feedback') && question && (
            <div className="space-y-4">
              {/* Progress */}
              <ProgressBar {...progress} />

              {/* Question text */}
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-4">
                <div className="flex items-start gap-2 mb-3">
                  <span className="shrink-0 rounded-md bg-[#8762F7]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#8762F7]/70 border border-[#8762F7]/15">
                    Q{progress.current + 1}
                  </span>
                  {question.bloomLevel && (
                    <span className="shrink-0 rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-white/30 border border-white/[0.06]">
                      {question.bloomLevel}
                    </span>
                  )}
                </div>
                <p className="text-sm text-white/85 leading-relaxed">{question.question}</p>
              </div>

              {/* Options */}
              {question.options && (
                <div className="space-y-2">
                  {question.options.map((opt, i) => {
                    const letter = optionLabel[i]!;
                    return (
                      <button
                        key={letter}
                        onClick={() => handleSelect(letter)}
                        disabled={phase === 'feedback'}
                        className={[
                          'w-full cursor-pointer rounded-lg border px-4 py-2.5 text-left text-sm transition-all duration-150 disabled:cursor-default',
                          optionColor(letter),
                        ].join(' ')}
                      >
                        <span className="mr-2.5 font-semibold">{letter}.</span>
                        {opt}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Feedback */}
              {phase === 'feedback' && (
                <div className="space-y-3">
                  <FeedbackBanner correct={wasCorrect} message={feedback} />
                  {!wasCorrect && (
                    <p className="text-[10px] text-white/25 text-center">
                      Advancing to next question automatically…
                    </p>
                  )}
                </div>
              )}

              {/* Concept tags */}
              {question.conceptTags && question.conceptTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {question.conceptTags.slice(0, 3).map(tag => (
                    <span key={tag} className="rounded-md border border-[#8762F7]/15 bg-[#8762F7]/[0.05] px-2 py-0.5 text-[10px] text-[#8762F7]/60">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Summary phase */}
          {phase === 'summary' && summary && (
            <SessionSummaryView
              summary={summary}
              onClose={onClose}
              onMentor={() => { onClose(); router.push('/mentor'); }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
