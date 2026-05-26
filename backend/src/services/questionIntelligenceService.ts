/**
 * Question Intelligence Service
 *
 * Aggregates per-question and per-concept performance data into
 * actionable insights for the mentor system, result analysis,
 * and adaptive test recommendations.
 */

import QuestionBank, { IQuestionBankDocument } from '../models/QuestionBank';
import QuestionPerformance                      from '../models/QuestionPerformance';
import ConceptGraph                             from '../models/ConceptGraph';
import { type TopicWeight }                     from '../types';
import { detectPrerequisiteGaps, type ConceptGap } from './questionBankService';

// ── Public types ──────────────────────────────────────────────────────────────

export interface ConceptMasteryEntry {
  conceptId:   string;
  conceptName: string;
  subject:     string;
  chapter:     string;
  topic:       string;
  masteryScore: number;      // 0–100 derived from topicWeights
  retentionScore: number;    // 0–100
  questionCount:  number;    // questions attempted from this concept
  accuracy:       number;    // % correct for questions tagged with this concept
  dominantMistake: string | null;
  prerequisites:  string[];  // conceptId[] that this concept depends on
  enables:        string[];  // conceptId[] this unlocks
}

export interface ConceptInsightResult {
  masteredConcepts:  ConceptMasteryEntry[];
  weakConcepts:      ConceptMasteryEntry[];
  gaps:              ConceptGap[];
  unlockableConcepts: string[];  // concepts that become accessible after fixing gaps
}

export interface ResultConceptBreakdown {
  byBloomLevel:  Record<string, { correct: number; total: number }>;
  bySkill:       Record<string, { correct: number; total: number }>;
  weakConcepts:  string[];          // concept tags from wrong questions
  formulaLinks:  string[];          // formula tags from wrong questions
  avgSolvingTime: number;           // seconds
  slowQuestions:  string[];         // question IDs where time > 2× expected
  conceptGaps:   ConceptGap[];
}

// ── Concept mastery analysis ──────────────────────────────────────────────────

export async function analyzeConceptMastery(
  topicWeights: Map<string, TopicWeight>,
  subject?: string,
): Promise<ConceptInsightResult> {
  const filter: Record<string, unknown> = { isActive: true };
  if (subject) filter.subject = subject;

  const allConcepts = await ConceptGraph.find(filter).lean();

  const masteredConcepts: ConceptMasteryEntry[] = [];
  const weakConcepts:     ConceptMasteryEntry[] = [];

  for (const concept of allConcepts) {
    const tw = topicWeights.get(concept.topic);
    if (!tw) continue;

    // Fetch perf for questions tagged with this concept
    const perfDocs = await QuestionPerformance.find({
      // We join via QuestionBank conceptTags
    }).limit(0).lean(); // placeholder — real join below

    // Get question performance for this concept's tags
    const bankDocs = await QuestionBank.find({
      conceptTags: concept.conceptId,
      isActive: true,
    }).select('stableId').lean<{ stableId: string }[]>();

    const stableIds = bankDocs.map(d => d.stableId);
    const perfs = stableIds.length > 0
      ? await QuestionPerformance.find({ stableId: { $in: stableIds } })
          .select('accuracy dominantMistakeType totalAttempts correctAttempts')
          .lean<{ accuracy: number; dominantMistakeType: string | null; totalAttempts: number; correctAttempts: number }[]>()
      : [];

    const totalQ     = perfs.length;
    const totalCorr  = perfs.reduce((s, p) => s + p.correctAttempts, 0);
    const totalAtt   = perfs.reduce((s, p) => s + p.totalAttempts, 0);
    const accuracy   = totalAtt > 0 ? Math.round((totalCorr / totalAtt) * 100) : 0;

    const mistakeCounts: Record<string, number> = {};
    for (const p of perfs) {
      if (p.dominantMistakeType) {
        mistakeCounts[p.dominantMistakeType] = (mistakeCounts[p.dominantMistakeType] ?? 0) + 1;
      }
    }
    const dominantMistake = Object.keys(mistakeCounts).length > 0
      ? Object.entries(mistakeCounts).sort((a, b) => b[1] - a[1])[0][0]
      : null;

    const entry: ConceptMasteryEntry = {
      conceptId:       concept.conceptId,
      conceptName:     concept.name,
      subject:         concept.subject,
      chapter:         concept.chapter,
      topic:           concept.topic,
      masteryScore:    tw.masteryScore,
      retentionScore:  tw.retentionScore,
      questionCount:   totalQ,
      accuracy,
      dominantMistake,
      prerequisites:   concept.prerequisites,
      enables:         concept.enables,
    };

    if (tw.masteryScore >= 60) {
      masteredConcepts.push(entry);
    } else {
      weakConcepts.push(entry);
    }
  }

  weakConcepts.sort((a, b) => a.masteryScore - b.masteryScore);

  const gaps = await detectPrerequisiteGaps('', topicWeights);

  // Concepts that become unlockable once gaps are fixed
  const unlockableConcepts = [...new Set(
    gaps.flatMap(g => g.enablesConcepts),
  )];

  return {
    masteredConcepts: masteredConcepts.slice(0, 20),
    weakConcepts:     weakConcepts.slice(0, 20),
    gaps,
    unlockableConcepts,
  };
}

// ── Result-level concept breakdown ────────────────────────────────────────────

