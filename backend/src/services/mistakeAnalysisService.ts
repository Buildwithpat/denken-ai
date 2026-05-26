/**
 * Mistake Intelligence Service
 *
 * Classifies mistakes after each test submission into seven categories:
 *   conceptual, careless, formula, time-pressure, weak-retention, guessing, repeated
 *
 * Updates persistent MistakePattern documents so the system accumulates a
 * long-term picture of what each student repeatedly struggles with.
 *
 * Formula linking uses findChapterByName() — graceful no-op when chapter has
 * no formula dataset entry.
 */

import { Types } from 'mongoose';
import MistakePattern, { type MistakeType } from '../models/MistakePattern';
import Result from '../models/Result';
import Test from '../models/Test';
import { findChapterByName } from '../lib/formulaLoader';

// ── Subject slug normalisation ────────────────────────────────────────────────

const SUBJECT_SLUG: Record<string, string> = {
  physics:     'physics',
  chemistry:   'chemistry',
  mathematics: 'maths',
  maths:       'maths',
  biology:     'biology',
};

function toSubjectSlug(subject: string): string {
  return SUBJECT_SLUG[subject.toLowerCase()] ?? subject.toLowerCase();
}

// ── Per-answer context used for classification ────────────────────────────────

interface WrongAnswerCtx {
  questionId: string;
  topic:      string;
  subject:    string;
  qType:      'mcq' | 'numerical';
  difficulty: string;
  isMarked:   boolean;
}

// ── Classify a single wrong answer ───────────────────────────────────────────

function classifyMistake(
  ctx:               WrongAnswerCtx,
  testAccuracy:      number,   // 0–100 for this test
  timePressured:     boolean,  // time taken < 60% of allowed duration
  consecutiveWrong:  number,   // current streak before this update
): MistakeType {
  // Repeated: long unbroken streak
  if (consecutiveWrong >= 3) return 'repeated';

  // Formula: numerical questions require formula recall
  if (ctx.qType === 'numerical') return 'formula';

  // Guessing: student flagged the question (isMarked = review flag) and got it wrong
  if (ctx.isMarked) return 'guessing';

  // Time-pressure: test was rushed AND wrong
  if (timePressured) return 'time-pressure';

  // Careless: easy question wrong in a high-accuracy test
  if (ctx.difficulty === 'easy' && testAccuracy >= 65) return 'careless';

  // Weak-retention: moderate accuracy on topic but wrong here — retention gap
  // (proxy: difficulty === 'medium' and low test accuracy)
  if (ctx.difficulty === 'medium' && testAccuracy < 50) return 'weak-retention';

  return 'conceptual';
}

// ── Build human-like insight string ──────────────────────────────────────────

function buildInsight(
  topic:       string,
  dominant:    MistakeType,
  total:       number,
  consecutive: number,
): string {
  if (dominant === 'repeated' || consecutive >= 3) {
    return `You've answered ${topic} incorrectly ${total} time${total !== 1 ? 's' : ''}. This is a persistent gap — consistent practice is essential.`;
  }
  if (dominant === 'formula') {
    return `Your formula recall for ${topic} needs work. You lose marks on numerical questions that depend on precise formula application.`;
  }
  if (dominant === 'careless') {
    return `You understand ${topic} conceptually but make careless slips — double-check calculations before finalising easy questions.`;
  }
  if (dominant === 'guessing') {
    return `You frequently mark ${topic} questions for review and then answer incorrectly — strengthen your confidence here.`;
  }
  if (dominant === 'time-pressure') {
    return `${topic} mistakes cluster in rushed tests. Practice under timed conditions to improve speed and accuracy together.`;
  }
  if (dominant === 'weak-retention') {
    return `You've seen ${topic} before but the knowledge isn't sticking. Schedule regular spaced-repetition sessions.`;
  }
  return `You've made ${total} conceptual mistake${total !== 1 ? 's' : ''} in ${topic}. Focus on understanding the core principles, not just memorising steps.`;
}

// ── Dominant type from counts ─────────────────────────────────────────────────

type CountKey = 'conceptual' | 'careless' | 'formula' | 'timePressure' | 'weakRetention' | 'guessing' | 'repeated';

