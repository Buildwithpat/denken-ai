'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams }  from 'next/navigation';
import { ArrowLeft, Sparkles, RefreshCw, Check } from 'lucide-react';
import { useOnboarding }       from '@/context/OnboardingContext';
import { chapters as CHAPTERS } from '@/data/chapters';
import type { ExamType }       from '@/context/OnboardingContext';
import { fetchNotes, mapAiResponseToNoteContent } from '@/lib/notesApi';
import type { NotesRequest } from '@/lib/notesApi';

/* ─── Types ──────────────────────────────────────────────────────────────── */

type NoteType = string;
type Depth    = 'Short' | 'Medium' | 'Detailed';

interface ConceptEntry    { heading: string; body: string }
interface QAItem          { q: string; a: string }

interface StructuredTheory {
  concepts:     string[];
  explanations: ConceptEntry[];
  mistakes:     string[];
}

interface StructuredFormula {
  name:        string;
  formula:     string;
  description: string;
}

interface NoteContent {
  type:      NoteType;
  depth:     Depth;
  theory?:   StructuredTheory;
  formulas?: StructuredFormula[];
  points?:   string[];
  qa?:       QAItem[];
}

/* ─── Static config ──────────────────────────────────────────────────────── */

const NOTE_TYPES: Record<ExamType, NoteType[]> = {
  jee:    ['Theory Notes', 'Formula Sheet', 'Both'],
  neet:   ['Theory Notes', 'Formula Sheet', 'Both'],
  cbse:   ['Theory Notes', 'Key Points', 'Important Questions'],
  custom: ['Theory Only'],
};

const DEPTHS: Depth[] = ['Short', 'Medium', 'Detailed'];

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function getSubjects(examType: ExamType | null, userSubjects: string[]): string[] {
  if (examType === 'jee')  return Object.keys(CHAPTERS.JEE);
  if (examType === 'neet') return Object.keys(CHAPTERS.NEET);
  return userSubjects.filter(Boolean);
}

function getChapters(examType: ExamType | null, subject: string): string[] {
  if (examType === 'jee') {
    const d = (CHAPTERS.JEE as Record<string, Record<string, string[]>>)[subject];
    return d ? [...(d['11'] ?? []), ...(d['12'] ?? [])] : [];
  }
  if (examType === 'neet') {
    const d = (CHAPTERS.NEET as Record<string, Record<string, string[]>>)[subject];
    return d ? [...(d['11'] ?? []), ...(d['12'] ?? [])] : [];
  }
  return [];
}

/* ─── Mock data generators ───────────────────────────────────────────────── */

const DEPTH_IDX: Record<Depth, number> = { Short: 0, Medium: 1, Detailed: 2 };

function mockStructuredTheory(chapter: string, depth: Depth): StructuredTheory {
  const i = DEPTH_IDX[depth];

  const allConcepts = [
    `Definition and fundamental scope of ${chapter}`,
    `Core laws and principles that govern ${chapter}`,
    `Mathematical representation and key variables`,
    `Physical intuition and real-world context`,
    `Relationship to adjacent topics in the syllabus`,
    `Historical development and landmark experiments`,
    `Dimensional analysis and SI unit conventions`,
  ];

  const allExplanations: ConceptEntry[] = [
    {
      heading: 'Core Principle',
      body: `${chapter} rests on the insight that measurable quantities follow predictable patterns under defined conditions. The primary goal is to model these patterns mathematically so that unknown values can be derived from known ones.`,
    },
    {
      heading: 'Mechanism and Process',
      body: `The underlying mechanism involves a chain of cause and effect that can be tracked quantitatively. Understanding why things happen in ${chapter}, not merely that they happen, is what separates strong problem-solvers from rote learners.`,
    },
    {
      heading: 'Mathematical Framework',
      body: `The formal treatment begins with one or two foundational equations. From these, all other results in ${chapter} can be derived through algebraic manipulation, differentiation, or integration depending on the specific scenario.`,
    },
    {
      heading: 'Exam-Relevant Applications',
      body: `In competitive exams, ${chapter} frequently appears in multi-step questions that combine it with adjacent topics. Recognising which concept applies, and when to switch, is the key differentiator between a good and a great score.`,
    },
  ];

  const allMistakes = [
    `Confusing sign conventions: always define a positive direction before writing equations`,
    `Applying a formula outside its stated range or conditions`,
    `Skipping dimensional verification before substituting numerical values`,
    `Mixing SI and CGS units within a single calculation`,
    `Overlooking edge cases where standard approximations fail`,
  ];

  return {
    concepts:     allConcepts.slice(0, [3, 5, 7][i]),
    explanations: allExplanations.slice(0, [1, 2, 4][i]),
    mistakes:     allMistakes.slice(0, [2, 3, 5][i]),
  };
}

