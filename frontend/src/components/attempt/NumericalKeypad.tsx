'use client';

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface Props {
  value:    string;
  onChange: (v: string) => void;
}

/* ─── Key logic ──────────────────────────────────────────────────────────── */

function apply(current: string, key: string): string {
  switch (key) {
    case '⌫':
      return current.length <= 1 ? '' : current.slice(0, -1);
    case 'C':
      return '';
    case '.':
      if (current.includes('.')) return current;
      if (current === '' || current === '-') return current + '0.';
      return current + '.';
    case '+/−':
      if (current === '' || current === '0') return '-';
      if (current.startsWith('-')) return current.slice(1);
      return '-' + current;
    default: {
      // digit
      if (current === '0') return key;
      if (current === '-0') return '-' + key;
      return current + key;
    }
  }
}

/* ─── NumericalKeypad ────────────────────────────────────────────────────── */

export default function NumericalKeypad({ value, onChange }: Props) {
  function press(key: string) {
    onChange(apply(value, key));
  }

  const isEmpty = value === '';

  /*
   * Flat 4-column grid, 4 rows.
   * ⌫ spans rows 1–2 (col 4).  C spans rows 3–4 (col 4).
   *
   *  7  8  9  ⌫
   *  4  5  6  (⌫ cont.)
   *  1  2  3  C
   *  -  0  .  (C cont.)
   */
  type Cell = {
    key:      string;
    col:      number;
    row:      number;
    rowSpan?: number;
    style?:   string;
  };

  const cells: Cell[] = [
    { key: '7',   col: 1, row: 1 },
    { key: '8',   col: 2, row: 1 },
    { key: '9',   col: 3, row: 1 },
    { key: '⌫',   col: 4, row: 1, rowSpan: 2, style: 'action' },
    { key: '4',   col: 1, row: 2 },
    { key: '5',   col: 2, row: 2 },
    { key: '6',   col: 3, row: 2 },
    { key: '1',   col: 1, row: 3 },
    { key: '2',   col: 2, row: 3 },
    { key: '3',   col: 3, row: 3 },
    { key: 'C',   col: 4, row: 3, rowSpan: 2, style: 'clear' },
    { key: '+/−', col: 1, row: 4, style: 'action' },
    { key: '0',   col: 2, row: 4 },
    { key: '.',   col: 3, row: 4 },
  ];

  return (
    <div className="w-full max-w-[272px]">

      {/* Display */}
      <div className="mb-5">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/25">
          Your Answer
        </p>
        <div className={[
          'flex h-10 items-center rounded border px-4 font-mono text-base tabular-nums transition-colors',
          isEmpty
            ? 'border-white/[0.07] text-white/20'
            : 'border-white/20 bg-white/[0.04] text-white',
        ].join(' ')}>
          {isEmpty ? '—' : value}
        </div>
      </div>

      {/* Keypad */}
      <div
        className="grid gap-1.5"
        style={{
          gridTemplateColumns: 'repeat(4, 1fr)',
          gridTemplateRows:    'repeat(4, 40px)',
        }}
      >
        {cells.map(({ key, col, row, rowSpan = 1, style }) => {
          const isAction = style === 'action';
          const isClear  = style === 'clear';
          return (
            <button
              key={key}
              onClick={() => press(key)}
              style={{
                gridColumn: `${col} / span 1`,
                gridRow:    `${row} / span ${rowSpan}`,
              }}
              className={[
                'flex cursor-pointer select-none items-center justify-center rounded border text-sm font-medium transition-colors duration-75',
                isClear
                  ? 'border-[#b91c1c]/30 bg-[#b91c1c]/10 text-[#b91c1c] hover:bg-[#b91c1c]/20'
                  : isAction
                    ? 'border-white/10 bg-white/[0.04] text-white/50 hover:bg-white/[0.08] hover:text-white/80'
                    : 'border-white/[0.07] bg-white/[0.03] text-white/75 hover:bg-white/[0.09] hover:text-white',
              ].join(' ')}
            >
              {key}
            </button>
          );
        })}
      </div>

    </div>
  );
}
