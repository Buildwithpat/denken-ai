/**
 * Question Bank Service
 *
 * Manages the QuestionBank collection: adaptive selection, difficulty
 * calibration, concept-aware filtering, and performance-guided ordering.
 *
 * selectFromBank() is the primary entry point used by testGenerator.
 * It returns structured Question objects ready to embed in Test documents.
 */

import * as crypto from 'crypto';
import { Types }   from 'mongoose';
import QuestionBank, { IQuestionBankDocument } from '../models/QuestionBank';
import QuestionPerformance                     from '../models/QuestionPerformance';
import ConceptGraph                            from '../models/ConceptGraph';
import { type TopicWeight }                    from '../types';
import { type ExamKey, type ResolvedDifficulty, type Question } from '../types';
import { findChapterByName } from '../lib/formulaLoader';

// ── Selection request ─────────────────────────────────────────────────────────

export interface BankSelectionRequest {
  exam:         ExamKey;
  subject:      string;
  topic:        string;
  type:         'mcq' | 'numerical';
  count:        number;
  difficulty?:  'easy' | 'medium' | 'hard' | 'mixed';
  topicWeight?: TopicWeight;
  // Concept-aware filters
  targetBloomLevels?:    string[];
  avoidStableIds?:       Set<string>;   // deduplicate across sessions
  boostPrerequisites?:   boolean;       // surface prerequisite-gap questions first
  userMasteryScore?:     number;        // 0–100 — drives adaptive difficulty
}

export interface BankSelectionResult {
  questions:  Question[];
  fromBank:   number;   // how many came from the bank (rest from template generator)
}

// ── Adaptive difficulty selection ─────────────────────────────────────────────

function targetDifficultyFromMastery(mastery: number): ResolvedDifficulty {
  if (mastery < 35) return 'easy';
  if (mastery < 65) return 'medium';
  return 'hard';
}

function difficultyWeight(
  questionDiff: ResolvedDifficulty,
  target:       ResolvedDifficulty,
): number {
  if (questionDiff === target) return 3.0;
  const dist = Math.abs(['easy','medium','hard'].indexOf(questionDiff) - ['easy','medium','hard'].indexOf(target));
  return dist === 1 ? 1.5 : 0.5;
}

// ── Convert DB document → Question (embedded) ─────────────────────────────────

function toQuestion(doc: IQuestionBankDocument, marks: number): Question {
  return {
    id:                     crypto.randomUUID(),
    bankQuestionId:         doc.stableId,
    subject:                doc.subject,
    topic:                  doc.topic,
    chapter:                doc.chapter,
    subtopic:               doc.subtopic,
    topicType:              doc.topicType,
    difficulty:             doc.difficulty,
    type:                   doc.type,
    question:               doc.questionText,
    options:                doc.type === 'mcq' ? (doc.options as [string,string,string,string]) : undefined,
    correctOption:          doc.type === 'mcq' ? doc.correctOption : undefined,
    answer:                 doc.type === 'numerical' ? doc.answer : undefined,
    marks,
    conceptTags:            doc.conceptTags,
    formulaTags:            doc.formulaTags,
    bloomLevel:             doc.bloomLevel,
    skillCategory:          doc.skillCategory,
    learningObjective:      doc.learningObjective,
    expectedSolvingTimeSec: doc.expectedSolvingTimeSec,
    prerequisiteTopics:     doc.prerequisiteTopics,
  };
}

// ── Core selection ────────────────────────────────────────────────────────────

