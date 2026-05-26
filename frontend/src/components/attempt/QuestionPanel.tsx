'use client';

import Image from 'next/image';
import { Bookmark } from 'lucide-react';
import NumericalKeypad from './NumericalKeypad';

/* ─── Types ──────────────────────────────────────────────────────────────── */

export interface AttemptQuestion {
  id:                   number;
  subject:              string;
  text:                 string;
  diagram?:             string;
  diagramDescription?:  string;
  type:                 'mcq' | 'numerical' | 'subjective';
  options:              string[];
}

interface Props {
  question:         AttemptQuestion;
  questionNumber:   number;
  totalQuestions:   number;
  selectedOption:   number | undefined;
  numericalAnswer:  string;
  isMarked:         boolean;
  isSaved:          boolean;
  hasPrevious:      boolean;
  hasNext:          boolean;
  onSelect:         (optIdx: number) => void;
  onNumericalChange:(val: string) => void;
  onClear:          () => void;
  onMarkAndNext:    () => void;
  onSaveAndNext:    () => void;
  onPrevious:       () => void;
  onToggleSave:     () => void;
}

/* ─── Radio circle ───────────────────────────────────────────────────────── */

function Radio({ selected }: { selected: boolean }) {
  return (
    <span className={[
      'mt-[3px] flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full border transition-colors duration-100',
      selected
        ? 'border-[#27ae60] bg-[#27ae60]'
        : 'border-white/30 bg-transparent',
    ].join(' ')}>
      {selected && (
        <span className="h-[5px] w-[5px] rounded-full bg-white" />
      )}
    </span>
  );
}

/* ─── Option row ─────────────────────────────────────────────────────────── */

function OptionRow({
  index, text, selected, onSelect,
}: {
  index: number; text: string; selected: boolean; onSelect: () => void;
}) {
  const letter = String.fromCharCode(65 + index);
  return (
    <li
      onClick={onSelect}
      className={[
        'flex cursor-pointer items-start gap-3 rounded px-3 py-2.5 transition-colors duration-100',
        selected
          ? 'bg-[#27ae60]/10 text-white'
          : 'text-white/70 hover:bg-white/[0.04] hover:text-white/90',
      ].join(' ')}
    >
      <Radio selected={selected} />
      <span className={[
        'text-sm font-semibold shrink-0 w-5',
        selected ? 'text-[#27ae60]' : 'text-white/40',
      ].join(' ')}>
        {letter}.
      </span>
      <span className="text-sm leading-relaxed">{text}</span>
    </li>
  );
}

/* ─── QuestionPanel ──────────────────────────────────────────────────────── */

