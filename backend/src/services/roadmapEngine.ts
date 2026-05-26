/**
 * Roadmap Engine — computes chapter-level preparation tracks per subject.
 *
 * For each syllabus chapter it computes:
 *   - ROI score  (exam weightage × mastery gap × forgetting × mistakes)
 *   - Status     (not-started | in-progress | needs-revision | mastered)
 *   - Priority   (critical | high | medium | low)
 *   - Checklist  (personalised action items)
 *
 * Topic weights from computeTopicWeights() are fuzzy-matched to syllabus
 * chapters so the engine works even when question topic names are sub-topics
 * (e.g. "Projectile Motion" → "Kinematics").
 */

import type { TopicWeight }           from './topicWeightService';
import type { IMistakePatternDocument } from '../models/MistakePattern';
import { findChapterByName }           from '../lib/formulaLoader';
import { getChapterIntelligence }      from '../lib/importantTopicsLoader';

// ── JEE Main syllabus + weightage data ────────────────────────────────────────

import jeeWeightage from '../data/weightage/jee-main.json';
import jeeSyllabus  from '../data/syllabus/jee-main.json';

// ── Subject slug mapping ──────────────────────────────────────────────────────

const SUBJECT_SLUG: Record<string, string> = {
  Mathematics: 'maths',
  Physics:     'physics',
  Chemistry:   'chemistry',
  Biology:     'biology',
};

// ── Public types ──────────────────────────────────────────────────────────────

export type ChapterStatus   = 'not-started' | 'in-progress' | 'needs-revision' | 'mastered';
export type ChapterPriority = 'critical' | 'high' | 'medium' | 'low';

export interface ChecklistItem {
  id:    string;
  label: string;
  type:  'concept' | 'formula' | 'notes' | 'practice' | 'pyq' | 'test' | 'mistake-revision';
  href:  string | null;
}

export interface ChapterCard {
  chapter:             string;
  subject:             string;
  subjectSlug:         string;
  examWeightage:       number;
  roiScore:            number;
  status:              ChapterStatus;
  masteryScore:        number;
  retentionScore:      number;
  forgettingFactor:    number;
  totalAttempted:      number;
  errorRate:           number;
  hasMistakes:         boolean;
  mistakeDominantType: string | null;
  linkedFormulaSlug:   string | null;
  linkedFormulaSubject: string | null;
  checklist:           ChecklistItem[];
  priority:            ChapterPriority;
  // Important-topics intelligence
  importantTopicPriority?: number;  // 1–5 from dataset
  importantTopicTags?:     string[];
  revisionValue?:          number;
  frequencyScore?:         number;
}

export interface SubjectTrack {
  subject:                 string;
  subjectSlug:             string;
  chapters:                ChapterCard[];
  overallMastery:          number;
  chaptersCompleted:       number;
  chaptersNeedingRevision: number;
  totalChapters:           number;
}

// ── Stop-words for fuzzy matching ─────────────────────────────────────────────

const STOP = new Set(['and', 'or', 'the', 'of', 'in', 'a', 'an', 'to', 'for', 'with', 'on', 'at', 'its', 'by']);

function significantWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 4 && !STOP.has(w));
}

function matchScore(chapter: string, topic: string): number {
  const chLow = chapter.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').trim();
  const tpLow = topic.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').trim();

  if (chLow === tpLow) return 10;
  if (chLow.includes(tpLow) || tpLow.includes(chLow)) return 7;

  const chWords = significantWords(chapter);
  const tpWords = new Set(significantWords(topic));
  const overlap = chWords.filter(w => tpWords.has(w)).length;
  return overlap;
}

// ── Aggregate topic weights for a chapter ─────────────────────────────────────

interface AggregatedWeight {
  masteryScore:     number;
  retentionScore:   number;
  forgettingFactor: number;
  totalAttempted:   number;
  wrongCount:       number;
  errorRate:        number;
  recentWrong:      boolean;
}

