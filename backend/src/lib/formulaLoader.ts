/**
 * Formula dataset loader.
 *
 * Dynamically scans /data/formulas/{subject}/ directories at startup,
 * caches all valid chapters in memory, and exposes retrieval + search
 * utilities for the formula API and AI service enrichment.
 *
 * Design principles:
 *  - Gracefully skips empty or malformed JSON files (never crashes).
 *  - No giant switch statements or manual chapter mappings.
 *  - Exam-aware filtering via `examTargets` field in each JSON.
 *  - `initFormulaLoader()` is idempotent — safe to call multiple times.
 */

import * as fs   from 'fs';
import * as path from 'path';
import type {
  FormulaChapterRaw,
  SubjectSummary,
  ChapterSummary,
  ChapterDetail,
  ConceptDetail,
  FormulaSearchResult,
} from '../types/formula';

// ── Subject metadata ──────────────────────────────────────────────────────────

const SUBJECT_NAMES: Record<string, string> = {
  physics:   'Physics',
  chemistry: 'Chemistry',
  maths:     'Mathematics',
  biology:   'Biology',
};

function subjectName(slug: string): string {
  return SUBJECT_NAMES[slug.toLowerCase()] ?? slug.charAt(0).toUpperCase() + slug.slice(1);
}

// ── Exam filter mapping ───────────────────────────────────────────────────────

function matchesExam(targets: string[], examFilter?: string): boolean {
  if (!examFilter) return true;
  const f = examFilter.toLowerCase();
  const normalised = targets.map(t => t.toLowerCase());
  if (f === 'jee' || f === 'jee_main' || f === 'jee main') {
    return normalised.some(t => t.includes('jee'));
  }
  if (f === 'neet') {
    return normalised.some(t => t.includes('neet'));
  }
  if (f === 'cbse') {
    return normalised.some(t => t.includes('cbse'));
  }
  return true;
}

// ── In-memory cache ───────────────────────────────────────────────────────────

/** slug → chapter slug → raw data */
const cache = new Map<string, Map<string, FormulaChapterRaw>>();
let ready = false;

const DATA_DIR = path.resolve(__dirname, '../data/formulas');

// ── Initialisation ────────────────────────────────────────────────────────────

