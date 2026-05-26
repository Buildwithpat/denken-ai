'use client';

import { X, Play } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { RevisionPlanItem } from '@/lib/revisionApi';

/* ─── Types ──────────────────────────────────────────────────────────────── */

export type ExamKey = 'jee' | 'neet' | 'cbse' | 'custom';

export interface WeakEntry { subject: string; chapter: string; score: number }

interface PlanItem    { text: string; critical?: boolean }
interface PlanSection { label: string; items: PlanItem[] }

interface Props {
  examType:    ExamKey;
  weakEntries: WeakEntry[];
  plan?:       RevisionPlanItem[];
  onClose:     () => void;
}

/* ─── Static labels ──────────────────────────────────────────────────────── */

const EXAM_LABEL: Record<ExamKey, string> = {
  jee:    'JEE',
  neet:   'NEET',
  cbse:   'CBSE',
  custom: 'Custom',
};

/* ─── Static plan fallback ───────────────────────────────────────────────── */

function buildStaticPlan(examType: ExamKey, weakEntries: WeakEntry[]): PlanSection[] {
  const topWeak = weakEntries.slice(0, 4);

  if (examType === 'jee' || examType === 'neet') {
    return [
      {
        label: 'Weak Chapters',
        items: topWeak.length > 0
          ? topWeak.map(e => ({ text: `${e.subject} — ${e.chapter} (${e.score}%)`, critical: e.score < 50 }))
          : [{ text: 'No weak areas detected. Great progress!' }],
      },
      {
        label: 'Practice Suggestions',
        items: examType === 'jee'
          ? [
              { text: 'Attempt 20 MCQs daily from your weakest chapters' },
              { text: 'Solve 2 full-length mock tests this week' },
              { text: 'Focus on numerical problems in Physics and Chemistry' },
            ]
          : [
              { text: 'Attempt 30 MCQs daily, prioritising Biology' },
              { text: 'Revise NCERT thoroughly for Chemistry and Physics' },
              { text: 'Practice assertion-reason and matching questions' },
            ],
      },
      {
        label: 'Formula Revision',
        items: examType === 'jee'
          ? [
              { text: "Revise Coulomb's law, Gauss's theorem, and AC circuits" },
              { text: 'Practice integration and differentiation shortcuts' },
              { text: 'Memorise equilibrium constant and Ksp expressions' },
            ]
          : [
              { text: 'Review electromagnetic spectrum and wave properties' },
              { text: 'Memorise IUPAC nomenclature for coordination compounds' },
              { text: 'Revise DNA replication, transcription, and translation steps' },
            ],
      },
    ];
  }

  if (examType === 'cbse') {
    return [
      {
        label: 'Writing Practice',
        items: [
          { text: 'Practice 5-mark descriptive answers daily — structured paragraphs' },
          { text: 'Write concise 2-mark answers: one concept, two lines maximum' },
          { text: 'Improve diagram labelling accuracy and neatness for full marks' },
        ],
      },
      {
        label: 'Key Topics',
        items: topWeak.length > 0
          ? topWeak.map(e => ({ text: `${e.subject} — ${e.chapter}`, critical: e.score < 50 }))
          : [
              { text: 'Integrals and Differential Equations' },
              { text: 'Electromagnetic Induction' },
              { text: 'Electrochemistry' },
            ],
      },
      {
        label: 'Important Questions',
        items: [
          { text: 'Solve 3 board-level application questions per day' },
          { text: 'Attempt all sections of previous year papers within time' },
          { text: 'Focus on case-study based questions (5 marks each)' },
        ],
      },
    ];
  }

  return [
    {
      label: 'Unit-Wise Plan',
      items: topWeak.length > 0
        ? topWeak.map(e => ({ text: `${e.subject} — ${e.chapter} (${e.score}%)`, critical: e.score < 50 }))
        : [
            { text: 'Complete all practice sets for each unit' },
            { text: 'Spend 2 sessions on foundational concepts per week' },
          ],
    },
    {
      label: 'Focus Areas',
      items: [
        { text: 'Revisit all unresolved doubts before your exam' },
        { text: 'Practice mixed questions across units for cross-unit recall' },
        { text: 'Review your mistake log and retry every failed question' },
      ],
    },
  ];
}

/* ─── Mode badge ─────────────────────────────────────────────────────────── */

const MODE_STYLE: Record<RevisionPlanItem['mode'], { label: string; cls: string }> = {
  concept:  { label: 'Theory',    cls: 'border-[#ef4444]/25 bg-[#ef4444]/[0.06] text-[#ef4444]/70' },
  drill:    { label: 'Drill',     cls: 'border-[#f59e0b]/25 bg-[#f59e0b]/[0.06] text-[#f59e0b]/70' },
  practice: { label: 'Practice',  cls: 'border-[#22c55e]/25 bg-[#22c55e]/[0.06] text-[#22c55e]/70' },
};

const PRIORITY_DOT: Record<RevisionPlanItem['priorityLabel'], string> = {
  critical: 'bg-[#ef4444]',
  high:     'bg-[#f59e0b]',
  medium:   'bg-[#8762F7]/60',
};

const SUBJECT_TAG: Record<string, string> = {
  Physics:     'text-[#3b82f6] bg-[#3b82f6]/[0.08] border-[#3b82f6]/20',
  Chemistry:   'text-[#22c55e] bg-[#22c55e]/[0.08] border-[#22c55e]/20',
  Mathematics: 'text-[#8762F7] bg-[#8762F7]/[0.08] border-[#8762F7]/20',
  Biology:     'text-[#f59e0b] bg-[#f59e0b]/[0.08] border-[#f59e0b]/20',
};

