import { Types } from 'mongoose';
import Result from '../models/Result';
import Test   from '../models/Test';
import { aiServiceClient } from '../lib/aiServiceClient';
import { retentionDecayFactor } from '../lib/studyUtils';
import { getMultiChapterPYQs, formatPYQsForPrompt } from '../lib/pyqRetrieval';
import { getChapterIntelligence } from '../lib/importantTopicsLoader';
import { logger } from '../lib/logger';

// ---------------------------------------------------------------------------
// Lean shapes — only fields we read
// ---------------------------------------------------------------------------

interface LeanAnswer {
  questionId: string;
  selectedOption?: string;
  numericalValue?: number;
  isCorrect: boolean;
}

interface LeanResult {
  _id: Types.ObjectId;
  testId: Types.ObjectId;
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
// Public interfaces
// ---------------------------------------------------------------------------

export interface RevisionQueueItem {
  topic: string;
  subject: string;
  /** % correct out of attempted */
  accuracy: number;
  /** 0–1 composite: errorRate×0.6 + recencyBoost×0.4 */
  priorityScore: number;
  wrongCount: number;
  totalAttempted: number;
  lastSeenAt: string;
}

export interface MistakeLogItem {
  topic: string;
  subject: string;
  wrongCount: number;
  lastSeen: string;
}

export interface RevisionPlanItem {
  day: string;
  topic: string;
  subject: string;
  duration: string;
  /** Recommended revision mode based on accuracy */
  mode: 'concept' | 'drill' | 'practice';
  priorityLabel: 'critical' | 'high' | 'medium';
  /** AI-generated focus points for this revision session (empty if AI service unavailable) */
  focusPoints: string[];
}

export interface RevisionData {
  queue: RevisionQueueItem[];
  mistakeLog: MistakeLogItem[];
  plan: RevisionPlanItem[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeAccuracy(correct: number, wrong: number): number {
  const attempted = correct + wrong;
  return attempted > 0 ? Math.round((correct / attempted) * 100) : 0;
}

/** accuracy < 40 → concept review, < 60 → drill, else → practice */
function modeFor(accuracy: number): 'concept' | 'drill' | 'practice' {
  if (accuracy < 40) return 'concept';
  if (accuracy < 60) return 'drill';
  return 'practice';
}

function priorityLabelFor(score: number): 'critical' | 'high' | 'medium' {
  if (score >= 0.7) return 'critical';
  if (score >= 0.45) return 'high';
  return 'medium';
}

/** Duration driven by revision mode so effort matches topic difficulty. */
const MODE_DURATION: Record<'concept' | 'drill' | 'practice', string> = {
  concept:  '50 min',
  drill:    '40 min',
  practice: '25 min',
};

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * @param full  true (default) = full revision with AI focus points + mistake log.
 *              false = free-tier subset: top 3 queue items only, empty plan and mistakeLog.
 */
export async function getUserRevision(userId: string, full = true): Promise<RevisionData> {
  // 1. Load results newest-first (recency detection needs index order)
  const results = await Result.find({ userId: new Types.ObjectId(userId) })
    .sort({ createdAt: -1 })
    .lean<LeanResult[]>();

  if (results.length === 0) return { queue: [], mistakeLog: [], plan: [] };

  // 2. Batch-load all referenced tests in ONE query
  const testIds = [...new Set(results.map((r) => r.testId.toString()))].map(
    (id) => new Types.ObjectId(id),
  );
  const tests = await Test.find({ _id: { $in: testIds } }).lean<LeanTest[]>();

  const testMap = new Map<string, LeanTest>();
  for (const t of tests) testMap.set(t._id.toString(), t);

  // 3. Build topic stats + mistake log via in-memory join
  interface TopicStats {
    subject: string;
    wrongCount: number;
    totalAttempted: number;
    lastSeenAt: Date;
    recentWrong: number; // wrong answers from the 2 most recent results
  }

  const topicMap = new Map<string, TopicStats>();
  const mistakeMap = new Map<string, { subject: string; wrongCount: number; lastSeen: Date }>();

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

      // Topic accumulator
      const ts = topicMap.get(q.topic) ?? {
        subject: q.subject,
        wrongCount: 0,
        totalAttempted: 0,
        lastSeenAt: result.createdAt,
        recentWrong: 0,
      };

      ts.totalAttempted += 1;
      if (!answer.isCorrect) {
        ts.wrongCount += 1;
        // results are newest-first; first two entries are the most recent tests
        if (resultIndex < 2) ts.recentWrong += 1;
      }
      // Results are newest-first, so the first encounter per topic is most recent
      if (result.createdAt > ts.lastSeenAt) ts.lastSeenAt = result.createdAt;
      topicMap.set(q.topic, ts);

      // Mistake log accumulator (wrong answers only)
      if (!answer.isCorrect) {
        const ms = mistakeMap.get(q.topic) ?? {
          subject: q.subject,
          wrongCount: 0,
          lastSeen: result.createdAt,
        };
        ms.wrongCount += 1;
        if (result.createdAt > ms.lastSeen) ms.lastSeen = result.createdAt;
        mistakeMap.set(q.topic, ms);
      }
    }
  });