export async function selectFromBank(req: BankSelectionRequest): Promise<Question[]> {
  const {
    exam, subject, topic, type, count,
    difficulty = 'mixed',
    topicWeight,
    avoidStableIds,
    boostPrerequisites = false,
    userMasteryScore,
    targetBloomLevels,
  } = req;

  // Base query
  const query: Record<string, unknown> = {
    isActive: true,
    subject,
    topic,
    type,
    $or: [{ exams: exam }, { exams: { $size: 0 } }],
  };

  // Difficulty filter — when mixed, we'll weight in memory
  if (difficulty !== 'mixed') query.difficulty = difficulty;

  const candidates = await QuestionBank.find(query)
    .sort({ qualityScore: -1, adaptiveDifficultyScore: 1 })
    .limit(count * 5)  // over-fetch for weighted selection
    .lean<IQuestionBankDocument[]>();

  if (candidates.length === 0) return [];

  // Determine target difficulty
  const effectiveMastery = userMasteryScore ?? topicWeight?.masteryScore ?? 50;
  const targetDiff: ResolvedDifficulty = difficulty !== 'mixed'
    ? (difficulty as ResolvedDifficulty)
    : targetDifficultyFromMastery(effectiveMastery);

  // Fetch performance data for these questions
  const stableIds = candidates.map(c => c.stableId);
  const perfs = await QuestionPerformance.find({ stableId: { $in: stableIds } })
    .select('stableId accuracy discriminationIndex adaptiveUsefulnessScore')
    .lean<{ stableId: string; accuracy: number; discriminationIndex: number; adaptiveUsefulnessScore: number }[]>();
  const perfMap = new Map(perfs.map(p => [p.stableId, p]));

  // Score each candidate
  const scored = candidates
    .filter(c => !avoidStableIds?.has(c.stableId))
    .map(c => {
      const perf = perfMap.get(c.stableId);
      let score = difficultyWeight(c.difficulty, targetDiff) * 2.0;

      // Prefer questions where discrimination is high (separates mastery levels well)
      if (perf) {
        score += perf.discriminationIndex * 1.5;
        score += perf.adaptiveUsefulnessScore / 100;
        // Prefer questions with some performance data (not entirely unseen)
        if (perf.accuracy > 0) score += 0.3;
      }

      // Bloom level weighting
      if (targetBloomLevels && targetBloomLevels.length > 0) {
        if (targetBloomLevels.includes(c.bloomLevel)) score += 1.0;
      }

      // Prerequisite boost: surface prerequisite questions when mastery is low
      if (boostPrerequisites && effectiveMastery < 45 && c.bloomLevel === 'remember') {
        score += 0.8;
      }

      // Quality weight
      score += c.qualityScore / 200;

      return { doc: c, score };
    });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Take top `count` (or all available)
  const selected = scored.slice(0, count);

  // Determine marks — use 4 for JEE/NEET, 1 for CBSE
  const marks = exam === 'CBSE' ? 1 : 4;

  return selected.map(s => toQuestion(s.doc, marks));
}

// ── Concept prerequisite analysis ─────────────────────────────────────────────

export interface ConceptGap {
  conceptId:        string;
  conceptName:      string;
  subject:          string;
  chapter:          string;
  topic:            string;
  gapSeverity:      'critical' | 'moderate' | 'minor';
  enablesConcepts:  string[];  // what mastering this unlocks
  formulaLinks:     string[];
}

export async function detectPrerequisiteGaps(
  userId:       string,
  topicWeights: Map<string, TopicWeight>,
): Promise<ConceptGap[]> {
  // Find concepts where prerequisites have low mastery
  const allConcepts = await ConceptGraph.find({ isActive: true }).lean();

  const gaps: ConceptGap[] = [];

  for (const concept of allConcepts) {
    if (concept.prerequisites.length === 0) continue;

    // Get mastery for this concept's topic
    const tw = topicWeights.get(concept.topic);
    if (!tw) continue;
    if (tw.masteryScore >= 60) continue; // Not a gap if mastery is decent

    // Check if any prerequisite concepts map to high-mastery topics
    const prereqTopics = concept.prerequisites
      .map(pid => allConcepts.find(c => c.conceptId === pid)?.topic)
      .filter((t): t is string => Boolean(t));

    const anyPrereqWeak = prereqTopics.some(pt => {
      const ptw = topicWeights.get(pt);
      return !ptw || ptw.masteryScore < 50;
    });

    if (!anyPrereqWeak) continue;

    const severity: ConceptGap['gapSeverity'] =
      tw.masteryScore < 25 ? 'critical' :
      tw.masteryScore < 45 ? 'moderate' : 'minor';

    gaps.push({
      conceptId:       concept.conceptId,
      conceptName:     concept.name,
      subject:         concept.subject,
      chapter:         concept.chapter,
      topic:           concept.topic,
      gapSeverity:     severity,
      enablesConcepts: concept.enables,
      formulaLinks:    concept.formulaLinks,
    });
  }

  // Sort critical first
  const order = { critical: 0, moderate: 1, minor: 2 };
  return gaps.sort((a, b) => order[a.gapSeverity] - order[b.gapSeverity]).slice(0, 10);
}