/* ─── Component ──────────────────────────────────────────────────────────── */

export default function RevisionPlanModal({ examType, weakEntries, plan, onClose }: Props) {
  const router     = useRouter();
  const hasRealPlan = plan && plan.length > 0;
  const examLabel  = EXAM_LABEL[examType];

  /* ── Real plan ── */
  if (hasRealPlan) {
    const itemCount = plan.length;

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
        onClick={onClose}
      >
        <div
          className="flex w-full max-w-lg flex-col overflow-hidden rounded border border-white/[0.09] bg-[#0d1019]"
          style={{ maxHeight: '88vh' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-white/[0.07] px-5 py-4">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-white">Your Smart Revision Plan</p>
                <span className="rounded-full border border-[#22c55e]/20 bg-[#22c55e]/[0.06] px-2 py-0.5 text-[10px] text-[#22c55e]/70">
                  Live data
                </span>
              </div>
              <p className="mt-0.5 text-xs text-white/35">
                Personalised for {examLabel} · Priority-ranked by your mistake patterns
              </p>
            </div>
            <button
              onClick={onClose}
              className="cursor-pointer rounded p-1.5 text-white/30 transition-colors hover:bg-white/[0.05] hover:text-white/70"
            >
              <X size={15} />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-5 py-5 [&::-webkit-scrollbar]:hidden">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-white/25">
              7-Day Roadmap
            </p>
            <div className="overflow-hidden rounded-xl border border-white/[0.07]">
              {plan.map((item, i) => {
                const modeStyle  = MODE_STYLE[item.mode];
                const dotCls     = PRIORITY_DOT[item.priorityLabel];
                const tagCls     = SUBJECT_TAG[item.subject] ?? 'text-white/50 bg-white/[0.06] border-white/[0.1]';
                return (
                  <div
                    key={item.day}
                    className={[
                      'flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.02]',
                      i < plan.length - 1 ? 'border-b border-white/[0.05]' : '',
                    ].join(' ')}
                  >
                    <span className="w-10 shrink-0 text-[11px] font-semibold text-white/30">{item.day}</span>
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotCls}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white/80">{item.topic}</p>
                      {item.focusPoints?.[0] && (
                        <p className="truncate text-[10px] text-white/30">{item.focusPoints[0]}</p>
                      )}
                    </div>
                    <span className={['shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold', tagCls].join(' ')}>
                      {item.subject}
                    </span>
                    <span className={['shrink-0 rounded border px-2 py-0.5 text-[10px] font-medium', modeStyle.cls].join(' ')}>
                      {modeStyle.label}
                    </span>
                    <span className="w-14 shrink-0 text-right text-[11px] text-white/25">{item.duration}</span>
                    <button
                      onClick={() =>
                        router.push(
                          `/revision/notes?subject=${encodeURIComponent(item.subject)}&chapter=${encodeURIComponent(item.topic)}`,
                        )
                      }
                      className="flex cursor-pointer shrink-0 items-center gap-1 rounded border border-[#8762F7]/30 bg-[#8762F7]/[0.08] px-2.5 py-1.5 text-[10px] font-semibold text-[#8762F7] transition-colors hover:bg-[#8762F7]/[0.15]"
                    >
                      <Play size={8} className="fill-[#8762F7]" />
                      Start
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="flex shrink-0 items-center justify-between border-t border-white/[0.07] px-5 py-4">
            <span className="text-[11px] text-white/25">
              {itemCount} topic{itemCount !== 1 ? 's' : ''} · priority-ranked
            </span>
            <button
              onClick={onClose}
              className="cursor-pointer rounded border border-white/[0.09] px-4 py-2 text-xs text-white/45 transition-colors hover:border-white/20 hover:text-white/75"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Static fallback plan ── */
  const sections  = buildStaticPlan(examType, weakEntries);
  const itemCount = sections.reduce((n, s) => n + s.items.length, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-lg flex-col overflow-hidden rounded border border-white/[0.09] bg-[#0d1019]"
        style={{ maxHeight: '88vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.07] px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-white">Your Smart Revision Plan</p>
            <p className="mt-0.5 text-xs text-white/35">
              Personalised for {examLabel} · Based on your weak areas
            </p>
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer rounded p-1.5 text-white/30 transition-colors hover:bg-white/[0.05] hover:text-white/70"
          >
            <X size={15} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 [&::-webkit-scrollbar]:hidden">
          {sections.map(section => (
            <div key={section.label}>
              <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-white/25">
                {section.label}
              </p>
              <ul className="space-y-1.5">
                {section.items.map((item, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2.5 rounded border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5"
                  >
                    <span
                      className={[
                        'mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full',
                        item.critical ? 'bg-[#ef4444]' : 'bg-[#8762F7]/45',
                      ].join(' ')}
                    />
                    <span
                      className={[
                        'text-xs leading-relaxed',
                        item.critical ? 'text-white/70' : 'text-white/50',
                      ].join(' ')}
                    >
                      {item.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between border-t border-white/[0.07] px-5 py-4">
          <span className="text-[11px] text-white/25">
            {itemCount} action item{itemCount !== 1 ? 's' : ''}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="cursor-pointer rounded border border-white/[0.09] px-4 py-2 text-xs text-white/45 transition-colors hover:border-white/20 hover:text-white/75"
            >
              Close
            </button>
            <button
              onClick={onClose}
              className="cursor-pointer rounded border border-[#8762F7]/30 bg-[#8762F7]/12 px-5 py-2 text-xs font-semibold text-[#8762F7] transition-colors hover:bg-[#8762F7]/22"
            >
              Start Revision
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
