/**
 * Important Topics Loader
 *
 * Centralized loader for all three important-topics datasets:
 *   - jee-main.json    → flat `chapters[]` with `subject`, `priorityGroup`, `trend2025`
 *   - jee-advanced.json → nested `topChapters: { Physics: [], Chemistry: [], Mathematics: [] }`
 *   - neet.json         → flat `chapters[]` with `estimatedMarks`, `averageQuestions`
 *
 * All three schemas are normalised into a single `ImportantChapter` interface.
 * The data is loaded once and cached for the process lifetime.
 */

import jeeMainRaw      from '../data/important-topics/jee-main.json';
import jeeAdvancedRaw  from '../data/important-topics/jee-advanced.json';
import neetRaw         from '../data/important-topics/neet.json';

// ── Normalised shape ──────────────────────────────────────────────────────────

export interface ImportantChapter {
  exam:             string;   // JEE_MAIN | JEE_ADVANCED | NEET
  subject:          string;   // Physics | Chemistry | Mathematics | Biology
  chapter:          string;
  priority:         number;   // 1–5, higher = more important
  priorityGroup?:   string;   // jee-main only: A | B | C | D
  weightageScore:   number;   // 1–10
  difficultyScore:  number;   // 1–10
  frequencyScore:   number;   // 1–10
  revisionValue:    number;   // 1–10 (ROI for revision time)
  averageWeightage: number;   // % or raw question count depending on exam
  tags:             string[];
  // jee-main extras
  trend2025?:       string;
  recommendedOrder?: number;
  // neet extras
  estimatedMarks?:  number;
  averageQuestions?: number;
}

// ── In-memory cache ───────────────────────────────────────────────────────────

let _cache: ImportantChapter[] | null = null;

// ── Normalisation helpers ─────────────────────────────────────────────────────

function normaliseJeeMain(): ImportantChapter[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = jeeMainRaw as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (raw.chapters as any[]).map((c: any): ImportantChapter => ({
    exam:             'JEE_MAIN',
    subject:          c.subject,
    chapter:          c.chapter,
    priority:         c.priority,
    priorityGroup:    c.priorityGroup,
    weightageScore:   c.weightageScore,
    difficultyScore:  c.difficultyScore,
    frequencyScore:   c.frequencyScore,
    revisionValue:    c.revisionValue,
    averageWeightage: c.averageWeightage,
    tags:             c.tags ?? [],
    trend2025:        c.trend2025,
    recommendedOrder: c.recommendedOrder,
  }));
}

function normaliseJeeAdvanced(): ImportantChapter[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = jeeAdvancedRaw as any;
  const result: ImportantChapter[] = [];
  const topChapters = raw.topChapters as Record<string, unknown[]>;
  for (const [subject, chapters] of Object.entries(topChapters)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const c of chapters as any[]) {
      result.push({
        exam:             'JEE_ADVANCED',
        subject,
        chapter:          c.chapter,
        priority:         c.priority,
        weightageScore:   c.weightageScore,
        difficultyScore:  c.difficultyScore,
        frequencyScore:   c.frequencyScore,
        revisionValue:    c.revisionValue,
        averageWeightage: c.averageWeightage,
        tags:             c.tags ?? [],
      });
    }
  }
  return result;
}

function normaliseNeet(): ImportantChapter[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = neetRaw as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (raw.chapters as any[]).map((c: any): ImportantChapter => ({
    exam:             'NEET',
    subject:          c.subject,
    chapter:          c.chapter,
    priority:         c.priority,
    weightageScore:   c.weightageScore,
    difficultyScore:  c.difficultyScore,
    frequencyScore:   c.frequencyScore,
    revisionValue:    c.revisionValue,
    averageWeightage: c.averageWeightage,
    tags:             c.tags ?? [],
    recommendedOrder: c.recommendedOrder,
    estimatedMarks:   c.estimatedMarks,
    averageQuestions: c.averageQuestions,
  }));
}

// ── Public API ────────────────────────────────────────────────────────────────

function getAllChapters(): ImportantChapter[] {
  if (!_cache) {
    _cache = [
      ...normaliseJeeMain(),
      ...normaliseJeeAdvanced(),
      ...normaliseNeet(),
    ];
  }
  return _cache;
}

/**
 * Returns the important-topics entry for a specific exam + subject + chapter.
 * Uses fuzzy matching: exact → includes → word overlap.
 */
export function getChapterIntelligence(
  exam:    string,
  subject: string,
  chapter: string,
): ImportantChapter | null {
  const all = getAllChapters();
  const examNorm    = exam.toUpperCase();
  const subjectNorm = subject.toLowerCase();
  const chapterNorm = chapter.toLowerCase();

  const candidates = all.filter(
    c => c.exam === examNorm && c.subject.toLowerCase() === subjectNorm,
  );
  if (candidates.length === 0) return null;

  // Exact match
  const exact = candidates.find(c => c.chapter.toLowerCase() === chapterNorm);
  if (exact) return exact;

  // Contains match
  const contains = candidates.find(
    c => c.chapter.toLowerCase().includes(chapterNorm) ||
         chapterNorm.includes(c.chapter.toLowerCase()),
  );
  if (contains) return contains;

  // Word-overlap match
  const chWords = new Set(chapterNorm.split(/\s+/).filter(w => w.length >= 4));
  let bestScore = 0;
  let bestMatch: ImportantChapter | null = null;
  for (const c of candidates) {
    const cWords = c.chapter.toLowerCase().split(/\s+/);
    const overlap = cWords.filter(w => chWords.has(w)).length;
    if (overlap > bestScore) { bestScore = overlap; bestMatch = c; }
  }
  return bestScore >= 1 ? bestMatch : null;
}

