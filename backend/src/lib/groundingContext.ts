/**
 * Grounding Context Builder
 *
 * Assembles a structured "grounding package" that is injected into Gemini
 * prompts before generation. Combines:
 *  - PYQ examples (style, depth, wording, difficulty distribution)
 *  - Formula snippets from the formula dataset (prevents hallucination)
 *  - Syllabus context (unit/chapter list for the exam)
 *  - Exam-specific style guidance
 *
 * The context is intentionally compact — we target a ~800–1200 token budget
 * to avoid drowning Gemini in context while still providing meaningful grounding.
 */

import { getRepresentativePYQs, getMultiChapterPYQs, formatPYQsForPrompt, type PYQSlim } from './pyqRetrieval';
import { extractFormulaStrings, findChapterByName }  from './formulaLoader';
import { getTopics }                                  from './syllabusLoader';
import { getChapterIntelligence, formatIntelligenceForPrompt, type ImportantChapter } from './importantTopicsLoader';
import { logger }                                     from './logger';
import type { ExamKey }                               from '../types';

// ── Exam style notes ──────────────────────────────────────────────────────────

const EXAM_STYLE: Record<string, string> = {
  JEE_MAIN: [
    'Question style: Single Correct MCQ (1 mark) + Numerical Answer Type (integer/decimal).',
    'Depth: Balanced conceptual understanding and numerical application.',
    'Wording: Clear, precise, standard NCERT-plus difficulty.',
    'Numericals: Moderate calculations with real physical insight.',
    'Concepts: Each question tests one focused concept cleanly.',
    'Difficulty split: ~30% easy, ~50% medium, ~20% hard.',
  ].join(' '),

  JEE_ADVANCED: [
    'Question style: Multiple Correct MCQ, Paragraph-based sets, Integer type, Matrix-match.',
    'Depth: Deep multi-step conceptual reasoning, often linking 2–3 chapters.',
    'Wording: Dense, nuanced, frequently involves limiting cases or novel scenarios.',
    'Numericals: Complex derivations, elegant mathematical insights expected.',
    'Concepts: Tests understanding at synthesis and evaluation level (Bloom).',
    'Difficulty split: ~10% easy, ~45% medium, ~45% hard.',
  ].join(' '),

  NEET: [
    'Question style: Single Correct MCQ only (4 options, 1 correct).',
    'Depth: NCERT-based factual, conceptual application, and straightforward numericals.',
    'Wording: Direct, unambiguous, often taken from or inspired by NCERT text.',
    'Biology: Factual recall, diagram-based, process questions. No diagrams in prompt.',
    'Physics/Chemistry: Formula-based, standard numerical values, simple calculations.',
    'Difficulty split: ~40% easy, ~45% medium, ~15% hard.',
  ].join(' '),

  CBSE: [
    'Question style: MCQ, Short Answer, Long Answer as per CBSE pattern.',
    'Depth: NCERT-level conceptual and application questions.',
    'Difficulty split: ~35% easy, ~45% medium, ~20% hard.',
  ].join(' '),
};

