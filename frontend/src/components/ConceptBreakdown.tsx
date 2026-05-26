'use client';

import { AlertCircle, TrendingUp, Unlock, Link } from 'lucide-react';
import type { ConceptGap, ConceptInsights } from '@/lib/questionApi';

const SEVERITY_CONFIG = {
  critical: { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800', badge: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300' },
  moderate: { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800', badge: 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300' },
  minor:    { color: 'text-sky-600 dark:text-sky-400',    bg: 'bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800',       badge: 'bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300'       },
};

interface GapCardProps {
  gap: ConceptGap;
}

function GapCard({ gap }: GapCardProps) {
  const cfg = SEVERITY_CONFIG[gap.gapSeverity];
  return (
    <div className={`rounded-lg border p-3 ${cfg.bg}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertCircle className={`h-4 w-4 shrink-0 ${cfg.color}`} />
          <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{gap.conceptName}</span>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${cfg.badge}`}>
          {gap.gapSeverity}
        </span>
      </div>
      <p className="mt-1 ml-6 text-xs text-zinc-500 dark:text-zinc-400">
        {gap.subject} — {gap.chapter}
      </p>
      {gap.enablesConcepts.length > 0 && (
        <div className="mt-2 ml-6 flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
          <Unlock className="h-3 w-3" />
          <span>Unlocks: {gap.enablesConcepts.slice(0, 3).join(', ')}</span>
        </div>
      )}
      {gap.formulaLinks.length > 0 && (
        <div className="mt-1 ml-6 flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
          <Link className="h-3 w-3" />
          <span>Formulas: {gap.formulaLinks.slice(0, 3).join(', ')}</span>
        </div>
      )}
    </div>
  );
}

interface BloomBarProps {
  label:   string;
  correct: number;
  total:   number;
}

function BloomBar({ label, correct, total }: BloomBarProps) {
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const color = pct >= 70 ? 'bg-green-500' : pct >= 45 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 text-right text-xs capitalize text-zinc-600 dark:text-zinc-400 shrink-0">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-zinc-200 dark:bg-zinc-700">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-12 text-xs text-zinc-500 dark:text-zinc-400">{correct}/{total}</span>
    </div>
  );
}

interface Props {
  insights?:    ConceptInsights;
  bloomBreakdown?: Record<string, { correct: number; total: number }>;
  skillBreakdown?: Record<string, { correct: number; total: number }>;
  weakConcepts?:   string[];
  formulaLinks?:   string[];
  avgSolvingTime?: number;
  slowQuestions?:  string[];
}

export default function ConceptBreakdown({
  insights,
  bloomBreakdown,
  skillBreakdown,
  weakConcepts,
  formulaLinks,
  avgSolvingTime,
}: Props) {
  const gaps = insights?.gaps ?? [];

  return (
    <div className="space-y-6">
      {/* Concept Gaps */}
      {gaps.length > 0 && (
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            <AlertCircle className="h-4 w-4 text-red-500" />
            Prerequisite Gaps ({gaps.length})
          </h3>
          <div className="space-y-2">
            {gaps.map(g => <GapCard key={g.conceptId} gap={g} />)}
          </div>
          {(insights?.unlockableConcepts?.length ?? 0) > 0 && (
            <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
              Fix these to unlock: {insights!.unlockableConcepts.slice(0, 4).join(', ')}
            </p>
          )}
        </section>
      )}

      {/* Bloom Taxonomy breakdown */}
      {bloomBreakdown && Object.keys(bloomBreakdown).length > 0 && (
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            <TrendingUp className="h-4 w-4 text-indigo-500" />
            Performance by Bloom Level
          </h3>
          <div className="space-y-2">
            {Object.entries(bloomBreakdown).map(([level, { correct, total }]) => (
              <BloomBar key={level} label={level} correct={correct} total={total} />
            ))}
          </div>
        </section>
      )}

      {/* Skill breakdown */}
      {skillBreakdown && Object.keys(skillBreakdown).length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">By Skill Category</h3>
          <div className="space-y-2">
            {Object.entries(skillBreakdown).map(([skill, { correct, total }]) => (
              <BloomBar key={skill} label={skill} correct={correct} total={total} />
            ))}
          </div>
        </section>
      )}

      {/* Solving time */}
      {avgSolvingTime !== undefined && avgSolvingTime > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Time Analysis</h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Average solving time: <strong>{avgSolvingTime}s</strong> per question
          </p>
        </section>
      )}

      {/* Weak concept tags */}
      {(weakConcepts?.length ?? 0) > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Concepts to Revisit</h3>
          <div className="flex flex-wrap gap-2">
            {weakConcepts!.map(c => (
              <span key={c} className="rounded-full bg-red-100 dark:bg-red-900/40 px-2.5 py-0.5 text-xs text-red-700 dark:text-red-300">
                {c}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Formula gaps */}
      {(formulaLinks?.length ?? 0) > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Formula Gaps</h3>
          <div className="flex flex-wrap gap-2">
            {formulaLinks!.map(f => (
              <span key={f} className="rounded bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 font-mono text-xs text-zinc-700 dark:text-zinc-300">
                {f}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