const TYPE_TO_KEY: Record<MistakeType, CountKey> = {
  conceptual:       'conceptual',
  careless:         'careless',
  formula:          'formula',
  'time-pressure':  'timePressure',
  'weak-retention': 'weakRetention',
  guessing:         'guessing',
  repeated:         'repeated',
};

function dominantType(counts: Record<CountKey, number>): MistakeType {
  const entries = Object.entries(counts) as [CountKey, number][];
  const top = entries.reduce((best, cur) => (cur[1] > best[1] ? cur : best), entries[0]);

  const KEY_TO_TYPE: Record<CountKey, MistakeType> = {
    conceptual:    'conceptual',
    careless:      'careless',
    formula:       'formula',
    timePressure:  'time-pressure',
    weakRetention: 'weak-retention',
    guessing:      'guessing',
    repeated:      'repeated',
  };
  return KEY_TO_TYPE[top[0]];
}

// ── Main update function (called after gradeAndSave) ─────────────────────────

export async function updateMistakePatterns(
  userId:     string,
  resultId:   string,
): Promise<void> {
  try {
    // Load the newly saved result
    const result = await Result.findById(resultId).lean();
    if (!result) return;

    // Load the corresponding test for question metadata
    const test = await Test.findById(result.testId).lean();
    if (!test) return;

    const questionMeta = new Map(test.questions.map(q => [q.id, q]));

    // Per-test stats for classification heuristics
    const attempted = result.correctCount + result.wrongCount;
    const testAccuracy = attempted > 0
      ? Math.round((result.correctCount / attempted) * 100)
      : 0;
    const timePressured = test.duration > 0 && result.timeTaken < test.duration * 60 * 0.6;

    // Build wrong-answer contexts
    const wrongAnswers: WrongAnswerCtx[] = [];
    for (const ans of result.answers) {
      if (ans.isCorrect) continue;
      const q = questionMeta.get(ans.questionId);
      if (!q) continue;

      const hasResponse = ans.selectedOption !== undefined || ans.numericalValue !== undefined;
      if (!hasResponse) continue; // skip unattempted

      wrongAnswers.push({
        questionId: ans.questionId,
        topic:      q.topic,
        subject:    q.subject,
        qType:      q.type,
        difficulty: q.difficulty,
        isMarked:   ans.isMarked,
      });
    }

    if (wrongAnswers.length === 0) return;

    // Group by topic to batch-process
    const byTopic = new Map<string, WrongAnswerCtx[]>();
    for (const wa of wrongAnswers) {
      const arr = byTopic.get(wa.topic) ?? [];
      arr.push(wa);
      byTopic.set(wa.topic, arr);
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);
    const userOid = new Types.ObjectId(userId);

    // Fetch existing patterns for affected topics in one query
    const topics = [...byTopic.keys()];
    const existingPatterns = await MistakePattern.find({
      userId: userOid,
      topic:  { $in: topics },
    }).lean();
    const patternMap = new Map(existingPatterns.map(p => [p.topic, p]));

    // Bulk operations
    const ops: Promise<unknown>[] = [];

    for (const [topic, answers] of byTopic) {
      const existing = patternMap.get(topic);
      const firstAnswer = answers[0];
      const subject = firstAnswer.subject;

      // Current counts
      const counts: Record<CountKey, number> = existing
        ? {
            conceptual:    existing.mistakeCounts.conceptual,
            careless:      existing.mistakeCounts.careless,
            formula:       existing.mistakeCounts.formula,
            timePressure:  existing.mistakeCounts.timePressure,
            weakRetention: existing.mistakeCounts.weakRetention,
            guessing:      existing.mistakeCounts.guessing,
            repeated:      existing.mistakeCounts.repeated,
          }
        : { conceptual: 0, careless: 0, formula: 0, timePressure: 0, weakRetention: 0, guessing: 0, repeated: 0 };

      const prevConsecutive = existing?.consecutiveWrong ?? 0;

      // Classify and accumulate each wrong answer in this topic
      for (const wa of answers) {
        const type = classifyMistake(wa, testAccuracy, timePressured, prevConsecutive);
        counts[TYPE_TO_KEY[type]] += 1;
      }

      const newTotal       = (existing?.totalMistakes ?? 0) + answers.length;
      const newConsecutive = prevConsecutive + answers.length;
      const dominant       = dominantType(counts);

      // Formula linking — try to find formula chapter for this topic
      let linkedSlug: string | null = existing?.linkedFormulaChapterSlug ?? null;
      let linkedSubSlug: string | null = existing?.linkedSubjectSlug ?? null;

      if (!linkedSlug) {
        const subSlug = toSubjectSlug(subject);
        const chapter = findChapterByName(subSlug, topic);
        if (chapter) {
          linkedSlug    = chapter.slug;
          linkedSubSlug = subSlug;
        }
      }

      // Recent mistakes: recalculate (simple approximation — add new ones; drift old ones out lazily)
      const prevRecent = existing ? (
        existing.lastMistakeAt >= thirtyDaysAgo ? existing.recentMistakes : 0
      ) : 0;
      const newRecent = prevRecent + answers.length;

      const insight = buildInsight(topic, dominant, newTotal, newConsecutive);

      ops.push(
        MistakePattern.findOneAndUpdate(
          { userId: userOid, topic },
          {
            $set: {
              subject,
              totalMistakes:            newTotal,
              recentMistakes:           newRecent,
              consecutiveWrong:         newConsecutive,
              'mistakeCounts.conceptual':    counts.conceptual,
              'mistakeCounts.careless':      counts.careless,
              'mistakeCounts.formula':       counts.formula,
              'mistakeCounts.timePressure':  counts.timePressure,
              'mistakeCounts.weakRetention': counts.weakRetention,
              'mistakeCounts.guessing':      counts.guessing,
              'mistakeCounts.repeated':      counts.repeated,
              dominantType:             dominant,
              linkedFormulaChapterSlug: linkedSlug,
              linkedSubjectSlug:        linkedSubSlug,
              lastMistakeAt:            new Date(),
              insight,
            },
          },
          { upsert: true, new: true },
        ),
      );
    }

    // Also reset consecutiveWrong for topics the user got right in this test
    const correctTopics = new Set<string>();
    for (const ans of result.answers) {
      if (!ans.isCorrect) continue;
      const q = questionMeta.get(ans.questionId);
      if (q && !byTopic.has(q.topic)) correctTopics.add(q.topic);
    }

    if (correctTopics.size > 0) {
      ops.push(
        MistakePattern.updateMany(
          { userId: userOid, topic: { $in: [...correctTopics] } },
          { $set: { consecutiveWrong: 0 } },
        ),
      );
    }

    await Promise.all(ops);
  } catch (err) {
    // Non-blocking — log but never throw (gradeAndSave must succeed regardless)
    console.error('[mistakeAnalysisService] updateMistakePatterns failed:', (err as Error).message);
  }
}

