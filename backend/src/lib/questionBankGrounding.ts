/**
 * Question-Bank Grounding Layer
 *
 * Loads the structured OCR-extracted question-bank datasets from
 * src/data/question-bank/ and provides compact, relevant example slices
 * to the Gemini generation pipeline as a primary realism layer.
 *
 * These datasets contain real competitive-exam questions that teach Gemini:
 *  - Exact question phrasing style (NCERT-plus, dense multi-step, factual)
 *  - Realistic distractor patterns (typical student misconceptions)
 *  - Appropriate numerical complexity for each exam
 *  - Chapter-level grouping so topic-relevant examples are surfaced first
 *
 * Design decisions:
 *  - Lazy load: files are huge — only load the relevant file on first access
 *  - Cache: once parsed, keep the extracted text index for process lifetime
 *  - No correct answers exposed: style reference only, not answer bank
 *  - Compact output: 250–300 char limit per example for token efficiency
 */

import path from 'path';
import fs   from 'fs';
import { logger } from './logger';

// ── File metadata registry ────────────────────────────────────────────────────

interface BankFileMeta {
  relativePath: string;  // relative to question-bank/
  exam:         string;  // JEE_MAIN | JEE_ADVANCED | NEET
  subject:      string;  // Physics | Chemistry | Mathematics | Biology
  topicHints:   string[]; // fuzzy topic keywords this file covers
}

