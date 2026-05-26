/**
 * Adaptive Practice Service — short focused concept-drill sessions.
 *
 * Unlike full tests, practice sessions:
 *  - Target a specific concept, topic, or mistake pattern
 *  - Adapt difficulty in real-time (correct → harder, 2 wrong → easier)
 *  - Provide immediate feedback after each answer
 *  - Track mastery delta across the session
 *  - Suggest next action: advance | continue | mentor | rest
 *
 * Sessions are stored in Redis (TTL.PRACTICE_SESSION) so they survive restarts
 * and work correctly across multiple backend instances.
 */

import { Types } from 'mongoose';
import { selectFromBank, type BankSelectionRequest } from './questionBankService';
import { computeTopicWeights }                        from './topicWeightService';
import { buildConceptMasteryMap, getUnlockableConcepts } from './conceptGraphService';
import MistakePattern, { type IMistakePatternDocument }  from '../models/MistakePattern';
import type { Question, Difficulty, ExamKey } from '../types';
import { cacheGet, cacheSet, cacheDel, CacheKey, TTL } from '../lib/cache';

// ── Session types ─────────────────────────────────────────────────────────────

export type PracticeIntent =
  | 'concept-drill'
  | 'prerequisite-fix'
  | 'retention-boost'
  | 'mistake-revisit';

export interface PracticeSessionConfig {
  userId:        string;
  subject:       string;
  chapter?:      string;
  topic?:        string;
  conceptId?:    string;
  exam:          string;
  questionCount: number;   // 5 | 8 | 10
  intent:        PracticeIntent;
}

export interface PracticeQuestion extends Question {
  sessionIndex:     number;
  targetConceptId?: string;
  hintAvailable:    boolean;
}

export type NextStepSuggestion = 'advance' | 'continue' | 'mentor' | 'rest';

export interface PracticeSessionSummary {
  sessionId:             string;
  totalQuestions:        number;
  correctCount:          number;
  accuracy:              number;
  masteryDelta:          number;
  weakConceptIds:        string[];
  suggestedNextStep:     NextStepSuggestion;
  averageSolvingTimeSec: number;
  answers:               Record<string, boolean>;
}

interface SessionState {
  sessionId:         string;
  config:            PracticeSessionConfig;
  questions:         PracticeQuestion[];
  currentIndex:      number;
  correctCount:      number;
  answers:           Record<string, boolean>;
  solvingTimes:      number[];
  startedAt:         Date;
  currentDifficulty: 'easy' | 'medium' | 'hard';
}

// ── Redis-backed session store helpers ───────────────────────────────────────

async function loadSession(sessionId: string): Promise<SessionState | undefined> {
  return cacheGet<SessionState>(CacheKey.practiceSession(sessionId));
}

async function saveSession(state: SessionState): Promise<void> {
  await cacheSet(CacheKey.practiceSession(state.sessionId), state, TTL.PRACTICE_SESSION);
}

