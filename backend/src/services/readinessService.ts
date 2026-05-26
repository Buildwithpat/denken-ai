import { Types } from 'mongoose';
import User from '../models/User';
import Result from '../models/Result';
import Test from '../models/Test';
import {
  EXAM_MONTH_DAY,
  PHASE_DAILY_MIN,
  PHASE_LABELS,
  studyPhaseFor,
  burnoutRiskFor,
  toISODate,
  ebbinghaus,
  halfLifeForAccuracy,
  resolveExamMeta,
} from '../lib/studyUtils';

// ── Lean DB shapes ────────────────────────────────────────────────────────────

interface LeanAnswer   { questionId: string; isCorrect: boolean; selectedOption?: string; numericalValue?: number; }
interface LeanSubject  { subject: string; correct: number; wrong: number; }
interface LeanResult   { _id: Types.ObjectId; testId: Types.ObjectId; correctCount: number; wrongCount: number; subjectWise: LeanSubject[]; answers: LeanAnswer[]; createdAt: Date; }
interface LeanQuestion { id: string; subject: string; topic: string; }
interface LeanTest     { _id: Types.ObjectId; questions: LeanQuestion[]; }

// ── Public types ──────────────────────────────────────────────────────────────

export type BurnoutRisk        = 'none' | 'low' | 'moderate' | 'high';
export type StudyPhase         = 'foundation' | 'consolidation' | 'intensive' | 'revision' | 'final' | 'post-exam';
export type ConfidenceBandWidth = 'narrow' | 'moderate' | 'wide';
export type IntensityChange    = 'increase' | 'maintain' | 'reduce';
export type ReadinessTrend     = 'improving' | 'stable' | 'declining';

export interface SubjectReadiness {
  subject: string;
  score: number;
  accuracy: number;
  retentionHealth: number;
  consistencyScore: number;
  trend: ReadinessTrend;
  weakTopicCount: number;
  criticalTopics: string[];
}

export interface ConfidenceBand {
  low: number;
  expected: number;
  high: number;
  width: ConfidenceBandWidth;
  note: string;
}

export interface WeaknessForecast {
  topic: string;
  subject: string;
  currentRetention: number;
  examDateRetention: number | null;
  errorRate: number;
  riskLevel: 'critical' | 'high' | 'medium';
  recommendation: string;
}

export interface PercentileEstimate {
  estimated: number;
  rangeLow: number;
  rangeHigh: number;
  exam: string;
  caveat: string;
}

export interface PlannerFeedback {
  baseDailyMin: number;
  adjustedDailyMin: number;
  intensityChange: IntensityChange;
  urgentSubjects: string[];
  restDaysRecommended: number;
  criticalMessage: string | null;
  topActions: string[];
}

export interface ReadinessReport {
  overall: number;
  confidence: ConfidenceBand;
  subjects: SubjectReadiness[];
  percentile: PercentileEstimate | null;
  weaknessForecast: WeaknessForecast[];
  plannerFeedback: PlannerFeedback;
  studyPhase: StudyPhase;
  phaseLabel: string;
  daysToExam: number | null;
  examDate: string | null;
  streakDays: number;
  burnoutRisk: BurnoutRisk;
  generatedAt: string;
}

// ── Config tables (re-exported from studyUtils) ───────────────────────────────
// EXAM_MONTH_DAY, PHASE_DAILY_MIN, PHASE_LABELS are imported above

const PERCENTILE_MAPS: Record<string, [number, number][]> = {
  jee:      [[0,2],[20,5],[30,10],[40,20],[50,35],[60,55],[70,75],[80,90],[88,97],[95,99.5]],
  jee_main: [[0,2],[20,5],[30,10],[40,20],[50,35],[60,55],[70,75],[80,90],[88,97],[95,99.5]],
  neet:     [[0,3],[20,7],[30,12],[40,22],[50,38],[60,58],[70,76],[80,88],[87,96],[93,99]],
  cbse:     [[0,10],[30,20],[50,40],[65,60],[75,75],[85,85],[90,90],[95,95],[100,99]],
};

