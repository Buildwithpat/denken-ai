'use client';

import { Lock, ChevronRight, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { PracticeRecommendation, PracticeUrgency } from '@/lib/practiceApi';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ConceptMasteryEntry {
  conceptId:               string;
  name:                    string;
  subject:                 string;
  chapter:                 string;
  mastery:                 number;
  retention:               number;
  isPrerequisiteSatisfied: boolean;
  prerequisiteIds:         string[];
  enablesIds:              string[];
  difficulty:              'foundational' | 'intermediate' | 'advanced';
  estimatedStudyMinutes:   number;
}

interface Props {
  concepts:        ConceptMasteryEntry[];
  onDrillConcept?: (concept: ConceptMasteryEntry) => void;
  compact?:        boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function masteryColor(mastery: number, locked: boolean): string {
  if (locked) return 'border-white/[0.06] bg-white/[0.02]';
  if (mastery >= 75) return 'border-[#22c55e]/25 bg-[#22c55e]/[0.05]';
  if (mastery >= 50) return 'border-[#f59e0b]/25 bg-[#f59e0b]/[0.04]';
  if (mastery >= 25) return 'border-[#ef4444]/20 bg-[#ef4444]/[0.04]';
  return 'border-[#ef4444]/35 bg-[#ef4444]/[0.07]';
}

function masteryTextColor(mastery: number, locked: boolean): string {
  if (locked) return 'text-white/20';
  if (mastery >= 75) return 'text-[#22c55e]';
  if (mastery >= 50) return 'text-[#f59e0b]';
  return 'text-[#ef4444]';
}

function masteryBarColor(mastery: number): string {
  if (mastery >= 75) return 'bg-[#22c55e]';
  if (mastery >= 50) return 'bg-[#f59e0b]';
  return 'bg-[#ef4444]';
}

function masteryLabel(mastery: number, locked: boolean): string {
  if (locked) return 'Locked';
  if (mastery >= 75) return 'Strong';
  if (mastery >= 50) return 'Moderate';
  if (mastery >= 25) return 'Weak';
  return 'Critical';
}

const DIFF_BADGE: Record<string, string> = {
  foundational: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  intermediate: 'bg-violet-500/10 text-violet-400 border border-violet-500/20',
  advanced:     'bg-rose-500/10 text-rose-400 border border-rose-500/20',
};

// ── Concept card ──────────────────────────────────────────────────────────────

function ConceptCard({
  concept,
  onDrill,
  compact,
}: {
  concept: ConceptMasteryEntry;
  onDrill?: () => void;
  compact?: boolean;
}) {
  const locked = !concept.isPrerequisiteSatisfied;
  const color  = masteryColor(concept.mastery, locked);
  const tc     = masteryTextColor(concept.mastery, locked);
  const bar    = masteryBarColor(concept.mastery);

  return (
    <div
      className={[
        'group relative flex flex-col gap-2 rounded-xl border p-3 transition-all duration-150',
        color,
        onDrill && !locked ? 'cursor-pointer hover:brightness-110' : '',
      ].join(' ')}
      onClick={!locked && onDrill ? onDrill : undefined}
    >
      {/* Locked overlay */}
      {locked && (
        <div className="absolute right-2.5 top-2.5">
          <Lock size={11} className="text-white/20" />
        </div>
      )}

      {/* Concept name */}
      <p className={`text-xs font-medium leading-snug ${locked ? 'text-white/30' : 'text-white/80'}`}>
        {concept.name}
      </p>

      {/* Mastery bar */}
      {!locked && (
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.07]">
          <div
            className={`h-full rounded-full transition-all duration-700 ${bar}`}
            style={{ width: `${concept.mastery}%` }}
          />
        </div>
      )}

      {/* Bottom row */}
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-semibold ${tc}`}>
          {locked ? 'Locked' : `${concept.mastery}%`}
        </span>
        {!compact && (
          <span className={`rounded px-1 py-0.5 text-[9px] uppercase tracking-wide ${DIFF_BADGE[concept.difficulty] ?? ''}`}>
            {concept.difficulty}
          </span>
        )}
      </div>

      {/* Hover drill button */}
      {!locked && onDrill && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl opacity-0 transition-opacity group-hover:opacity-100 bg-black/40">
          <span className="flex items-center gap-1 text-[10px] font-semibold text-white">
            Drill <ChevronRight size={10} />
          </span>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ConceptMasteryGrid({ concepts, onDrillConcept, compact }: Props) {
  if (concepts.length === 0) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 text-center">
        <TrendingUp size={20} className="mx-auto mb-2 text-white/15" />
        <p className="text-xs text-white/30">
          No concept data yet. Complete a few tests to populate this map.
        </p>
      </div>
    );
  }

  const mastered = concepts.filter(c => c.mastery >= 75 && c.isPrerequisiteSatisfied);
  const moderate = concepts.filter(c => c.mastery >= 50 && c.mastery < 75 && c.isPrerequisiteSatisfied);
  const weak     = concepts.filter(c => c.mastery < 50 && c.isPrerequisiteSatisfied);
  const locked   = concepts.filter(c => !c.isPrerequisiteSatisfied);

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-white/35">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[#22c55e]" />Strong (≥75%)
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[#f59e0b]" />Moderate (50–75%)
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[#ef4444]" />Weak (&lt;50%)
        </span>
        <span className="flex items-center gap-1">
          <Lock size={9} />Locked
        </span>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        {mastered.length > 0 && (
          <span className="flex items-center gap-1 rounded-full border border-[#22c55e]/20 bg-[#22c55e]/8 px-2.5 py-1 text-[10px] font-medium text-[#22c55e]/80">
            <CheckCircle2 size={9} />{mastered.length} mastered
          </span>
        )}
        {weak.length > 0 && (
          <span className="flex items-center gap-1 rounded-full border border-[#ef4444]/20 bg-[#ef4444]/8 px-2.5 py-1 text-[10px] font-medium text-[#ef4444]/80">
            <AlertTriangle size={9} />{weak.length} need work
          </span>
        )}
        {locked.length > 0 && (
          <span className="flex items-center gap-1 rounded-full border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 text-[10px] font-medium text-white/30">
            <Lock size={9} />{locked.length} locked
          </span>
        )}
      </div>

      {/* Grid */}
      <div className={`grid gap-2 ${compact ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'}`}>
        {/* Show unlockable/weak first for maximum visibility */}
        {[...weak, ...moderate, ...mastered, ...locked].map(concept => (
          <ConceptCard
            key={concept.conceptId}
            concept={concept}
            onDrill={onDrillConcept ? () => onDrillConcept(concept) : undefined}
            compact={compact}
          />
        ))}
      </div>
    </div>
  );
}