/**
 * Returns all chapters for an exam, optionally filtered by subject,
 * sorted by priority descending.
 */
export function getTopChapters(
  exam:     string,
  subject?: string,
  topN?:    number,
): ImportantChapter[] {
  const all      = getAllChapters();
  const examNorm = exam.toUpperCase();

  let filtered = all.filter(c => c.exam === examNorm);
  if (subject) {
    const subjectNorm = subject.toLowerCase();
    filtered = filtered.filter(c => c.subject.toLowerCase() === subjectNorm);
  }

  filtered.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return b.weightageScore - a.weightageScore;
  });

  return topN ? filtered.slice(0, topN) : filtered;
}

/**
 * Returns chapters matching one or more tags (e.g. "easy-win", "formula-heavy", "high-weightage").
 * Results sorted by priority × weightageScore descending.
 */
export function getChaptersByTag(
  exam:     string,
  tags:     string[],
  subject?: string,
): ImportantChapter[] {
  const all      = getAllChapters();
  const examNorm = exam.toUpperCase();
  const tagSet   = new Set(tags);

  let filtered = all.filter(c =>
    c.exam === examNorm && c.tags.some(t => tagSet.has(t)),
  );
  if (subject) {
    const subjectNorm = subject.toLowerCase();
    filtered = filtered.filter(c => c.subject.toLowerCase() === subjectNorm);
  }

  filtered.sort((a, b) =>
    (b.priority * b.weightageScore) - (a.priority * a.weightageScore),
  );
  return filtered;
}

/**
 * Returns chapters with priority >= minPriority, sorted by composite ROI score:
 *   (weightageScore × 0.4) + (frequencyScore × 0.3) + (revisionValue × 0.3)
 */
export function getHighROIChapters(
  exam:         string,
  subject?:     string,
  minPriority:  number = 4,
  topN?:        number,
): ImportantChapter[] {
  const all      = getAllChapters();
  const examNorm = exam.toUpperCase();

  let filtered = all.filter(c =>
    c.exam === examNorm && c.priority >= minPriority,
  );
  if (subject) {
    const subjectNorm = subject.toLowerCase();
    filtered = filtered.filter(c => c.subject.toLowerCase() === subjectNorm);
  }

  filtered.sort((a, b) => {
    const roiA = a.weightageScore * 0.4 + a.frequencyScore * 0.3 + a.revisionValue * 0.3;
    const roiB = b.weightageScore * 0.4 + b.frequencyScore * 0.3 + b.revisionValue * 0.3;
    return roiB - roiA;
  });

  return topN ? filtered.slice(0, topN) : filtered;
}

/**
 * Returns "easy win" chapters — high revision value, low difficulty.
 * Ideal for crash-course / last-30-day preparation modes.
 */
export function getCrashCourseChapters(
  exam:     string,
  subject?: string,
  topN:     number = 10,
): ImportantChapter[] {
  const all      = getAllChapters();
  const examNorm = exam.toUpperCase();

  let filtered = all.filter(c => c.exam === examNorm);
  if (subject) {
    const subjectNorm = subject.toLowerCase();
    filtered = filtered.filter(c => c.subject.toLowerCase() === subjectNorm);
  }

  // Score = (revisionValue × 0.5) + ((10 - difficultyScore) × 0.3) + (weightageScore × 0.2)
  filtered.sort((a, b) => {
    const sA = a.revisionValue * 0.5 + (10 - a.difficultyScore) * 0.3 + a.weightageScore * 0.2;
    const sB = b.revisionValue * 0.5 + (10 - b.difficultyScore) * 0.3 + b.weightageScore * 0.2;
    return sB - sA;
  });

  return filtered.slice(0, topN);
}

/**
 * Returns a formatted string of important-topics intelligence for a chapter,
 * ready for injection into Gemini prompts.
 */
export function formatIntelligenceForPrompt(intel: ImportantChapter): string {
  const lines: string[] = [
    `Chapter Strategic Intelligence (${intel.exam}):`,
    `  Priority: ${intel.priority}/5 | Weightage Score: ${intel.weightageScore}/10 | Frequency: ${intel.frequencyScore}/10`,
    `  Difficulty: ${intel.difficultyScore}/10 | Revision Value: ${intel.revisionValue}/10`,
    `  Tags: ${intel.tags.join(', ')}`,
  ];
  if (intel.trend2025) lines.push(`  Trend 2025: ${intel.trend2025}`);
  if (intel.estimatedMarks) lines.push(`  Estimated marks in exam: ${intel.estimatedMarks}`);
  return lines.join('\n');
}

/**
 * Returns the composite priority score for a chapter (0–100 range).
 * Used to adjust mock test topic allocation.
 */
export function chapterPriorityScore(intel: ImportantChapter): number {
  return Math.round(
    intel.weightageScore * 0.35 +
    intel.frequencyScore * 0.25 +
    intel.revisionValue  * 0.20 +
    intel.priority       * 2.0,   // priority 1–5 mapped to 0–10 contribution
  );
}