// ── Per-test mistake analysis (for result page) ───────────────────────────────

export interface TestMistakeItem {
  questionId: string;
  topic:      string;
  subject:    string;
  type:       MistakeType;
  qType:      'mcq' | 'numerical';
  difficulty: string;
}

export interface TestMistakeSummary {
  totalWrong:       number;
  byType:           Record<MistakeType, number>;
  dominantType:     MistakeType | null;
  items:            TestMistakeItem[];
  insight:          string;
}

export async function analyseTestMistakes(
  userId:   string,
  resultId: string,
): Promise<TestMistakeSummary> {
  const result = await Result.findById(resultId).lean();
  if (!result || result.userId.toString() !== userId) {
    return { totalWrong: 0, byType: emptyByType(), dominantType: null, items: [], insight: '' };
  }

  const test = await Test.findById(result.testId).lean();
  if (!test) {
    return { totalWrong: 0, byType: emptyByType(), dominantType: null, items: [], insight: '' };
  }

  const questionMeta = new Map(test.questions.map(q => [q.id, q]));
  const attempted    = result.correctCount + result.wrongCount;
  const testAccuracy = attempted > 0
    ? Math.round((result.correctCount / attempted) * 100)
    : 0;
  const timePressured = test.duration > 0 && result.timeTaken < test.duration * 60 * 0.6;

  const items:     TestMistakeItem[] = [];
  const byType:    Record<MistakeType, number> = emptyByType();

  for (const ans of result.answers) {
    if (ans.isCorrect) continue;
    const q = questionMeta.get(ans.questionId);
    if (!q) continue;
    const hasResponse = ans.selectedOption !== undefined || ans.numericalValue !== undefined;
    if (!hasResponse) continue;

    const type = classifyMistake(
      { questionId: ans.questionId, topic: q.topic, subject: q.subject, qType: q.type, difficulty: q.difficulty, isMarked: ans.isMarked },
      testAccuracy,
      timePressured,
      0, // no streak context for per-test analysis
    );

    byType[type] = (byType[type] ?? 0) + 1;
    items.push({ questionId: ans.questionId, topic: q.topic, subject: q.subject, type, qType: q.type, difficulty: q.difficulty });
  }

  const totalWrong = items.length;
  if (totalWrong === 0) {
    return { totalWrong: 0, byType, dominantType: null, items, insight: 'No wrong answers — excellent!' };
  }

  const dom = dominantType(byType as unknown as Record<CountKey, number>);
  const insight = buildTestInsight(dom, byType, testAccuracy, timePressured);

  return { totalWrong, byType, dominantType: dom, items, insight };
}

