import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth';
import { getReadinessReport } from '../services/readinessService';

export async function readinessReportHandler(req: AuthRequest, res: Response): Promise<void> {
  try {
    const report = await getReadinessReport(req.user!.userId);
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate readiness report.' });
  }
}
