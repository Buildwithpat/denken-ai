import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth';
import { getWeekPlan, getDayPlan, getPlannerSummary } from '../services/plannerService';

export async function weekPlanHandler(req: AuthRequest, res: Response): Promise<void> {
  try {
    const plan = await getWeekPlan(req.user!.userId);
    res.json(plan);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate week plan.' });
  }
}

export async function dayPlanHandler(req: AuthRequest, res: Response): Promise<void> {
  try {
    const plan = await getDayPlan(req.user!.userId);
    res.json(plan);
  } catch (err) {
    res.status(500).json({ error: "Failed to generate today's plan." });
  }
}

export async function plannerSummaryHandler(req: AuthRequest, res: Response): Promise<void> {
  try {
    const summary = await getPlannerSummary(req.user!.userId);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate planner summary.' });
  }
}