function buildTestInsight(
  dom:          MistakeType,
  byType:       Record<MistakeType, number>,
  accuracy:     number,
  timePressured: boolean,
): string {
  if (timePressured && byType['time-pressure'] > 0) {
    return `You ran out of time — ${byType['time-pressure']} mistakes likely happened because of rushing. Practice timed sessions to build speed.`;
  }
  if (dom === 'formula') {
    return `Most mistakes were in numerical questions. Write out the relevant formulas before attempting — precision matters here.`;
  }
  if (dom === 'careless' && accuracy >= 65) {
    return `Strong accuracy overall, but careless slips cost marks on easy questions. Slow down the final 5 minutes to review.`;
  }
  if (dom === 'repeated') {
    return `Several topics have become recurring weak spots. Targeted revision on those chapters will have the highest return.`;
  }
  if (dom === 'guessing') {
    return `Many flagged questions ended up wrong — trust your first instinct or skip and revisit with a clear head.`;
  }
  if (dom === 'weak-retention') {
    return `Topics you've studied before are fading. Schedule a spaced-repetition revision session this week.`;
  }
  return `Most mistakes were conceptual. Focus on building first-principles understanding rather than pattern memorisation.`;
}

function emptyByType(): Record<MistakeType, number> {
  return { conceptual: 0, careless: 0, formula: 0, 'time-pressure': 0, 'weak-retention': 0, guessing: 0, repeated: 0 };
}

// ── Mistake patterns API helpers ──────────────────────────────────────────────

export interface MistakePatternSummary {
  topic:                   string;
  subject:                 string;
  totalMistakes:           number;
  recentMistakes:          number;
  consecutiveWrong:        number;
  dominantType:            MistakeType;
  insight:                 string;
  linkedFormulaChapterSlug: string | null;
  linkedSubjectSlug:        string | null;
  lastMistakeAt:           string;
  mistakeCounts:           {
    conceptual: number; careless: number; formula: number;
    timePressure: number; weakRetention: number; guessing: number; repeated: number;
  };
}

export async function getMistakePatterns(userId: string): Promise<MistakePatternSummary[]> {
  const patterns = await MistakePattern.find({ userId: new Types.ObjectId(userId) })
    .sort({ totalMistakes: -1, lastMistakeAt: -1 })
    .lean();

  return patterns.map(p => ({
    topic:                    p.topic,
    subject:                  p.subject,
    totalMistakes:            p.totalMistakes,
    recentMistakes:           p.recentMistakes,
    consecutiveWrong:         p.consecutiveWrong,
    dominantType:             p.dominantType as MistakeType,
    insight:                  p.insight,
    linkedFormulaChapterSlug: p.linkedFormulaChapterSlug,
    linkedSubjectSlug:        p.linkedSubjectSlug,
    lastMistakeAt:            p.lastMistakeAt.toISOString(),
    mistakeCounts: {
      conceptual:    p.mistakeCounts.conceptual,
      careless:      p.mistakeCounts.careless,
      formula:       p.mistakeCounts.formula,
      timePressure:  p.mistakeCounts.timePressure,
      weakRetention: p.mistakeCounts.weakRetention,
      guessing:      p.mistakeCounts.guessing,
      repeated:      p.mistakeCounts.repeated,
    },
  }));
}

// ── Smart revision queue ──────────────────────────────────────────────────────

export interface RevisionQueueItem {
  topic:        string;
  subject:      string;
  priority:     'critical' | 'high' | 'medium';
  reason:       string;
  totalMistakes: number;
  dominantType: MistakeType;
  linkedFormulaChapterSlug: string | null;
  linkedSubjectSlug: string | null;
}