// ── Pure math helpers ─────────────────────────────────────────────────────────
// ebbinghaus() and halfLifeForAccuracy() are imported from studyUtils above

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function piecewiseLinear(x: number, points: [number, number][]): number {
  if (x <= points[0][0]) return points[0][1];
  if (x >= points[points.length - 1][0]) return points[points.length - 1][1];
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    if (x >= x0 && x <= x1) {
      const t = (x - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  return points[points.length - 1][1];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function getReadinessReport(userId: string): Promise<ReadinessReport> {
  const now = new Date();
  const MS_PER_DAY = 1000 * 60 * 60 * 24;

  // ── Step 1 — Load data ────────────────────────────────────────────────────

  const user = await User.findById(userId).lean();
  if (!user) {
    return buildEmptyReport(now, null, null, 0, 'foundation');
  }

  const results = await Result.find({ userId })
    .sort({ createdAt: -1 })
    .select('testId correctCount wrongCount subjectWise answers createdAt')
    .lean<LeanResult[]>();

  if (results.length === 0) {
    const { daysToExam, examDate, phase } = resolveExamMeta(user.targetExam, user.targetYear, now, MS_PER_DAY);
    return buildEmptyReport(now, daysToExam, examDate, PHASE_DAILY_MIN[phase], phase);
  }

  const testIds = [...new Set(results.map(r => r.testId.toString()))];
  const rawTests = await Test.find({ _id: { $in: testIds } })
    .select('questions')
    .lean<LeanTest[]>();

  const testMap = new Map<string, LeanTest>();
  for (const t of rawTests) {
    testMap.set(t._id.toString(), t);
  }

  // ── Step 2 — Exam date / phase ────────────────────────────────────────────

  const { daysToExam, examDate, phase } = resolveExamMeta(user.targetExam, user.targetYear, now, MS_PER_DAY);

  // ── Step 3 — Activity stats (last 14 days) ────────────────────────────────

  const fourteenDaysAgo = new Date(now.getTime() - 14 * MS_PER_DAY);
  const activityDates = new Set<string>();
  for (const r of results) {
    if (r.createdAt >= fourteenDaysAgo) {
      activityDates.add(toISODate(r.createdAt));
    }
  }

  const burnoutRisk: BurnoutRisk = burnoutRiskFor(activityDates.size);

  let streakDays = 0;
  {
    const cursor = new Date(now);
    cursor.setHours(0, 0, 0, 0);
    while (activityDates.has(toISODate(cursor))) {
      streakDays++;
      cursor.setDate(cursor.getDate() - 1);
    }
  }

  // ── Step 4 — Per-topic stats ──────────────────────────────────────────────

  interface TopicStats {
    subject: string;
    wrong: number;
    attempted: number;
    recentWrong: boolean;  // true if wrong in one of the two most recent results
    lastSeenAt: Date;
  }

  const topicMap = new Map<string, TopicStats>();

  // results are ordered newest-first; idx < 2 means the two most recent
  results.forEach((result, idx) => {
    const test = testMap.get(result.testId.toString());
    if (!test) return;

    const questionMeta = new Map<string, LeanQuestion>();
    for (const q of test.questions) {
      questionMeta.set(q.id, q);
    }

    for (const ans of result.answers) {
      const meta = questionMeta.get(ans.questionId);
      if (!meta) continue;

      const key = `${meta.subject}||${meta.topic}`;
      const existing = topicMap.get(key);
      const isWrong = !ans.isCorrect;

      if (!existing) {
        topicMap.set(key, {
          subject:     meta.subject,
          wrong:       isWrong ? 1 : 0,
          attempted:   1,
          recentWrong: isWrong && idx < 2,
          lastSeenAt:  result.createdAt,
        });
      } else {
        existing.wrong     += isWrong ? 1 : 0;
        existing.attempted += 1;
        // lastSeenAt stays as the most-recent result date (results are newest-first,
        // so the first time we see a topic is already the most-recent occurrence)
        existing.recentWrong = existing.recentWrong || (isWrong && idx < 2);
      }
    }
  });

  // ── Step 5 — Per-subject stats ────────────────────────────────────────────

  const subjectTotals   = new Map<string, { correct: number; wrong: number }>();
  // Per-test accuracy per subject, oldest-first (results are newest-first, so we reverse index)
  const subjectRecentAccuracies = new Map<string, number[]>();
  const subjectActivityDates    = new Map<string, Set<string>>();

  // Iterate oldest-first so recentAccuracies is already in chronological order
  for (let i = results.length - 1; i >= 0; i--) {
    const result = results[i];
    for (const sw of result.subjectWise) {
      const total = sw.correct + sw.wrong;
      if (total === 0) continue;

      const acc = (sw.correct / total) * 100;

      const totals = subjectTotals.get(sw.subject) ?? { correct: 0, wrong: 0 };
      totals.correct += sw.correct;
      totals.wrong   += sw.wrong;
      subjectTotals.set(sw.subject, totals);

      const accList = subjectRecentAccuracies.get(sw.subject) ?? [];
      accList.push(acc);
      subjectRecentAccuracies.set(sw.subject, accList);

      if (result.createdAt >= fourteenDaysAgo) {
        const dateSet = subjectActivityDates.get(sw.subject) ?? new Set<string>();
        dateSet.add(toISODate(result.createdAt));
        subjectActivityDates.set(sw.subject, dateSet);
      }
    }
  }

  const subjectReadinessList: SubjectReadiness[] = [];
  const subjectsToProcess = user.selectedSubjects.length > 0
    ? user.selectedSubjects
    : [...subjectTotals.keys()];

  for (const subject of subjectsToProcess) {
    const totals = subjectTotals.get(subject);
    if (!totals) continue;

    const totalAttempted = totals.correct + totals.wrong;
    if (totalAttempted === 0) continue;

    const accuracy = (totals.correct / totalAttempted) * 100;

    // retentionHealth: average Ebbinghaus retention across topics in this subject
    const subjectTopics: { accuracy: number; daysSinceSeen: number }[] = [];
    for (const [key, stats] of topicMap) {
      if (stats.subject !== subject || stats.attempted === 0) continue;
      const topicAccuracy = ((stats.attempted - stats.wrong) / stats.attempted) * 100;
      const daysSinceSeen = (now.getTime() - stats.lastSeenAt.getTime()) / MS_PER_DAY;
      subjectTopics.push({ accuracy: topicAccuracy, daysSinceSeen });
    }

    let retentionHealth: number;
    if (subjectTopics.length === 0) {
      retentionHealth = accuracy;
    } else {
      const retentions = subjectTopics.map(t =>
        ebbinghaus(halfLifeForAccuracy(t.accuracy), t.daysSinceSeen)
      );
      retentionHealth = retentions.reduce((s, v) => s + v, 0) / retentions.length;
    }

    const actDates = subjectActivityDates.get(subject);
    const consistencyScore = Math.min(100, ((actDates?.size ?? 0) / 7) * 100);

    const recentAccs = subjectRecentAccuracies.get(subject) ?? [];
    let trendDelta = 0;
    if (recentAccs.length >= 6) {
      const last3  = recentAccs.slice(-3).reduce((s, v) => s + v, 0) / 3;
      const prior3 = recentAccs.slice(-6, -3).reduce((s, v) => s + v, 0) / 3;
      trendDelta = last3 - prior3;
    }
    const trendScore = clamp((trendDelta + 30) / 60, 0, 1);
    const trend: ReadinessTrend =
      trendDelta >  5 ? 'improving' :
      trendDelta < -5 ? 'declining' : 'stable';

    const score = Math.round(
      accuracy         * 0.40 +
      retentionHealth  * 0.30 +
      trendScore * 100 * 0.15 +
      consistencyScore * 0.15
    );

    // Critical topics: errorRate > 0.60 OR examRetention < 30
    const criticalTopics: string[] = [];
    let weakTopicCount = 0;
    for (const [key, stats] of topicMap) {
      if (stats.subject !== subject || stats.attempted === 0) continue;
      const errorRate = stats.wrong / stats.attempted;
      if (errorRate > 0.50) weakTopicCount++;

      if (criticalTopics.length < 3) {
        const topicName = key.split('||')[1];
        if (errorRate > 0.60) {
          criticalTopics.push(topicName);
        } else if (daysToExam !== null) {
          const topicAccuracy = (1 - errorRate) * 100;
          const daysSinceSeen = (now.getTime() - stats.lastSeenAt.getTime()) / MS_PER_DAY;
          const examRetention = ebbinghaus(halfLifeForAccuracy(topicAccuracy), daysSinceSeen + daysToExam);
          if (examRetention < 30) criticalTopics.push(topicName);
        }
      }
    }

    subjectReadinessList.push({
      subject,
      score:            clamp(score, 0, 100),
      accuracy:         Math.round(accuracy),
      retentionHealth:  Math.round(clamp(retentionHealth, 0, 100)),
      consistencyScore: Math.round(consistencyScore),
      trend,
      weakTopicCount,
      criticalTopics,
    });
  }

  if (subjectReadinessList.length === 0) {
    return buildEmptyReport(now, daysToExam, examDate, PHASE_DAILY_MIN[phase], phase);
  }

  // ── Step 6 — Overall readiness ────────────────────────────────────────────

  const weightedAvg = subjectReadinessList.reduce((s, sr) => s + sr.score, 0) / subjectReadinessList.length;
  const streakBonus = Math.min(10, streakDays);

  const burnoutPenalties: Record<BurnoutRisk, number> = { none: 0, low: -2, moderate: -8, high: -15 };
  const burnoutPenalty = burnoutPenalties[burnoutRisk];

  const overall = Math.round(clamp(weightedAvg + streakBonus + burnoutPenalty, 0, 100));

  // ── Step 7 — Confidence band ──────────────────────────────────────────────

  const recentAccuracies = results.slice(0, 5).map(r => {
    const total = r.correctCount + r.wrongCount;
    return total > 0 ? (r.correctCount / total) * 100 : 0;
  });

  const sd = stdDev(recentAccuracies);
  const confLow  = Math.round(Math.max(0,   overall - 1.5 * sd - Math.abs(burnoutPenalty)));
  const confHigh = Math.round(Math.min(100, overall + 0.8 * sd));
  const confWidth: ConfidenceBandWidth = sd < 5 ? 'narrow' : sd < 12 ? 'moderate' : 'wide';

  const confNote =
    confWidth === 'narrow'   ? 'Consistent recent scores give a tight prediction range.' :
    confWidth === 'moderate' ? 'Moderate score variation; range reflects typical performance spread.' :
    'High score variability across recent tests widens the prediction range.';

  const confidence: ConfidenceBand = {
    low:      confLow,
    expected: overall,
    high:     confHigh,
    width:    confWidth,
    note:     confNote,
  };

  // ── Step 8 — Weakness forecasts ───────────────────────────────────────────

  const forecasts: WeaknessForecast[] = [];
  for (const [key, stats] of topicMap) {
    if (stats.attempted < 2) continue;
    const errorRate = stats.wrong / stats.attempted;
    if (errorRate <= 0.40) continue;

    const topicName    = key.split('||')[1];
    const topicAccuracy = (1 - errorRate) * 100;
    const halfLife     = halfLifeForAccuracy(topicAccuracy);
    const daysSinceSeen = (now.getTime() - stats.lastSeenAt.getTime()) / MS_PER_DAY;

    const retentionNow  = Math.round(ebbinghaus(halfLife, daysSinceSeen));
    const retentionAtExam = daysToExam !== null
      ? Math.round(ebbinghaus(halfLife, daysSinceSeen + daysToExam))
      : null;

    const riskLevel: WeaknessForecast['riskLevel'] =
      (retentionAtExam !== null && retentionAtExam < 30) || errorRate > 0.75 ? 'critical' :
      (retentionAtExam !== null && retentionAtExam < 50) || errorRate > 0.60 ? 'high' :
      'medium';

    let recommendation: string;
    if (riskLevel === 'critical') {
      recommendation = daysToExam !== null && daysToExam < 30
        ? `Immediate daily revision required — retention will be critically low by exam day.`
        : `Schedule intensive review sessions; error rate is very high.`;
    } else if (riskLevel === 'high') {
      recommendation = daysToExam !== null && daysToExam < 60
        ? `Revise within the next week to restore retention before exam.`
        : `Plan a dedicated review session soon to consolidate understanding.`;
    } else {
      recommendation = `Monitor and include in next revision cycle.`;
    }

    forecasts.push({
      topic:             topicName,
      subject:           stats.subject,
      currentRetention:  retentionNow,
      examDateRetention: retentionAtExam,
      errorRate:         Math.round(errorRate * 100) / 100,
      riskLevel,
      recommendation,
    });
  }

  forecasts.sort((a, b) => {
    const riskOrder = { critical: 0, high: 1, medium: 2 };
    const rDiff = riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
    if (rDiff !== 0) return rDiff;
    // Within same risk level, worst exam-day retention first
    const aRet = a.examDateRetention ?? 100;
    const bRet = b.examDateRetention ?? 100;
    return aRet - bRet;
  });

  const weaknessForecast = forecasts.slice(0, 6);

  // ── Step 9 — Percentile estimate ──────────────────────────────────────────

  const examKey = user.targetExam.toLowerCase().replace(/[\s-]/g, '_');
  const percentileMap = PERCENTILE_MAPS[examKey];

  let percentile: PercentileEstimate | null = null;
  if (percentileMap) {
    const estimated = Math.round(piecewiseLinear(overall, percentileMap) * 10) / 10;
    const rangeLow  = Math.round(Math.max(0,    estimated - estimated * 0.05) * 10) / 10;
    const rangeHigh = Math.round(Math.min(99.9, estimated + estimated * 0.05) * 10) / 10;
    percentile = {
      estimated,
      rangeLow,
      rangeHigh,
      exam:   user.targetExam,
      caveat: 'Heuristic based on readiness score and typical exam distribution. Not a real rank prediction.',
    };
  }

  // ── Step 10 — Planner feedback ────────────────────────────────────────────

  const baseDailyMin = PHASE_DAILY_MIN[phase];

  let readinessAdj = 0;
  if (overall < 40 && daysToExam !== null && daysToExam < 60)       readinessAdj = 45;
  else if (overall < 55 && daysToExam !== null && daysToExam < 90)  readinessAdj = 30;
  else if (overall > 80 && daysToExam !== null && daysToExam > 60)  readinessAdj = -15;

  const burnoutAdjs: Record<BurnoutRisk, number> = { none: 0, low: 0, moderate: 30, high: 45 };
  const burnoutAdj = burnoutAdjs[burnoutRisk];

  const adjustedDailyMin = clamp(baseDailyMin + readinessAdj - burnoutAdj, 60, 360);

  const intensityChange: IntensityChange =
    adjustedDailyMin > baseDailyMin + 15 ? 'increase' :
    adjustedDailyMin < baseDailyMin - 15 ? 'reduce' :
    'maintain';

  const urgentSubjects = subjectReadinessList
    .filter(s => s.score < 45)
    .map(s => s.subject);

  const restDaysMap: Record<BurnoutRisk, number> = { none: 0, low: 0, moderate: 1, high: 2 };
  const restDaysRecommended = restDaysMap[burnoutRisk];

  let criticalMessage: string | null = null;
  if (daysToExam !== null && daysToExam < 30 && overall < 40) {
    criticalMessage = `Exam in ${daysToExam} days with readiness at ${overall}/100 — prioritise critical topics immediately.`;
  } else if (daysToExam !== null && daysToExam < 14 && overall < 55) {
    criticalMessage = `Final stretch: ${daysToExam} days left — focus only on high-priority topics and mock tests.`;
  } else if (burnoutRisk === 'high') {
    criticalMessage = `Burnout risk is high — reducing intensity will improve retention and exam performance.`;
  }

  const topActions = buildTopActions(
    subjectReadinessList,
    weaknessForecast,
    burnoutRisk,
    daysToExam,
  );

  const plannerFeedback: PlannerFeedback = {
    baseDailyMin,
    adjustedDailyMin,
    intensityChange,
    urgentSubjects,
    restDaysRecommended,
    criticalMessage,
    topActions,
  };

  // ── Assemble report ───────────────────────────────────────────────────────

  return {
    overall,
    confidence,
    subjects: subjectReadinessList,
    percentile,
    weaknessForecast,
    plannerFeedback,
    studyPhase:  phase,
    phaseLabel:  PHASE_LABELS[phase],
    daysToExam,
    examDate,
    streakDays,
    burnoutRisk,
    generatedAt: now.toISOString(),
  };
}

// ── Internal helpers ──────────────────────────────────────────────────────────
// resolveExamMeta() is imported from studyUtils above

function buildTopActions(
  subjects: SubjectReadiness[],
  forecasts: WeaknessForecast[],
  burnoutRisk: BurnoutRisk,
  daysToExam: number | null,
): string[] {
  const actions: string[] = [];

  const criticalSubject = subjects.find(s => s.score < 35);
  if (criticalSubject) {
    actions.push(`Focus daily practice on ${criticalSubject.subject} — readiness is critically low.`);
  }

  const criticalForecast = forecasts.find(f => f.riskLevel === 'critical');
  if (criticalForecast) {
    actions.push(`Revise "${criticalForecast.topic}" (${criticalForecast.subject}) before retention drops further.`);
  }

  if (burnoutRisk === 'high' || burnoutRisk === 'moderate') {
    actions.push(`Take ${burnoutRisk === 'high' ? '2 rest days' : '1 rest day'} this week to prevent burnout.`);
  }

  const decliningSubject = subjects.find(s => s.trend === 'declining');
  if (decliningSubject) {
    actions.push(`${decliningSubject.subject} accuracy is declining — review recent mistakes and reattempt weak topics.`);
  }

  if (daysToExam !== null && daysToExam <= 30) {
    actions.push(`Only ${daysToExam} days to exam — prioritise mock tests and formula revision over new material.`);
  } else if (subjects.some(s => s.consistencyScore < 40)) {
    actions.push(`Increase study frequency — inconsistent practice is the main drag on your readiness score.`);
  }

  // Always return between 3 and 5 actions
  if (actions.length < 3) {
    const improvingSubjects = subjects.filter(s => s.trend === 'improving');
    if (improvingSubjects.length > 0) {
      actions.push(`Keep up the momentum in ${improvingSubjects[0].subject} — scores are trending upward.`);
    }
    if (actions.length < 3) {
      actions.push(`Attempt at least one full-length mock test this week to benchmark your progress.`);
    }
  }

  return actions.slice(0, 5);
}

function buildEmptyReport(
  now: Date,
  daysToExam: number | null,
  examDate: string | null,
  baseDailyMin: number,
  phase: StudyPhase,
): ReadinessReport {
  return {
    overall: 0,
    confidence: {
      low:      0,
      expected: 0,
      high:     0,
      width:    'wide',
      note:     'No test history available to estimate performance.',
    },
    subjects:         [],
    percentile:       null,
    weaknessForecast: [],
    plannerFeedback: {
      baseDailyMin,
      adjustedDailyMin:     baseDailyMin,
      intensityChange:      'maintain',
      urgentSubjects:       [],
      restDaysRecommended:  0,
      criticalMessage:      null,
      topActions:           ['Complete your first practice test to get personalised recommendations.'],
    },
    studyPhase:  phase,
    phaseLabel:  PHASE_LABELS[phase],
    daysToExam,
    examDate,
    streakDays:  0,
    burnoutRisk: 'none',
    generatedAt: now.toISOString(),
  };
}
