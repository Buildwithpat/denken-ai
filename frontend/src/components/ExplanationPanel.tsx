'use client';

import { useState } from 'react';
import { BookOpen, Lightbulb, AlertTriangle, ChevronDown, ChevronUp, Loader2, Sparkles } from 'lucide-react';
import { questionApi, type ExplanationStyle, type QuestionExplanation } from '@/lib/questionApi';

const STYLES: { value: ExplanationStyle; label: string }[] = [
  { value: 'step-by-step',  label: 'Step-by-Step' },
  { value: 'beginner',      label: 'Beginner'      },
  { value: 'intermediate',  label: 'Intermediate'  },
  { value: 'advanced',      label: 'Advanced'      },
  { value: 'mistake-aware', label: 'Fix My Mistake' },
  { value: 'alternative',   label: 'Alt. Method'   },
];

interface Props {
  stableId:     string;
  mistakeType?: string;
  masteryScore?: number;
}

function inferStyle(masteryScore?: number, mistakeType?: string): ExplanationStyle {
  if (mistakeType) return 'mistake-aware';
  if (masteryScore === undefined) return 'step-by-step';
  if (masteryScore < 35)  return 'beginner';
  if (masteryScore < 60)  return 'intermediate';
  if (masteryScore < 80)  return 'step-by-step';
  return 'advanced';
}

export default function ExplanationPanel({ stableId, mistakeType, masteryScore }: Props) {
  const [open,        setOpen]        = useState(false);
  const [style,       setStyle]       = useState<ExplanationStyle>(() => inferStyle(masteryScore, mistakeType));
  const [explanation, setExplanation] = useState<QuestionExplanation | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [hintLevel,   setHintLevel]   = useState(0);
  const [hints,       setHints]       = useState<string[]>([]);

  async function loadExplanation(s: ExplanationStyle) {
    setLoading(true);
    setError(null);
    try {
      const data = await questionApi.getExplanation(stableId, s, mistakeType);
      setExplanation(data);
      setHints([]);
      setHintLevel(0);
    } catch {
      setError('Could not load explanation. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function loadNextHint() {
    const next = (hintLevel + 1) as 1 | 2 | 3;
    if (next > 3) return;
    try {
      const data = await questionApi.getHints(stableId, next);
      setHints(data.hints);
      setHintLevel(next);
    } catch {
      // silent
    }
  }

  function handleToggle() {
    if (!open && !explanation) {
      void loadExplanation(style);
    }
    setOpen(v => !v);
  }

  function handleStyleChange(s: ExplanationStyle) {
    setStyle(s);
    void loadExplanation(s);
  }

  return (
    <div className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50/50 dark:border-indigo-800 dark:bg-indigo-950/30">
      <button
        onClick={handleToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-indigo-700 dark:text-indigo-300"
      >
        <span className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          AI Explanation
        </span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          {/* Style selector */}
          <div className="flex flex-wrap gap-2">
            {STYLES.map(s => (
              <button
                key={s.value}
                onClick={() => handleStyleChange(s.value)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  style === s.value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-indigo-600 border border-indigo-300 hover:bg-indigo-50 dark:bg-zinc-800 dark:text-indigo-300 dark:border-indigo-700'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {loading && (
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating explanation…
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          {explanation && !loading && (
            <div className="space-y-4">
              {/* Main explanation */}
              <div className="prose prose-sm dark:prose-invert max-w-none text-zinc-800 dark:text-zinc-200">
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{explanation.explanation}</p>
              </div>

              {/* Step-by-step */}
              {explanation.stepByStep.length > 0 && (
                <div>
                  <h4 className="flex items-center gap-1 text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
                    <BookOpen className="h-3 w-3" /> Steps
                  </h4>
                  <ol className="list-decimal list-inside space-y-1">
                    {explanation.stepByStep.map((step, i) => (
                      <li key={i} className="text-sm text-zinc-700 dark:text-zinc-300">{step}</li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Key insight */}
              {explanation.keyInsight && (
                <div className="flex gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 p-3 border border-amber-200 dark:border-amber-800">
                  <Lightbulb className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                  <p className="text-sm text-amber-800 dark:text-amber-200">{explanation.keyInsight}</p>
                </div>
              )}

              {/* Common mistakes */}
              {explanation.commonMistakes.length > 0 && (
                <div>
                  <h4 className="flex items-center gap-1 text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
                    <AlertTriangle className="h-3 w-3" /> Common Mistakes
                  </h4>
                  <ul className="space-y-1">
                    {explanation.commonMistakes.map((m, i) => (
                      <li key={i} className="flex gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                        <span className="text-red-400">×</span> {m}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Formulas used */}
              {explanation.formulasUsed.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {explanation.formulasUsed.map((f, i) => (
                    <span key={i} className="rounded bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 font-mono text-xs text-zinc-700 dark:text-zinc-300">
                      {f}
                    </span>
                  ))}
                </div>
              )}

              {/* Progressive hints */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => void loadNextHint()}
                  disabled={hintLevel >= 3}
                  className="rounded-md bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-40"
                >
                  {hintLevel === 0 ? 'Show Hint' : hintLevel < 3 ? 'Next Hint' : 'No more hints'}
                </button>
                {hints.map((h, i) => (
                  <span key={i} className="text-xs text-zinc-500 dark:text-zinc-400 italic">H{i + 1}: {h}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
