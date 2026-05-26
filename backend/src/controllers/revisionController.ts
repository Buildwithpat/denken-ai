import { Response } from 'express';
import type { RequestHandler } from 'express';
import type { AuthRequest } from '../middleware/auth';
import { getUserRevision } from '../services/revisionService';
import { AppError } from '../utils/AppError';
import { updateStreak } from '../lib/streakUtils';

export const getRevisionHandler: RequestHandler = async (
  req,
  res: Response,
): Promise<void> => {
  try {
    // Entitlements attached by attachEntitlements() middleware upstream
    const userId = (req as AuthRequest).user!.userId;
    const full   = (req as AuthRequest).entitlements?.features.aiRevision ?? false;
    const data   = await getUserRevision(userId, full);
    void updateStreak(userId);
    res.status(200).json({ ...data, _tier: full ? 'full' : 'free' });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Failed to compute revision data.' });
  }
};