export default function QuestionPanel({
  question,
  questionNumber,
  totalQuestions,
  selectedOption,
  numericalAnswer,
  isMarked,
  isSaved,
  hasPrevious,
  hasNext,
  onSelect,
  onNumericalChange,
  onClear,
  onMarkAndNext,
  onSaveAndNext,
  onPrevious,
  onToggleSave,
}: Props) {
  const isNumerical  = question.type === 'numerical';
  const isSubjective = question.type === 'subjective';
  const hasResponse  = isNumerical ? numericalAnswer !== '' : selectedOption !== undefined;
  return (
    <div className="flex flex-col h-full">

      {/* ── Section strip ── */}
      <div className="flex shrink-0 items-center gap-3 border-b border-white/[0.07] px-6 py-2.5">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-white/20">
          Section
        </span>
        <span className="text-xs text-white/55">{question.subject}</span>
        <span className="ml-auto text-[10px] text-white/25">
          Question {questionNumber} of {totalQuestions}
        </span>
        <button
          onClick={onToggleSave}
          title={isSaved ? 'Remove bookmark' : 'Save question'}
          className="cursor-pointer rounded p-1 transition-all duration-150 hover:bg-white/[0.06]"
        >
          <Bookmark
            size={14}
            className={[
              'transition-all duration-200',
              isSaved
                ? 'fill-[#8762F7] stroke-[#8762F7]'
                : 'stroke-white/30 hover:stroke-[#8762F7]/70',
            ].join(' ')}
          />
        </button>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto px-7 py-7">

        {/* Question label + text */}
        <div className="mb-6">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-white/25">
            Question {questionNumber}
          </p>
          <p className="text-sm leading-[1.85] text-white/85">
            {question.text}
          </p>
        </div>

        {/* Diagram image (URL-based) */}
        {question.diagram && (
          <div className="mb-7 border-t border-b border-white/[0.07] py-5">
            <Image
              src={question.diagram}
              alt={`Diagram for question ${questionNumber}`}
              width={0}
              height={0}
              sizes="100vw"
              className="h-auto max-w-full"
              style={{ width: 'auto' }}
            />
          </div>
        )}

        {/* Diagram description (text-based figure reference) */}
        {!question.diagram && question.diagramDescription && (
          <div className="mb-6 rounded-lg border border-white/[0.08] bg-white/[0.02] px-4 py-3">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-white/25">Figure / Diagram Reference</p>
            <p className="text-xs leading-relaxed text-white/55">{question.diagramDescription}</p>
          </div>
        )}

        {/* Divider */}
        <div className="mb-1 h-px bg-white/[0.06]" />

        {/* Answer area — varies by question type */}
        {isSubjective ? (

          <div className="pt-3">
            <div className="rounded border border-white/[0.07] bg-white/[0.02] px-5 py-4">
              <p className="mb-1.5 text-xs font-semibold text-white/70">Write your answers on paper</p>
              <p className="text-xs leading-relaxed text-white/35">
                Write your answers neatly. Evaluation will be available after submission.
              </p>
            </div>
          </div>

        ) : isNumerical ? (

          <div className="pt-3">
            <NumericalKeypad value={numericalAnswer} onChange={onNumericalChange} />
          </div>

        ) : (

          <ul className="space-y-0.5">
            {question.options.map((opt, i) => (
              <OptionRow
                key={i}
                index={i}
                text={opt}
                selected={selectedOption === i}
                onSelect={() => onSelect(i)}
              />
            ))}
          </ul>

        )}

      </div>

      {/* ── Action bar ── */}
      {isSubjective ? (

        /* Subjective: just prev / next, no save or mark */
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-white/[0.07] bg-[#0b0e14] px-6 py-3">
          <button
            onClick={onPrevious}
            disabled={!hasPrevious}
            className="cursor-pointer rounded border border-white/[0.09] px-3 py-1.5 text-xs text-white/40 transition-colors hover:border-white/20 hover:text-white/75 disabled:cursor-not-allowed disabled:opacity-25"
          >
            ← Previous
          </button>
          <button
            onClick={onSaveAndNext}
            disabled={!hasNext}
            className="cursor-pointer rounded border border-white/[0.09] px-4 py-1.5 text-xs text-white/40 transition-colors hover:border-white/20 hover:text-white/75 disabled:cursor-not-allowed disabled:opacity-25"
          >
            Next →
          </button>
        </div>

      ) : (

        /* Objective: clear + mark + save */
        <div className="flex shrink-0 items-center justify-between border-t border-white/[0.07] bg-[#0b0e14] px-6 py-3">
          <button
            onClick={onClear}
            disabled={!hasResponse}
            className="cursor-pointer text-xs text-white/35 underline-offset-2 transition-colors hover:text-white/70 disabled:cursor-not-allowed disabled:opacity-30 hover:underline"
          >
            Clear Response
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onPrevious}
              disabled={!hasPrevious}
              className="cursor-pointer rounded border border-white/[0.09] px-3 py-1.5 text-xs text-white/40 transition-colors hover:border-white/20 hover:text-white/75 disabled:cursor-not-allowed disabled:opacity-25"
            >
              ← Previous
            </button>
            <button
              onClick={onMarkAndNext}
              className={[
                'cursor-pointer rounded border px-3 py-1.5 text-xs transition-colors',
                isMarked
                  ? 'border-[#8762F7]/40 bg-[#8762F7]/15 text-[#8762F7] hover:bg-[#8762F7]/22'
                  : 'border-white/[0.09] text-white/40 hover:border-white/20 hover:text-white/75',
              ].join(' ')}
            >
              Mark for Review &amp; Next
            </button>
            <button
              onClick={onSaveAndNext}
              disabled={!hasNext}
              className="cursor-pointer rounded border border-[#16a34a]/35 bg-[#16a34a]/12 px-4 py-1.5 text-xs font-medium text-[#16a34a] transition-colors hover:bg-[#16a34a]/22 disabled:cursor-not-allowed disabled:opacity-25"
            >
              Save &amp; Next →
            </button>
          </div>
        </div>

      )}
    </div>
  );
}
