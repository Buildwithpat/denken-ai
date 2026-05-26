import { Response, NextFunction, type RequestHandler } from 'express';
import type { AuthRequest } from '../middleware/auth';
import { getExamRoadmap } from '../services/roadmapService';

export const getRoadmapHandler: RequestHandler = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) { res.status(401).json({ error: 'Unauthorised' }); return; }

    const exam = (req.query['exam'] as string | undefined) ?? 'JEE_MAIN';
    const roadmap = await getExamRoadmap(userId, exam);
    res.json(roadmap);
  } catch (err) {
    next(err);
  }
};
