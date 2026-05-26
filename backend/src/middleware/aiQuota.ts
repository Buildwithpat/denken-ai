/**
 * Per-user AI quota enforcement middleware.
 *
 * Enforces daily call limits per endpoint based on subscription tier.
 * Free users: 20 total AI calls/day, 5 mentor/day
 * Pro users:  200 total AI calls/day, 100 mentor/day
 *
 * Quota counts are stored in Redis. If Redis is unavailable, quota
 * enforcement is bypassed (fail-open to avoid blocking paying users).
 *
 * Mount this AFTER protect() + attachEntitlements().
 */

import { Response, NextFunction }          from 'express';
import type { AuthRequest }                from './auth';
import { isWithinQuota }                   from '../lib/aiTracker';
import { logger }                          from '../lib/logger';

export function aiQuotaGuard(endpoint: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user?.userId;
    if (!userId) { next(); return; } // unauthenticated — protect() handles 401

    const isPro = req.entitlements?.plan === 'pro';

    const allowed = await isWithinQuota(userId, endpoint, isPro).catch(() => true); // fail-open
    if (!allowed) {
      const limit = isPro ? 200 : 20;
      logger.warn('[AIQuota] Daily quota exceeded', { userId, endpoint, isPro });
      res.status(429).json({
        error:   'AI quota exceeded',
        message: isPro
          ? `You've reached your daily AI limit (${limit} calls/day). Limit resets at midnight.`
          : `Free plan allows ${limit} AI calls/day. Upgrade to Pro for higher limits.`,
        code: 'AI_QUOTA_EXCEEDED',
      });
      return;
    }

    next();
  };
}
