/**
 * Adaptive test recommendation engine.
 *
 * Uses topic weights (mastery, retention, error history) to produce ranked
 * TestRecommendations with human-readable reasoning strings derived entirely
 * from real performance data.
 */

import { computeTopicWeights } from './topicWeightService';
import { ExamKey, AdaptiveMode, AdaptiveUrgency } from '../types';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface TopicInsight {
  topic:            string;
  subject:          string;
  masteryScore:     number;
  retentionScore:   number;
  accuracy:         number;
  wrongCount:       number;
  totalAttempted:   number;
  forgettingFactor: number;
  daysSinceLastSeen: number;
}

export interface TestRecommendation {
  mode:              AdaptiveMode;
  title:             string;
  description:       string;
  urgency:           AdaptiveUrgency;
  headline:          string;
  reasoning:         string[];
  subjects:          string[];
  topicFocus:        string[];
  suggestedChapters: string[];
  difficulty:        'easy' | 'medium' | 'hard' | 'mixed';
  questionCount:     number;
  estimatedDuration: number;
}

export interface AdaptiveRecommendationResponse {
  hasData:  boolean;
  primary:  TestRecommendation | null;
  allModes: TestRecommendation[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function urgencyFrom(criticalCount: number, highCount: number): AdaptiveUrgency {
  if (criticalCount >= 2) return 'critical';
  if (criticalCount >= 1 || highCount >= 3) return 'high';
  if (highCount >= 1) return 'medium';
  return 'low';
}

function uniqueSubjects(topics: TopicInsight[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of topics) {
    if (t.subject && !seen.has(t.subject)) { seen.add(t.subject); out.push(t.subject); }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Mode builders
// ---------------------------------------------------------------------------

function buildWeakTopicRec(
  insights: TopicInsight[],
  fallbackSubjects: string[],
): TestRecommendation {
  const weak = insights
    .filter((t) => t.totalAttempted >= 2 && t.masteryScore < 60)
    .sort((a, b) => a.masteryScore - b.masteryScore)
    .slice(0, 6);

  const criticalCount = weak.filter((t) => t.masteryScore < 35).length;
  const highCount     = weak.filter((t) => t.masteryScore >= 35 && t.masteryScore < 50).length;
  const urgency       = weak.length === 0 ? 'low' : urgencyFrom(criticalCount, highCount);
  const topicFocus    = weak.slice(0, 3).map((t) => t.topic);
  const subjects      = weak.length > 0 ? uniqueSubjects(weak) : fallbackSubjects;

  const reasoning: string[] = [];
  if (weak.length === 0) {
    reasoning.push("No significant weak topics found — you're performing well.");
  } else {
    for (const t of weak.slice(0, 3)) {
      reasoning.push(
        `Your mastery in ${t.topic} is ${t.masteryScore}/100 — you got ${t.wrongCount} of ${t.totalAttempted} wrong.`,
      );
    }
    if (weak.length > 3) {
      reasoning.push(`${weak.length - 3} more topic${weak.length - 3 > 1 ? 's' : ''} also need attention.`);
    }
  }

  const avgMastery = weak.length > 0 ? Math.round(weak.reduce((s, t) => s + t.masteryScore, 0) / weak.length) : 80;
  const difficulty  = avgMastery < 40 ? 'easy' : 'mixed';
  const qCount      = Math.max(15, Math.min(30, weak.length * 5));

  return {
    mode:              'weak-topic',
    title:             'Weakness Targeted',
    description:       weak.length > 0
      ? `Focus on your ${weak.length} weakest topic${weak.length > 1 ? 's' : ''} to close preparation gaps.`
      : 'AI-targeted practice — no major gaps detected right now.',
    urgency,
    headline:          weak.length > 0
      ? `Generated because your mastery in ${topicFocus[0] ?? 'key topics'} is only ${weak[0]?.masteryScore ?? 0}/100`
      : 'No significant weak topics detected — great job!',
    reasoning,
    subjects,
    topicFocus,
    suggestedChapters: topicFocus,
    difficulty,
    questionCount:     qCount,
    estimatedDuration: Math.round(qCount * 2.5),
  };
}

function buildRevisionRec(
  insights: TopicInsight[],
  fallbackSubjects: string[],
): TestRecommendation {
  const forgotten = insights
    .filter((t) => t.retentionScore < 60 && t.totalAttempted >= 1)
    .sort((a, b) => a.retentionScore - b.retentionScore)
    .slice(0, 6);

  const criticalCount = forgotten.filter((t) => t.retentionScore < 30).length;
  const highCount     = forgotten.filter((t) => t.retentionScore >= 30 && t.retentionScore < 50).length;
  const urgency       = forgotten.length === 0 ? 'low' : urgencyFrom(criticalCount, highCount);
  const topicFocus    = forgotten.slice(0, 3).map((t) => t.topic);
  const subjects      = forgotten.length > 0 ? uniqueSubjects(forgotten) : fallbackSubjects;

  const reasoning: string[] = [];
  if (forgotten.length === 0) {
    reasoning.push('Retention across all topics looks healthy. Keep up regular revision.');
  } else {
    for (const t of forgotten.slice(0, 3)) {
      reasoning.push(
        `Retention in ${t.topic} has dropped to ${t.retentionScore}% — last seen ${t.daysSinceLastSeen} day${t.daysSinceLastSeen !== 1 ? 's' : ''} ago.`,
      );
    }
  }

  const qCount = Math.max(15, Math.min(25, forgotten.length * 5));

  return {
    mode:              'revision',
    title:             'Revision Boost',
    description:       forgotten.length > 0
      ? `Revive ${forgotten.length} topic${forgotten.length > 1 ? 's' : ''} you haven't practised recently.`
      : 'Revision test to keep retention high.',
    urgency,
    headline:          forgotten.length > 0
      ? `Generated because your retention in ${topicFocus[0] ?? 'key topics'} has dropped to ${forgotten[0]?.retentionScore ?? 0}%`
      : "No significantly forgotten topics — your revision habits are solid.",
    reasoning,
    subjects,
    topicFocus,
    suggestedChapters: topicFocus,
    difficulty:        'mixed',
    questionCount:     qCount,
    estimatedDuration: Math.round(qCount * 2.5),
  };
}

function buildBalancedMockRec(
  insights: TopicInsight[],
  fallbackSubjects: string[],
): TestRecommendation {
  const subjects    = fallbackSubjects.length > 0 ? fallbackSubjects : uniqueSubjects(insights);
  const avgAccuracy = insights.length > 0
    ? Math.round(insights.reduce((s, t) => s + t.accuracy, 0) / insights.length)
    : 0;

  return {
    mode:              'balanced-mock',
    title:             'Balanced Mock Test',
    description:       'Full exam-pattern simulation with proper subject and difficulty distribution.',
    urgency:           'medium',
    headline:          'Simulates real exam conditions across all subjects.',
    reasoning:         [
      'Covers all subjects with exam-pattern distribution.',
      avgAccuracy > 0
        ? `Your overall accuracy is ${avgAccuracy}% — this benchmarks your readiness.`
        : 'Perfect for establishing a performance baseline.',
    ],
    subjects,
    topicFocus:        [],
    suggestedChapters: [],
    difficulty:        'mixed',
    questionCount:     40,
    estimatedDuration: 60,
  };
}

function buildSurpriseRec(
  insights: TopicInsight[],
  fallbackSubjects: string[],
): TestRecommendation {
  const subjects = fallbackSubjects.length > 0 ? fallbackSubjects : uniqueSubjects(insights);

  return {
    mode:              'surprise',
    title:             'Surprise Test',
    description:       'Random balanced selection to test your preparation breadth without bias.',
    urgency:           'low',
    headline:          'Randomised mix to reveal unexpected gaps.',
    reasoning:         [
      'Equal coverage across all topics — no predictable pattern.',
      "Good for identifying blind spots you haven't noticed.",
    ],
    subjects,
    topicFocus:        [],
    suggestedChapters: [],
    difficulty:        'mixed',
    questionCount:     25,
    estimatedDuration: 40,
  };
}

function buildExamAdaptiveRec(
  insights: TopicInsight[],
  fallbackSubjects: string[],
): TestRecommendation {
  const subjects = fallbackSubjects.length > 0 ? fallbackSubjects : uniqueSubjects(insights);
  const avgMastery = insights.length > 0
    ? Math.round(insights.reduce((s, t) => s + t.masteryScore, 0) / insights.length)
    : 50;
  const difficulty: 'easy' | 'mixed' | 'hard' = avgMastery < 45 ? 'easy' : avgMastery >= 75 ? 'hard' : 'mixed';

  return {
    mode:              'exam-adaptive',
    title:             'Exam-Adaptive Session',
    description:       'Full exam simulation where question difficulty scales to match your real-time performance.',
    urgency:           'medium',
    headline:          `Adaptive difficulty set to ${difficulty} based on your mastery of ${avgMastery}/100.`,
    reasoning:         [
      `Based on your average mastery of ${avgMastery}/100 — difficulty set to ${difficulty}.`,
      'Topics with lower mastery receive priority weighting.',
    ],
    subjects,
    topicFocus:        [],
    suggestedChapters: [],
    difficulty,
    questionCount:     50,
    estimatedDuration: 90,
  };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function computeTestRecommendations(
  userId:   string,
  exam:     ExamKey,
  subjects: string[],
): Promise<AdaptiveRecommendationResponse> {
  const topicWeights = await computeTopicWeights(userId);

  if (topicWeights.size === 0) {
    return { hasData: false, primary: null, allModes: [] };
  }

  // Build insights from enriched topic weights
  const insights: TopicInsight[] = Array.from(topicWeights.entries()).map(([topic, tw]) => ({
    topic,
    subject:           tw.subject,
    masteryScore:      tw.masteryScore,
    retentionScore:    tw.retentionScore,
    accuracy:          tw.accuracy,
    wrongCount:        tw.wrongCount,
    totalAttempted:    tw.totalAttempted,
    forgettingFactor:  tw.forgettingFactor,
    daysSinceLastSeen: tw.daysSinceLastSeen,
  }));

  const allModes: TestRecommendation[] = [
    buildWeakTopicRec(insights, subjects),
    buildRevisionRec(insights, subjects),
    buildBalancedMockRec(insights, subjects),
    buildSurpriseRec(insights, subjects),
    buildExamAdaptiveRec(insights, subjects),
  ];

  const urgencyOrder: AdaptiveUrgency[] = ['critical', 'high', 'medium', 'low'];
  const primary = [...allModes].sort(
    (a, b) => urgencyOrder.indexOf(a.urgency) - urgencyOrder.indexOf(b.urgency),
  )[0] ?? null;

  return { hasData: true, primary, allModes };
}
