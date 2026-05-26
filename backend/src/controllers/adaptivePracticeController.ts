import { Response } from 'express';
import type { AuthRequest } from '../middleware/auth';
import {
  createPracticeSession,
  submitPracticeAnswer,
  getPracticeSessionSummary,
  getPracticeRecommendations,
  type PracticeIntent,
} from '../services/adaptivePracticeService';
import { AppError } from '../utils/AppError';

export async function startPracticeSessionHandler(req: AuthRequest, res: Response): Promise<void> {
  const { subject, chapter, topic, conceptId, exam, questionCount = 8, intent = 'concept-drill' } =
    req.body as {
      subject:       string;
      chapter?:      string;
      topic?:        string;
      conceptId?:    string;
      exam:          string;
      questionCount?: number;
      intent?:        string;
    };

  if (!subject || !exam) {
    res.status(400).json({ error: '`subject` and `exam` are required.' });
    return;
  }

  try {
    const result = await createPracticeSession({
      userId:        req.user!.userId,
      subject,
      chapter,
      topic,
      conceptId,
      exam,
      questionCount: Math.min(Math.max(questionCount, 5), 10),
      intent:        intent as PracticeIntent,
    });
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof AppError) { res.status(err.statusCode).json({ error: err.message }); return; }
    const msg = err instanceof Error ? err.message : 'Failed to create practice session.';
    res.status(500).json({ error: msg });
  }
}

export async function submitPracticeAnswerHandler(req: AuthRequest, res: Response): Promise<void> {
  const { sessionId } = req.params as { sessionId: string };
  const { questionId, isCorrect, solvingTimeSec = 60 } = req.body as {
    questionId:      string;
    isCorrect:       boolean;
    solvingTimeSec?: number;
  };

  if (!sessionId || !questionId || isCorrect === undefined) {
    res.status(400).json({ error: '`sessionId`, `questionId`, and `isCorrect` are required.' });
    return;
  }

  try {
    const result = await submitPracticeAnswer(sessionId, questionId, isCorrect, solvingTimeSec);
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof AppError) { res.status(err.statusCode).json({ error: err.message }); return; }
    const msg = err instanceof Error ? err.message : 'Failed to submit answer.';
    res.status(err instanceof Error && err.message.includes('not found') ? 404 : 500).json({ error: msg });
  }
}

export async function getPracticeSessionSummaryHandler(req: AuthRequest, res: Response): Promise<void> {
  const { sessionId } = req.params as { sessionId: string };

  try {
    const summary = await getPracticeSessionSummary(sessionId);
    res.status(200).json(summary);
  } catch (err) {
    if (err instanceof AppError) { res.status(err.statusCode).json({ error: err.message }); return; }
    const msg = err instanceof Error ? err.message : 'Failed to get session summary.';
    res.status(err instanceof Error && err.message.includes('not found') ? 404 : 500).json({ error: msg });
  }
}

export async function getPracticeRecommendationsHandler(req: AuthRequest, res: Response): Promise<void> {
  const { exam = 'JEE_MAIN', subject } = req.query as { exam?: string; subject?: string };

  try {
    const result = await getPracticeRecommendations(req.user!.userId, exam, subject);
    res.status(200).json({ recommendations: result });
  } catch (err) {
    if (err instanceof AppError) { res.status(err.statusCode).json({ error: err.message }); return; }
    res.status(500).json({ error: 'Failed to get practice recommendations.' });
  }
}