function mockStructuredFormulas(chapter: string, depth: Depth): StructuredFormula[] {
  const i = DEPTH_IDX[depth];

  const all: StructuredFormula[] = [
    {
      name:        'Primary Relation',
      formula:     'A = B · C',
      description: `Core identity for ${chapter}. Apply under standard conditions; verify assumptions first.`,
    },
    {
      name:        'Kinematic Form',
      formula:     'x = x₀ + v₀t + ½at²',
      description: 'Valid under uniform acceleration. Connects displacement, initial velocity, and time.',
    },
    {
      name:        'Energy Expression',
      formula:     'E = ½mv²',
      description: 'Kinetic energy analogue. Note the quadratic dependence on velocity: doubling speed quadruples energy.',
    },
    {
      name:        'Equilibrium Condition',
      formula:     'Σ F = 0',
      description: 'Steady-state condition. Often used to derive unknown forces in static systems.',
    },
    {
      name:        'Rate Form',
      formula:     'dQ/dt = −kA (dT/dx)',
      description: 'Rate-dependent phenomena. The negative sign indicates flow opposite to the gradient.',
    },
    {
      name:        'Dimensional Identity',
      formula:     '[A] = M¹ L² T⁻²',
      description: 'Always verify this before finalising an answer. Catches unit errors instantly.',
    },
    {
      name:        'Efficiency Ratio',
      formula:     'η = W_out / W_in',
      description: 'Dimensionless quantity bounded 0 – 1. Useful for evaluating real-world system performance.',
    },
  ];

  return all.slice(0, [3, 5, 7][i]);
}

function mockPoints(chapter: string): string[] {
  return [
    `${chapter} was developed to explain phenomena that earlier theories could not account for.`,
    'State every definition with all its conditions. Partial definitions lose marks in board exams.',
    'Draw labelled diagrams wherever relevant; they carry independent marks.',
    'Learn at least two real-world applications for every major concept.',
    'NCERT examples and exercises are the primary source for 1–2 mark questions.',
    'Numerical problems from this chapter follow a standard two-step approach.',
    'Write SI units explicitly in every final answer.',
  ];
}

function mockQA(chapter: string): QAItem[] {
  return [
    {
      q: `Define the fundamental quantity studied in ${chapter}. State its SI unit.`,
      a: `It is defined as [concise one-sentence definition]. Its SI unit is [unit name] represented by the symbol [symbol].`,
    },
    {
      q: `State and explain the primary law governing ${chapter}.`,
      a: `The law states that [statement]. This means [explanation in student-friendly language]. It holds when [conditions].`,
    },
    {
      q: `Derive the expression for the key formula used in ${chapter}.`,
      a: `Starting from first principles, consider [initial setup]. Applying [law], we get [intermediate step]. Simplifying yields [formula].`,
    },
    {
      q: `Give two applications of ${chapter} in everyday life.`,
      a: `(i) [Application 1] — [brief explanation]. (ii) [Application 2] — [brief explanation].`,
    },
  ];
}

function generateNotesMock(chapter: string, type: NoteType, depth: Depth): NoteContent {
  switch (type) {
    case 'Theory Notes':
    case 'Theory Only':
      return { type, depth, theory: mockStructuredTheory(chapter, depth) };
    case 'Formula Sheet':
      return { type, depth, formulas: mockStructuredFormulas(chapter, depth) };
    case 'Both':
      return { type, depth, theory: mockStructuredTheory(chapter, depth), formulas: mockStructuredFormulas(chapter, depth) };
    case 'Key Points':
      return { type, depth, points: mockPoints(chapter) };
    case 'Important Questions':
      return { type, depth, qa: mockQA(chapter) };
    default:
      return { type, depth, theory: mockStructuredTheory(chapter, depth) };
  }
}

/* ─── API mode helpers ───────────────────────────────────────────────────── */

function toAiMode(noteType: NoteType): NotesRequest['mode'] {
  const l = noteType.toLowerCase();
  if (l.includes('formula')) return 'formula';
  if (l.includes('both'))    return 'both';
  return 'theory';
}

