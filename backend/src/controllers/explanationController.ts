import { Response } from 'express';
import type { AuthRequest } from '../middleware/auth';
import { getExplanation, getHints } from '../services/explanationService';
import { type ExplanationStyle } from '../models/QuestionExplanation';
import { AppError } from '../utils/AppError';

const VALID_STYLES: ExplanationStyle[] = [
  'step-by-step', 'beginner', 'intermediate',
  'advanced', 'mistake-aware', 'alternative',
];

function qs(val: unknown, fallback = ''): string {
  if (typeof val === 'string') return val;
  if (Array.isArray(val) && typeof val[0] === 'string') return val[0];
  return fallback;
}

// ── GET /api/explanation/:stableId ───────────────────────────────────────────

export async function getExplanationHandler(req: AuthRequest, res: Response): Promise<void> {
  try {
    const stableId = req.params['stableId'] as string;
    const style      = qs(req.query.style, 'step-by-step') as ExplanationStyle;
    const mistakeType = qs(req.query.mistakeType) || undefined;

    if (!VALID_STYLES.includes(style)) {
      res.status(400).json({ error: `Invalid style. Must be one of: ${VALID_STYLES.join(', ')}` });
      return;
    }

    const explanation = await getExplanation(stableId, style, mistakeType);
    res.json(explanation);
  } catch (err) {
    if (err instanceof AppError) { res.status(err.statusCode).json({ error: err.message }); return; }
    res.status(500).json({ error: 'Failed to generate explanation.' });
  }
}

// ── GET /api/explanation/:stableId/hints ─────────────────────────────────────

export async function getHintsHandler(req: AuthRequest, res: Response): Promise<void> {
  try {
    const stableId = req.params['stableId'] as string;
    const level = parseInt(qs(req.query.level, '1'), 10) as 1 | 2 | 3;

    if (![1, 2, 3].includes(level)) {
      res.status(400).json({ error: 'level must be 1, 2, or 3.' });
      return;
    }

    const hints = await getHints(stableId, level);
    res.json({ hints, level });
  } catch (err) {
    if (err instanceof AppError) { res.status(err.statusCode).json({ error: err.message }); return; }
    res.status(500).json({ error: 'Failed to fetch hints.' });
  }
}