export async function getRevisionQueue(userId: string): Promise<RevisionQueueItem[]> {
  const patterns = await MistakePattern.find({ userId: new Types.ObjectId(userId) })
    .sort({ lastMistakeAt: -1 })
    .lean();

  if (patterns.length === 0) return [];

  const queue: RevisionQueueItem[] = patterns.map(p => {
    // Priority score: mistakes × weight + recency boost + streak bonus
    const recencyDays = Math.floor((Date.now() - p.lastMistakeAt.getTime()) / 86_400_000);
    const recencyBoost = recencyDays <= 1 ? 1.0 : recencyDays <= 7 ? 0.6 : 0.2;
    const streakBonus  = p.consecutiveWrong >= 3 ? 0.5 : p.consecutiveWrong >= 2 ? 0.2 : 0;
    const score        = p.totalMistakes * 0.5 + p.recentMistakes * 0.3 + recencyBoost + streakBonus;

    let priority: 'critical' | 'high' | 'medium';
    if (p.consecutiveWrong >= 3 || score >= 5) priority = 'critical';
    else if (score >= 2.5 || p.recentMistakes >= 2) priority = 'high';
    else priority = 'medium';

    const reason = buildRevisionReason(p.dominantType as MistakeType, p.consecutiveWrong, p.totalMistakes, recencyDays);

    return {
      topic:                    p.topic,
      subject:                  p.subject,
      priority,
      reason,
      totalMistakes:            p.totalMistakes,
      dominantType:             p.dominantType as MistakeType,
      linkedFormulaChapterSlug: p.linkedFormulaChapterSlug,
      linkedSubjectSlug:        p.linkedSubjectSlug,
    };
  });

  // Sort: critical → high → medium, then by score desc
  const ORDER = { critical: 0, high: 1, medium: 2 };
  return queue.sort((a, b) => ORDER[a.priority] - ORDER[b.priority]);
}

function buildRevisionReason(
  type:        MistakeType,
  consecutive: number,
  total:       number,
  daysAgo:     number,
): string {
  if (consecutive >= 3) return `Wrong ${consecutive} tests in a row — this needs urgent attention.`;
  if (type === 'formula') return `Formula recall is weak here — review and practice writing from memory.`;
  if (type === 'careless') return `Careless errors on easy questions — a quick targeted drill will fix this.`;
  if (type === 'weak-retention') return `Knowledge is fading — revisit the fundamentals with spaced repetition.`;
  if (type === 'repeated') return `Repeated mistake pattern detected across ${total} attempts.`;
  if (type === 'guessing') return `Uncertainty in this topic is costing marks — build genuine understanding.`;
  if (daysAgo <= 2) return `Made mistakes here recently — address it while it's fresh.`;
  return `Conceptual gap with ${total} mistake${total !== 1 ? 's' : ''} — revisit core theory.`;
}

// ── Formula-linked mistakes ───────────────────────────────────────────────────

export async function getFormulaLinkedMistakes(
  userId: string,
): Promise<MistakePatternSummary[]> {
  const patterns = await MistakePattern.find({
    userId: new Types.ObjectId(userId),
    linkedFormulaChapterSlug: { $ne: null },
  })
    .sort({ totalMistakes: -1 })
    .lean();

  return patterns.map(p => ({
    topic:                    p.topic,
    subject:                  p.subject,
    totalMistakes:            p.totalMistakes,
    recentMistakes:           p.recentMistakes,
    consecutiveWrong:         p.consecutiveWrong,
    dominantType:             p.dominantType as MistakeType,
    insight:                  p.insight,
    linkedFormulaChapterSlug: p.linkedFormulaChapterSlug,
    linkedSubjectSlug:        p.linkedSubjectSlug,
    lastMistakeAt:            p.lastMistakeAt.toISOString(),
    mistakeCounts: {
      conceptual:    p.mistakeCounts.conceptual,
      careless:      p.mistakeCounts.careless,
      formula:       p.mistakeCounts.formula,
      timePressure:  p.mistakeCounts.timePressure,
      weakRetention: p.mistakeCounts.weakRetention,
      guessing:      p.mistakeCounts.guessing,
      repeated:      p.mistakeCounts.repeated,
    },
  }));
}
