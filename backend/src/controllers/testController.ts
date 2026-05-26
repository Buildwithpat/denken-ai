import { Response } from 'express';
import { Types } from 'mongoose';
import { generateTest } from '../services/testGenerator';
import { gradeAndSave } from '../services/resultService';
import { computeTopicWeights } from '../services/topicWeightService';
import { computeTestRecommendations } from '../services/adaptiveTestService';
import { getSyllabus } from '../lib/syllabusLoader';
import { ExamKey, CbseClassFilter, TestMode, AdaptiveMode, SubmittedAnswer } from '../types';
import {
  validateGenerateBody,
  validateSyllabusQuery,
  validateSubmitBody,
} from '../validators/testValidator';
import { AppError } from '../utils/AppError';
import Test from '../models/Test';
import type { AuthRequest } from '../middleware/auth';
import { PREMIUM_TEST_MODES } from '../lib/usagePolicy';

// ── POST /api/test/generate  (protected) ─────────────────────────────────────

export async function generateTestHandler(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  const validation = validateGenerateBody(req.body as Record<string, unknown>);
  if (!validation.valid) {
    res.status(400).json({ error: validation.error });
    return;
  }

  try {
    const {
      exam, subjects, chapters, difficulty,
      questionCount, cbseClass, mode, questionTypeMode,
    } = req.body as Record<string, unknown>;

    // ── Premium mode gate — reads entitlements attached upstream ─────────────
    if (mode && PREMIUM_TEST_MODES.has(mode as TestMode)) {
      // req.entitlements is set by attachEntitlements() in the route pipeline
      const ents = req.entitlements;
      if (!ents?.features.unlimitedTests) {
        res.status(403).json({
          error:      `Test mode '${mode as string}' requires an active subscription.`,
          code:       'MODE_GATED',
          mode,
          plan:       ents?.plan ?? 'free',
          status:     ents?.status ?? 'none',
          upgradeUrl: '/api/subscription/plans',
        });
        return;
      }
    }

    // Load adaptive weights from past performance.
    // Failures are non-fatal — fall back to equal distribution silently.
    let topicWeights;
    try {
      topicWeights = await computeTopicWeights(req.user!.userId);
    } catch {
      topicWeights = undefined;
    }

    const generated = await generateTest({
      exam:             exam as ExamKey,
      subjects:         subjects as string[],
      chapters:         chapters as string[] | undefined,
      difficulty:       difficulty as 'easy' | 'medium' | 'hard' | 'mixed' | undefined,
      questionCount:    questionCount as number | undefined,
      cbseClass:        cbseClass as CbseClassFilter | undefined,
      mode:             mode as TestMode | undefined,
      adaptiveMode:     (req.body as Record<string, unknown>).adaptiveMode as AdaptiveMode | undefined,
      questionTypeMode: questionTypeMode as 'mcq' | 'numerical' | 'mixed' | undefined,
      topicWeights,
    });

    // Persist to DB — userId comes from the JWT
    const saved = await Test.create({
      userId:        new Types.ObjectId(req.user!.userId),
      exam:          generated.exam,
      subjects:      generated.subjects,
      chapters:      chapters as string[] | undefined,
      difficulty:    ((difficulty as string | undefined) ?? 'mixed') as 'easy' | 'medium' | 'hard' | 'mixed',
      mode:          ((mode as string | undefined) ?? 'normal') as TestMode,
      questionCount: generated.totalQuestions,
      duration:      generated.duration,
      marking:       generated.marking,
      cbseClass:     cbseClass as CbseClassFilter | undefined,
      questions:     generated.questions,
    });

    res.status(201).json({ testId: saved._id.toString(), ...generated });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    if (err instanceof Error) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Unexpected error while generating the test.' });
  }
}

// ── POST /api/test/submit  (protected) ───────────────────────────────────────

export async function submitTestHandler(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  const validation = validateSubmitBody(req.body as Record<string, unknown>);
  if (!validation.valid) {
    res.status(400).json({ error: validation.error });
    return;
  }

  try {
    const { testId, timeTaken, answers } = req.body as {
      testId: string;
      timeTaken: number;
      answers: SubmittedAnswer[];
    };

    const result = await gradeAndSave(
      req.user!.userId,
      testId,
      timeTaken,
      answers,
    );

    res.status(201).json({ result });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Unexpected error while submitting the test.' });
  }
}

// ── GET /api/test/recommend  (protected) ─────────────────────────────────────

export async function getTestRecommendationHandler(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const exam     = ((req.query.exam as string) ?? 'JEE_MAIN').toUpperCase() as ExamKey;
    const subjects = req.query.subjects
      ? (req.query.subjects as string).split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    const result = await computeTestRecommendations(req.user!.userId, exam, subjects);
    res.status(200).json(result);
  } catch {
    res.status(500).json({ error: 'Unable to compute recommendation.' });
  }
}

// ── GET /api/test/syllabus  (public) ─────────────────────────────────────────

export function getSyllabusHandler(req: AuthRequest, res: Response): void {
  const validation = validateSyllabusQuery(req.query as Record<string, unknown>);
  if (!validation.valid) {
    res.status(400).json({ error: validation.error });
    return;
  }

  try {
    const { exam, cbseClass } = req.query as Record<string, string>;

    const classFilter: CbseClassFilter =
      exam === 'CBSE' && cbseClass && ['11', '12', 'both'].includes(cbseClass)
        ? (cbseClass as CbseClassFilter)
        : 'both';

    const syllabus = getSyllabus(exam as ExamKey, classFilter);

    res.status(200).json({
      exam,
      ...(exam === 'CBSE' ? { cbseClass: classFilter } : {}),
      subjects: syllabus,
    });
  } catch (err) {
    if (err instanceof Error) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Unexpected error while loading the syllabus.' });
  }
}
