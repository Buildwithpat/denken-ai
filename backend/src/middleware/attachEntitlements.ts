import { Response, NextFunction } from 'express';
import type { RequestHandler } from 'express';
import type { AuthRequest } from './auth';
import { loadUserSnapshot, syncExpiredStatus } from '../services/subscriptionService';
import { computeEntitlements, resolveStatus } from '../lib/entitlements';

export function attachEntitlements(): RequestHandler {
  return async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user?.userId;
    if (!userId) {
      next();
      return;
    }

    try {
      const snapshot = await loadUserSnapshot(userId);
      const effectiveStatus = resolveStatus(
        snapshot.plan,
        snapshot.subscriptionStatus,
        snapshot.subscriptionEndsAt,
      );

      if (effectiveStatus !== snapshot.subscriptionStatus) {
        syncExpiredStatus(userId);
      }

      req.entitlements = computeEntitlements({
        ...snapshot,
        subscriptionStatus: effectiveStatus,
      });
    } catch {
      // Non-fatal: downstream guards handle the missing entitlements
    }

    next();
  };
}
