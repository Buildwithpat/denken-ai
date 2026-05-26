'use client';

import type { QStatus } from './QuestionPalette';

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface Props {
  statuses:  QStatus[];
  onCancel:  () => void;
  onConfirm: () => void;
}

/* ─── SubmitModal ────────────────────────────────────────────────────────── */

export default function SubmitModal({ statuses, onCancel, onConfirm }: Props) {
  const count = (s: QStatus) => statuses.filter(x => x === s).length;

  const rows: { label: string; value: number; color: string }[] = [
    { label: 'Answered',              value: count('answered') + count('answered-marked'), color: 'text-[#22c55e]' },
    { label: 'Not Answered',          value: count('not-answered'),                        color: 'text-[#ef4444]' },
    { label: 'Marked for Review',     value: count('marked'),                              color: 'text-[#a78bfa]' },
    { label: 'Answered & Marked',     value: count('answered-marked'),                     color: 'text-[#60a5fa]' },
    { label: 'Not Visited',           value: count('not-visited'),                         color: 'text-white/35'  },
  ];

  return (
    /* Overlay */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onCancel}
    >
      {/* Card */}
      <div
        className="w-full max-w-sm border border-white/[0.09] bg-[#0d1019] shadow-2xl"
        onClick={e => e.stopPropagation()}
      >

        {/* Header */}
        <div className="border-b border-white/[0.07] px-6 py-4">
          <p className="text-sm font-semibold text-white">Submit Test</p>
          <p className="mt-0.5 text-xs text-white/35">
            Review your attempt before submitting.
          </p>
        </div>

        {/* Stats */}
        <div className="border-b border-white/[0.07] px-6 py-4">
          <table className="w-full">
            <tbody>
              {rows.map(({ label, value, color }) => (
                <tr key={label} className="border-b border-white/[0.04] last:border-0">
                  <td className="py-1.5 text-xs text-white/45">{label}</td>
                  <td className={`py-1.5 text-right text-xs font-semibold tabular-nums ${color}`}>
                    {value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Warning */}
        <div className="border-b border-white/[0.07] px-6 py-3">
          <p className="text-[11px] leading-relaxed text-white/30">
            Once submitted, you cannot return to this test or change your answers.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 px-6 py-4">
          <button
            onClick={onCancel}
            className="cursor-pointer rounded border border-white/[0.09] px-4 py-2 text-xs text-white/55 transition-colors hover:border-white/20 hover:text-white/85"
          >
            Go Back
          </button>
          <button
            onClick={onConfirm}
            className="cursor-pointer rounded border border-[#16a34a]/35 bg-[#16a34a]/15 px-5 py-2 text-xs font-semibold text-[#22c55e] transition-colors hover:bg-[#16a34a]/25"
          >
            Submit Test
          </button>
        </div>

      </div>
    </div>
  );
}
