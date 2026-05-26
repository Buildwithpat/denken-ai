/**
 * Topic weight computation for the adaptive test engine.
 *
 * Scores each topic the user has encountered on four axes:
 *   - errorRate     (wrong / attempted)              — 50 % weight
 *   - recencyScore  (decay since last wrong answer)  — 30 % weight
 *   - trendPenalty  (subject accuracy declining)     — 20 % weight
 *
 * Topics the user has never seen get a moderate default weight so they
 * still appear in tests until first attempted.
 */
import { Types } from 'mongoose';
import Result from '../models/Result';
import Test from '../models/Test';
import { TopicWeight, Difficulty } from '../types';
import { ebbinghaus, halfLifeForAccuracy } from '../lib/studyUtils';
import { cacheGet, cacheSet, CacheKey, TTL } from '../lib/cache';

export type { TopicWeight };

// ---------------------------------------------------------------------------
// Internal lean shapes (only fields we read)
// ---------------------------------------------------------------------------

interface LeanAnswer {
  questionId: string;
  selectedOption?: string;
  numericalValue?: number;
  isCorrect: boolean;
}

interface LeanSubjectSummary {
  subject: string;
  correct: number;
  wrong: number;
}

interface LeanResult {
  _id: Types.ObjectId;
  testId: Types.ObjectId;
  subjectWise: LeanSubjectSummary[];
  answers: LeanAnswer[];
  createdAt: Date;
}

interface LeanQuestion {
  id: string;
  subject: string;
  topic: string;
}

