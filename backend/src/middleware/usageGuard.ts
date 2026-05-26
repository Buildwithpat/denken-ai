import { Response, NextFunction } from 'express';
import type { RequestHandler } from 'express';
import type { AuthRequest } from './auth';
import type { Entitlements } from '../types/subscription';
import { resolveStatus, computeEntitlements } from '../lib/entitlements';
import { loadUserSnapshot, syncExpiredStatus } from '../services/subscriptionService';
import User from '../models/User';

async function resolveEntitlements(req: AuthRequest): Promise<Entitlements> {
  if (req.entitlements) return req.entitlements;

  const snapshot = await loadUserSnapshot(req.user!.userId);
  const effectiveStatus = resolveStatus(
    snapshot.plan,
    snapshot.subscriptionStatus,
    snapshot.subscriptionEndsAt,
  );
  if (effectiveStatus !== snapshot.subscriptionStatus) {
    syncExpiredStatus(req.user!.userId);
  }
  const ents = computeEntitlements({ ...snapshot, subscriptionStatus: effectiveStatus });
  req.entitlements = ents;
  return ents;
}

/**
 * Middleware for POST /test/generate.
 *
 * Free users are limited to 1 test total (lifetime). Active pro users pass unconditionally.
 * On success, increments User.testsUsed atomically.
 */
export function enforceTestLimit(): RequestHandler {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    try {
      const ents = await resolveEntitlements(req);

      // Active pro subscribers have no limit
      if (ents.testsLimit === null) {
        next();
        return;
      }

      if (ents.testsUsed >= ents.testsLimit) {
        res.status(429).json({
          error:      `Free demo limit reached. Subscribe to generate more tests.`,
          code:       'FREE_LIMIT_REACHED',
          limit:      ents.testsLimit,
          used:       ents.testsUsed,
          plan:       ents.plan,
          status:     ents.status,
          upgradeUrl: '/api/subscription/plans',
        });
        return;
      }

      // Increment atomically before passing through
      await User.findByIdAndUpdate(userId, { $inc: { testsUsed: 1 } });
      next();
    } catch {
      res.status(500).json({ error: 'Failed to verify usage limits.' });
    }
  };
}

/**
 * Middleware for AI revision endpoints.
 *
 * Free users are limited to 1 revision total (lifetime). Active pro users pass unconditionally.
 * On success, increments User.revisionsUsed atomically.
 */
export function enforceRevisionLimit(): RequestHandler {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    try {
      const ents = await resolveEntitlements(req);

      // Active pro subscribers have no limit
      if (ents.revisionsLimit === null) {
        next();
        return;
      }

      if (ents.revisionsUsed >= ents.revisionsLimit) {
        res.status(429).json({
          error:      `Free demo limit reached. Subscribe to access unlimited revisions.`,
          code:       'FREE_LIMIT_REACHED',
          limit:      ents.revisionsLimit,
          used:       ents.revisionsUsed,
          plan:       ents.plan,
          status:     ents.status,
          upgradeUrl: '/api/subscription/plans',
        });
        return;
      }

      await User.findByIdAndUpdate(userId, { $inc: { revisionsUsed: 1 } });
      next();
    } catch {
      res.status(500).json({ error: 'Failed to verify usage limits.' });
    }
  };
}