const BANK_FILES: BankFileMeta[] = [
  // ── JEE Main ──
  { relativePath: 'jee-main/jee-main-physics.json',     exam: 'JEE_MAIN',     subject: 'Physics',     topicHints: ['mechanics', 'optics', 'thermodynamics', 'electrostatics', 'waves', 'modern physics', 'magnetism', 'current electricity', 'kinematics', 'rotational'] },
  { relativePath: 'jee-main/jee-main-chemistry.json',   exam: 'JEE_MAIN',     subject: 'Chemistry',   topicHints: ['organic', 'inorganic', 'physical', 'electrochemistry', 'thermodynamics', 'equilibrium', 'kinetics', 'bonding', 'coordination', 'aldehydes', 'amines'] },
  { relativePath: 'jee-main/jee-main-mathematics.json', exam: 'JEE_MAIN',     subject: 'Mathematics', topicHints: ['calculus', 'algebra', 'coordinate geometry', 'probability', 'vectors', 'matrices', 'integration', 'differentiation', 'trigonometry', 'sequences'] },
  // ── JEE Advanced — Physics ──
  { relativePath: 'jee-adv/physics-Mech-1.json',        exam: 'JEE_ADVANCED', subject: 'Physics',     topicHints: ['mechanics', 'kinematics', 'gravitation', 'newton', 'rotation', 'rigid body', 'work energy', 'centre of mass'] },
  { relativePath: 'jee-adv/physics-Mech-2.json',        exam: 'JEE_ADVANCED', subject: 'Physics',     topicHints: ['mechanics', 'fluid', 'elasticity', 'shm', 'oscillation', 'simple harmonic', 'surface tension', 'laws of motion'] },
  { relativePath: 'jee-adv/physics-electromagnetism.json', exam: 'JEE_ADVANCED', subject: 'Physics',  topicHints: ['electrostatics', 'magnetism', 'electromagnetic', 'current', 'capacitor', 'inductor', 'faraday', 'ampere', 'biot savart'] },
  { relativePath: 'jee-adv/physics-modernphysics.json', exam: 'JEE_ADVANCED', subject: 'Physics',     topicHints: ['modern physics', 'photoelectric', 'nuclear', 'atom', 'radioactivity', 'bohr', 'semiconductor', 'dual nature'] },
  { relativePath: 'jee-adv/physics-optics.json',        exam: 'JEE_ADVANCED', subject: 'Physics',     topicHints: ['optics', 'ray optics', 'wave optics', 'lens', 'mirror', 'interference', 'diffraction', 'refraction', 'snell'] },
  // ── JEE Advanced — Chemistry ──
  { relativePath: 'jee-adv/chemistry-inorganic.json',   exam: 'JEE_ADVANCED', subject: 'Chemistry',   topicHints: ['inorganic', 'coordination', 'periodic table', 'p-block', 'd-block', 'f-block', 's-block', 'transition metals', 'crystal field', 'isomerism'] },
  { relativePath: 'jee-adv/chemistry-organic.json',     exam: 'JEE_ADVANCED', subject: 'Chemistry',   topicHints: ['organic', 'goc', 'reaction mechanism', 'aldehyde', 'ketone', 'amine', 'carboxylic', 'alcohol', 'benzene', 'aromatic', 'stereochemistry'] },
  { relativePath: 'jee-adv/chemistry-physical.json',    exam: 'JEE_ADVANCED', subject: 'Chemistry',   topicHints: ['physical chemistry', 'thermodynamics', 'electrochemistry', 'equilibrium', 'kinetics', 'solutions', 'colligative', 'solid state'] },
  // ── JEE Advanced — Mathematics ──
  { relativePath: 'jee-adv/maths-algebra.json',         exam: 'JEE_ADVANCED', subject: 'Mathematics', topicHints: ['algebra', 'complex numbers', 'quadratic', 'permutation', 'combination', 'binomial', 'progression', 'sequences', 'series', 'matrices'] },
  { relativePath: 'jee-adv/maths-calculus.json',        exam: 'JEE_ADVANCED', subject: 'Mathematics', topicHints: ['calculus', 'integration', 'differentiation', 'limits', 'continuity', 'differential equations', 'application of derivatives', 'definite integral'] },
  { relativePath: 'jee-adv/maths-coordinate.json',      exam: 'JEE_ADVANCED', subject: 'Mathematics', topicHints: ['coordinate geometry', 'conic', 'ellipse', 'parabola', 'hyperbola', 'circle', 'straight lines', 'pair of lines'] },
  { relativePath: 'jee-adv/maths-trigonometry.json',    exam: 'JEE_ADVANCED', subject: 'Mathematics', topicHints: ['trigonometry', 'inverse trigonometric', 'height and distance', 'solution of triangles', 'properties of triangles'] },
  { relativePath: 'jee-adv/maths-vector.json',          exam: 'JEE_ADVANCED', subject: 'Mathematics', topicHints: ['vectors', '3d geometry', 'three dimensional', 'dot product', 'cross product', 'planes', 'lines in space'] },
  // ── NEET ──
  { relativePath: 'neet/neet-biology.json',              exam: 'NEET',         subject: 'Biology',     topicHints: ['cell', 'genetics', 'evolution', 'ecology', 'plant', 'animal physiology', 'reproduction', 'biotechnology', 'diversity', 'biomolecules'] },
  { relativePath: 'neet/neet-chemistry.json',            exam: 'NEET',         subject: 'Chemistry',   topicHints: ['organic', 'inorganic', 'physical', 'thermodynamics', 'equilibrium', 'bonding', 'electrochemistry', 'coordination'] },
  { relativePath: 'neet/neet-physics.json',              exam: 'NEET',         subject: 'Physics',     topicHints: ['mechanics', 'optics', 'thermodynamics', 'current', 'magnetism', 'waves', 'semiconductor', 'modern physics'] },
];

// ── OCR JSON schema ───────────────────────────────────────────────────────────

interface OcrContent {
  id:    number;
  text:  string;
  type:  string;
  score: number;
}

interface OcrPage {
  page_id: number;
  content: OcrContent[];
}

interface OcrDocument {
  pages: OcrPage[];
}

// ── Parsed question text ──────────────────────────────────────────────────────

export interface BankExample {
  exam:     string;
  subject:  string;
  chapter:  string;   // detected from content headers
  text:     string;   // trimmed question + options (max 350 chars)
}

// ── In-memory cache ───────────────────────────────────────────────────────────

// cacheKey: `${exam}::${subject}` → extracted examples array
const _cache = new Map<string, BankExample[]>();
const _loaded = new Set<string>(); // which relativePaths have been loaded

