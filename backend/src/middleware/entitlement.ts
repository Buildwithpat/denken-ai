import { Response, NextFunction } from 'express';
import type { RequestHandler } from 'express';
import type { AuthRequest } from './auth';
import type { FeatureName, Entitlements } from '../types/subscription';
import { loadUserSnapshot, syncExpiredStatus } from '../services/subscriptionService';
import { computeEntitlements, resolveStatus } from '../lib/entitlements';

async function resolveEntitlements(req: AuthRequest): Promise<Entitlements> {
  if (req.entitlements) return req.entitlements;

  const userId = req.user!.userId;
  const snapshot = await loadUserSnapshot(userId);
  const effectiveStatus = resolveStatus(
    snapshot.plan,
    snapshot.subscriptionStatus,
    snapshot.subscriptionEndsAt,
  );

  if (effectiveStatus !== snapshot.subscriptionStatus) {
    syncExpiredStatus(userId);
  }

  const ents = computeEntitlements({ ...snapshot, subscriptionStatus: effectiveStatus });
  req.entitlements = ents;
  return ents;
}

export function requireFeature(feature: FeatureName): RequestHandler {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    try {
      const ents = await resolveEntitlements(req);

      if (!ents.features[feature]) {
        res.status(403).json({
          error:      `Feature '${feature}' requires an active subscription.`,
          code:       'FEATURE_GATED',
          feature,
          plan:       ents.plan,
          status:     ents.status,
          upgradeUrl: '/api/subscription/plans',
        });
        return;
      }

      next();
    } catch {
      res.status(500).json({ error: 'Failed to verify entitlements.' });
    }
  };
}