function toAiDepth(depth: Depth): NotesRequest['depth'] {
  if (depth === 'Short')    return 'short';
  if (depth === 'Detailed') return 'detailed';
  return 'medium';
}

function toAiExam(examType: ExamType): string {
  if (examType === 'jee')  return 'JEE_MAIN';
  if (examType === 'neet') return 'NEET';
  if (examType === 'cbse') return 'CBSE';
  return 'JEE_MAIN';
}

/* ─── Render blocks ──────────────────────────────────────────────────────── */

function ConceptsBlock({ concepts }: { concepts: string[] }) {
  return (
    <div>
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-white/25">
        Key Concepts
      </p>
      <ul className="space-y-2">
        {concepts.map((c, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm text-white/70">
            <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#8762F7]/50" />
            {c}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ExplanationsBlock({ explanations }: { explanations: ConceptEntry[] }) {
  return (
    <div className="space-y-4">
      {explanations.map(({ heading, body }) => (
        <div key={heading}>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/25">
            {heading}
          </p>
          <p className="text-sm leading-[1.8] text-white/65">{body}</p>
        </div>
      ))}
    </div>
  );
}

function MistakesBlock({ mistakes }: { mistakes: string[] }) {
  return (
    <div>
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-white/25">
        Common Mistakes
      </p>
      <ul className="space-y-2">
        {mistakes.map((m, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm text-[#ef4444]/70">
            <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#ef4444]/50" />
            {m}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StructuredTheoryBlock({ theory }: { theory: StructuredTheory }) {
  return (
    <div className="space-y-6">
      <ConceptsBlock concepts={theory.concepts} />
      {theory.explanations.length > 0 && (
        <div className="border-t border-white/[0.05] pt-5">
          <ExplanationsBlock explanations={theory.explanations} />
        </div>
      )}
      <div className="border-t border-white/[0.05] pt-5">
        <MistakesBlock mistakes={theory.mistakes} />
      </div>
    </div>
  );
}

function StructuredFormulaBlock({ formulas }: { formulas: StructuredFormula[] }) {
  return (
    <div>
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-white/25">
        Formula Sheet
      </p>
      <div className="space-y-2.5">
        {formulas.map(({ name, formula, description }) => (
          <div
            key={name}
            className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-4 py-3"
          >
            <div className="mb-1.5 flex items-center justify-between gap-4">
              <span className="text-[11px] font-medium text-white/35">{name}</span>
              <code className="font-mono text-sm font-semibold text-white/90">{formula}</code>
            </div>
            <p className="text-[11px] leading-relaxed text-white/40">{description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PointsBlock({ points }: { points: string[] }) {
  return (
    <div>
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-white/25">
        Key Points
      </p>
      <ul className="space-y-2.5">
        {points.map((p, i) => (
          <li key={i} className="flex items-start gap-3 text-sm text-white/70">
            <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#8762F7]/60" />
            {p}
          </li>
        ))}
      </ul>
    </div>
  );
}

function QABlock({ items }: { items: QAItem[] }) {
  return (
    <div className="space-y-4">
      {items.map(({ q, a }, i) => (
        <div key={i} className="rounded border border-white/[0.07] bg-white/[0.02] px-4 py-4">
          <p className="mb-2 text-xs font-semibold text-white/55">
            <span className="mr-1.5 text-[#8762F7]/70">Q{i + 1}.</span>{q}
          </p>
          <p className="text-xs leading-relaxed text-white/40">
            <span className="mr-1 font-medium text-white/30">Ans.</span>{a}
          </p>
        </div>
      ))}
    </div>
  );
}

/* ─── Notes output ───────────────────────────────────────────────────────── */

interface NotesOutputProps {
  content:       NoteContent;
  subject:       string;
  chapter:       string;
  marked:        boolean;
  generatedBy:   'ai' | 'mock' | null;
  onRegenerate:  () => void;
  onMarkRevised: () => void;
}

function NotesOutput({ content, subject, chapter, marked, generatedBy, onRegenerate, onMarkRevised }: NotesOutputProps) {
  return (
    <div>
      {/* Header row */}
      <div className="mb-5 border-b border-white/[0.07] pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/20">
                {content.type}
              </p>
              <span className="rounded-full border border-white/[0.07] px-2 py-0.5 text-[10px] text-white/25">
                {content.depth}
              </span>
              {generatedBy === 'ai' && (
                <span className="rounded-full border border-[#8762F7]/25 bg-[#8762F7]/[0.07] px-2 py-0.5 text-[10px] text-[#8762F7]/70">
                  AI
                </span>
              )}
            </div>
            <h2 className="text-base font-semibold text-white">{chapter}</h2>
            <p className="mt-0.5 text-xs text-white/35">{subject}</p>
          </div>

          {/* Action buttons */}
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={onRegenerate}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 py-1.5 text-[11px] text-white/40 transition-colors hover:border-white/[0.15] hover:text-white/70"
            >
              <RefreshCw size={10} />
              Regenerate
            </button>
            <button
              onClick={onMarkRevised}
              className={[
                'flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] transition-colors',
                marked
                  ? 'border-[#22c55e]/30 bg-[#22c55e]/[0.08] text-[#22c55e]'
                  : 'border-white/[0.08] text-white/40 hover:border-white/[0.15] hover:text-white/70',
              ].join(' ')}
            >
              <Check size={10} />
              {marked ? 'Revised' : 'Mark Revised'}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-8">
        {content.theory   && <StructuredTheoryBlock   theory={content.theory}     />}
        {content.formulas && (
          <div className={content.theory ? 'border-t border-white/[0.05] pt-6' : ''}>
            <StructuredFormulaBlock formulas={content.formulas} />
          </div>
        )}
        {content.points   && <PointsBlock   points={content.points} />}
        {content.qa       && <QABlock       items={content.qa}      />}
      </div>
    </div>
  );
}

function BookPlaceholder() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="text-white/10">
      <rect x="6" y="5" width="24" height="30" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 9h24" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 15h16M12 20h16M12 25h10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

/* ─── Client component ───────────────────────────────────────────────────── */

export default function NotesContent() {
  const router           = useRouter();
  const searchParams     = useSearchParams();
  const { data, loaded } = useOnboarding();

  const examType = (data.examType ?? 'jee') as ExamType;
  const subjects  = getSubjects(data.examType, data.subjects);
  const types     = NOTE_TYPES[examType];

  const [subject,     setSubject]     = useState('');
  const [chapter,     setChapter]     = useState('');
  const [noteType,    setNoteType]    = useState(types[0]);
  const [depth,       setDepth]       = useState<Depth>('Short');
  const [content,     setContent]     = useState<NoteContent | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [marked,      setMarked]      = useState(false);
  const [generatedBy, setGeneratedBy] = useState<'ai' | 'mock' | null>(null);

  /* Prevents the subject-change effect from wiping the chapter when pre-filling from params */
  const skipChapterReset = useRef(false);

  /* Reset chapter when subject changes (skip on initial param pre-fill) */
  useEffect(() => {
    if (skipChapterReset.current) { skipChapterReset.current = false; return; }
    setChapter('');
    setContent(null);
    setMarked(false);
  }, [subject]);

  /* Reset type list when exam changes */
  useEffect(() => { setNoteType(types[0]); setContent(null); setMarked(false); }, [examType]);

  /* Re-generate instantly when note type or depth switches (only if content already exists) */
  useEffect(() => {
    if (!subject || !chapter || content === null) return;
    void callGenerateApi(chapter, noteType, depth);
    setMarked(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteType]);

  useEffect(() => {
    if (!subject || !chapter || content === null) return;
    void callGenerateApi(chapter, noteType, depth);
    setMarked(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depth]);

  /* Pre-fill from roadmap query params and auto-generate */
  useEffect(() => {
    if (!loaded) return;
    const paramSubject = searchParams.get('subject');
    const paramChapter = searchParams.get('chapter');
    if (!paramSubject || !paramChapter) return;

    skipChapterReset.current = true;
    setSubject(paramSubject);
    setChapter(paramChapter);
    setNoteType('Theory Notes');
    setDepth('Short');
    setContent(null);
    setMarked(false);
    void callGenerateApi(paramChapter, 'Theory Notes', 'Short');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const chapters = getChapters(data.examType, subject);

  async function callGenerateApi(chap: string, type: NoteType, d: Depth) {
    setLoading(true);
    setContent(null);
    try {
      const res = await fetchNotes({
        topic:   chap,
        subject,
        exam:    toAiExam(examType),
        depth:   toAiDepth(d),
        mode:    toAiMode(type),
      });
      setContent(mapAiResponseToNoteContent(res, type, d) as NoteContent);
      setGeneratedBy('ai');
    } catch {
      setContent(generateNotesMock(chap, type, d));
      setGeneratedBy('mock');
    } finally {
      setLoading(false);
    }
  }

  function handleGenerate() {
    if (!subject || !chapter) return;
    setMarked(false);
    void callGenerateApi(chapter, noteType, depth);
  }

  if (!loaded) return null;

  return (
    <div className="mx-auto max-w-7xl px-6 py-6">

      {/* ── Header ── */}
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="flex cursor-pointer items-center gap-1.5 text-white/40 transition-colors hover:text-white/80"
        >
          <ArrowLeft size={14} />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-white">Smart Notes</h1>
          <p className="mt-0.5 text-sm text-white/40">
            AI-generated notes tailored to your exam
          </p>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">

        {/* ── Config panel ── */}
        <div className="space-y-5 rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">

          {/* Subject */}
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-white/25">
              Subject
            </label>
            <select
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full cursor-pointer rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-white/70 outline-none transition-colors hover:border-white/15 focus:border-[#8762F7]/40"
            >
              <option value="" disabled className="bg-[#0d1019] text-white/40">
                Select subject
              </option>
              {subjects.map(s => (
                <option key={s} value={s} className="bg-[#0d1019] text-white/80">
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Chapter */}
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-white/25">
              Chapter
            </label>
            <select
              value={chapter}
              onChange={e => setChapter(e.target.value)}
              disabled={!subject || chapters.length === 0}
              className="w-full cursor-pointer rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-white/70 outline-none transition-colors hover:border-white/15 focus:border-[#8762F7]/40 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <option value="" disabled className="bg-[#0d1019] text-white/40">
                {subject ? 'Select chapter' : 'Select subject first'}
              </option>
              {chapters.map(c => (
                <option key={c} value={c} className="bg-[#0d1019] text-white/80">
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Note type */}
          <div>
            <label className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-white/25">
              Note Type
            </label>
            <div className="space-y-1.5">
              {types.map(t => (
                <label
                  key={t}
                  onClick={() => setNoteType(t)}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 transition-colors hover:bg-white/[0.03]"
                >
                  <span className={[
                    'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border transition-colors',
                    noteType === t ? 'border-[#8762F7] bg-[#8762F7]' : 'border-white/20',
                  ].join(' ')}>
                    {noteType === t && <span className="h-[5px] w-[5px] rounded-full bg-white" />}
                  </span>
                  <span className={[
                    'text-xs transition-colors',
                    noteType === t ? 'text-white/85' : 'text-white/45',
                  ].join(' ')}>
                    {t}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Depth */}
          <div>
            <label className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-white/25">
              Depth
            </label>
            <div className="flex gap-1.5">
              {DEPTHS.map(d => (
                <button
                  key={d}
                  onClick={() => setDepth(d)}
                  className={[
                    'flex-1 cursor-pointer rounded-lg border py-1.5 text-[11px] font-medium transition-all duration-150',
                    depth === d
                      ? 'border-[#8762F7]/40 bg-[#8762F7]/[0.12] text-[#8762F7]'
                      : 'border-white/[0.08] text-white/35 hover:border-white/[0.15] hover:text-white/60',
                  ].join(' ')}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* CTA */}
          <button
            onClick={handleGenerate}
            disabled={!subject || !chapter || loading}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#8762F7] to-[#6D4AFF] py-2.5 text-xs font-semibold text-white transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Sparkles size={13} />
            {loading ? 'Generating…' : 'Generate Notes'}
          </button>

        </div>

        {/* ── Output panel ── */}
        <div className="min-h-[400px] rounded-xl border border-white/[0.07] bg-white/[0.02] p-6">
          {loading ? (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <Sparkles size={20} className="animate-pulse text-[#8762F7]/50" />
              <p className="text-xs text-white/25">Generating notes…</p>
            </div>
          ) : content ? (
            <NotesOutput
              content={content}
              subject={subject}
              chapter={chapter}
              marked={marked}
              generatedBy={generatedBy}
              onRegenerate={handleGenerate}
              onMarkRevised={() => setMarked(m => !m)}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <BookPlaceholder />
              <p className="text-xs text-white/25">
                Select a subject, chapter, and note type, then click Generate Notes.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
