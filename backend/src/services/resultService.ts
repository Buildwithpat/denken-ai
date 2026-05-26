import { Types } from 'mongoose';
import Test from '../models/Test';
import Result from '../models/Result';
import { IAnswer, ISubjectSummary } from '../models/Result';
import { SubmittedAnswer } from '../types';
import { AppError } from '../utils/AppError';
import { updateMistakePatterns } from './mistakeAnalysisService';
import { updateQuestionPerformance, type QuestionAttemptRecord } from './questionBankService';
import { computeTopicWeights } from './topicWeightService';
import { invalidateUserCache } from '../lib/cache';
import { enqueueAnalyticsJob } from '../lib/queue';
import { updateStreak } from '../lib/streakUtils';

export interface GradedResult {
  id: string;
  testId: string;
  totalScore: number;
  correctCount: number;
  wrongCount: number;
  unattemptedCount: number;
  accuracy: number;
  timeTaken: number;
  subjectWise: ISubjectSummary[];
}

export async function gradeAndSave(
  userId: string,
  testId: string,
  timeTaken: number,
  submitted: SubmittedAnswer[],
): Promise<GradedResult> {
  const test = await Test.findById(testId);
  if (!test) throw new AppError('Test not found.', 404);
  if (test.userId.toString() !== userId) throw new AppError('Access denied.', 403);

  // Build O(1) lookup from submitted answers
  const answerMap = new Map<string, SubmittedAnswer>(
    submitted.map((a) => [a.questionId, a]),
  );

  const gradedAnswers: IAnswer[] = [];
  const subjectMap = new Map<string, ISubjectSummary>();

  let totalScore = 0;
  let correctCount = 0;
  let wrongCount = 0;
  let unattemptedCount = 0;

  for (const q of test.questions) {
    // Ensure subject bucket exists
    if (!subjectMap.has(q.subject)) {
      subjectMap.set(q.subject, {
        subject: q.subject,
        correct: 0,
        wrong: 0,
        unattempted: 0,
        score: 0,
      });
    }
    const bucket = subjectMap.get(q.subject)!;

    const sub = answerMap.get(q.id);
    const isMarked = sub?.isMarked ?? false;
    const hasResponse =
      sub?.selectedOption !== undefined || sub?.numericalValue !== undefined;

    let isCorrect = false;
    let marksAwarded = 0;

    if (!hasResponse) {
      // Unattempted — no penalty
      unattemptedCount++;
      bucket.unattempted++;
    } else if (q.type === 'mcq') {
      isCorrect = sub!.selectedOption === q.correctOption;
      marksAwarded = isCorrect ? test.marking.correct : test.marking.wrong;
      if (isCorrect) { correctCount++; bucket.correct++; }
      else           { wrongCount++;   bucket.wrong++;   }
    } else {
      // Numerical — tolerance-based match (handles floating-point precision and
      // JEE-style "nearest integer" rounding; tolerance: 0.01 absolute OR 0.1% relative)
      if (sub!.numericalValue !== undefined && q.answer !== undefined) {
        const submitted = sub!.numericalValue;
        const expected  = q.answer;
        const absDiff   = Math.abs(submitted - expected);
        const relDiff   = expected !== 0 ? absDiff / Math.abs(expected) : absDiff;
        isCorrect = absDiff <= 0.01 || relDiff <= 0.001;
      }
      marksAwarded = isCorrect ? test.marking.correct : test.marking.wrong;
      if (isCorrect) { correctCount++; bucket.correct++; }
      else           { wrongCount++;   bucket.wrong++;   }
    }

    totalScore      += marksAwarded;
    bucket.score    += marksAwarded;

    gradedAnswers.push({
      questionId:     q.id,
      selectedOption: sub?.selectedOption,
      numericalValue: sub?.numericalValue,
      isMarked,
      isCorrect,
      marksAwarded,
    });
  }

  const subjectWise = [...subjectMap.values()];
  const attempted   = correctCount + wrongCount;
  const accuracy    = attempted > 0
    ? Math.round((correctCount / attempted) * 1000) / 10
    : 0;

  const result = await Result.create({
    userId:           new Types.ObjectId(userId),
    testId:           new Types.ObjectId(testId),
    answers:          gradedAnswers,
    totalScore,
    correctCount,
    wrongCount,
    unattemptedCount,
    timeTaken,
    subjectWise,
  });

  // Invalidate Redis cache — topic weights / roadmap are now stale
  void invalidateUserCache(userId);

  // Update preparation streak
  void updateStreak(userId);

  // Enqueue background analytics jobs — never block the submit response
  void enqueueAnalyticsJob({ type: 'update-mistake-patterns', userId, resultId: result._id.toString() });

  // Build bank performance attempts for background enrichment
  const bankAttempts: QuestionAttemptRecord[] = [];
  for (const q of test.questions) {
    if (!q.bankQuestionId) continue;
    const answer = answerMap.get(q.id);
    const hasResponse = answer?.selectedOption !== undefined || answer?.numericalValue !== undefined;
    if (!hasResponse) continue;

    const graded = gradedAnswers.find(a => a.questionId === q.id);
    if (!graded) continue;

    bankAttempts.push({
      stableId:       q.bankQuestionId,
      subject:        q.subject,
      chapter:        q.chapter ?? q.topic,
      topic:          q.topic,
      isCorrect:      graded.isCorrect,
      solvingTimeSec: 0,
      userMastery:    50,
    });
  }

  if (bankAttempts.length > 0) {
    void enqueueAnalyticsJob({ type: 'update-question-performance', userId, bankAttempts });
  }

  return {
    id: result._id.toString(),
    testId,
    totalScore,
    correctCount,
    wrongCount,
    unattemptedCount,
    accuracy,
    timeTaken,
    subjectWise,
  };
}