function getExamStyleNote(exam: string): string {
  return EXAM_STYLE[exam] ?? EXAM_STYLE['JEE_MAIN'];
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GroundingDebugLog {
  buildTimeMs:          number;
  exam:                 string;
  subject:              string;
  chapter:              string;
  topic?:               string;
  pyqsFound:            number;
  pyqsSelected:         number;
  pyqSources:           string[];  // e.g. "NEET 2024 Thermodynamics (hard)"
  formulasFound:        number;
  formulasUsed:         number;
  syllabusMatched:      boolean;
  syllabusUnits:        string[];
  importantTopicFound:  boolean;
  importantTopicPriority?: number;
  importantTopicTags?:  string[];
}

export interface GroundingContext {
  exam:             string;
  subject:          string;
  chapter:          string;
  topic?:           string;
  pyqExamples:      PYQSlim[];
  pyqText:          string;    // formatted for prompt injection
  formulaSnippets:  string[];
  syllabusUnits:    string[];
  examStyleNote:    string;
  chapterIntel?:    ImportantChapter;
  debugLog:         GroundingDebugLog;
}

export interface GroundingParams {
  exam:        string;
  subject:     string;
  chapter:     string;
  topic?:      string;
  pyqLimit?:   number;   // how many PYQ examples to include (default 4)
  formulaLimit?: number; // how many formula strings (default 8)
}

// ── Subject slug normalisation ────────────────────────────────────────────────

const SUBJECT_SLUG: Record<string, string> = {
  physics:     'physics',
  chemistry:   'chemistry',
  mathematics: 'maths',
  maths:       'maths',
  biology:     'biology',
  'bio':       'biology',
};

function subjectSlug(subject: string): string {
  return SUBJECT_SLUG[subject.toLowerCase()] ?? subject.toLowerCase();
}

// ── Exam key normalisation ────────────────────────────────────────────────────

function toPYQExamKey(exam: string): string {
  const map: Record<string, string> = {
    JEE_MAIN:     'JEE_MAIN',
    JEE_ADVANCED: 'JEE_ADVANCED',
    NEET:         'NEET',
  };
  return map[exam.toUpperCase()] ?? exam.toUpperCase();
}

// ── Core builder ──────────────────────────────────────────────────────────────

/**
 * Assemble a GroundingContext for a single chapter/topic combination.
 *
 * This is the primary function called by all generation services before
 * sending a request to Gemini.
 */
export async function buildGroundingContext(params: GroundingParams): Promise<GroundingContext> {
  const t0 = Date.now();
  const {
    exam,
    subject,
    chapter,
    topic,
    pyqLimit   = 4,
    formulaLimit = 8,
  } = params;

  // ── 1. PYQ retrieval ───────────────────────────────────────────────────────
  const pyqResult = getRepresentativePYQs(exam, subject, chapter, topic, pyqLimit);
  const pyqSources = pyqResult.questions.map(q =>
    `${q.exam} ${q.year} ${q.chapter} (${q.difficulty})`
  );

  logger.debug('[groundingContext] PYQ retrieval', {
    exam, subject, chapter, topic,
    matched: pyqResult.debugLog.matchedChapter,
    selected: pyqResult.debugLog.selected,
  });

  // ── 2. Formula retrieval ──────────────────────────────────────────────────
  const slug            = subjectSlug(subject);
  const allFormulas     = extractFormulaStrings(slug, chapter);
  const formulaSnippets = allFormulas.slice(0, formulaLimit);

  logger.debug('[groundingContext] Formula retrieval', {
    subject: slug, chapter,
    totalFormulas: allFormulas.length,
    using: formulaSnippets.length,
  });

  // ── 3. Syllabus context ──────────────────────────────────────────────────
  let syllabusUnits: string[] = [];
  let syllabusMatched = false;

  try {
    const examKey = toPYQExamKey(exam) as ExamKey;
    if (examKey !== 'CBSE') {
      const topics = getTopics(examKey, [subject]);
      // Find topics within this chapter/unit grouping
      const chapterNorm = chapter.toLowerCase();
      const relevant = topics.filter(t =>
        t.topic.toLowerCase().includes(chapterNorm) ||
        chapterNorm.includes(t.topic.toLowerCase())
      );
      syllabusUnits    = relevant.length > 0
        ? relevant.map(t => t.topic).slice(0, 6)
        : topics.filter(t => t.subject.toLowerCase() === subject.toLowerCase()).map(t => t.topic).slice(0, 4);
      syllabusMatched  = relevant.length > 0;
    }
  } catch {
    // non-fatal
  }

  // ── 4. Important-topics intelligence ─────────────────────────────────────
  const chapterIntel = getChapterIntelligence(exam, subject, chapter);

  logger.debug('[groundingContext] Important-topics lookup', {
    exam, subject, chapter,
    found:    !!chapterIntel,
    priority: chapterIntel?.priority,
    tags:     chapterIntel?.tags,
  });

  // ── 5. Assemble ─────────────────────────────────────────────────────────
  const examStyleNote = getExamStyleNote(exam);
  const pyqText       = formatPYQsForPrompt(pyqResult.questions);

  const debugLog: GroundingDebugLog = {
    buildTimeMs:           Date.now() - t0,
    exam,
    subject,
    chapter,
    topic,
    pyqsFound:             pyqResult.debugLog.totalInChapter,
    pyqsSelected:          pyqResult.debugLog.selected,
    pyqSources,
    formulasFound:         allFormulas.length,
    formulasUsed:          formulaSnippets.length,
    syllabusMatched,
    syllabusUnits,
    importantTopicFound:   !!chapterIntel,
    importantTopicPriority: chapterIntel?.priority,
    importantTopicTags:    chapterIntel?.tags,
  };

  return {
    exam,
    subject,
    chapter,
    topic,
    pyqExamples:     pyqResult.questions,
    pyqText,
    formulaSnippets,
    syllabusUnits,
    examStyleNote,
    chapterIntel:    chapterIntel ?? undefined,
    debugLog,
  };
}

/**
 * Serialise a GroundingContext into a compact prompt text block.
 * Returned string is injected before the generation task instruction.
 */
export function serializeForPrompt(ctx: GroundingContext): string {
  const parts: string[] = [];

  parts.push(`=== EXAM STYLE (${ctx.exam}) ===`);
  parts.push(ctx.examStyleNote);
  parts.push('');

  if (ctx.chapterIntel) {
    parts.push('=== CHAPTER STRATEGIC INTELLIGENCE ===');
    parts.push(formatIntelligenceForPrompt(ctx.chapterIntel));
    parts.push('Use this to calibrate question difficulty and emphasis appropriately.');
    parts.push('');
  }

  if (ctx.formulaSnippets.length > 0) {
    parts.push('=== KEY FORMULAS (use these — do not invent others) ===');
    ctx.formulaSnippets.forEach((f, i) => parts.push(`${i + 1}. ${f}`));
    parts.push('');
  }

  if (ctx.syllabusUnits.length > 0) {
    parts.push('=== SYLLABUS CONTEXT ===');
    parts.push(`Subject: ${ctx.subject} | Chapter/Unit: ${ctx.chapter}`);
    if (ctx.topic) parts.push(`Specific topic: ${ctx.topic}`);
    parts.push('Covered units: ' + ctx.syllabusUnits.join(', '));
    parts.push('');
  }

  parts.push('=== REPRESENTATIVE PYQ EXAMPLES (style reference — do NOT copy) ===');
  parts.push(ctx.pyqText);
  parts.push('');

  return parts.join('\n');
}

/**
 * Build grounding contexts for multiple chapters simultaneously.
 * Used for full mock test generation spanning multiple chapters/subjects.
 */
export async function buildMultiChapterGrounding(
  exam:     string,
  subject:  string,
  chapters: string[],
  pyqPerChapter: number = 2,
): Promise<{ combinedContext: string; debugLogs: GroundingDebugLog[] }> {
  const contexts: GroundingContext[] = [];

  for (const chapter of chapters.slice(0, 8)) {
    const ctx = await buildGroundingContext({
      exam, subject, chapter,
      pyqLimit: pyqPerChapter,
      formulaLimit: 4,
    });
    contexts.push(ctx);
  }

  const debugLogs = contexts.map(c => c.debugLog);

  // Merge: combine unique formulas + PYQ examples across chapters
  const allFormulas = [...new Set(contexts.flatMap(c => c.formulaSnippets))].slice(0, 12);
  const allPYQs     = contexts.flatMap(c => c.pyqExamples);
  const examStyleNote = contexts[0]?.examStyleNote ?? getExamStyleNote(exam);

  const parts: string[] = [];
  parts.push(`=== EXAM STYLE (${exam}) ===`);
  parts.push(examStyleNote);
  parts.push('');

  if (allFormulas.length > 0) {
    parts.push('=== KEY FORMULAS (use these — do not invent others) ===');
    allFormulas.forEach((f, i) => parts.push(`${i + 1}. ${f}`));
    parts.push('');
  }

  if (allPYQs.length > 0) {
    parts.push('=== REPRESENTATIVE PYQ EXAMPLES (style reference — do NOT copy) ===');
    parts.push(formatPYQsForPrompt(allPYQs));
    parts.push('');
  }

  return { combinedContext: parts.join('\n'), debugLogs };
}
