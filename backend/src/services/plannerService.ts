/**
 * Intelligent Study Planner Engine — v2
 *
 * Generates personalised daily/weekly study plans driven by:
 *   - Ebbinghaus retention + mastery scores (via topicWeightService)
 *   - Persistent mistake patterns (dominant type, consecutive wrong, insights)
 *   - Subject-level urgency from the readiness layer
 *   - Exam countdown + phase-aware pacing + burnout detection
 *   - Formula chapter linking per session
 *   - Adaptive test recommendations surfaced as session CTAs
 *   - Onboarding-safe: new users get a phase-seeded starter plan
 *
 * v2 changes from v1:
 *   - Uses computeTopicWeights() (Ebbinghaus-enriched) instead of local computation
 *   - MistakePattern integration for consecutive-wrong boost + dominant type label
 *   - Rich reasoning strings ("retention dropped to 41%…") on every session
 *   - StudySession extended: reasoning, masteryScore, retentionScore,
 *     mistakeType, linkedFormulaSlug/Subject, suggestTest
 *   - PlannerSummary extended: todayInsight, syllabusProgress, mistakeInsights,
 *     adaptiveTestSuggestion, isNewUser
 *   - Skips over-revision of mastered topics (masteryScore ≥ 80 & low decay)
 *   - Balanced selection: avoids running the same subject on consecutive days
 */

import { Types } from 'mongoose';
import User           from '../models/User';
import Result         from '../models/Result';
import Test           from '../models/Test';
import MistakePattern from '../models/MistakePattern';
import {
  PHASE_DAILY_MIN,
  getExamDate,
  daysUntil,
  studyPhaseFor,
  burnoutRiskFor,
  computeStreakFromSet,
  toISODate,
  type StudyPhase,
  type BurnoutRisk,
} from '../lib/studyUtils';
import { getReadinessReport }        from './readinessService';
import { computeTopicWeights }       from './topicWeightService';
import { computeTestRecommendations } from './adaptiveTestService';
import { findChapterByName }          from '../lib/formulaLoader';

export type { StudyPhase, BurnoutRisk };

// ── Subject → formula slug mapping ────────────────────────────────────────────

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

// ── Approximate total topics per exam (for syllabusProgress) ──────────────────

const EXAM_TOPIC_COUNTS: Record<string, number> = {
  jee:          82,
  jee_main:     82,
  jee_advanced: 95,
  neet:         97,
  cbse:         64,
  custom:       50,
};

// ── Public types ──────────────────────────────────────────────────────────────

export type LoadLevel      = 'light' | 'moderate' | 'heavy';
export type ActivityType   = 'theory' | 'practice' | 'review' | 'mock_prep';
export type SessionSlot    = 'morning' | 'afternoon' | 'evening';
export type PriorityLabel  = 'critical' | 'high' | 'medium' | 'low';
export type IntensityChange = 'increase' | 'maintain' | 'reduce';

export interface AdaptiveTestSuggestion {
  mode:    string;
  title:   string;
  reason:  string;
  urgency: string;
}

export interface StudySession {
  slot:                 SessionSlot;
  subject:              string;
  topic:                string;
  activity:             ActivityType;
  durationMin:          number;
  priority:             PriorityLabel;
  rationale:            string;
  /** Data-driven explanation: "retention dropped to 41%" etc. */
  reasoning:            string;
  masteryScore:         number;
  retentionScore:       number;
  mistakeType:          string | null;
  linkedFormulaSlug:    string | null;
  linkedFormulaSubject: string | null;
  /** Whether the session should suggest taking an adaptive test */
  suggestTest:          boolean;
}

export interface DayPlan {
  date:      string;   // YYYY-MM-DD
  dayLabel:  string;   // "Today", "Tomorrow", or weekday name
  isRestDay: boolean;
  sessions:  StudySession[];
  totalMin:  number;
  loadLevel: LoadLevel;
}