  // 4. Compute priority scores and build sorted revision queue
  //    priorityScore = errorRate×0.45 + recencyBoost×0.25 + retentionDecay×0.15 + revisionValue×0.15
  const now = Date.now();

  // We need the exam context for important-topics lookup — derive from latest test
  const latestTestForIntel = testMap.get(results[0]?.testId.toString() ?? '');
  const examForIntel = latestTestForIntel?.exam ?? 'JEE_MAIN';

  const queue: RevisionQueueItem[] = Array.from(topicMap.entries())
    .filter(([, s]) => s.wrongCount > 0)
    .map(([topic, s]) => {
      const errorRate    = s.totalAttempted > 0 ? s.wrongCount / s.totalAttempted : 0;
      const recencyBoost = s.recentWrong > 0 ? 1 : 0;
      const accuracy     = computeAccuracy(s.totalAttempted - s.wrongCount, s.wrongCount);
      const daysSince    = Math.floor((now - s.lastSeenAt.getTime()) / (1000 * 60 * 60 * 24));
      const decayFactor  = retentionDecayFactor(accuracy, daysSince);

      // Factor in important-topics revisionValue (0–10 → 0–1)
      const intel         = getChapterIntelligence(examForIntel, s.subject, topic);
      const revisionBoost = intel ? (intel.revisionValue / 10) : 0.5;

      const priorityScore = Math.round(
        (errorRate * 0.45 + recencyBoost * 0.25 + decayFactor * 0.15 + revisionBoost * 0.15) * 100,
      ) / 100;

      return {
        topic,
        subject: s.subject,
        accuracy,
        priorityScore,
        wrongCount: s.wrongCount,
        totalAttempted: s.totalAttempted,
        lastSeenAt: s.lastSeenAt.toISOString(),
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore);

  // 5. Free-tier early return — top 3 queue items, no plan, no mistake log -----

  if (!full) {
    return { queue: queue.slice(0, 3), mistakeLog: [], plan: [] };
  }

  // 6. Mistake log — sorted by most recent, capped at 20 entries (full only) --
  const mistakeLog: MistakeLogItem[] = Array.from(mistakeMap.entries())
    .map(([topic, m]) => ({
      topic,
      subject: m.subject,
      wrongCount: m.wrongCount,
      lastSeen: m.lastSeen.toISOString(),
    }))
    .sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime())
    .slice(0, 20);

  // 7. Revision plan base — top 7 queue items with enriched metadata ----------
  const top7 = queue.slice(0, 7);
  const dominantMode = top7.length > 0 ? modeFor(top7[0].accuracy) : 'drill';

  // 8. AI-enriched focus points (fire-and-forget — null on failure) -----------
  const examForAI = examForIntel;

  // Build PYQ grounding for the top revision topics — group by subject
  let revisionPYQContext: string | undefined;
  try {
    const bySubject = new Map<string, string[]>();
    for (const item of top7) {
      if (!bySubject.has(item.subject)) bySubject.set(item.subject, []);
      bySubject.get(item.subject)!.push(item.topic);
    }

    const allExamples: ReturnType<typeof getMultiChapterPYQs>['questions'] = [];
    for (const [subject, chapters] of bySubject) {
      const { questions } = getMultiChapterPYQs(examForAI, subject, chapters, 1);
      allExamples.push(...questions);
    }

    if (allExamples.length > 0) {
      revisionPYQContext = '=== REAL EXAM QUESTIONS FROM THESE TOPICS (style reference) ===\n' +
        formatPYQsForPrompt(allExamples.slice(0, 5));
      logger.info('[revisionService] PYQ grounding injected', {
        topics: top7.map(t => t.topic).join(', '),
        pyqCount: allExamples.length,
      });
    }
  } catch {
    // non-fatal
  }

  const aiRevision = await aiServiceClient.generateRevision({
    topics: top7.map((item) => ({
      topic:    item.topic,
      subject:  item.subject,
      accuracy: item.accuracy,
    })),
    exam:        examForAI,
    mode:        dominantMode,
    pyq_context: revisionPYQContext,
  });

  const plan: RevisionPlanItem[] = top7.map((item, i) => ({
    day:           `Day ${i + 1}`,
    topic:         item.topic,
    subject:       item.subject,
    duration:      MODE_DURATION[modeFor(item.accuracy)],
    mode:          modeFor(item.accuracy),
    priorityLabel: priorityLabelFor(item.priorityScore),
    focusPoints:   aiRevision?.plan[i]?.focus_points ?? [],
  }));

  return { queue, mistakeLog, plan };
}
