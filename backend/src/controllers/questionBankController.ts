import { Response } from 'express';
import type { AuthRequest } from '../middleware/auth';
import {
  getQuestionStats,
  upsertQuestion,
  getQuestionsByChapter,
  getFormulaLinkedQuestions,
  selectFromBank,
} from '../services/questionBankService';
import { analyzeConceptMastery, getTopicConceptMap } from '../services/questionIntelligenceService';
import { computeTopicWeights } from '../services/topicWeightService';
import { AppError } from '../utils/AppError';
import QuestionBank from '../models/QuestionBank';

// ── GET /api/question-bank/stats ─────────────────────────────────────────────

export async function getStatsHandler(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { subject, chapter } = req.query as Record<string, string>;
    const stats = await getQuestionStats(subject, chapter);
    res.json(stats);
  } catch {
    res.status(500).json({ error: 'Failed to fetch question bank stats.' });
  }
}

// ── GET /api/question-bank/questions ─────────────────────────────────────────

export async function getQuestionsHandler(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { subject, chapter, limit } = req.query as Record<string, string>;
    if (!subject || !chapter) {
      res.status(400).json({ error: 'subject and chapter are required.' });
      return;
    }
    const questions = await getQuestionsByChapter(subject, chapter, parseInt(limit ?? '50', 10));
    res.json({ questions, count: questions.length });
  } catch {
    res.status(500).json({ error: 'Failed to fetch questions.' });
  }
}

// ── GET /api/question-bank/:stableId ─────────────────────────────────────────

export async function getOneHandler(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { stableId } = req.params;
    const question = await QuestionBank.findOne({ stableId, isActive: true }).lean();
    if (!question) {
      res.status(404).json({ error: 'Question not found.' });
      return;
    }
    res.json(question);
  } catch {
    res.status(500).json({ error: 'Failed to fetch question.' });
  }
}

// ── PUT /api/question-bank/:stableId  (admin only) ───────────────────────────

export async function upsertHandler(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { stableId } = req.params;
    const doc = await upsertQuestion({ ...(req.body as object), stableId } as Parameters<typeof upsertQuestion>[0]);
    res.json(doc);
  } catch (err) {
    if (err instanceof AppError) { res.status(err.statusCode).json({ error: err.message }); return; }
    res.status(500).json({ error: 'Failed to upsert question.' });
  }
}

// ── DELETE /api/question-bank/:stableId  (admin only) ────────────────────────

export async function deleteHandler(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { stableId } = req.params;
    await QuestionBank.updateOne({ stableId }, { $set: { isActive: false } });
    res.json({ message: 'Question deactivated.' });
  } catch {
    res.status(500).json({ error: 'Failed to deactivate question.' });
  }
}

// ── GET /api/question-bank/formula-linked ────────────────────────────────────

export async function formulaLinkedHandler(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { subject, chapter, limit } = req.query as Record<string, string>;
    if (!subject || !chapter) {
      res.status(400).json({ error: 'subject and chapter are required.' });
      return;
    }
    const questions = await getFormulaLinkedQuestions(subject, chapter, parseInt(limit ?? '20', 10));
    res.json({ questions, count: questions.length });
  } catch {
    res.status(500).json({ error: 'Failed to fetch formula-linked questions.' });
  }
}

// ── GET /api/question-bank/concept-map ───────────────────────────────────────

export async function conceptMapHandler(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { subject, topic } = req.query as Record<string, string>;
    if (!subject || !topic) {
      res.status(400).json({ error: 'subject and topic are required.' });
      return;
    }
    const result = await getTopicConceptMap(subject, topic);
    res.json(result);
  } catch {
    res.status(500).json({ error: 'Failed to fetch concept map.' });
  }
}

// ── GET /api/question-bank/concept-insights  (user-scoped) ───────────────────

export async function conceptInsightsHandler(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { subject } = req.query as Record<string, string>;
    const topicWeights = await computeTopicWeights(req.user!.userId);
    const insights = await analyzeConceptMastery(topicWeights, subject);
    res.json(insights);
  } catch {
    res.status(500).json({ error: 'Failed to compute concept insights.' });
  }
}