export interface PlannerTopicHint {
  topic:          string;
  subject:        string;
  reason:         string;
  urgent?:        boolean;
  masteryScore?:  number;
  retentionScore?: number;
}

export interface PlannerSummary {
  daysToExam:             number | null;
  examDate:               string | null;
  studyPhase:             StudyPhase;
  phaseLabel:             string;
  phaseDescription:       string;
  weeklyGoal:             string;
  dailyTargetMin:         number;
  topPriorityTopics:      PlannerTopicHint[];
  burnoutRisk:            BurnoutRisk;
  streakDays:             number;
  readinessScore:         number;
  adjustedDailyMin:       number;
  intensityChange:        IntensityChange;
  urgentSubjects:         string[];
  criticalMessage:        string | null;
  /** High-level insight for today */
  todayInsight:           string;
  /** 0–100 % of estimated syllabus covered */
  syllabusProgress:       number;
  /** Top 3 human-like insights from MistakePattern */
  mistakeInsights:        string[];
  /** Primary adaptive test the student should take next */
  adaptiveTestSuggestion: AdaptiveTestSuggestion | null;
  /** True when the student has no test history yet */
  isNewUser:              boolean;
}

export interface WeekPlan {
  summary:     PlannerSummary;
  days:        DayPlan[];
  generatedAt: string;
}

// ── Internal pool shape ───────────────────────────────────────────────────────

interface TopicPoolItem {
  topic:                string;
  subject:              string;
  errorRate:            number;
  recentWrong:          boolean;
  daysSinceSeen:        number;
  priority:             number;       // composite 0–1
  priorityLabel:        PriorityLabel;
  rationale:            string;
  reasoning:            string;
  masteryScore:         number;
  retentionScore:       number;
  forgettingFactor:     number;
  mistakeType:          string | null;
  linkedFormulaSlug:    string | null;
  linkedFormulaSubject: string | null;
}

// ── Config tables ─────────────────────────────────────────────────────────────

const PHASE_META: Record<StudyPhase, { label: string; description: string }> = {
  foundation:    { label: 'Foundation Phase',    description: 'Build conceptual clarity across all topics'              },
  consolidation: { label: 'Consolidation Phase', description: 'Deepen understanding and begin timed practice'           },
  intensive:     { label: 'Intensive Phase',     description: 'Heavy practice and weak-area elimination'                },
  revision:      { label: 'Revision Phase',      description: 'Rapid revision cycles and formula reinforcement'         },
  final:         { label: 'Final Sprint',        description: 'Mock tests, key formulas, and confidence building'       },
  'post-exam':   { label: 'Post-Exam',           description: 'Exam concluded — review your performance and next steps' },
};

const ACTIVITY_DUR: Record<ActivityType, number> = {
  theory:    50,
  practice:  40,
  review:    25,
  mock_prep: 60,
};

