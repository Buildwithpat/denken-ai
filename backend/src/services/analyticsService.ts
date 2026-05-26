import { Types } from 'mongoose';
import Result from '../models/Result';
import Test from '../models/Test';
import User from '../models/User';
import { aiServiceClient } from '../lib/aiServiceClient';
import { ebbinghaus, halfLifeForAccuracy, retentionDecayFactor } from '../lib/studyUtils';

// ---------------------------------------------------------------------------
// Internal lean shapes — only the fields we actually read
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
  unattempted: number;
}

interface LeanResult {
  _id: Types.ObjectId;
  testId: Types.ObjectId;
  correctCount: number;
  wrongCount: number;
  subjectWise: LeanSubjectSummary[];
  answers: LeanAnswer[];
  createdAt: Date;
}

interface LeanQuestion {
  id: string;
  subject: string;
  topic: string;
  type: 'mcq' | 'numerical';
}

interface LeanTest {
  _id: Types.ObjectId;
  exam: string;
  subjects: string[];
  questions: LeanQuestion[];
}

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface AnalyticsData {
  overview: {
    testsTaken: number;
    avgAccuracy: number;
    bestAccuracy: number;
    currentStreak: number;
    longestStreak: number;
  };
  trends: {
    accuracy: number;
    exam: string;
    date: string;
  }[];
  subjects: {
    subject: string;
    correct: number;
    wrong: number;
    unattempted: number;
    accuracy: number;
    trend: number;
  }[];
  weakTopics: {
    topic: string;
    subject: string;
    wrongCount: number;
    totalAttempted: number;
    accuracy: number;
    masteryScore: number;
    retentionScore: number;
    lastSeenAt: string;
  }[];
  strengths: {
    topic: string;
    subject: string;
    accuracy: number;
    masteryScore: number;
    totalAttempted: number;
  }[];
  questionTypes: {
    type: string;
    correct: number;
    wrong: number;
    attempted: number;
    accuracy: number;
  }[];
  activity: {
    date: string;
    count: number;
  }[];
  recommendations: {
    title: string;
    body: string;
    sentiment: 'success' | 'warning' | 'danger';
  }[];
  revisionRoadmap: {
    day: string;
    topic: string;
    subject: string;
    duration: string;
  }[];
  lastTest: {
    exam: string;
    subjects: string[];
    accuracy: number;
    date: string;
  } | null;
  exam: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeAccuracy(correct: number, wrong: number): number {
  const attempted = correct + wrong;
  return attempted > 0 ? Math.round((correct / attempted) * 100) : 0;
}

/** Count consecutive days going backwards from today that have ≥1 test. */
function computeStreak(dates: Date[]): number {
  if (dates.length === 0) return 0;

  const toUtcDateStr = (d: Date): string =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

  const dateSet = new Set(dates.map(toUtcDateStr));

  const today = new Date();
  let streak = 0;
  const cursor = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  while (dateSet.has(toUtcDateStr(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return streak;
}

/** Returns Map<subject, trendDelta> — avg(last 3 accuracies) minus avg(prior 3 accuracies). */
function computeSubjectTrends(results: LeanResult[]): Map<string, number> {
  // Collect per-test accuracy per subject (results already oldest→newest)
  const subjectAccuracies = new Map<string, number[]>();

  for (const result of results) {
    for (const sw of result.subjectWise) {
      const acc = computeAccuracy(sw.correct, sw.wrong);
      const arr = subjectAccuracies.get(sw.subject) ?? [];
      arr.push(acc);
      subjectAccuracies.set(sw.subject, arr);
    }
  }

  const avg = (arr: number[]): number =>
    arr.length === 0 ? 0 : arr.reduce((s, v) => s + v, 0) / arr.length;

  const trendMap = new Map<string, number>();

  subjectAccuracies.forEach((accs, subject) => {
    if (accs.length < 6) {
      trendMap.set(subject, 0);
      return;
    }
    const recent = accs.slice(-3);
    const prior = accs.slice(-6, -3);
    trendMap.set(subject, Math.round(avg(recent) - avg(prior)));
  });

  return trendMap;
}

function emptyAnalytics(): AnalyticsData {
  return {
    overview: { testsTaken: 0, avgAccuracy: 0, bestAccuracy: 0, currentStreak: 0, longestStreak: 0 },
    trends: [],
    subjects: [],
    weakTopics: [],
    strengths: [],
    questionTypes: [],
    activity: [],
    recommendations: [{ title: 'No tests yet', body: 'Take your first test to see analytics.', sentiment: 'success' }],
    revisionRoadmap: [],
    lastTest: null,
    exam: null,
  };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * @param full  true (default) = full analytics with AI + premium fields.
 *              false = free-tier subset: overview, limited trends, subjects,
 *              activity, last test — no weak topics, roadmap, or AI recommendations.
 */
export async function getUserAnalytics(userId: string, full = true): Promise<AnalyticsData> {
  // 1. Load all results for the user (oldest first) + user streak data in parallel
  const [results, userDoc] = await Promise.all([
    Result.find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: 1 })
      .lean<LeanResult[]>(),
    User.findById(userId).select('currentStreak longestStreak').lean(),
  ]);

  if (results.length === 0) return emptyAnalytics();

  // 2. Batch-load all referenced tests in ONE query
  const testIds = [...new Set(results.map((r) => r.testId.toString()))].map(
    (id) => new Types.ObjectId(id),
  );

  const tests = await Test.find({ _id: { $in: testIds } }).lean<LeanTest[]>();

  const testMap = new Map<string, LeanTest>();
  for (const t of tests) {
    testMap.set(t._id.toString(), t);
  }

  // 3. Overview ---------------------------------------------------------------

  const accuracies = results.map((r) => computeAccuracy(r.correctCount, r.wrongCount));
  const avgAccuracy = Math.round(accuracies.reduce((s, v) => s + v, 0) / accuracies.length);
  const bestAccuracy = Math.max(...accuracies);
  // Prefer User model streak (includes revisions) over test-only computed streak
  const currentStreak = userDoc?.currentStreak ?? computeStreak(results.map((r) => r.createdAt));
  const longestStreak = userDoc?.longestStreak ?? currentStreak;

  // 4. Trends — last 10 for full analytics, last 3 for free tier ---------------

  const trendWindow = full ? 10 : 3;
  const last10 = results.slice(-trendWindow);
  const trends = last10.map((r, i) => {
    const test = testMap.get(r.testId.toString());
    return {
      accuracy: accuracies[results.length - last10.length + i],
      exam: test?.exam ?? 'Unknown',
      date: r.createdAt.toISOString(),
    };
  });

  // 5. Subject aggregates ------------------------------------------------------

  const subjectTotals = new Map<string, { correct: number; wrong: number; unattempted: number }>();

  for (const result of results) {
    for (const sw of result.subjectWise) {
      const existing = subjectTotals.get(sw.subject) ?? { correct: 0, wrong: 0, unattempted: 0 };
      existing.correct += sw.correct;
      existing.wrong += sw.wrong;
      existing.unattempted += sw.unattempted;
      subjectTotals.set(sw.subject, existing);
    }
  }

  const subjectTrendMap = computeSubjectTrends(results);

  const subjects = Array.from(subjectTotals.entries()).map(([subject, totals]) => ({
    subject,
    correct: totals.correct,
    wrong: totals.wrong,
    unattempted: totals.unattempted,
    accuracy: computeAccuracy(totals.correct, totals.wrong),
    trend: subjectTrendMap.get(subject) ?? 0,
  }));

  // 6. Weak topics & question types (premium only) ----------------------------

  interface TopicStats {
    subject: string;
    wrongCount: number;
    totalAttempted: number;
    lastSeenAt: Date;
  }

  const topicMap = new Map<string, TopicStats>();

  interface QTypeStats {
    correct: number;
    wrong: number;
  }
  const qTypeMap = new Map<string, QTypeStats>();

  if (full) {
    for (const result of results) {
      const test = testMap.get(result.testId.toString());
      if (!test) continue;

      const questionById = new Map<string, LeanQuestion>();
      for (const q of test.questions) {
        questionById.set(q.id, q);
      }

      for (const answer of result.answers) {
        const q = questionById.get(answer.questionId);
        if (!q) continue;

        const hasResponse =
          answer.selectedOption !== undefined || answer.numericalValue !== undefined;

        if (hasResponse) {
          const existing = topicMap.get(q.topic);
          const stats = existing ?? { subject: q.subject, wrongCount: 0, totalAttempted: 0, lastSeenAt: result.createdAt };
          stats.totalAttempted += 1;
          if (!answer.isCorrect) stats.wrongCount += 1;
          if (result.createdAt > stats.lastSeenAt) stats.lastSeenAt = result.createdAt;
          topicMap.set(q.topic, stats);

          const ts = qTypeMap.get(q.type) ?? { correct: 0, wrong: 0 };
          if (answer.isCorrect) ts.correct += 1;
          else ts.wrong += 1;
          qTypeMap.set(q.type, ts);
        }
      }
    }
  }

  const now = Date.now();

  const weakTopics = full
    ? Array.from(topicMap.entries())
        .filter(([, s]) => s.wrongCount > 0)
        .map(([topic, s]) => {
          const accuracy      = computeAccuracy(s.totalAttempted - s.wrongCount, s.wrongCount);
          const daysSince     = Math.max(0, Math.floor((now - s.lastSeenAt.getTime()) / 86_400_000));
          const retentionScore = Math.round(ebbinghaus(halfLifeForAccuracy(accuracy), daysSince));
          const masteryScore  = Math.round(accuracy * 0.6 + retentionScore * 0.4);
          return { topic, subject: s.subject, wrongCount: s.wrongCount, totalAttempted: s.totalAttempted, accuracy, masteryScore, retentionScore, lastSeenAt: s.lastSeenAt.toISOString() };
        })
        .sort((a, b) => a.masteryScore - b.masteryScore)
        .slice(0, 10)
    : [];

  const strengths = full
    ? Array.from(topicMap.entries())
        .filter(([, s]) => {
          const acc = computeAccuracy(s.totalAttempted - s.wrongCount, s.wrongCount);
          return acc >= 75 && s.totalAttempted >= 3;
        })
        .map(([topic, s]) => {
          const accuracy     = computeAccuracy(s.totalAttempted - s.wrongCount, s.wrongCount);
          const daysSince    = Math.max(0, Math.floor((now - s.lastSeenAt.getTime()) / 86_400_000));
          const retentionScore = Math.round(ebbinghaus(halfLifeForAccuracy(accuracy), daysSince));
          const masteryScore = Math.round(accuracy * 0.6 + retentionScore * 0.4);
          return { topic, subject: s.subject, accuracy, masteryScore, totalAttempted: s.totalAttempted };
        })
        .sort((a, b) => b.masteryScore - a.masteryScore)
        .slice(0, 8)
    : [];

  const questionTypes = full
    ? Array.from(qTypeMap.entries()).map(([type, ts]) => {
        const attempted = ts.correct + ts.wrong;
        return { type, correct: ts.correct, wrong: ts.wrong, attempted, accuracy: computeAccuracy(ts.correct, ts.wrong) };
      })
    : [];

  // 7. Activity (last 90 days) -------------------------------------------------

  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - 90);

  const activityMap = new Map<string, number>();
  for (const result of results) {
    if (result.createdAt < cutoff) continue;
    const d = result.createdAt;
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    activityMap.set(key, (activityMap.get(key) ?? 0) + 1);
  }

  const activity = Array.from(activityMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date, count }));

  // 8. Most frequent exam ------------------------------------------------------

  const examTally = new Map<string, number>();
  for (const test of tests) {
    examTally.set(test.exam, (examTally.get(test.exam) ?? 0) + 1);
  }
  let exam: string | null = null;
  let maxCount = 0;
  examTally.forEach((count, key) => {
    if (count > maxCount) {
      maxCount = count;
      exam = key;
    }
  });

  // 9. Last test ---------------------------------------------------------------

  const lastResult = results[results.length - 1];
  const lastTest = lastResult
    ? (() => {
        const t = testMap.get(lastResult.testId.toString());
        return t
          ? {
              exam: t.exam,
              subjects: t.subjects,
              accuracy: computeAccuracy(lastResult.correctCount, lastResult.wrongCount),
              date: lastResult.createdAt.toISOString(),
            }
          : null;
      })()
    : null;

  // 10. Free-tier early return — no AI call, no premium fields ------------------

  if (!full) {
    return {
      overview: { testsTaken: results.length, avgAccuracy, bestAccuracy, currentStreak, longestStreak },
      trends,
      subjects,
      weakTopics:    [],
      strengths:     [],
      questionTypes: [],
      activity,
      recommendations: [{
        title: 'Unlock full analytics',
        body:  'Upgrade to a pro plan to see weak topic breakdowns, AI-generated recommendations, and your revision roadmap.',
        sentiment: 'success',
      }],
      revisionRoadmap: [],
      lastTest,
      exam,
    };
  }

  // 11. Deterministic recommendations (full analytics only) --------------------

  const recommendations: AnalyticsData['recommendations'] = [];

  const sortedSubjectsByAccuracy = [...subjects].sort((a, b) => a.accuracy - b.accuracy);
  if (sortedSubjectsByAccuracy.length > 0 && sortedSubjectsByAccuracy[0].accuracy < 60) {
    const weakest = sortedSubjectsByAccuracy[0];
    recommendations.push({
      title: `${weakest.subject} needs focus`,
      body: `Your accuracy in ${weakest.subject} is ${weakest.accuracy}%. Spend more time on practice problems in this area.`,
      sentiment: 'danger',
    });
  }

  const mcqStats = qTypeMap.get('mcq');
  const numStats = qTypeMap.get('numerical');
  if (mcqStats && numStats) {
    const mcqAcc = computeAccuracy(mcqStats.correct, mcqStats.wrong);
    const numAcc = computeAccuracy(numStats.correct, numStats.wrong);
    if (mcqAcc - numAcc > 15) {
      recommendations.push({
        title: 'Strengthen numerical skills',
        body: `Your MCQ accuracy (${mcqAcc}%) is significantly higher than numerical accuracy (${numAcc}%). Practice more numerical problems.`,
        sentiment: 'warning',
      });
    }
  }

  if (trends.length >= 4) {
    const last4 = trends.slice(-4).map((t) => t.accuracy);
    if (last4[last4.length - 1] - last4[0] < -10) {
      recommendations.push({
        title: 'Declining scores detected',
        body: 'Your accuracy has dropped over your recent tests. Review your weak topics and consider slowing down your test pace.',
        sentiment: 'danger',
      });
    }
  }

  const topSubject = [...subjects].sort((a, b) => b.accuracy - a.accuracy)[0];
  if (topSubject && topSubject.accuracy >= 75 && (subjectTrendMap.get(topSubject.subject) ?? 0) >= 5) {
    recommendations.push({
      title: `Great momentum in ${topSubject.subject}`,
      body: `You're performing well in ${topSubject.subject} with ${topSubject.accuracy}% accuracy and an upward trend. Keep it up!`,
      sentiment: 'success',
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      title: 'Keep up the consistency',
      body: 'You are building a solid practice habit. Stay consistent and challenge yourself with harder tests.',
      sentiment: 'success',
    });
  }

  // 12. Revision roadmap -------------------------------------------------------

  function roadmapDuration(accuracy: number): string {
    if (accuracy < 40) return '50 min';
    if (accuracy < 60) return '40 min';
    return '25 min';
  }

  const revisionRoadmap = weakTopics.slice(0, 7).map((wt, i) => ({
    day:      `Day ${i + 1}`,
    topic:    wt.topic,
    subject:  wt.subject,
    duration: roadmapDuration(wt.accuracy),
  }));

  // 13. AI-enhanced recommendations -------------------------------------------

  const aiPerf = await aiServiceClient.analyzePerformance({
    exam:           exam ?? 'UNKNOWN',
    subjects:       subjects.map((s) => ({ subject: s.subject, accuracy: s.accuracy, trend: s.trend })),
    weak_topics:    weakTopics.slice(0, 5).map((wt) => ({
      topic:       wt.topic,
      subject:     wt.subject,
      accuracy:    wt.accuracy,
      wrong_count: wt.wrongCount,
    })),
    question_types: questionTypes.map((qt) => ({ type: qt.type, accuracy: qt.accuracy })),
    avg_accuracy:   avgAccuracy,
    tests_taken:    results.length,
  });

  const finalRecommendations: AnalyticsData['recommendations'] =
    aiPerf?.recommendations.map((r) => ({
      title:     r.title,
      body:      r.body,
      sentiment: r.sentiment,
    })) ?? recommendations;

  // ---------------------------------------------------------------------------

  return {
    overview: { testsTaken: results.length, avgAccuracy, bestAccuracy, currentStreak, longestStreak },
    trends,
    subjects,
    weakTopics,
    strengths,
    questionTypes,
    activity,
    recommendations: finalRecommendations,
    revisionRoadmap,
    lastTest,
    exam,
  };
}