function aggregateForChapter(
  chapter: string,
  topicWeights: Map<string, TopicWeight>,
): AggregatedWeight | null {
  const matches: TopicWeight[] = [];
  topicWeights.forEach((tw, topic) => {
    if (matchScore(chapter, topic) >= 1) matches.push(tw);
  });
  if (matches.length === 0) return null;

  const totalAttempted  = matches.reduce((s, m) => s + m.totalAttempted, 0);
  const totalWrong      = matches.reduce((s, m) => s + m.wrongCount, 0);
  const masteryScore    = Math.round(matches.reduce((s, m) => s + m.masteryScore,    0) / matches.length);
  const retentionScore  = Math.round(matches.reduce((s, m) => s + m.retentionScore,  0) / matches.length);
  const forgettingFactor = matches.reduce((s, m) => s + m.forgettingFactor, 0) / matches.length;

  return {
    masteryScore,
    retentionScore,
    forgettingFactor,
    totalAttempted,
    wrongCount:  totalWrong,
    errorRate:   totalAttempted > 0 ? totalWrong / totalAttempted : 0,
    recentWrong: matches.some(m => m.recentWrong),
  };
}

// ── Mistake lookup for a chapter ──────────────────────────────────────────────

function mistakeForChapter(
  chapter: string,
  patterns: IMistakePatternDocument[],
): IMistakePatternDocument | null {
  let best: IMistakePatternDocument | null = null;
  let bestScore = 0;
  for (const p of patterns) {
    const s = matchScore(chapter, p.topic);
    if (s > bestScore) { bestScore = s; best = p; }
  }
  return bestScore >= 1 ? best : null;
}

// ── Chapter status + priority ─────────────────────────────────────────────────

function chapterStatus(agg: AggregatedWeight | null, hasMistakes: boolean): ChapterStatus {
  if (!agg || agg.totalAttempted === 0) return 'not-started';
  if (agg.masteryScore >= 80 && !hasMistakes) return 'mastered';
  if (agg.recentWrong || hasMistakes || agg.masteryScore < 50) return 'needs-revision';
  return 'in-progress';
}

function chapterPriority(roiScore: number): ChapterPriority {
  if (roiScore >= 0.65) return 'critical';
  if (roiScore >= 0.45) return 'high';
  if (roiScore >= 0.25) return 'medium';
  return 'low';
}

// ── ROI score ─────────────────────────────────────────────────────────────────

function computeRoi(
  weightageNorm:          number,
  agg:                    AggregatedWeight | null,
  hasMistakes:            boolean,
  importantTopicPriority: number = 3,  // 1–5 scale; default mid-range if unknown
): number {
  const mastery    = agg ? agg.masteryScore    : 0;
  const forgetting = agg ? agg.forgettingFactor : 0;

  // Normalise important-topic priority to 0–1 (1→0.0, 5→1.0)
  const intelBoost = (importantTopicPriority - 1) / 4;

  return Math.min(
    1,
    weightageNorm     * 0.35 +
    (1 - mastery / 100) * 0.25 +
    forgetting          * 0.15 +
    intelBoost          * 0.15 +
    (hasMistakes ? 0.10 : 0),
  );
}

// ── Checklist builder ─────────────────────────────────────────────────────────

function buildChecklist(
  chapter: string,
  subjectSlug: string,
  status: ChapterStatus,
  hasMistakes: boolean,
  linkedFormulaSlug: string | null,
  linkedFormulaSubject: string | null,
): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  const enc = encodeURIComponent;

  if (status === 'not-started' || status === 'in-progress') {
    items.push({
      id:    'concept',
      label: 'Study concepts',
      type:  'concept',
      href:  `/revision?topic=${enc(chapter)}`,
    });
  } else if (status === 'needs-revision') {
    items.push({
      id:    'concept',
      label: 'Review concepts urgently',
      type:  'concept',
      href:  `/revision?topic=${enc(chapter)}`,
    });
  }

  if (linkedFormulaSlug && linkedFormulaSubject) {
    items.push({
      id:    'formula',
      label: 'Revise formulas',
      type:  'formula',
      href:  `/formula/${linkedFormulaSubject}/${linkedFormulaSlug}`,
    });
  }

  if (hasMistakes) {
    items.push({
      id:    'mistake',
      label: 'Drill your mistakes',
      type:  'mistake-revision',
      href:  `/revision?type=mistakes&topic=${enc(chapter)}`,
    });
  }

  items.push({
    id:    'test',
    label: status === 'not-started' ? 'Take first practice test' : 'Take adaptive practice test',
    type:  'test',
    href:  `/denkenstudio?topic=${enc(chapter)}&subject=${enc(subjectSlug)}`,
  });

  items.push({
    id:    'pyq',
    label: 'Solve PYQ questions',
    type:  'pyq',
    href:  `/tests?filter=pyq&topic=${enc(chapter)}`,
  });

  return items;
}

