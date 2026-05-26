'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams }    from 'next/navigation';
import { ArrowLeft, ChevronRight, BookOpen, FlaskConical, AlertTriangle } from 'lucide-react';
import { useTestConfig }       from '@/context/TestContext';
import { fetchFormulaChapter } from '@/lib/formulaApi';
import type { ChapterDetail, ConceptDetail, FormulaDetail } from '@/types/formula';

// ── Accordion ─────────────────────────────────────────────────────────────────

function Accordion({
  title, isOpen, onToggle, children,
}: {
  title: string; isOpen: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-white/[0.07] bg-white/[0.02]">
      <button
        onClick={onToggle}
        className="flex w-full cursor-pointer items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-white/[0.02]"
      >
        <span className="text-xs font-semibold text-white/75">{title}</span>
        <ChevronRight
          size={13}
          className={`shrink-0 text-white/30 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
        />
      </button>
      {isOpen && (
        <div className="border-t border-white/[0.06] px-4 py-4">
          {children}
        </div>
      )}
    </div>
  );
}

// ── Formula card ──────────────────────────────────────────────────────────────

function FormulaCard({ formula }: { formula: FormulaDetail }) {
  const [expanded, setExpanded] = useState(false);
  const hasExtra = formula.applications.length > 0 || formula.commonMistakes.length > 0
    || formula.conditions.length > 0 || Object.keys(formula.variables).length > 0;

  return (
    <div className="rounded-lg border border-white/[0.07] bg-white/[0.02]">
      {/* Main row */}
      <div className="flex items-start justify-between gap-4 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-white/60">{formula.name}</p>
          {formula.meaning && (
            <p className="mt-0.5 text-[10px] leading-relaxed text-white/30">{formula.meaning}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <code className="rounded bg-[#8762F7]/12 px-2.5 py-1 font-mono text-[12px] font-semibold text-[#8762F7]/85">
            {formula.equation}
          </code>
          {hasExtra && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="cursor-pointer rounded p-0.5 text-white/20 transition-colors hover:text-white/50"
            >
              <ChevronRight size={12} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && hasExtra && (
        <div className="space-y-3 border-t border-white/[0.05] px-4 py-3">
          {Object.keys(formula.variables).length > 0 && (
            <div>
              <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-widest text-white/20">
                Variables
              </p>
              <div className="space-y-1">
                {Object.entries(formula.variables).map(([sym, v]) => (
                  <div key={sym} className="flex items-baseline gap-1.5 text-[10px]">
                    <code className="shrink-0 font-mono text-[#8762F7]/70">{sym}</code>
                    <span className="text-white/35">=</span>
                    <span className="text-white/45">{v.meaning}</span>
                    {v.unit && <span className="text-white/25">({v.unit})</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {formula.conditions.length > 0 && (
            <div>
              <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-widest text-white/20">
                Conditions
              </p>
              {formula.conditions.map((c, i) => (
                <p key={i} className="text-[10px] text-white/40">{c}</p>
              ))}
            </div>
          )}
          {formula.applications.length > 0 && (
            <div>
              <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-widest text-white/20">
                Applications
              </p>
              <ul className="space-y-1">
                {formula.applications.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-[10px] text-white/40">
                    <span className="mt-[4px] h-1 w-1 shrink-0 rounded-full bg-[#8762F7]/40" />
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {formula.commonMistakes.length > 0 && (
            <div>
              <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-widest text-white/20">
                Common Mistakes
              </p>
              <ul className="space-y-1">
                {formula.commonMistakes.map((m, i) => (
                  <li key={i} className="flex items-start gap-2 text-[10px] text-[#ef4444]/60">
                    <span className="mt-[4px] h-1 w-1 shrink-0 rounded-full bg-[#ef4444]/40" />
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Concept group ─────────────────────────────────────────────────────────────

function ConceptGroup({
  concept, isOpen, onToggle,
}: { concept: ConceptDetail; isOpen: boolean; onToggle: () => void }) {
  return (
    <Accordion
      title={`${concept.conceptName}${concept.description ? ` — ${concept.description}` : ''}`}
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <div className="space-y-2">
        {concept.formulas.map(f => (
          <FormulaCard key={f.formulaId} formula={f} />
        ))}
      </div>
    </Accordion>
  );
}

// ── Skeleton loader ───────────────────────────────────────────────────────────

function SkeletonSection() {
  return (
    <div className="animate-pulse space-y-2">
      {[1, 2, 3].map(i => (
        <div key={i} className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-4 py-3.5">
          <div className="flex items-center justify-between">
            <div className="h-3 w-1/3 rounded bg-white/[0.04]" />
            <div className="h-3 w-1/4 rounded bg-[#8762F7]/10" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Empty / not-in-dataset state ──────────────────────────────────────────────

function NoDataState({ chapter, onGoNotes }: { chapter: string; onGoNotes: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.07] bg-white/[0.03]">
        <FlaskConical size={18} className="text-white/20" />
      </div>
      <p className="text-sm font-semibold text-white/50">Formula sheet not ready yet</p>
      <p className="mt-2 max-w-[280px] text-[11px] leading-relaxed text-white/25">
        The formula dataset for <span className="text-white/40">{chapter}</span> is being prepared.
        Use Smart Notes for AI-generated content in the meantime.
      </p>
      <button
        onClick={onGoNotes}
        className="mt-5 rounded-lg bg-[#8762F7]/15 px-4 py-2 text-xs font-semibold text-[#8762F7] transition-colors hover:bg-[#8762F7]/25"
      >
        Open Smart Notes
      </button>
    </div>
  );
}

// ── Theory tab ────────────────────────────────────────────────────────────────

function TheoryTab({ chapter }: { chapter: ChapterDetail }) {
  const router = useRouter();

  if (
    chapter.importantNotes.length === 0 &&
    chapter.jeeAdvancedFocus.length === 0 &&
    chapter.neetFocus.length === 0 &&
    chapter.commonMistakes.length === 0
  ) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <BookOpen size={28} className="mb-3 text-white/15" />
        <p className="text-xs text-white/30">
          No theory notes in the dataset yet.
          <button
            onClick={() => router.push(`/revision/notes?subject=${chapter.subjectName}&chapter=${encodeURIComponent(chapter.chapterName)}`)}
            className="ml-1 text-[#8762F7]/70 underline underline-offset-2 hover:text-[#8762F7]"
          >
            Generate with AI
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {chapter.importantNotes.length > 0 && (
        <div>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-white/20">
            Important Notes
          </p>
          <ul className="space-y-2">
            {chapter.importantNotes.map((note, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#8762F7]/45" />
                <span className="text-xs leading-relaxed text-white/55">{note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {chapter.commonMistakes.length > 0 && (
        <div className="border-t border-white/[0.05] pt-4">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-white/20">
            Common Mistakes
          </p>
          <ul className="space-y-2">
            {chapter.commonMistakes.map((m, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <AlertTriangle size={10} className="mt-[3px] shrink-0 text-amber-400/60" />
                <span className="text-xs leading-relaxed text-white/50">{m}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {chapter.jeeAdvancedFocus.length > 0 && (
        <div className="border-t border-white/[0.05] pt-4">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-white/20">
            JEE Advanced Focus
          </p>
          <ul className="space-y-1.5">
            {chapter.jeeAdvancedFocus.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-[11px] text-white/45">
                <span className="mt-[4px] h-1 w-1 shrink-0 rounded-full bg-[#8762F7]/50" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {chapter.neetFocus.length > 0 && (
        <div className="border-t border-white/[0.05] pt-4">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-white/20">
            NEET Focus Areas
          </p>
          <ul className="space-y-1.5">
            {chapter.neetFocus.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-[11px] text-white/45">
                <span className="mt-[4px] h-1 w-1 shrink-0 rounded-full bg-[#22c55e]/50" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Formula tab ───────────────────────────────────────────────────────────────

function FormulaTab({ chapter }: { chapter: ChapterDetail }) {
  const [openConcept, setOpenConcept] = useState<string | null>(
    chapter.concepts[0]?.conceptId ?? null,
  );

  function toggle(id: string) {
    setOpenConcept(prev => (prev === id ? null : id));
  }

  return (
    <div className="space-y-2">
      {chapter.concepts.map(c => (
        <ConceptGroup
          key={c.conceptId}
          concept={c}
          isOpen={openConcept === c.conceptId}
          onToggle={() => toggle(c.conceptId)}
        />
      ))}
    </div>
  );
}

// ── Inner page (reads search params) ─────────────────────────────────────────

type Tab = 'theory' | 'formula';

function FormulaRevisionInner() {
  const { testConfig } = useTestConfig();
  const router         = useRouter();
  const searchParams   = useSearchParams();

  // URL params take priority (set by FormulaPracticePanel)
  const subjectSlug  = searchParams.get('sub')  ?? '';
  const chapterSlug  = searchParams.get('ch')   ?? '';

  // Fall back to testConfig for backwards compat
  const displayChapter = testConfig.chapter || testConfig.subject || 'General';
  const displaySubject = testConfig.subject || 'Physics';
  const totalTime      = (testConfig.time > 0 ? testConfig.time : 15) * 60;

  const [tab,         setTab]         = useState<Tab>('formula');
  const [timeLeft,    setTimeLeft]    = useState(totalTime);
  const [chapter,     setChapter]     = useState<ChapterDetail | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [notFound,    setNotFound]    = useState(false);

  // Fetch chapter data
  useEffect(() => {
    if (!subjectSlug || !chapterSlug) {
      setLoading(false);
      setNotFound(true);
      return;
    }
    setLoading(true);
    setNotFound(false);
    fetchFormulaChapter(subjectSlug, chapterSlug)
      .then(data => { setChapter(data); setTab(data.formulaCount > 0 ? 'formula' : 'theory'); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [subjectSlug, chapterSlug]);

  // Countdown
  useEffect(() => {
    const id = setInterval(() => setTimeLeft(t => Math.max(0, t - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  const progress  = timeLeft / totalTime;
  const minsLeft  = Math.ceil(timeLeft / 60);
  const chName    = chapter?.chapterName ?? displayChapter;
  const subName   = chapter?.subjectName ?? displaySubject;

  function barColor() {
    if (progress > 0.5) return 'bg-[#8762F7]';
    if (progress > 0.2) return 'bg-amber-400';
    return 'bg-[#ef4444]';
  }

  function goToNotes() {
    router.push(
      `/revision/notes?subject=${encodeURIComponent(subName)}&chapter=${encodeURIComponent(chName)}`,
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-6">

      {/* Progress bar */}
      <div className="mb-6">
        <div className="h-[3px] w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${barColor()}`}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          <span className="text-[10px] text-white/25">{chName}</span>
          <span className={`text-[10px] tabular-nums ${progress < 0.2 ? 'text-[#ef4444]/70' : 'text-white/25'}`}>
            {minsLeft} min left
          </span>
        </div>
      </div>

      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="flex cursor-pointer items-center gap-1.5 text-white/40 transition-colors hover:text-white/80"
        >
          <ArrowLeft size={13} />
          <span className="text-xs">Back</span>
        </button>
        <h1 className="mt-3 text-xl font-semibold text-white">{chName}</h1>
        <div className="mt-1 flex items-center gap-3">
          <p className="text-sm text-white/35">{subName}</p>
          {chapter && (
            <span className="text-[10px] text-white/20">
              {chapter.formulaCount} formula{chapter.formulaCount !== 1 ? 's' : ''}
              {' · '}
              {chapter.conceptCount} concept{chapter.conceptCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex border-b border-white/[0.07]">
        {(['formula', 'theory'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              'cursor-pointer px-4 py-2.5 text-xs font-medium transition-colors',
              tab === t
                ? '-mb-px border-b-2 border-[#8762F7] text-white/90'
                : 'text-white/35 hover:text-white/65',
            ].join(' ')}
          >
            {t === 'formula' ? 'Formula Sheet' : 'Theory Notes'}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <SkeletonSection />
      ) : notFound || !chapter ? (
        <NoDataState chapter={chName} onGoNotes={goToNotes} />
      ) : tab === 'formula' ? (
        chapter.formulaCount > 0
          ? <FormulaTab chapter={chapter} />
          : <NoDataState chapter={chName} onGoNotes={goToNotes} />
      ) : (
        <TheoryTab chapter={chapter} />
      )}

    </div>
  );
}

// ── Page (wraps with Suspense for useSearchParams) ────────────────────────────

export default function FormulaRevisionPage() {
  return (
    <Suspense>
      <FormulaRevisionInner />
    </Suspense>
  );
}