const DATA_ROOT = path.join(__dirname, '..', 'data', 'question-bank');

// ── Text helpers ──────────────────────────────────────────────────────────────

const QUESTION_PATTERN = /^(Q?\s*\d+[\.\):]|[0-9]+\s*[\.\)])\s+/i;
const CHAPTER_PATTERN  = /^(chapter\s*:|subject\s*:|section\s*:)\s*/i;

function isQuestionText(text: string): boolean {
  if (text.length < 30) return false;
  if (QUESTION_PATTERN.test(text)) return true;
  // Also catch long paragraphs that likely contain question content
  if (text.length > 120 && (text.includes('(1)') || text.includes('(A)') || text.includes('(a)'))) return true;
  return false;
}

function isChapterHeader(text: string): boolean {
  return CHAPTER_PATTERN.test(text) && text.length < 120;
}

function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    // Remove Hindi/Devanagari text blocks
    .replace(/[ऀ-ॿ]+/g, '')
    // Normalize option patterns: (1) → (A), (2) → (B), etc.
    .replace(/\(1\)\s*/g, '(A) ')
    .replace(/\(2\)\s*/g, '(B) ')
    .replace(/\(3\)\s*/g, '(C) ')
    .replace(/\(4\)\s*/g, '(D) ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractChapterFromHeader(text: string): string {
  return text
    .replace(CHAPTER_PATTERN, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── File loader ───────────────────────────────────────────────────────────────

function loadFile(meta: BankFileMeta): BankExample[] {
  const filePath = path.join(DATA_ROOT, meta.relativePath);
  const t0 = Date.now();

  let raw: OcrDocument;
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    raw = JSON.parse(content) as OcrDocument;
  } catch (err) {
    logger.warn('[qbGrounding] Failed to load bank file', {
      file: meta.relativePath,
      error: (err as Error).message,
    });
    return [];
  }

  const examples: BankExample[] = [];
  let currentChapter = meta.subject; // default to subject name

  for (const page of raw.pages) {
    if (!page.content) continue;

    for (const item of page.content) {
      const text = (item.text ?? '').trim();
      if (!text || text.length < 10) continue;

      if (isChapterHeader(text)) {
        currentChapter = extractChapterFromHeader(text);
        continue;
      }

      if (isQuestionText(text)) {
        const cleaned = cleanText(text);
        // Truncate to 350 chars — enough for style reference, not full question
        const truncated = cleaned.length > 350 ? cleaned.slice(0, 347) + '…' : cleaned;

        // Skip if mostly noise (bilingual artifacts)
        const ascii = truncated.replace(/[^\x20-\x7E]/g, '');
        if (ascii.length / truncated.length < 0.6) continue;

        examples.push({
          exam:    meta.exam,
          subject: meta.subject,
          chapter: currentChapter,
          text:    truncated,
        });
      }
    }
  }

  const ms = Date.now() - t0;
  logger.info('[qbGrounding] Loaded bank file', {
    file:     meta.relativePath,
    exam:     meta.exam,
    subject:  meta.subject,
    examples: examples.length,
    loadMs:   ms,
  });

  return examples;
}

// ── Ensure exam+subject cache is populated ────────────────────────────────────

function ensureLoaded(exam: string, subject: string): void {
  const cacheKey = `${exam}::${subject}`;
  if (_cache.has(cacheKey)) return;

  const relevant = BANK_FILES.filter(
    f => f.exam === exam && f.subject.toLowerCase() === subject.toLowerCase(),
  );

  const allExamples: BankExample[] = [];

  for (const meta of relevant) {
    if (_loaded.has(meta.relativePath)) continue;
    _loaded.add(meta.relativePath);
    const examples = loadFile(meta);
    allExamples.push(...examples);
  }

  _cache.set(cacheKey, allExamples);
}

// ── Topic relevance scoring ───────────────────────────────────────────────────

function topicScore(example: BankExample, chapter: string): number {
  const chLow = chapter.toLowerCase();
  const exLow = example.chapter.toLowerCase();
  const txtLow = example.text.toLowerCase();

  if (exLow === chLow) return 3;
  if (exLow.includes(chLow) || chLow.includes(exLow)) return 2;

  // Keyword overlap in chapter name
  const chWords = chLow.split(/\s+/).filter(w => w.length >= 4);
  const overlap  = chWords.filter(w => exLow.includes(w) || txtLow.includes(w)).length;
  return overlap;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface BankGroundingResult {
  examples:  BankExample[];
  formatted: string;
  debugLog: {
    exam:             string;
    subject:          string;
    chapter:          string;
    filesLoaded:      string[];
    totalAvailable:   number;
    topicMatched:     number;
    selected:         number;
  };
}

/**
 * Retrieve compact question-bank examples for a specific exam/subject/chapter.
 * Returns a formatted text block ready for Gemini prompt injection.
 *
 * @param exam     JEE_MAIN | JEE_ADVANCED | NEET
 * @param subject  Physics | Chemistry | Mathematics | Biology
 * @param chapter  Chapter/topic name (fuzzy matched)
 * @param limit    Max examples to return (default 4, keep low for token budget)
 */
export function getQuestionBankExamples(
  exam:    string,
  subject: string,
  chapter: string,
  limit:   number = 4,
): BankGroundingResult {
  ensureLoaded(exam, subject);

  const cacheKey = `${exam}::${subject}`;
  const allExamples = _cache.get(cacheKey) ?? [];

  const filesLoaded = BANK_FILES
    .filter(f => f.exam === exam && f.subject.toLowerCase() === subject.toLowerCase())
    .map(f => f.relativePath);

  // Score each example by topic relevance
  const scored = allExamples
    .map(ex => ({ ex, score: topicScore(ex, chapter) }))
    .filter(x => x.score > 0);

  // Sort descending, then sample top examples
  scored.sort((a, b) => b.score - a.score);

  // Take from the top half of scored matches, with variety
  const topMatches  = scored.filter(x => x.score >= 2).slice(0, limit * 3);
  const lowMatches  = scored.filter(x => x.score === 1).slice(0, limit * 2);
  const pool        = [...topMatches, ...lowMatches];

  // If we have too few topic-matched, supplement with random examples from the subject
  let selected: BankExample[];
  if (pool.length >= limit) {
    selected = pool.slice(0, limit).map(x => x.ex);
  } else {
    // Supplement with random from the full pool
    const supplementCount = limit - pool.length;
    const used    = new Set(pool.map(x => x.ex.text));
    const fallback = allExamples
      .filter(ex => !used.has(ex.text))
      .sort(() => Math.random() - 0.5)
      .slice(0, supplementCount);
    selected = [...pool.map(x => x.ex), ...fallback];
  }

  const formatted = formatForPrompt(selected, exam);

  return {
    examples: selected,
    formatted,
    debugLog: {
      exam,
      subject,
      chapter,
      filesLoaded,
      totalAvailable:  allExamples.length,
      topicMatched:    scored.length,
      selected:        selected.length,
    },
  };
}

/**
 * Format question-bank examples as a compact prompt block.
 * Emphasises that these are STYLE references, not content to copy.
 */
function formatForPrompt(examples: BankExample[], exam: string): string {
  if (examples.length === 0) return '';

  const lines: string[] = [
    `=== REAL ${exam} QUESTION PATTERNS (style + realism reference — do NOT copy) ===`,
    `Study these to match the exact phrasing depth, calculation complexity, and distractor quality:`,
    '',
  ];

  examples.forEach((ex, i) => {
    lines.push(`[Example ${i + 1} | ${ex.chapter}]`);
    lines.push(ex.text);
    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Returns the topic hints for all files of a given exam+subject.
 * Used to determine which bank files are most relevant for a chapter.
 */
export function getBankTopicHints(exam: string, subject: string): string[] {
  return BANK_FILES
    .filter(f => f.exam === exam && f.subject.toLowerCase() === subject.toLowerCase())
    .flatMap(f => f.topicHints);
}