export function initFormulaLoader(): void {
  if (ready) return;

  let totalChapters = 0;
  let skipped = 0;

  try {
    const subjects = fs.readdirSync(DATA_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    for (const subject of subjects) {
      const subjectDir = path.join(DATA_DIR, subject);
      const files = fs.readdirSync(subjectDir).filter(f => f.endsWith('.json'));
      const subjectMap = new Map<string, FormulaChapterRaw>();

      for (const file of files) {
        const slug = file.replace(/\.json$/, '');
        const filePath = path.join(subjectDir, file);

        try {
          const raw = fs.readFileSync(filePath, 'utf8').trim();
          if (!raw || raw === '{}' || raw === '') { skipped++; continue; }

          const parsed = JSON.parse(raw) as Partial<FormulaChapterRaw>;

          // Require at minimum a chapterName and concepts array
          if (!parsed.chapterName || !Array.isArray(parsed.concepts) || parsed.concepts.length === 0) {
            skipped++;
            continue;
          }

          // Normalise optional fields with defaults
          const chapter: FormulaChapterRaw = {
            chapterId:        parsed.chapterId        ?? `${subject}_${slug}`,
            fileName:         parsed.fileName         ?? file,
            chapterName:      parsed.chapterName,
            subject:          parsed.subject          ?? subjectName(subject),
            examTargets:      parsed.examTargets      ?? [],
            tags:             parsed.tags             ?? [],
            concepts:         parsed.concepts,
            importantNotes:   parsed.importantNotes   ?? [],
            commonMistakes:   parsed.commonMistakes   ?? [],
            jeeAdvancedFocus: parsed.jeeAdvancedFocus ?? [],
            neetFocus:        parsed.neetFocus        ?? [],
            keywords:         parsed.keywords         ?? [],
          };

          subjectMap.set(slug, chapter);
          totalChapters++;
        } catch (err) {
          // Malformed JSON — skip without crashing
          console.warn(`[formulaLoader] Skipping ${subject}/${file}: ${(err as Error).message}`);
          skipped++;
        }
      }

      if (subjectMap.size > 0) {
        cache.set(subject, subjectMap);
      }
    }
  } catch (err) {
    console.error('[formulaLoader] Directory scan failed:', (err as Error).message);
  }

  ready = true;
  const subjects = cache.size;
  console.log(
    `[formulaLoader] Ready — ${totalChapters} chapters loaded across ${subjects} subject(s), ${skipped} file(s) skipped`,
  );
}

// ── Count helpers ─────────────────────────────────────────────────────────────

function countFormulas(raw: FormulaChapterRaw): number {
  return raw.concepts.reduce((sum, c) => sum + c.formulas.length, 0);
}

// ── Normalisation helpers ─────────────────────────────────────────────────────

function toChapterSummary(slug: string, subjectSlug: string, raw: FormulaChapterRaw): ChapterSummary {
  return {
    chapterId:   raw.chapterId,
    chapterName: raw.chapterName,
    slug,
    subjectSlug,
    subjectName: subjectName(subjectSlug),
    examTargets: raw.examTargets,
    conceptCount: raw.concepts.length,
    formulaCount: countFormulas(raw),
    tags: raw.tags,
  };
}

function toChapterDetail(slug: string, subjectSlug: string, raw: FormulaChapterRaw): ChapterDetail {
  const concepts: ConceptDetail[] = raw.concepts.map(c => ({
    conceptId:   c.conceptId,
    conceptName: c.conceptName,
    description: c.description ?? '',
    formulaType: c.formulaType ?? '',
    formulas:    c.formulas.map(f => ({
      formulaId:     f.formulaId,
      name:          f.name,
      equation:      f.equation,
      latex:         f.latex,
      meaning:       f.meaning,
      variables:     f.variables ?? {},
      applications:  f.applications ?? [],
      commonMistakes: f.commonMistakes ?? [],
      conditions:    f.conditions ?? [],
    })),
  }));

  return {
    chapterId:        raw.chapterId,
    chapterName:      raw.chapterName,
    slug,
    subjectSlug,
    subjectName:      subjectName(subjectSlug),
    examTargets:      raw.examTargets,
    tags:             raw.tags,
    concepts,
    importantNotes:   raw.importantNotes   ?? [],
    commonMistakes:   raw.commonMistakes   ?? [],
    jeeAdvancedFocus: raw.jeeAdvancedFocus ?? [],
    neetFocus:        raw.neetFocus        ?? [],
    keywords:         raw.keywords         ?? [],
    conceptCount:     concepts.length,
    formulaCount:     concepts.reduce((s, c) => s + c.formulas.length, 0),
  };
}

// ── Public getters ────────────────────────────────────────────────────────────

export function getSubjects(examFilter?: string): SubjectSummary[] {
  const out: SubjectSummary[] = [];
  for (const [slug, chapters] of cache) {
    const matching = examFilter
      ? [...chapters.values()].filter(ch => matchesExam(ch.examTargets, examFilter))
      : [...chapters.values()];
    if (matching.length > 0) {
      out.push({ slug, name: subjectName(slug), chapterCount: matching.length });
    }
  }
  return out;
}

export function getChapters(subjectSlug: string, examFilter?: string): ChapterSummary[] {
  const subjectMap = cache.get(subjectSlug.toLowerCase());
  if (!subjectMap) return [];

  const out: ChapterSummary[] = [];
  for (const [slug, raw] of subjectMap) {
    if (!matchesExam(raw.examTargets, examFilter)) continue;
    out.push(toChapterSummary(slug, subjectSlug.toLowerCase(), raw));
  }
  return out.sort((a, b) => a.chapterName.localeCompare(b.chapterName));
}

export function getChapter(subjectSlug: string, chapterSlug: string): ChapterDetail | null {
  const subjectMap = cache.get(subjectSlug.toLowerCase());
  if (!subjectMap) return null;
  const raw = subjectMap.get(chapterSlug.toLowerCase());
  if (!raw) return null;
  return toChapterDetail(chapterSlug.toLowerCase(), subjectSlug.toLowerCase(), raw);
}

/**
 * Find a chapter by display name (fuzzy — normalised lowercase comparison).
 * Used by the notes service to match AI request topic to dataset chapter.
 */
export function findChapterByName(subjectSlug: string, chapterName: string): ChapterDetail | null {
  const subjectMap = cache.get(subjectSlug.toLowerCase());
  if (!subjectMap) return null;

  const needle = chapterName.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();

  let bestSlug: string | null = null;
  let bestScore = 0;

  for (const [slug, raw] of subjectMap) {
    const hay = raw.chapterName.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
    if (hay === needle) return toChapterDetail(slug, subjectSlug.toLowerCase(), raw);

    // Score: count matching words
    const needleWords = needle.split(/\s+/);
    const hayWords    = new Set(hay.split(/\s+/));
    const score = needleWords.filter(w => hayWords.has(w)).length;
    if (score > bestScore) { bestScore = score; bestSlug = slug; }
  }

  if (bestSlug && bestScore >= 1) {
    const raw = subjectMap.get(bestSlug)!;
    return toChapterDetail(bestSlug, subjectSlug.toLowerCase(), raw);
  }
  return null;
}

// ── Search ────────────────────────────────────────────────────────────────────

interface SearchOptions {
  subject?: string;
  exam?:    string;
  limit?:   number;
}

function scoreFormula(
  fName: string, fEquation: string, fMeaning: string,
  conceptName: string, chapterName: string, tags: string[], keywords: string[],
  query: string,
): number {
  const q = query.toLowerCase();
  const terms = q.split(/\s+/).filter(Boolean);

  function hit(text: string, weight: number): number {
    const t = text.toLowerCase();
    if (t === q)         return weight * 10;
    if (t.startsWith(q)) return weight * 7;
    if (t.includes(q))   return weight * 4;
    const matched = terms.filter(w => t.includes(w)).length;
    return matched * weight;
  }

  return (
    hit(fName,       10) +
    hit(fEquation,    8) +
    hit(conceptName,  6) +
    hit(chapterName,  5) +
    hit(fMeaning,     4) +
    tags.reduce((s, t)    => s + hit(t, 3), 0) +
    keywords.reduce((s, k) => s + hit(k, 2), 0)
  );
}

export function searchFormulas(query: string, opts: SearchOptions = {}): FormulaSearchResult[] {
  if (!query.trim()) return [];

  const { subject, exam, limit = 20 } = opts;
  const results: FormulaSearchResult[] = [];

  const subjects = subject
    ? [[subject.toLowerCase(), cache.get(subject.toLowerCase())] as const].filter(([, v]) => v)
    : [...cache.entries()];

  for (const [subSlug, subjectMap] of subjects) {
    if (!subjectMap) continue;
    for (const [chSlug, raw] of subjectMap) {
      if (!matchesExam(raw.examTargets, exam)) continue;
      for (const concept of raw.concepts) {
        for (const formula of concept.formulas) {
          const score = scoreFormula(
            formula.name, formula.equation, formula.meaning,
            concept.conceptName, raw.chapterName,
            raw.tags, raw.keywords ?? [],
            query,
          );
          if (score <= 0) continue;
          results.push({
            formulaId:   formula.formulaId,
            name:        formula.name,
            equation:    formula.equation,
            latex:       formula.latex,
            meaning:     formula.meaning,
            conceptName: concept.conceptName,
            chapterId:   raw.chapterId,
            chapterName: raw.chapterName,
            chapterSlug: chSlug,
            subjectSlug: subSlug,
            subjectName: subjectName(subSlug),
            score,
          });
        }
      }
    }
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Extract a flat list of formula strings from a chapter.
 * Used by the notes service to inject real formulas into AI context.
 */
export function extractFormulaStrings(subjectSlug: string, chapterName: string): string[] {
  const chapter = findChapterByName(subjectSlug, chapterName);
  if (!chapter) return [];
  return chapter.concepts.flatMap(c =>
    c.formulas.map(f => `${f.name}: ${f.equation}${f.meaning ? ` — ${f.meaning}` : ''}`)
  );
}

export { ready as isFormulaLoaderReady };
