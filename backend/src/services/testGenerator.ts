import { EXAM_CONFIG, JEE_EXAMS } from '../constants';
import {
  ExamKey, Difficulty, CbseClassFilter, Question,
  GenerateTestRequest, GeneratedTest, TopicEntry, TopicWeight, AdaptiveMode,
} from '../types';
import { getTopics }                  from '../lib/syllabusLoader';
import { generateQuestions }          from './questionGenerator';
import { generateGroundedQuestions }  from './geminiQuestionGenerator';
import { shuffle, distribute }        from '../utils/array';
import { selectFromBank }             from './questionBankService';
import { logger }                     from '../lib/logger';
import { getChapterIntelligence, getHighROIChapters, getCrashCourseChapters, getChaptersByTag } from '../lib/importantTopicsLoader';

// ---------------------------------------------------------------------------
// Subject allocation (unchanged)
// ---------------------------------------------------------------------------

type SubjectAllocation = { subject: string; count: number }[];

function allocateBySubject(
  exam: ExamKey,
  subjects: string[],
  total: number,
): SubjectAllocation {
  if (subjects.length === 0) return [];

  const lower = (s: string) => s.toLowerCase();

  if (exam === 'NEET') {
    const bioIdx = subjects.findIndex((s) => lower(s) === 'biology');
    if (bioIdx !== -1 && subjects.length > 1) {
      const biologyCount = Math.round(total * 0.5);
      const othersTotal = total - biologyCount;
      const others = subjects.filter((s) => lower(s) !== 'biology');
      const otherCounts = distribute(othersTotal, others.length);

      const allocation: SubjectAllocation = others.map((s, i) => ({
        subject: s,
        count: otherCounts[i],
      }));
      allocation.push({ subject: subjects[bioIdx], count: biologyCount });
      return allocation;
    }
  }

  const counts = distribute(total, subjects.length);
  return subjects.map((s, i) => ({ subject: s, count: counts[i] }));
}

// ---------------------------------------------------------------------------
// Topic distribution — equal fallback
// ---------------------------------------------------------------------------

function distributeAcrossTopics(
  topics: TopicEntry[],
  total: number,
): { topic: string; topicKey: 'chapters' | 'units'; count: number; difficulty: Difficulty }[] {
  if (topics.length === 0 || total === 0) return [];
  const counts = distribute(total, topics.length);
  return topics.map((t, i) => ({
    topic: t.topic,
    topicKey: t.topicKey,
    count: counts[i],
    difficulty: 'mixed',
  }));
}

// ---------------------------------------------------------------------------
// Weighted topic distribution — used when topicWeights are available
// ---------------------------------------------------------------------------

const DEFAULT_WEIGHT = 0.3; // For topics never attempted — moderate visibility

/**
 * Apply adaptive-mode boosting to raw weights.
 * weak-topic: amplify topics with low mastery (mastery < 50 → boost ×2).
 * revision:   amplify topics with high forgetting factor (forgetting > 0.5 → boost ×2).
 * surprise:   flatten all weights (equal exposure).
 * balanced-mock / exam-adaptive: use weights as-is.
 */
function applyModeBoost(
  rawWeight:  number,
  tw:         TopicWeight | undefined,
  mode:       AdaptiveMode | undefined,
  exam:       ExamKey,
  subject:    string,
  topicName:  string,
): number {
  if (!tw && mode !== 'high-roi' && mode !== 'crash-course' && mode !== 'formula-heavy') return rawWeight;

  switch (mode) {
    case 'weak-topic':
      if (!tw) return rawWeight;
      return tw.masteryScore < 50 ? Math.min(1.0, rawWeight * 2.0) : rawWeight * 0.5;
    case 'revision':
      if (!tw) return rawWeight;
      return tw.forgettingFactor > 0.5 ? Math.min(1.0, rawWeight * 2.0) : rawWeight * 0.6;
    case 'surprise':
      return DEFAULT_WEIGHT;
    case 'high-roi': {
      const intel = getChapterIntelligence(exam, subject, topicName);
      if (!intel) return rawWeight;
      // Boost high-weightage, high-frequency chapters
      const score = (intel.weightageScore * 0.5 + intel.frequencyScore * 0.5) / 10;
      return Math.min(1.0, rawWeight * (0.5 + score));
    }
    case 'crash-course': {
      const intel = getChapterIntelligence(exam, subject, topicName);
      if (!intel) return rawWeight;
      // Boost easy-win chapters: high revision value, low difficulty
      const score = (intel.revisionValue * 0.6 + (10 - intel.difficultyScore) * 0.4) / 10;
      return Math.min(1.0, rawWeight * (0.5 + score));
    }
    case 'formula-heavy': {
      const intel = getChapterIntelligence(exam, subject, topicName);
      if (!intel) return rawWeight;
      const isFormula = intel.tags.includes('formula-heavy') || intel.tags.includes('numerical-based');
      return isFormula ? Math.min(1.0, rawWeight * 2.0) : rawWeight * 0.4;
    }
    default:
      return rawWeight;
  }
}