// ── Main builder ──────────────────────────────────────────────────────────────

export function buildSubjectTracks(
  topicWeights: Map<string, TopicWeight>,
  mistakePatterns: IMistakePatternDocument[],
): SubjectTrack[] {
  const weightageSubjects = (jeeWeightage as {
    subjects: Record<string, Record<string, number>>;
  }).subjects;

  const tracks: SubjectTrack[] = [];

  for (const syllabusSubject of jeeSyllabus.subjects) {
    const subjectName = syllabusSubject.name;
    const subjectSlug = SUBJECT_SLUG[subjectName] ?? subjectName.toLowerCase();
    const weightageMap: Record<string, number> = weightageSubjects[subjectName] ?? {};

    // Normalise weightages so they sum to 1
    const weightageValues = Object.values(weightageMap);
    const weightageTotal  = weightageValues.reduce((s, v) => s + v, 0) || 1;

    const chapters: ChapterCard[] = [];

    for (const unit of syllabusSubject.units) {
      const rawWeightage = weightageMap[unit] ?? 3;
      const weightageNorm = rawWeightage / weightageTotal;

      const agg        = aggregateForChapter(unit, topicWeights);
      const mistake    = mistakeForChapter(unit, mistakePatterns);
      const hasMistakes = mistake !== null && mistake.totalMistakes > 0;

      // Important-topics intelligence
      const intel = getChapterIntelligence('JEE_MAIN', subjectName, unit);

      // Formula linking
      const formulaChapter = findChapterByName(subjectSlug, unit);
      const linkedFormulaSlug    = formulaChapter?.slug ?? null;
      const linkedFormulaSubject = formulaChapter ? subjectSlug : null;

      const roiScore = computeRoi(weightageNorm, agg, hasMistakes, intel?.priority);
      const status   = chapterStatus(agg, hasMistakes);
      const priority = chapterPriority(roiScore);

      const checklist = buildChecklist(
        unit, subjectSlug, status, hasMistakes,
        linkedFormulaSlug, linkedFormulaSubject,
      );

      chapters.push({
        chapter:             unit,
        subject:             subjectName,
        subjectSlug,
        examWeightage:       rawWeightage,
        roiScore:            Math.round(roiScore * 100) / 100,
        status,
        masteryScore:        agg?.masteryScore     ?? 0,
        retentionScore:      agg?.retentionScore   ?? 100,
        forgettingFactor:    agg ? Math.round(agg.forgettingFactor * 100) / 100 : 0,
        totalAttempted:      agg?.totalAttempted   ?? 0,
        errorRate:           agg ? Math.round(agg.errorRate * 100) / 100 : 0,
        hasMistakes,
        mistakeDominantType: mistake?.dominantType ?? null,
        linkedFormulaSlug,
        linkedFormulaSubject,
        checklist,
        priority,
        importantTopicPriority: intel?.priority,
        importantTopicTags:     intel?.tags,
        revisionValue:          intel?.revisionValue,
        frequencyScore:         intel?.frequencyScore,
      });
    }

    // Sort by ROI descending
    chapters.sort((a, b) => b.roiScore - a.roiScore);

    const attempted  = chapters.filter(c => c.totalAttempted > 0);
    const overallMastery = attempted.length > 0
      ? Math.round(attempted.reduce((s, c) => s + c.masteryScore, 0) / attempted.length)
      : 0;

    tracks.push({
      subject:                 subjectName,
      subjectSlug,
      chapters,
      overallMastery,
      chaptersCompleted:       chapters.filter(c => c.status === 'mastered').length,
      chaptersNeedingRevision: chapters.filter(c => c.status === 'needs-revision').length,
      totalChapters:           chapters.length,
    });
  }

  return tracks;
}