const SLOT_ACTIVITIES: Record<StudyPhase, [ActivityType, ActivityType, ActivityType]> = {
  foundation:    ['theory',    'review',    'practice'  ],
  consolidation: ['theory',    'practice',  'review'    ],
  intensive:     ['practice',  'practice',  'review'    ],
  revision:      ['review',    'practice',  'review'    ],
  final:         ['mock_prep', 'practice',  'review'    ],
  'post-exam':   ['review',    'review',    'review'    ],
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ── Pure helpers ──────────────────────────────────────────────────────────────

function priorityLabelFor(score: number): PriorityLabel {
  if (score >= 0.70) return 'critical';
  if (score >= 0.45) return 'high';
  if (score >= 0.25) return 'medium';
  return 'low';
}

function buildRationale(errorRate: number, recentWrong: boolean, daysSinceSeen: number): string {
  if (errorRate >= 0.60) return `${Math.round(errorRate * 100)}% error rate — needs focused practice`;
  if (recentWrong)       return 'Missed in a recent test — address while still fresh';
  if (daysSinceSeen > 14) return `Not reviewed in ${daysSinceSeen} days — retention risk`;
  if (daysSinceSeen > 7)  return 'Overdue for scheduled revision';
  return 'Recurring weak area — consistent reinforcement needed';
}

function buildRichReasoning(
  topic:   string,
  tw:      { masteryScore: number; retentionScore: number; errorRate: number; recentWrong: boolean; daysSinceSeen?: number; daysSinceLastSeen?: number; forgettingFactor: number },
  pattern: { consecutiveWrong: number; dominantType: string } | null,
): string {
  const daysSinceSeen = tw.daysSinceSeen ?? tw.daysSinceLastSeen ?? 0;
  // Highest-severity case first
  if (pattern && pattern.consecutiveWrong >= 3) {
    return `${topic} wrong ${pattern.consecutiveWrong} tests in a row — urgent action needed`;
  }

  const parts: string[] = [];

  if (tw.retentionScore < 40) {
    parts.push(`retention critically low at ${tw.retentionScore}%`);
  } else if (tw.retentionScore < 60) {
    parts.push(`retention dropped to ${tw.retentionScore}%`);
  }

  if (tw.masteryScore < 35) {
    parts.push(`mastery at ${tw.masteryScore}%`);
  } else if (tw.masteryScore < 50 && parts.length === 0) {
    parts.push(`low mastery (${tw.masteryScore}%)`);
  }

  if (tw.errorRate >= 0.65 && parts.length < 2) {
    parts.push(`${Math.round(tw.errorRate * 100)}% error rate`);
  }

  if (tw.recentWrong && parts.length === 0) {
    parts.push('wrong in a recent test — address while fresh');
  }

  if (pattern?.dominantType === 'formula' && parts.length < 2) {
    parts.push('formula recall is weak');
  } else if (pattern?.dominantType === 'repeated' && parts.length < 2) {
    parts.push('repeated mistake pattern detected');
  }

  if (daysSinceSeen > 21 && parts.length === 0) {
    parts.push(`not reviewed in ${daysSinceSeen} days`);
  }

  if (parts.length === 0) {
    return 'Recurring weak area — consistent reinforcement needed';
  }

  return `Needs attention: ${parts.slice(0, 2).join(' and ')}`;
}

function buildTodayInsight(
  pool:       TopicPoolItem[],
  daysToExam: number | null,
  phase:      StudyPhase,
  isNewUser:  boolean,
): string {
  if (isNewUser) {
    return 'Take your first test today — Denken will build your personalised plan the moment it sees your performance.';
  }
  if (pool.length === 0) {
    return 'Great work! No critical weak areas detected. Take a test to stay sharp and build your streak.';
  }

  const top     = pool[0];
  const examHint = daysToExam != null && daysToExam <= 30 ? ` (${daysToExam} days to exam)` : '';
  const phaseHint = phase === 'final'    ? ' Every session counts now.'
                  : phase === 'revision' ? ' Prioritise high-weight revision over new content.'
                  : '';

  if (top.retentionScore < 40) {
    return `Focus on ${top.topic} today — retention has fallen to ${top.retentionScore}%.${examHint}${phaseHint}`;
  }
  if (top.masteryScore < 35) {
    return `${top.topic} is your weakest area right now (mastery: ${top.masteryScore}%). Start here today.${examHint}`;
  }
  if (top.errorRate >= 0.65) {
    return `${top.topic} has a ${Math.round(top.errorRate * 100)}% error rate — clear this before moving forward.${examHint}`;
  }

  return `Your top focus today is ${top.topic} (${top.subject}).${examHint}${phaseHint}`;
}

function addDays(base: Date, n: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

function dayLabelFor(date: Date, todayStr: string): string {
  const ds = toISODate(date);
  if (ds === todayStr)                           return 'Today';
  if (ds === toISODate(addDays(new Date(), 1)))  return 'Tomorrow';
  return DAY_NAMES[date.getDay()];
}

function loadLevelFor(
  phase:      StudyPhase,
  dayOfWeek:  number,
  streakDays: number,
  dayOffset:  number,
): LoadLevel {
  const isSunday      = dayOfWeek === 0;
  const isSaturday    = dayOfWeek === 6;
  const isRecoveryDay = streakDays > 0 && (streakDays + dayOffset) % 7 === 0;

  if (isSunday || isRecoveryDay) return 'light';
  if (isSaturday) return 'moderate';
  if (phase === 'foundation' || phase === 'post-exam') return 'moderate';
  if (phase === 'consolidation') return 'moderate';
  return 'heavy';
}

function pickTopics(
  pool:        TopicPoolItem[],
  used:        Set<string>,
  lastSubject: string,
  count:       number,
): TopicPoolItem[] {
  const picked: TopicPoolItem[] = [];
  const daySubjects = new Set<string>();

  // Pass 1: different subject from last, no duplicates
  for (const item of pool) {
    if (picked.length >= count) break;
    if (used.has(item.topic))          continue;
    if (daySubjects.has(item.subject)) continue;
    if (picked.length === 0 && item.subject === lastSubject) continue;
    picked.push(item);
    daySubjects.add(item.subject);
  }

  // Pass 2: any subject, no duplicates
  for (const item of pool) {
    if (picked.length >= count) break;
    if (used.has(item.topic))                       continue;
    if (picked.some((p) => p.topic === item.topic)) continue;
    if (daySubjects.has(item.subject))              continue;
    picked.push(item);
    daySubjects.add(item.subject);
  }

  // Pass 3: fill remaining slots, any subject
  for (const item of pool) {
    if (picked.length >= count) break;
    if (used.has(item.topic))                       continue;
    if (picked.some((p) => p.topic === item.topic)) continue;
    picked.push(item);
  }

  return picked;
}

// ── Topic pool builder ────────────────────────────────────────────────────────

async function buildTopicPool(userId: string): Promise<TopicPoolItem[]> {
  // Use Ebbinghaus-enriched topic weights
  const topicWeights = await computeTopicWeights(userId);
  if (topicWeights.size === 0) return [];

  // Load mistake patterns in one query
  const patterns = await MistakePattern.find({ userId: new Types.ObjectId(userId) }).lean();
  const patternMap = new Map(patterns.map((p) => [p.topic, p]));

  const pool: TopicPoolItem[] = [];

  for (const [topic, tw] of topicWeights) {
    // Skip fully mastered, recently seen, no-wrong topics — don't over-revise
    if (tw.masteryScore >= 80 && tw.forgettingFactor < 0.20 && !tw.recentWrong && tw.wrongCount === 0) {
      continue;
    }

    const pattern = patternMap.get(topic) ?? null;

    // Base priority from topicWeightService weight, boosted by mistake severity
    let priority = tw.weight;
    if (pattern) {
      if (pattern.consecutiveWrong >= 3) priority = Math.min(1, priority + 0.15);
      else if (pattern.recentMistakes >= 2) priority = Math.min(1, priority + 0.08);
    }

    // Formula chapter linking
    let linkedFormulaSlug:    string | null = null;
    let linkedFormulaSubject: string | null = null;
    try {
      const subSlug = toSubjectSlug(tw.subject);
      const chapter = findChapterByName(subSlug, topic);
      if (chapter) {
        linkedFormulaSlug    = chapter.slug;
        linkedFormulaSubject = subSlug;
      }
    } catch { /* formula loader not initialised yet — safe skip */ }

    pool.push({
      topic,
      subject:              tw.subject,
      errorRate:            tw.errorRate,
      recentWrong:          tw.recentWrong,
      daysSinceSeen:        tw.daysSinceLastSeen,
      priority,
      priorityLabel:        priorityLabelFor(priority),
      rationale:            buildRationale(tw.errorRate, tw.recentWrong, tw.daysSinceLastSeen),
      reasoning:            buildRichReasoning(topic, { ...tw, daysSinceSeen: tw.daysSinceLastSeen }, pattern),
      masteryScore:         tw.masteryScore,
      retentionScore:       tw.retentionScore,
      forgettingFactor:     tw.forgettingFactor,
      mistakeType:          pattern?.dominantType ?? null,
      linkedFormulaSlug,
      linkedFormulaSubject,
    });
  }

  return pool.sort((a, b) => b.priority - a.priority);
}

// ── Syllabus progress ─────────────────────────────────────────────────────────

async function computeSyllabusProgress(userId: string, exam: string): Promise<number> {
  const results = await Result.find({ userId: new Types.ObjectId(userId) })
    .select('testId')
    .lean<{ testId: Types.ObjectId }[]>();

  if (results.length === 0) return 0;

  const testIds = [...new Set(results.map((r) => r.testId.toString()))].map(
    (id) => new Types.ObjectId(id),
  );
  const tests = await Test.find({ _id: { $in: testIds } })
    .select('questions')
    .lean<{ questions: { topic: string }[] }[]>();

  const seenTopics = new Set<string>();
  for (const t of tests) {
    for (const q of t.questions) seenTopics.add(q.topic);
  }

  const examKey = exam.toLowerCase().replace(/[\s-]/g, '_');
  const total   = EXAM_TOPIC_COUNTS[examKey] ?? 75;

  return Math.min(100, Math.round((seenTopics.size / total) * 100));
}

// ── Day plan builder ──────────────────────────────────────────────────────────

function buildDayPlan(
  date:      Date,
  todayStr:  string,
  phase:     StudyPhase,
  topics:    TopicPoolItem[],
  loadLevel: LoadLevel,
): DayPlan {
  const slots:      SessionSlot[]  = ['morning', 'afternoon', 'evening'];
  const activities: ActivityType[] = SLOT_ACTIVITIES[phase];
  const sessions:   StudySession[] = [];

  const isRestDay = loadLevel === 'light' && topics.length === 0;
  const shouldOfferTest = phase === 'intensive' || phase === 'revision' || phase === 'final';

  topics.forEach((t, i) => {
    const activity    = activities[i] ?? 'review';
    const suggestTest = shouldOfferTest && i === 0 && t.masteryScore < 55;

    sessions.push({
      slot:                 slots[i] ?? 'evening',
      subject:              t.subject,
      topic:                t.topic,
      activity,
      durationMin:          ACTIVITY_DUR[activity],
      priority:             t.priorityLabel,
      rationale:            t.rationale,
      reasoning:            t.reasoning,
      masteryScore:         t.masteryScore,
      retentionScore:       t.retentionScore,
      mistakeType:          t.mistakeType,
      linkedFormulaSlug:    t.linkedFormulaSlug,
      linkedFormulaSubject: t.linkedFormulaSubject,
      suggestTest,
    });
  });

  return {
    date:      toISODate(date),
    dayLabel:  dayLabelFor(date, todayStr),
    isRestDay,
    sessions,
    totalMin:  sessions.reduce((s, sess) => s + sess.durationMin, 0),
    loadLevel,
  };
}

// ── Onboarding plan (no test history) ────────────────────────────────────────

function buildOnboardingWeek(
  subjects:  string[],
  phase:     StudyPhase,
  today:     Date,
  todayStr:  string,
): DayPlan[] {
  const activities = SLOT_ACTIVITIES[phase];
  const days: DayPlan[] = [];

  for (let i = 0; i < 7; i++) {
    const date      = addDays(today, i);
    const dayOfWeek = date.getDay();
    const isRest    = dayOfWeek === 0;

    if (isRest) {
      days.push({
        date: toISODate(date), dayLabel: dayLabelFor(date, todayStr),
        isRestDay: true, sessions: [], totalMin: 0, loadLevel: 'light',
      });
      continue;
    }

    const subj    = subjects[i % Math.max(1, subjects.length)] ?? 'Physics';
    const activity = activities[i % 3] ?? 'theory';
    const sessions: StudySession[] = [{
      slot:                 'morning',
      subject:              subj,
      topic:                'Overview & Foundation',
      activity,
      durationMin:          ACTIVITY_DUR[activity],
      priority:             'medium',
      rationale:            'Start with conceptual foundations for a strong base',
      reasoning:            'No test history yet. Take your first test to personalise this plan.',
      masteryScore:         0,
      retentionScore:       0,
      mistakeType:          null,
      linkedFormulaSlug:    null,
      linkedFormulaSubject: null,
      suggestTest:          i === 0, // suggest test on day 1
    }];

    days.push({
      date: toISODate(date), dayLabel: dayLabelFor(date, todayStr),
      isRestDay: false, sessions,
      totalMin: sessions.reduce((s, ss) => s + ss.durationMin, 0),
      loadLevel: 'moderate',
    });
  }

  return days;
}

// ── Public service functions ──────────────────────────────────────────────────

export async function getWeekPlan(userId: string): Promise<WeekPlan> {
  const user = await User.findById(userId)
    .select('targetExam selectedSubjects targetYear')
    .lean<{ targetExam: string; selectedSubjects: string[]; targetYear?: number }>();
  if (!user) throw new Error('User not found.');

  // ── Exam timeline ─────────────────────────────────────────────────────────
  const ed         = getExamDate(user.targetExam, user.targetYear);
  const daysToExam = ed ? daysUntil(ed) : null;
  const phase      = studyPhaseFor(daysToExam ?? 999);
  const { label: phaseLabel, description: phaseDescription } = PHASE_META[phase];

  // ── Activity stats (last 14 days) ─────────────────────────────────────────
  const since14 = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const recentResults = await Result.find({
    userId: new Types.ObjectId(userId), createdAt: { $gte: since14 },
  })
    .select('createdAt')
    .lean<{ createdAt: Date }[]>();

  const activityDates = new Set(recentResults.map((r) => toISODate(r.createdAt)));
  const burnoutRisk   = burnoutRiskFor(activityDates.size);
  const streakDays    = computeStreakFromSet(activityDates);

  // ── Topic pool + isNewUser ────────────────────────────────────────────────
  const pool      = await buildTopicPool(userId);
  const isNewUser = pool.length === 0;

  // ── Syllabus progress ─────────────────────────────────────────────────────
  const syllabusProgress = await computeSyllabusProgress(userId, user.targetExam);

  // ── Mistake insights ──────────────────────────────────────────────────────
  const topPatterns = await MistakePattern.find({ userId: new Types.ObjectId(userId) })
    .sort({ totalMistakes: -1 })
    .limit(3)
    .lean<{ insight: string }[]>();
  const mistakeInsights = topPatterns.map((p) => p.insight).filter(Boolean);

  // ── Readiness integration ─────────────────────────────────────────────────
  let readinessScore:   number         = 0;
  let adjustedDailyMin: number         = PHASE_DAILY_MIN[phase];
  let intensityChange:  IntensityChange = 'maintain';
  let urgentSubjects:   string[]       = [];
  let criticalMessage:  string | null  = null;

  try {
    const readiness  = await getReadinessReport(userId);
    readinessScore   = readiness.overall;
    adjustedDailyMin = readiness.plannerFeedback.adjustedDailyMin;
    intensityChange  = readiness.plannerFeedback.intensityChange;
    urgentSubjects   = readiness.plannerFeedback.urgentSubjects;
    criticalMessage  = readiness.plannerFeedback.criticalMessage;
  } catch { /* degrade gracefully */ }

  // ── Boost urgent-subject topics ────────────────────────────────────────────
  if (urgentSubjects.length > 0) {
    pool.sort((a, b) => {
      const aBoost = urgentSubjects.includes(a.subject) ? 0.15 : 0;
      const bBoost = urgentSubjects.includes(b.subject) ? 0.15 : 0;
      return (b.priority + bBoost) - (a.priority + aBoost);
    });
  }

  // ── Adaptive test suggestion ──────────────────────────────────────────────
  let adaptiveTestSuggestion: AdaptiveTestSuggestion | null = null;
  if (!isNewUser) {
    try {
      const recs = await computeTestRecommendations(
        userId,
        user.targetExam.toUpperCase() as import('../types').ExamKey,
        user.selectedSubjects,
      );
      if (recs.primary) {
        adaptiveTestSuggestion = {
          mode:    recs.primary.mode,
          title:   recs.primary.title,
          reason:  recs.primary.reasoning[0] ?? recs.primary.description,
          urgency: recs.primary.urgency,
        };
      }
    } catch { /* skip — non-critical */ }
  }

  // ── Weekly goal ───────────────────────────────────────────────────────────
  const weeklyGoal = isNewUser
    ? 'Take your first test to personalise your study plan'
    : phase === 'final'
    ? 'Complete 2 full mock tests and revise all critical-priority topics'
    : `Clear ${Math.min(pool.length, 5)} weak topics — target 70%+ accuracy on each`;

  // ── Today's insight ───────────────────────────────────────────────────────
  const todayInsight = buildTodayInsight(pool, daysToExam, phase, isNewUser);

  // ── Summary ───────────────────────────────────────────────────────────────
  const summary: PlannerSummary = {
    daysToExam,
    examDate:          ed ? ed.toISOString() : null,
    studyPhase:        phase,
    phaseLabel,
    phaseDescription,
    weeklyGoal,
    dailyTargetMin:    adjustedDailyMin,
    topPriorityTopics: pool.slice(0, 5).map((t) => ({
      topic:          t.topic,
      subject:        t.subject,
      reason:         t.reasoning,
      urgent:         urgentSubjects.includes(t.subject),
      masteryScore:   t.masteryScore,
      retentionScore: t.retentionScore,
    })),
    burnoutRisk,
    streakDays,
    readinessScore,
    adjustedDailyMin,
    intensityChange,
    urgentSubjects,
    criticalMessage,
    todayInsight,
    syllabusProgress,
    mistakeInsights,
    adaptiveTestSuggestion,
    isNewUser,
  };

  // ── 7-day plan ────────────────────────────────────────────────────────────
  const today    = new Date();
  const todayStr = toISODate(today);

  let days: DayPlan[];

  if (isNewUser) {
    days = buildOnboardingWeek(user.selectedSubjects, phase, today, todayStr);
  } else {
    const used       = new Set<string>();
    let lastSubject  = '';
    days = [];

    for (let i = 0; i < 7; i++) {
      const date  = addDays(today, i);
      const load  = loadLevelFor(phase, date.getDay(), streakDays, i);
      const rawCount = load === 'heavy' ? 3 : load === 'moderate' ? 2 : 1;
      const count    = burnoutRisk === 'high' && rawCount > 1 ? 1 : rawCount;

      const picked = pickTopics(pool, used, lastSubject, count);
      picked.forEach((t) => used.add(t.topic));
      if (picked[0]) lastSubject = picked[0].subject;

      days.push(buildDayPlan(date, todayStr, phase, picked, load));
    }
  }

  return { summary, days, generatedAt: new Date().toISOString() };
}

export async function getDayPlan(userId: string): Promise<DayPlan> {
  const plan = await getWeekPlan(userId);
  return plan.days[0]!;
}

export async function getPlannerSummary(userId: string): Promise<PlannerSummary> {
  const plan = await getWeekPlan(userId);
  return plan.summary;
}