// ── Question performance update ────────────────────────────────────────────────

export interface QuestionAttemptRecord {
  stableId:       string;
  subject:        string;
  chapter:        string;
  topic:          string;
  isCorrect:      boolean;
  solvingTimeSec: number;
  mistakeType?:   string;
  userMastery:    number;   // 0–100 student's mastery at time of attempt
}

export async function updateQuestionPerformance(
  attempts: QuestionAttemptRecord[],
): Promise<void> {
  if (attempts.length === 0) return;

  const ops: Promise<unknown>[] = [];

  for (const a of attempts) {
    const isHighMastery = a.userMastery >= 70;
    const isLowMastery  = a.userMastery < 40;

    // Count mistake type if applicable
    const mistakeIncrement: Record<string, number> = {};
    if (!a.isCorrect && a.mistakeType) {
      const keyMap: Record<string, string> = {
        conceptual:        'mistakeCounts.conceptual',
        careless:          'mistakeCounts.careless',
        formula:           'mistakeCounts.formula',
        'time-pressure':   'mistakeCounts.timePressure',
        'weak-retention':  'mistakeCounts.weakRetention',
        guessing:          'mistakeCounts.guessing',
        repeated:          'mistakeCounts.repeated',
      };
      const key = keyMap[a.mistakeType];
      if (key) mistakeIncrement[key] = 1;
    }

    ops.push(
      QuestionPerformance.findOneAndUpdate(
        { stableId: a.stableId },
        {
          $setOnInsert: {
            subject:  a.subject,
            chapter:  a.chapter,
            topic:    a.topic,
          },
          $set: { lastAttemptAt: new Date() },
          $inc: {
            totalAttempts:       1,
            correctAttempts:     a.isCorrect ? 1 : 0,
            totalSolvingTimeSec: a.solvingTimeSec,
            sumSolvingTimeSq:    a.solvingTimeSec * a.solvingTimeSec,
            highMasteryAttempts: isHighMastery ? 1 : 0,
            highMasteryCorrect:  isHighMastery && a.isCorrect ? 1 : 0,
            lowMasteryAttempts:  isLowMastery ? 1 : 0,
            lowMasteryCorrect:   isLowMastery && a.isCorrect ? 1 : 0,
            ...mistakeIncrement,
          },
        },
        { upsert: true, new: true },
      ).then((doc) => {
        if (!doc) return;
        // Recompute derived stats and write them back
        const attempts = doc.totalAttempts || 1;
        const accuracy = Math.round((doc.correctAttempts / attempts) * 100);
        const avg      = doc.totalSolvingTimeSec / attempts;
        const variance = doc.sumSolvingTimeSq / attempts - avg * avg;
        const stdDev   = Math.sqrt(Math.max(0, variance));

        // Item discrimination index
        const hiRate = doc.highMasteryAttempts > 0
          ? doc.highMasteryCorrect / doc.highMasteryAttempts : 0;
        const loRate = doc.lowMasteryAttempts > 0
          ? doc.lowMasteryCorrect / doc.lowMasteryAttempts : 0;
        const discrimination = Math.round((hiRate - loRate) * 100) / 100;

        // Adaptive usefulness: high when discrimination is high
        const usefulnessScore = Math.round(Math.min(100, Math.max(0,
          50 + discrimination * 50
        )));

        // Dominant mistake type
        const counts = doc.mistakeCounts as unknown as Record<string, number>;
        let dominantKey = 'conceptual';
        let dominantVal = 0;
        for (const [k, v] of Object.entries(counts ?? {})) {
          if ((v as number) > dominantVal) { dominantVal = v as number; dominantKey = k; }
        }
        const dominantMistakeType = dominantVal > 0 ? dominantKey : null;

        return QuestionPerformance.updateOne(
          { stableId: a.stableId },
          {
            $set: {
              accuracy,
              avgSolvingTimeSec:       Math.round(avg),
              stdDevSolvingTimeSec:    Math.round(stdDev),
              discriminationIndex:     discrimination,
              adaptiveUsefulnessScore: usefulnessScore,
              observedDifficultyScore: 100 - accuracy,
              dominantMistakeType,
            },
          },
        );
      }),
    );
  }

  await Promise.all(ops);

  // Back-propagate to QuestionBank.adaptiveDifficultyScore
  const stableIds = [...new Set(attempts.map(a => a.stableId))];
  const updatedPerfs = await QuestionPerformance.find({ stableId: { $in: stableIds } })
    .select('stableId observedDifficultyScore dominantMistakeType')
    .lean<{ stableId: string; observedDifficultyScore: number; dominantMistakeType: string | null }[]>();

  for (const perf of updatedPerfs) {
    await QuestionBank.updateOne(
      { stableId: perf.stableId },
      {
        $set: {
          adaptiveDifficultyScore: perf.observedDifficultyScore,
          dominantMistakeType:     perf.dominantMistakeType,
          totalAttempts:           await QuestionPerformance.findOne({ stableId: perf.stableId }).then(d => d?.totalAttempts ?? 0),
        },
      },
    );
  }
}