interface AttemptedQuestion {
  questionId:      string;
  bankQuestionId?: string;
  isCorrect:       boolean;
  solvingTimeSec?: number;
  conceptTags?:    string[];
  formulaTags?:    string[];
  bloomLevel?:     string;
  skillCategory?:  string;
  expectedSolvingTimeSec?: number;
}

export async function computeResultConceptBreakdown(
  userId:    string,
  questions: AttemptedQuestion[],
  topicWeights: Map<string, TopicWeight>,
): Promise<ResultConceptBreakdown> {
  const byBloomLevel: Record<string, { correct: number; total: number }> = {};
  const bySkill:      Record<string, { correct: number; total: number }> = {};
  const weakConceptSet   = new Set<string>();
  const formulaLinkSet   = new Set<string>();
  const slowQuestions:   string[] = [];

  let totalSolvingTime = 0;
  let timedCount       = 0;

  for (const q of questions) {
    if (q.bloomLevel) {
      if (!byBloomLevel[q.bloomLevel]) byBloomLevel[q.bloomLevel] = { correct: 0, total: 0 };
      byBloomLevel[q.bloomLevel].total++;
      if (q.isCorrect) byBloomLevel[q.bloomLevel].correct++;
    }

    if (q.skillCategory) {
      if (!bySkill[q.skillCategory]) bySkill[q.skillCategory] = { correct: 0, total: 0 };
      bySkill[q.skillCategory].total++;
      if (q.isCorrect) bySkill[q.skillCategory].correct++;
    }

    if (!q.isCorrect) {
      q.conceptTags?.forEach(t => weakConceptSet.add(t));
      q.formulaTags?.forEach(t => formulaLinkSet.add(t));
    }

    if (q.solvingTimeSec !== undefined) {
      totalSolvingTime += q.solvingTimeSec;
      timedCount++;

      if (q.expectedSolvingTimeSec && q.solvingTimeSec > q.expectedSolvingTimeSec * 2) {
        slowQuestions.push(q.questionId);
      }
    }
  }

  const avgSolvingTime = timedCount > 0 ? Math.round(totalSolvingTime / timedCount) : 0;

  // Fetch concept gaps using the topic weights we already have
  const gaps = await detectPrerequisiteGaps(userId, topicWeights);

  return {
    byBloomLevel,
    bySkill,
    weakConcepts:   [...weakConceptSet].slice(0, 15),
    formulaLinks:   [...formulaLinkSet].slice(0, 15),
    avgSolvingTime,
    slowQuestions:  slowQuestions.slice(0, 10),
    conceptGaps:    gaps.slice(0, 5),
  };
}

// ── Mentor context enrichment ─────────────────────────────────────────────────

export interface MentorConceptContext {
  recentWeakConcepts:  string[];
  prerequisiteGaps:    ConceptGap[];
  formulaWeaknesses:   string[];
  recommendedBloom:    string;   // bloom level to target next
}

export async function buildMentorConceptContext(
  userId:       string,
  topicWeights: Map<string, TopicWeight>,
  recentResultId?: string,
): Promise<MentorConceptContext> {
  const gaps = await detectPrerequisiteGaps(userId, topicWeights);

  // Find formula tags from recent wrong questions
  const weakTopics = Array.from(topicWeights.entries())
    .filter(([, tw]) => tw.masteryScore < 50)
    .map(([topic]) => topic);

  const formulaDocs = weakTopics.length > 0
    ? await QuestionBank.find({
        topic: { $in: weakTopics },
        isActive: true,
      })
        .select('formulaTags')
        .limit(30)
        .lean<{ formulaTags: string[] }[]>()
    : [];

  const formulaWeaknesses = [...new Set(
    formulaDocs.flatMap(d => d.formulaTags ?? []),
  )].slice(0, 10);

  // Recommend Bloom level: start at 'remember' for very weak, scale up
  const avgMastery = topicWeights.size > 0
    ? Array.from(topicWeights.values()).reduce((s, tw) => s + tw.masteryScore, 0) / topicWeights.size
    : 50;

  const recommendedBloom =
    avgMastery < 30 ? 'remember' :
    avgMastery < 50 ? 'understand' :
    avgMastery < 70 ? 'apply' : 'analyze';

  return {
    recentWeakConcepts: gaps.slice(0, 5).map(g => g.conceptName),
    prerequisiteGaps:   gaps,
    formulaWeaknesses,
    recommendedBloom,
  };
}

// ── Formula-concept linkage for a given topic ─────────────────────────────────

export async function getTopicConceptMap(
  subject: string,
  topic:   string,
): Promise<{ concepts: IConceptNodeSummary[]; formulaLinks: string[] }> {
  const concepts = await ConceptGraph.find({ subject, topic, isActive: true })
    .select('conceptId name difficulty bloomLevel formulaLinks enables prerequisites')
    .lean();

  const formulaLinks = [...new Set(concepts.flatMap(c => c.formulaLinks ?? []))];

  return {
    concepts: concepts.map(c => ({
      conceptId:     c.conceptId,
      name:          c.name,
      difficulty:    c.difficulty,
      bloomLevel:    c.bloomLevel,
      formulaLinks:  c.formulaLinks,
      enables:       c.enables,
      prerequisites: c.prerequisites,
    })),
    formulaLinks,
  };
}

interface IConceptNodeSummary {
  conceptId:     string;
  name:          string;
  difficulty:    string;
  bloomLevel:    string;
  formulaLinks:  string[];
  enables:       string[];
  prerequisites: string[];
}
