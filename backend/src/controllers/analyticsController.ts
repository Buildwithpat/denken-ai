import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth';
import { getUserAnalytics } from '../services/analyticsService';
import { AppError } from '../utils/AppError';
import { logger } from '../lib/logger';

export async function getAnalyticsHandler(req: AuthRequest, res: Response): Promise<void> {
  try {
    // Entitlements attached by attachEntitlements() middleware upstream
    const full = req.entitlements?.features.advancedAnalytics ?? false;
    const data = await getUserAnalytics(req.user!.userId, full);
    res.status(200).json({ ...data, _tier: full ? 'full' : 'free' });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Failed to compute analytics.' });
  }
}

/**
 * POST /api/analytics/event
 *
 * Receives product analytics events from the frontend and logs them
 * for aggregation. Fire-and-forget from the client — always returns 204.
 *
 * Events: onboarding_complete, trial_exhausted, upgrade_modal_shown,
 *         checkout_started, subscription_activated, feature_gated, etc.
 */
export async function trackEventHandler(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId ?? 'anonymous';
    const { event, properties } = req.body as {
      event:       string;
      properties?: Record<string, unknown>;
    };

    if (!event || typeof event !== 'string') {
      res.status(400).json({ error: 'event is required.' });
      return;
    }

    logger.info('product_event', {
      userId,
      event,
      properties: properties ?? {},
      timestamp:  new Date().toISOString(),
    });

    res.status(204).end();
  } catch {
    res.status(204).end(); // never fail the client on analytics
  }
}