interface LeanTest {
  _id: Types.ObjectId;
  questions: LeanQuestion[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** masteryScore < 35 → easy | < 55 → mixed | < 75 → mixed | ≥ 75 → hard */
function adaptiveDifficulty(masteryScore: number): Difficulty {
  if (masteryScore < 35) return 'easy';
  if (masteryScore < 55) return 'mixed';
  if (masteryScore < 75) return 'mixed';
  return 'hard';
}

function avg(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((s, v) => s + v, 0) / arr.length;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Compute per-topic weights for a user.
 * Returns an empty Map when the user has no test history (first test).
 *
 * Results are cached in Redis for TTL.TOPIC_WEIGHTS seconds.
 * Call invalidateUserCache(userId) after a test submission to bust the cache.
 */
export async function computeTopicWeights(
  userId: string,
): Promise<Map<string, TopicWeight>> {
  // Cache check — serialize/deserialize Map as plain object
  const cacheKey = CacheKey.topicWeights(userId);
  const cached = await cacheGet<Record<string, TopicWeight>>(cacheKey);
  if (cached) {
    return new Map(Object.entries(cached));
  }

  // 1. Load all results newest-first (recency detection relies on index order)
  const results = await Result.find({ userId: new Types.ObjectId(userId) })
    .sort({ createdAt: -1 })
    .lean<LeanResult[]>();

  if (results.length === 0) return new Map();

  // 2. Batch-load referenced tests (single query)
  const testIds = [...new Set(results.map((r) => r.testId.toString()))].map(
    (id) => new Types.ObjectId(id),
  );
  const tests = await Test.find({ _id: { $in: testIds } })
    .select('questions')
    .lean<LeanTest[]>();

  const testMap = new Map<string, LeanTest>();
  for (const t of tests) testMap.set(t._id.toString(), t);

  // 3. Subject trend deltas — needs oldest-first order
  const subjectAccuracies = new Map<string, number[]>();
  for (const r of [...results].reverse()) {
    for (const sw of r.subjectWise) {
      const attempted = sw.correct + sw.wrong;
      const acc = attempted > 0 ? Math.round((sw.correct / attempted) * 100) : 0;
      const arr = subjectAccuracies.get(sw.subject) ?? [];
      arr.push(acc);
      subjectAccuracies.set(sw.subject, arr);
    }
  }

  const subjectTrendMap = new Map<string, number>();
  subjectAccuracies.forEach((accs, subject) => {
    if (accs.length < 6) { subjectTrendMap.set(subject, 0); return; }
    const delta = Math.round(avg(accs.slice(-3)) - avg(accs.slice(-6, -3)));
    subjectTrendMap.set(subject, delta);
  });

  // 4. Per-topic stats (results are newest-first)
  interface TopicStats {
    subject: string;
    wrongCount: number;
    totalAttempted: number;
    recentWrong: boolean;
    lastSeenAt: Date;
  }

  const topicMap = new Map<string, TopicStats>();

  results.forEach((result, resultIndex) => {
    const test = testMap.get(result.testId.toString());
    if (!test) return;

    const questionById = new Map<string, LeanQuestion>();
    for (const q of test.questions) questionById.set(q.id, q);

    for (const answer of result.answers) {
      const q = questionById.get(answer.questionId);
      if (!q) continue;

      const hasResponse =
        answer.selectedOption !== undefined || answer.numericalValue !== undefined;
      if (!hasResponse) continue;

      const ts = topicMap.get(q.topic) ?? {
        subject: q.subject,
        wrongCount: 0,
        totalAttempted: 0,
        recentWrong: false,
        lastSeenAt: result.createdAt,
      };

      ts.totalAttempted += 1;
      if (!answer.isCorrect) {
        ts.wrongCount += 1;
        // resultIndex < 2 means the 2 most recent test sessions
        if (resultIndex < 2) ts.recentWrong = true;
      }
      if (result.createdAt > ts.lastSeenAt) ts.lastSeenAt = result.createdAt;
      topicMap.set(q.topic, ts);
    }
  });

  // 5. Compute composite weights with Ebbinghaus retention
  const now = Date.now();
  const weights = new Map<string, TopicWeight>();

  topicMap.forEach((stats, topic) => {
    const errorRate =
      stats.totalAttempted > 0 ? stats.wrongCount / stats.totalAttempted : 0;

    const accuracy =
      stats.totalAttempted > 0
        ? Math.round(((stats.totalAttempted - stats.wrongCount) / stats.totalAttempted) * 100)
        : 50;

    // Ebbinghaus retention — how much the student still remembers
    const daysSince = (now - stats.lastSeenAt.getTime()) / (1000 * 60 * 60 * 24);
    const retentionScore = Math.round(ebbinghaus(halfLifeForAccuracy(accuracy), daysSince));
    const forgettingFactor = Math.round((1 - retentionScore / 100) * 100) / 100;

    // Mastery: accuracy captures correctness; retention captures durability
    const masteryScore = Math.round(accuracy * 0.6 + retentionScore * 0.4);

    // Recency score: 1.0 if wrong in last 2 tests, otherwise decays to 0 over ~3 weeks
    const recencyScore = stats.recentWrong
      ? 1.0
      : Math.max(0, 1 - daysSince / 21);

    const subjectTrend = subjectTrendMap.get(stats.subject) ?? 0;
    const trendPenalty = Math.max(0, -subjectTrend / 50);

    // New formula: error dominates, forgetting is second signal, recency third, inverse-mastery fourth
    const rawWeight =
      errorRate * 0.35 +
      forgettingFactor * 0.30 +
      recencyScore * 0.20 +
      (1 - masteryScore / 100) * 0.15 +
      trendPenalty * 0.10;

    const weight = Math.min(1.0, Math.max(0.05, rawWeight));

    weights.set(topic, {
      subject: stats.subject,
      accuracy,
      wrongCount: stats.wrongCount,
      totalAttempted: stats.totalAttempted,
      errorRate,
      recentWrong: stats.recentWrong,
      subjectTrend,
      daysSinceLastSeen: Math.round(daysSince),
      weight,
      suggestedDifficulty: adaptiveDifficulty(masteryScore),
      retentionScore,
      masteryScore,
      forgettingFactor,
    });
  });

  // Store as plain object (Maps can't be JSON-serialized directly)
  void cacheSet(cacheKey, Object.fromEntries(weights), TTL.TOPIC_WEIGHTS);

  return weights;
}