function weightedDistributeAcrossTopics(
  topics:           TopicEntry[],
  topicWeights:     Map<string, TopicWeight>,
  total:            number,
  requestDifficulty: Difficulty,
  adaptiveMode?:    AdaptiveMode,
  exam?:            ExamKey,
  subject?:         string,
): { topic: string; topicKey: 'chapters' | 'units'; count: number; difficulty: Difficulty }[] {
  if (topics.length === 0 || total === 0) return [];

  // Pair each topic with its weight, applying mode-specific boosting
  const tagged = topics.map((t) => {
    const tw = topicWeights.get(t.topic);
    const base = tw?.weight ?? DEFAULT_WEIGHT;
    const boosted = applyModeBoost(base, tw, adaptiveMode, exam ?? 'JEE_MAIN', subject ?? '', t.topic);
    return {
      topic: t.topic,
      topicKey: t.topicKey,
      rawWeight: boosted,
      difficulty:
        requestDifficulty === 'mixed'
          ? (tw?.suggestedDifficulty ?? 'mixed')
          : requestDifficulty,
    };
  });

  // Sort descending by weight so weak topics bubble up first
  tagged.sort((a, b) => b.rawWeight - a.rawWeight);

  // When there are fewer questions than topics we can only cover a subset.
  // Select the highest-weight topics — prioritising revision-pending ones.
  if (total <= tagged.length) {
    return tagged.slice(0, total).map((t) => ({
      topic: t.topic,
      topicKey: t.topicKey,
      count: 1,
      difficulty: t.difficulty,
    }));
  }

  // Proportional allocation with a minimum of 1 per topic
  const sumWeights = tagged.reduce((s, t) => s + t.rawWeight, 0);
  const counts = tagged.map((t) =>
    Math.max(1, Math.round((total * t.rawWeight) / sumWeights)),
  );

  // Reconcile to match `total` exactly
  let allocated = counts.reduce((s, c) => s + c, 0);

  // Trim excess from the lowest-weight topics first
  for (let i = tagged.length - 1; i >= 0 && allocated > total; i--) {
    if (counts[i] > 1) { counts[i]--; allocated--; }
  }
  // Add remainder to the highest-weight topics first
  for (let i = 0; i < tagged.length && allocated < total; i++) {
    counts[i]++; allocated++;
  }

  return tagged.map((t, i) => ({
    topic: t.topic,
    topicKey: t.topicKey,
    count: counts[i],
    difficulty: t.difficulty,
  }));
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

// ── Bank-first slot filler ────────────────────────────────────────────────────

async function fillSlotFromBank(
  exam:       ExamKey,
  subject:    string,
  topic:      string,
  topicType:  'chapter' | 'unit',
  difficulty: Difficulty,
  type:       'mcq' | 'numerical',
  count:      number,
  topicWeight?: TopicWeight,
  seenIds?:   Set<string>,
): Promise<{ bankQuestions: Question[]; remaining: number }> {
  if (count === 0) return { bankQuestions: [], remaining: 0 };

  try {
    const bankQuestions = await selectFromBank({
      exam,
      subject,
      topic,
      type,
      count,
      difficulty: difficulty as 'easy' | 'medium' | 'hard' | 'mixed',
      topicWeight,
      avoidStableIds: seenIds,
      userMasteryScore: topicWeight?.masteryScore,
      boostPrerequisites: topicWeight !== undefined && topicWeight.masteryScore < 45,
    });

    if (seenIds) {
      for (const q of bankQuestions) {
        if (q.bankQuestionId) seenIds.add(q.bankQuestionId);
      }
    }

    const remaining = count - bankQuestions.length;
    return { bankQuestions, remaining };
  } catch {
    return { bankQuestions: [], remaining: count };
  }
}

/**
 * Generate questions for a slot that the QuestionBank could not fill.
 * Primary path: Gemini-grounded generation.
 * Fallback: template-based generation.
 */
async function generateFallbackQuestions(
  exam:         ExamKey,
  subject:      string,
  topic:        string,
  topicType:    'chapter' | 'unit',
  difficulty:   Difficulty,
  type:         'mcq' | 'numerical',
  count:        number,
  correctMarks: number,
): Promise<Question[]> {
  const result = await generateGroundedQuestions({
    exam,
    subject,
    topic,
    topicType,
    difficulty,
    type,
    count,
    correctMarks,
  });

  logger.info('[testGenerator] Fallback generation', {
    exam, subject, topic, type, count,
    source: result.source,
    generated: result.questions.length,
    pyqsInjected: (result.debugLog.groundingDebug as { pyqsSelected?: number }).pyqsSelected ?? 0,
  });

  return result.questions;
}

// ---------------------------------------------------------------------------
// Question type split helper
// ---------------------------------------------------------------------------

function computeTypeSplit(
  slotCount:        number,
  exam:             ExamKey,
  questionTypeMode: 'mcq' | 'numerical' | 'mixed' | undefined,
): { mcqCount: number; numericalCount: number } {
  // NEET and CBSE never have numerical answer type
  if (exam === 'NEET' || exam === 'CBSE') {
    return { mcqCount: slotCount, numericalCount: 0 };
  }

  switch (questionTypeMode) {
    case 'mcq':
      return { mcqCount: slotCount, numericalCount: 0 };
    case 'numerical':
      return { mcqCount: 0, numericalCount: slotCount };
    case 'mixed': {
      // 35% numerical for mixed mode (heavier numerical presence)
      const numericalCount = slotCount >= 2 ? Math.max(1, Math.round(slotCount * 0.35)) : 0;
      return { mcqCount: slotCount - numericalCount, numericalCount };
    }
    default: {
      // Default for JEE (legacy behaviour): ~20% numerical
      const numericalCount = slotCount >= 2 ? Math.max(1, Math.round(slotCount * 0.20)) : 0;
      return { mcqCount: slotCount - numericalCount, numericalCount };
    }
  }
}

// ---------------------------------------------------------------------------
// Main export (async — bank-first)
// ---------------------------------------------------------------------------

export async function generateTest(req: GenerateTestRequest): Promise<GeneratedTest> {
  const {
    exam,
    subjects,
    chapters,
    difficulty = 'mixed',
    questionCount,
    cbseClass = 'both',
    topicWeights,
    adaptiveMode,
    questionTypeMode,
  } = req;

  const config = EXAM_CONFIG[exam];
  const total = questionCount
    ? Math.min(questionCount, config.maxQuestions)
    : config.maxQuestions;

  const topicPool = getTopics(exam, subjects, chapters, cbseClass as CbseClassFilter);

  if (topicPool.length === 0) {
    const classNote = exam === 'CBSE' ? ` (class filter: ${cbseClass})` : '';
    throw new Error(
      `No topics found for exam "${exam}" with subjects [${subjects.join(', ')}]` +
        (chapters ? ` and chapters [${chapters.join(', ')}]` : '') +
        classNote +
        '. Verify that subject names match the syllabus exactly.',
    );
  }

  const availableSubjects = [...new Set(topicPool.map((t) => t.subject))];
  const subjectAllocation = allocateBySubject(exam, availableSubjects, total);
  const allQuestions: Question[] = [];

  const useAdaptive = topicWeights !== undefined && topicWeights.size > 0;
  const seenBankIds = new Set<string>();

  for (const { subject, count: subjectCount } of subjectAllocation) {
    if (subjectCount === 0) continue;

    const subjectTopics = topicPool.filter((t) => t.subject === subject);

    const topicSlots = useAdaptive
      ? weightedDistributeAcrossTopics(subjectTopics, topicWeights!, subjectCount, difficulty, adaptiveMode, exam, subject)
      : distributeAcrossTopics(subjectTopics, subjectCount);

    for (const slot of topicSlots) {
      if (slot.count === 0) continue;

      const topicType: 'chapter' | 'unit' =
        slot.topicKey === 'chapters' ? 'chapter' : 'unit';

      const effectiveDifficulty: Difficulty = slot.difficulty;
      const tw = topicWeights?.get(slot.topic);

      const { mcqCount, numericalCount } = computeTypeSplit(slot.count, exam, questionTypeMode);

      logger.debug('[testGenerator] Type split for slot', {
        exam, subject, topic: slot.topic,
        slotCount: slot.count, mcqCount, numericalCount,
        questionTypeMode: questionTypeMode ?? 'default',
      });

      if (mcqCount > 0) {
        const { bankQuestions: bMcq, remaining: rMcq } = await fillSlotFromBank(
          exam, subject, slot.topic, topicType, effectiveDifficulty,
          'mcq', mcqCount, tw, seenBankIds,
        );
        allQuestions.push(...bMcq);
        if (rMcq > 0) {
          const fallback = await generateFallbackQuestions(
            exam, subject, slot.topic, topicType, effectiveDifficulty, 'mcq', rMcq, config.marking.correct,
          );
          allQuestions.push(...fallback);
        }
      }

      if (numericalCount > 0) {
        const { bankQuestions: bNum, remaining: rNum } = await fillSlotFromBank(
          exam, subject, slot.topic, topicType, effectiveDifficulty,
          'numerical', numericalCount, tw, seenBankIds,
        );
        allQuestions.push(...bNum);
        if (rNum > 0) {
          const fallback = await generateFallbackQuestions(
            exam, subject, slot.topic, topicType, effectiveDifficulty, 'numerical', rNum, config.marking.correct,
          );
          allQuestions.push(...fallback);
        }
      }
    }
  }

  shuffle(allQuestions);

  return {
    exam,
    totalQuestions: allQuestions.length,
    duration: config.duration,
    marking: config.marking,
    subjects: availableSubjects,
    questions: allQuestions,
    generatedAt: new Date().toISOString(),
  };
}
