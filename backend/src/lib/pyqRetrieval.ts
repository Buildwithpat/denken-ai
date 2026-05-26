/**
 * PYQ Retrieval Library
 *
 * Loads PYQ JSON datasets lazily from src/data/pyqs/ and provides a
 * lightweight retrieval interface for injecting representative examples
 * into Gemini generation prompts.
 *
 * Design:
 *  - Lazy-loads each exam-year JSON file on first access, then caches in memory
 *  - Indexes questions by subject → chapter → topic for O(1) retrieval
 *  - Returns slim representations (no correct answers exposed to prompt)
 *  - Prioritises variety: selects questions across multiple topics/difficulties
 *  - All debug metadata included in GroundingDebugLog
 */

import * as fs   from 'fs';
import * as path from 'path';
import { logger } from './logger';

// ── Types ─────────────────────────────────────────────────────────────────────

export type PYQExam = 'jee-main' | 'jee-advanced' | 'neet';

/** Slim question representation safe for prompt injection */
export interface PYQSlim {
  exam:       string;
  year:       number;
  subject:    string;
  chapter:    string;
  topic:      string;
  difficulty: string;
  type:       string;
  text:       string;           // truncated questionText
  options?:   string[];         // option texts only — correctAnswer NOT exposed
}

/** Raw schema as stored in the JSON files */
interface PYQRaw {
  questionId:    string;
  questionNumber: number;
  subject:       string;
  chapter:       string;
  topic:         string;
  difficulty:    string;
  questionType:  string;
  questionText:  string;
  options:       Record<string, string>;
  correctAnswer: string;
  exam:          string;
  year:          number;
  diagramRequired?: boolean;
}

interface PYQFile {
  questions: PYQRaw[];
}

// ── Index structure ───────────────────────────────────────────────────────────

// examKey → subjectLower → chapterLower → question[]
type PYQIndex = Map<string, Map<string, Map<string, PYQSlim[]>>>;

const pyqIndex: PYQIndex = new Map();
const loadedFiles = new Set<string>(); // track which files are cached

const DATA_DIR = path.resolve(__dirname, '../data/pyqs');

// ── Exam key normalisation ────────────────────────────────────────────────────

const EXAM_FOLDER: Record<string, PYQExam> = {
  JEE_MAIN:     'jee-main',
  JEE_ADVANCED: 'jee-advanced',
  NEET:         'neet',
  jee_main:     'jee-main',
  jee_advanced: 'jee-advanced',
  neet:         'neet',
  'jee-main':   'jee-main',
  'jee-advanced':'jee-advanced',
};

function toExamFolder(exam: string): PYQExam | null {
  return EXAM_FOLDER[exam] ?? null;
}

// ── File loading ──────────────────────────────────────────────────────────────

function loadExamYear(folder: PYQExam, year: number): void {
  const fileKey = `${folder}/${year}`;
  if (loadedFiles.has(fileKey)) return;

  const filePath = path.join(DATA_DIR, folder, `${year}.json`);
  if (!fs.existsSync(filePath)) return;

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const data: PYQFile = JSON.parse(raw);

    if (!Array.isArray(data.questions)) {
      loadedFiles.add(fileKey);
      return;
    }

    // Skip diagram-based questions — they can't be prompt-grounded reliably
    const usable = data.questions.filter(q => !q.diagramRequired);

    let indexed = 0;
    for (const q of usable) {
      const subjectKey = (q.subject ?? '').toLowerCase();
      const chapterKey = (q.chapter ?? '').toLowerCase();

      if (!pyqIndex.has(folder)) pyqIndex.set(folder, new Map());
      const examMap = pyqIndex.get(folder)!;

      if (!examMap.has(subjectKey)) examMap.set(subjectKey, new Map());
      const subjectMap = examMap.get(subjectKey)!;

      if (!subjectMap.has(chapterKey)) subjectMap.set(chapterKey, []);
      const chapterList = subjectMap.get(chapterKey)!;

      const slim: PYQSlim = {
        exam:       q.exam ?? folder,
        year:       q.year ?? year,
        subject:    q.subject,
        chapter:    q.chapter,
        topic:      q.topic,
        difficulty: q.difficulty,
        type:       q.questionType === 'integer' || q.questionType === 'numerical' ? 'numerical' : 'mcq',
        text:       q.questionText.slice(0, 350), // keep short for token budget
        options:    q.questionType !== 'integer' && q.questionType !== 'numerical'
          ? Object.values(q.options).map(v => v.slice(0, 120))
          : undefined,
      };

      chapterList.push(slim);
      indexed++;
    }

    loadedFiles.add(fileKey);
    logger.debug('[pyqRetrieval] Loaded', { file: fileKey, questions: indexed, skipped: data.questions.length - usable.length });
  } catch (err) {
    logger.warn('[pyqRetrieval] Failed to load file', { fileKey, error: (err as Error).message });
    loadedFiles.add(fileKey); // mark as attempted so we don't retry
  }
}

