'use client';

/* ─── Types ──────────────────────────────────────────────────────────────── */

export type QStatus =
  | 'not-visited'
  | 'not-answered'
  | 'answered'
  | 'marked'
  | 'answered-marked';

export interface PaletteQuestion {
  id:      number;
  subject: string;
  status:  QStatus;
}

interface Props {
  questions:     PaletteQuestion[];
  currentIndex:  number;
  subjects:      string[];
  activeSubject: string;
  onJump:        (idx: number) => void;
  onSubject:     (s: string) => void;
}

/* ─── Status config ──────────────────────────────────────────────────────── */

const STATUS_BG: Record<QStatus, string> = {
  'not-visited':     'bg-[#1a1e2a] border border-white/[0.12] text-white/40',
  'not-answered':    'bg-[#991b1b]  border border-[#991b1b]  text-white',
  'answered':        'bg-[#166534]  border border-[#166534]  text-white',
  'marked':          'bg-[#5b21b6]  border border-[#5b21b6]  text-white',
  'answered-marked': 'bg-[#1e40af]  border border-[#1e40af]  text-white',
};

const STATUS_DOT: Record<QStatus, string> = {
  'not-visited':     'bg-white/20',
  'not-answered':    'bg-[#ef4444]',
  'answered':        'bg-[#22c55e]',
  'marked':          'bg-[#a78bfa]',
  'answered-marked': 'bg-[#60a5fa]',
};

const LEGEND: { status: QStatus; label: string }[] = [
  { status: 'answered',        label: 'Answered'          },
  { status: 'not-answered',    label: 'Not Answered'      },
  { status: 'marked',          label: 'Marked for Review' },
  { status: 'answered-marked', label: 'Answered & Marked' },
  { status: 'not-visited',     label: 'Not Visited'       },
];

/* ─── QuestionPalette ────────────────────────────────────────────────────── */

export default function QuestionPalette({
  questions,
  currentIndex,
  subjects,
  activeSubject,
  onJump,
  onSubject,
}: Props) {
  /* Count per status */
  const counts = questions.reduce<Record<string, number>>((acc, q) => {
    acc[q.status] = (acc[q.status] ?? 0) + 1;
    return acc;
  }, {});

  const visible = activeSubject === 'All'
    ? questions
    : questions.filter(q => q.subject === activeSubject);

  return (
    <div className="flex h-full flex-col border-l border-white/[0.07] bg-[#0c0f18]">

      {/* ── Header ── */}
      <div className="shrink-0 border-b border-white/[0.07] px-4 pt-3 pb-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/20">
          Question Palette
        </p>
      </div>

      {/* ── Legend (top) ── */}
      <div className="shrink-0 border-b border-white/[0.07] px-4 py-3 space-y-2">
        {LEGEND.map(({ status, label }) => {
          const count = counts[status] ?? 0;
          return (
            <div key={status} className="flex items-center gap-2.5">
              {/* Color swatch — same proportions as grid button */}
              <div className={[
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-[9px] font-bold',
                STATUS_BG[status],
              ].join(' ')}>
                <span className={`h-[7px] w-[7px] rounded-[2px] ${STATUS_DOT[status]}`} />
              </div>
              <span className="flex-1 text-[11px] text-white/40">{label}</span>
              <span className="text-[11px] font-medium text-white/55 tabular-nums">
                {count}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Subject filter ── */}
      {subjects.length > 2 && (
        <div className="flex shrink-0 flex-wrap gap-1 border-b border-white/[0.07] px-4 py-2">
          {subjects.map(s => (
            <button
              key={s}
              onClick={() => onSubject(s)}
              className={[
                'cursor-pointer rounded px-2 py-0.5 text-[10px] font-medium transition-colors',
                activeSubject === s
                  ? 'bg-white/[0.09] text-white'
                  : 'text-white/30 hover:text-white/65',
              ].join(' ')}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* ── Number grid ── */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-5 gap-1.5">
          {visible.map(pq => {
            const idx      = pq.id - 1;
            const isCurrent = currentIndex === idx;
            return (
              <button
                key={pq.id}
                onClick={() => onJump(idx)}
                title={`Question ${pq.id} — ${pq.subject}`}
                className={[
                  /* square: aspect-square enforces equal w/h within the col width */
                  'aspect-square w-full cursor-pointer rounded-sm text-[11px] font-semibold tabular-nums transition-all duration-75',
                  STATUS_BG[pq.status],
                  isCurrent
                    ? 'outline outline-2 outline-offset-1 outline-white/60'
                    : 'hover:brightness-110',
                ].join(' ')}
              >
                {String(pq.id).padStart(2, '0')}
              </button>
            );
          })}
        </div>
      </div>

    </div>
  );
}