async function deleteSession(sessionId: string): Promise<void> {
  await cacheDel(CacheKey.practiceSession(sessionId));
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function masteryToDifficulty(mastery: number): 'easy' | 'medium' | 'hard' {
  return mastery < 35 ? 'easy' : mastery < 65 ? 'medium' : 'hard';
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Create a new adaptive practice session and return the first question.
 */
export async function createPracticeSession(
  config: PracticeSessionConfig,
): Promise<{ sessionId: string; firstQuestion: PracticeQuestion; totalPlanned: number }> {
  const sessionId = `ps_${config.userId}_${Date.now()}`;

  // Load student mastery context for the target topic
  const topicWeights    = await computeTopicWeights(config.userId);
  const tw              = topicWeights.get(config.topic ?? config.chapter ?? config.subject);
  const startingMastery = tw?.masteryScore ?? 30;
  const startDiff       = masteryToDifficulty(startingMastery);

  const bankReq: BankSelectionRequest = {
    exam:              config.exam as ExamKey,
    subject:           config.subject,
    topic:             config.topic ?? config.chapter ?? config.subject,
    type:              'mcq',
    count:             config.questionCount,
    difficulty:        startDiff,
    topicWeight:       tw,
    boostPrerequisites: startingMastery < 45,
    userMasteryScore:  startingMastery,
    avoidStableIds:    new Set<string>(),
  };

  const bankQuestions = await selectFromBank(bankReq);

  const practiceQuestions: PracticeQuestion[] = bankQuestions.map((q, i) => ({
    ...q,
    sessionIndex:     i,
    hintAvailable:    true,
    targetConceptId:  config.conceptId,
  }));

  if (practiceQuestions.length === 0) {
    throw new Error('No questions available for the requested concept/topic.');
  }

  const state: SessionState = {
    sessionId,
    config,
    questions:         practiceQuestions,
    currentIndex:      0,
    correctCount:      0,
    answers:           {},
    solvingTimes:      [],
    startedAt:         new Date(),
    currentDifficulty: startDiff,
  };

  await saveSession(state);

  return {
    sessionId,
    firstQuestion: practiceQuestions[0]!,
    totalPlanned:  practiceQuestions.length,
  };
}

/**
 * Submit answer for the current question.
 * Returns feedback text, next question (or null if session done), and progress.
 * Adapts difficulty: 3/3 correct → harder; 2/3 wrong → easier.
 */
export async function submitPracticeAnswer(
  sessionId:      string,
  questionId:     string,
  isCorrect:      boolean,
  solvingTimeSec: number,
): Promise<{
  feedback:     string;
  isCorrect:    boolean;
  nextQuestion: PracticeQuestion | null;
  sessionDone:  boolean;
  progress:     { current: number; total: number; accuracy: number };
}> {
  const state = await loadSession(sessionId);
  if (!state) throw new Error('Practice session not found or expired.');

  state.answers[questionId] = isCorrect;
  if (isCorrect) state.correctCount++;
  state.solvingTimes.push(solvingTimeSec);
  state.currentIndex++;

  // Adaptive difficulty: look at last 3 answers
  const recentKeys    = Object.keys(state.answers).slice(-3);
  const recentCorrect = recentKeys.filter(k => state.answers[k]).length;
  const recentPct     = recentKeys.length > 0 ? recentCorrect / recentKeys.length : 0.5;

  if (recentPct >= 0.9 && state.currentDifficulty !== 'hard') {
    state.currentDifficulty = state.currentDifficulty === 'easy' ? 'medium' : 'hard';
  } else if (recentPct <= 0.33 && state.currentDifficulty !== 'easy') {
    state.currentDifficulty = state.currentDifficulty === 'hard' ? 'medium' : 'easy';
  }

  const prevQuestion = state.questions[state.currentIndex - 1]!;
  const conceptNote  = prevQuestion.conceptTags?.[0] ? ` (${prevQuestion.conceptTags[0]})` : '';
  const feedback     = isCorrect
    ? `Correct! Good grasp of the concept${conceptNote}.`
    : `Incorrect. Review the concept${conceptNote} and check your approach.`;

  const sessionDone  = state.currentIndex >= state.questions.length;
  const nextQuestion = sessionDone ? null : (state.questions[state.currentIndex] ?? null);
  const accuracy     = Math.round((state.correctCount / state.currentIndex) * 100);

  await saveSession(state);

  return { feedback, isCorrect, nextQuestion, sessionDone, progress: { current: state.currentIndex, total: state.questions.length, accuracy } };
}

/**
 * Get session summary after all questions answered. Cleans up session state.
 */
export async function getPracticeSessionSummary(sessionId: string): Promise<PracticeSessionSummary> {
  const state = await loadSession(sessionId);
  if (!state) throw new Error('Practice session not found or expired.');

  const total    = state.questions.length;
  const accuracy = total > 0 ? Math.round((state.correctCount / total) * 100) : 0;
  const avgTime  = state.solvingTimes.length > 0
    ? Math.round(state.solvingTimes.reduce((s, t) => s + t, 0) / state.solvingTimes.length)
    : 0;

  // Rough mastery delta: +8 per correct, -3 per wrong, capped ±20
  const masteryDelta = Math.max(-20, Math.min(20,
    state.correctCount * 8 - (total - state.correctCount) * 3,
  ));

  // Collect weak concepts from wrong-answer questions
  const wrongQuestions = state.questions.filter(q => !state.answers[q.id]);
  const weakConceptIds = [...new Set(wrongQuestions.flatMap(q => q.conceptTags ?? []))];

  const suggestedNextStep: NextStepSuggestion =
    accuracy >= 80 ? 'advance' :
    accuracy >= 60 ? 'continue' :
    accuracy >= 40 ? 'mentor'   :
    'mentor';

  await deleteSession(sessionId);

  return {
    sessionId,
    totalQuestions:        total,
    correctCount:          state.correctCount,
    accuracy,
    masteryDelta,
    weakConceptIds:        weakConceptIds.slice(0, 5),
    suggestedNextStep,
    averageSolvingTimeSec: avgTime,
    answers:               state.answers,
  };
}

// ── Practice Recommendations ──────────────────────────────────────────────────

export interface PracticeRecommendation {
  type:             PracticeIntent;
  title:            string;
  description:      string;
  topic:            string;
  subject:          string;
  chapter:          string;
  urgency:          'critical' | 'high' | 'medium' | 'low';
  estimatedMinutes: number;
  questionCount:    number;
}

/**
 * Generate personalised practice recommendations from mastery, mistakes, and
 * forgetting curve data. Called from the practice hub page.
 */
export async function getPracticeRecommendations(
  userId:  string,
  exam:    string,
  subject?: string,
): Promise<PracticeRecommendation[]> {
  const cacheKey = CacheKey.practiceRecs(userId, exam, subject);
  const cached   = await cacheGet<PracticeRecommendation[]>(cacheKey);
  if (cached) return cached;

  const [topicWeights, mistakePatterns] = await Promise.all([
    computeTopicWeights(userId),
    MistakePattern.find({ userId: new Types.ObjectId(userId) })
      .sort({ consecutiveWrong: -1, totalMistakes: -1 })
      .limit(10)
      .lean<IMistakePatternDocument[]>(),
  ]);

  const masteryMap  = await buildConceptMasteryMap(topicWeights, subject);
  const unlockable  = getUnlockableConcepts(masteryMap);
  const recs: PracticeRecommendation[] = [];

  // 1. Mistake revisit — consecutive wrong streaks are highest urgency
  for (const mp of mistakePatterns.slice(0, 3)) {
    if (subject && mp.subject !== subject) continue;
    if (mp.consecutiveWrong < 2) continue;
    recs.push({
      type:             'mistake-revisit',
      title:            `Break the ${mp.topic} mistake streak`,
      description:      `${mp.consecutiveWrong} consecutive errors in ${mp.topic}. A targeted drill will identify and fix the root cause.`,
      topic:            mp.topic,
      subject:          mp.subject,
      chapter:          mp.topic,
      urgency:          mp.consecutiveWrong >= 4 ? 'critical' : 'high',
      estimatedMinutes: 15,
      questionCount:    8,
    });
  }

  // 2. Concept unlock — prerequisites met, concept itself weak
  for (const concept of unlockable.slice(0, 3)) {
    if (subject && concept.subject !== subject) continue;
    recs.push({
      type:             'concept-drill',
      title:            `Strengthen ${concept.name}`,
      description:      `Prerequisites are solid. A focused drill here will accelerate your mastery of downstream concepts.`,
      topic:            concept.topic,
      subject:          concept.subject,
      chapter:          concept.chapter,
      urgency:          concept.mastery < 30 ? 'critical' : concept.mastery < 50 ? 'high' : 'medium',
      estimatedMinutes: concept.estimatedStudyMinutes,
      questionCount:    8,
    });
  }

  // 3. Retention boost — learned well but forgetting curve is steep
  const forgettingTargets = [...topicWeights.entries()]
    .filter(([, tw]) => {
      if (subject && tw.subject !== subject) return false;
      return tw.forgettingFactor > 0.5 && tw.masteryScore > 40;
    })
    .sort(([, a], [, b]) => b.forgettingFactor - a.forgettingFactor)
    .slice(0, 2);

  for (const [topic, tw] of forgettingTargets) {
    recs.push({
      type:             'retention-boost',
      title:            `Refresh ${topic}`,
      description:      `${Math.round(tw.forgettingFactor * 100)}% of this topic has decayed. A quick drill resets the forgetting curve.`,
      topic,
      subject:          tw.subject,
      chapter:          topic,
      urgency:          tw.forgettingFactor > 0.75 ? 'high' : 'medium',
      estimatedMinutes: 10,
      questionCount:    5,
    });
  }

  // 4. Prerequisite fix — mastery of a blocker concept is low
  const criticalBlockers = [...masteryMap.values()]
    .filter(c => c.mastery < 35 && c.enablesIds.length > 2)
    .sort((a, b) => b.enablesIds.length - a.enablesIds.length)
    .slice(0, 2);

  for (const c of criticalBlockers) {
    if (subject && c.subject !== subject) continue;
    recs.push({
      type:             'prerequisite-fix',
      title:            `Fix prerequisite: ${c.name}`,
      description:      `Weak mastery here is blocking ${c.enablesIds.length} downstream concepts. Resolve this first.`,
      topic:            c.topic,
      subject:          c.subject,
      chapter:          c.chapter,
      urgency:          'critical',
      estimatedMinutes: c.estimatedStudyMinutes,
      questionCount:    8,
    });
  }

  const sorted = recs
    .sort((a, b) => {
      const o = { critical: 0, high: 1, medium: 2, low: 3 };
      return o[a.urgency] - o[b.urgency];
    })
    .slice(0, 8);

  void cacheSet(cacheKey, sorted, TTL.PRACTICE_RECS);
  return sorted;
}