// ── CRUD helpers for admin ────────────────────────────────────────────────────

export async function getQuestionStats(subject?: string, chapter?: string) {
  const match: Record<string, unknown> = { isActive: true };
  if (subject) match.subject = subject;
  if (chapter) match.chapter = chapter;

  const [total, byDifficulty, byBloom, byType] = await Promise.all([
    QuestionBank.countDocuments(match),
    QuestionBank.aggregate([
      { $match: match },
      { $group: { _id: '$difficulty', count: { $sum: 1 } } },
    ]),
    QuestionBank.aggregate([
      { $match: match },
      { $group: { _id: '$bloomLevel', count: { $sum: 1 } } },
    ]),
    QuestionBank.aggregate([
      { $match: match },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]),
  ]);

  return {
    total,
    byDifficulty: Object.fromEntries(byDifficulty.map(b => [b._id, b.count])),
    byBloom:       Object.fromEntries(byBloom.map(b => [b._id, b.count])),
    byType:        Object.fromEntries(byType.map(b => [b._id, b.count])),
  };
}

export async function upsertQuestion(data: Partial<IQuestionBankDocument> & { stableId: string }) {
  return QuestionBank.findOneAndUpdate(
    { stableId: data.stableId },
    { $set: data },
    { upsert: true, new: true, runValidators: true },
  );
}

export async function getQuestionsByChapter(
  subject: string,
  chapter: string,
  limit = 50,
): Promise<IQuestionBankDocument[]> {
  return QuestionBank.find({ subject, chapter, isActive: true })
    .sort({ qualityScore: -1 })
    .limit(limit)
    .lean<IQuestionBankDocument[]>();
}

// ── Formula-linked question finder ────────────────────────────────────────────

export async function getFormulaLinkedQuestions(
  subjectSlug: string,
  chapterName: string,
  limit = 20,
): Promise<IQuestionBankDocument[]> {
  const chapter = findChapterByName(subjectSlug, chapterName);
  if (!chapter) return [];

  const tags = [chapter.slug, ...chapter.concepts.map(c => c.conceptName.toLowerCase())];

  return QuestionBank.find({
    isActive: true,
    $or: [
      { formulaTags: { $in: tags } },
      { conceptTags: { $in: chapter.concepts.map(c => c.conceptName) } },
    ],
  })
    .sort({ qualityScore: -1 })
    .limit(limit)
    .lean<IQuestionBankDocument[]>();
}