/** Load all available years for a given exam folder */
function loadAllYears(folder: PYQExam): void {
  const folderPath = path.join(DATA_DIR, folder);
  if (!fs.existsSync(folderPath)) return;

  const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.json'));
  for (const file of files) {
    const year = parseInt(file.replace('.json', ''), 10);
    if (!isNaN(year)) loadExamYear(folder, year);
  }
}

function ensureLoaded(folder: PYQExam): void {
  loadAllYears(folder);
}

// ── Normalisation helpers ─────────────────────────────────────────────────────

function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Score how closely a stored chapter name matches the requested chapter */
function chapterSimilarity(stored: string, requested: string): number {
  const s = normalise(stored);
  const r = normalise(requested);
  if (s === r) return 100;
  if (s.includes(r) || r.includes(s)) return 80;
  const rWords = r.split(' ').filter(Boolean);
  const sSet   = new Set(s.split(' ').filter(Boolean));
  const matched = rWords.filter(w => sSet.has(w)).length;
  return matched > 0 ? (matched / rWords.length) * 60 : 0;
}

// ── Selection helpers ─────────────────────────────────────────────────────────

/** Spread selection across difficulties to get variety */
function selectVaried(pool: PYQSlim[], limit: number): PYQSlim[] {
  if (pool.length <= limit) return [...pool];

  const byDiff: Record<string, PYQSlim[]> = { easy: [], medium: [], hard: [] };
  for (const q of pool) byDiff[q.difficulty]?.push(q);

  const result: PYQSlim[] = [];
  const perDiff = Math.max(1, Math.floor(limit / 3));

  for (const diff of ['medium', 'hard', 'easy']) {
    const bucket = byDiff[diff] ?? [];
    result.push(...bucket.slice(0, perDiff));
    if (result.length >= limit) break;
  }

  // Fill remaining slots if one bucket was small
  for (const q of pool) {
    if (result.length >= limit) break;
    if (!result.includes(q)) result.push(q);
  }

  return result.slice(0, limit);
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface PYQRetrievalResult {
  questions:  PYQSlim[];
  debugLog: {
    exam:           string;
    subject:        string;
    requestedChapter: string;
    matchedChapter: string | null;
    totalInChapter: number;
    selected:       number;
    yearsSearched:  number[];
  };
}

/**
 * Get representative PYQ examples for a given exam/subject/chapter.
 * Falls back progressively: exact chapter → fuzzy chapter → subject-level.
 *
 * Does NOT expose correct answers — returns only question text and options
 * so Gemini sees the style/depth without memorising the solution.
 */
export function getRepresentativePYQs(
  exam:    string,
  subject: string,
  chapter: string,
  topic?:  string,
  limit:   number = 4,
): PYQRetrievalResult {
  const folder = toExamFolder(exam);
  const debugLog: PYQRetrievalResult['debugLog'] = {
    exam, subject,
    requestedChapter: chapter,
    matchedChapter:   null,
    totalInChapter:   0,
    selected:         0,
    yearsSearched:    [],
  };

  if (!folder) {
    logger.debug('[pyqRetrieval] Unknown exam key', { exam });
    return { questions: [], debugLog };
  }

  ensureLoaded(folder);

  const examMap = pyqIndex.get(folder);
  if (!examMap) return { questions: [], debugLog };

  const subjectKey  = subject.toLowerCase();
  const subjectMap  = examMap.get(subjectKey);
  if (!subjectMap) {
    // Try partial match on subject
    let bestSubjectMap: Map<string, PYQSlim[]> | undefined;
    for (const [k, v] of examMap) {
      if (k.includes(subjectKey) || subjectKey.includes(k)) {
        bestSubjectMap = v;
        break;
      }
    }
    if (!bestSubjectMap) return { questions: [], debugLog };
    return doChapterLookup(bestSubjectMap, chapter, topic, limit, debugLog);
  }

  return doChapterLookup(subjectMap, chapter, topic, limit, debugLog);
}

function doChapterLookup(
  subjectMap:    Map<string, PYQSlim[]>,
  chapter:       string,
  topic:         string | undefined,
  limit:         number,
  debugLog:      PYQRetrievalResult['debugLog'],
): PYQRetrievalResult {
  // 1. Exact match
  const exactKey = chapter.toLowerCase();
  if (subjectMap.has(exactKey)) {
    return buildResult(subjectMap.get(exactKey)!, exactKey, topic, limit, debugLog);
  }

  // 2. Fuzzy match — find best chapter
  let bestScore  = 0;
  let bestKey:   string | null = null;

  for (const [k] of subjectMap) {
    const score = chapterSimilarity(k, chapter);
    if (score > bestScore) { bestScore = score; bestKey = k; }
  }

  if (bestKey && bestScore >= 30) {
    return buildResult(subjectMap.get(bestKey)!, bestKey, topic, limit, debugLog);
  }

  // 3. Subject-level fallback — merge first 3 chapters
  const combined: PYQSlim[] = [];
  let merged = 0;
  for (const [, questions] of subjectMap) {
    combined.push(...questions.slice(0, 2));
    if (++merged >= 3) break;
  }
  debugLog.matchedChapter = '(subject-level fallback)';
  const selected = selectVaried(combined, limit);
  debugLog.totalInChapter = combined.length;
  debugLog.selected = selected.length;
  return { questions: selected, debugLog };
}

function buildResult(
  pool:     PYQSlim[],
  matchedKey: string,
  topic:    string | undefined,
  limit:    number,
  debugLog: PYQRetrievalResult['debugLog'],
): PYQRetrievalResult {
  debugLog.matchedChapter  = matchedKey;
  debugLog.totalInChapter  = pool.length;

  // Prefer topic-matching questions if topic given
  let candidates = pool;
  if (topic) {
    const topicNorm  = normalise(topic);
    const topicMatch = pool.filter(q => normalise(q.topic).includes(topicNorm));
    if (topicMatch.length >= 2) candidates = topicMatch;
  }

  const selected = selectVaried(candidates, limit);
  debugLog.selected = selected.length;
  return { questions: selected, debugLog };
}

/**
 * Build a compact text block of PYQ examples suitable for injection into
 * a Gemini prompt. Does NOT include correct answers.
 */
export function formatPYQsForPrompt(pyqs: PYQSlim[]): string {
  if (pyqs.length === 0) return '(No PYQ examples available for this chapter)';

  return pyqs.map((q, i) => {
    const header = `[Example ${i + 1} | ${q.exam} ${q.year} | ${q.chapter} | ${q.difficulty.toUpperCase()}]`;
    const options = q.options
      ? '\n' + ['A', 'B', 'C', 'D'].map((l, j) => `  (${l}) ${q.options![j] ?? ''}`).join('\n')
      : '';
    return `${header}\n${q.text}${options}`;
  }).join('\n\n');
}

/**
 * Retrieve PYQs for multiple chapters/topics simultaneously.
 * Used when generating multi-chapter tests.
 */
export function getMultiChapterPYQs(
  exam:     string,
  subject:  string,
  chapters: string[],
  perChapter: number = 2,
): { questions: PYQSlim[]; debugLogs: PYQRetrievalResult['debugLog'][] } {
  const all: PYQSlim[]                       = [];
  const logs: PYQRetrievalResult['debugLog'][] = [];

  for (const chapter of chapters.slice(0, 6)) { // cap at 6 chapters
    const result = getRepresentativePYQs(exam, subject, chapter, undefined, perChapter);
    all.push(...result.questions);
    logs.push(result.debugLog);
  }

  return { questions: all, debugLogs: logs };
}
