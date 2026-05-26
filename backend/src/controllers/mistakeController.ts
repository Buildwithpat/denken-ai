import { Response, NextFunction } from 'express';
import {
  getMistakePatterns,
  getRevisionQueue,
  getFormulaLinkedMistakes,
  analyseTestMistakes,
} from '../services/mistakeAnalysisService';
import { AppError } from '../utils/AppError';
import type { AuthRequest } from '../middleware/auth';

export async function getMistakePatternsHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const patterns = await getMistakePatterns(req.user!.userId);
    res.status(200).json({ patterns });
  } catch (err) {
    next(err);
  }
}

export async function getRevisionQueueHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const queue = await getRevisionQueue(req.user!.userId);
    res.status(200).json({ queue });
  } catch (err) {
    next(err);
  }
}

export async function getFormulaLinkedHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const patterns = await getFormulaLinkedMistakes(req.user!.userId);
    res.status(200).json({ patterns });
  } catch (err) {
    next(err);
  }
}

export async function getTestMistakeAnalysisHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const resultId = req.params['resultId'] as string;
    if (!resultId) throw new AppError('resultId is required', 400);
    const analysis = await analyseTestMistakes(req.user!.userId, resultId);
    res.status(200).json(analysis);
  } catch (err) {
    next(err);
  }
}
