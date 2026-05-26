import { Response } from 'express';
import type { AuthRequest } from '../middleware/auth';
import type { FeatureName } from '../types/subscription';
import { loadUserSnapshot, syncExpiredStatus } from '../services/subscriptionService';
import { computeEntitlements, resolveStatus } from '../lib/entitlements';

const FEATURE_LABELS: Record<FeatureName, string> = {
  smartNotes:        'AI Smart Notes',
  aiRevision:        'AI Revision Plan',
  advancedAnalytics: 'Advanced Analytics',
  unlimitedTests:    'Unlimited Tests & Premium Modes',
  ocr:               'OCR Question Scanner',
};

/**
 * GET /api/access
 *
 * Returns a complete, frontend-ready access context:
 *   - `entitlements`  — plan, status, feature flags, limits
 *   - `usage`         — lifetime test/revision counts vs limits
 *   - `features`      — per-feature object with `allowed`, `label`, `upgradeRequired`
 */
export async function getAccessHandler(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;

    let ents = req.entitlements;

    if (!ents) {
      const snapshot = await loadUserSnapshot(userId);
      const effectiveStatus = resolveStatus(
        snapshot.plan,
        snapshot.subscriptionStatus,
        snapshot.subscriptionEndsAt,
      );
      if (effectiveStatus !== snapshot.subscriptionStatus) {
        syncExpiredStatus(userId);
      }
      ents = computeEntitlements({ ...snapshot, subscriptionStatus: effectiveStatus });
      req.entitlements = ents;
    }

    const features = (Object.keys(FEATURE_LABELS) as FeatureName[]).reduce(
      (acc, feature) => {
        const allowed = ents!.features[feature];
        acc[feature] = {
          label:           FEATURE_LABELS[feature],
          allowed,
          upgradeRequired: !allowed,
        };
        return acc;
      },
      {} as Record<FeatureName, { label: string; allowed: boolean; upgradeRequired: boolean }>,
    );

    res.status(200).json({
      entitlements: ents,
      usage: {
        testsUsed:      ents.testsUsed,
        testsLimit:     ents.testsLimit,
        revisionsUsed:  ents.revisionsUsed,
        revisionsLimit: ents.revisionsLimit,
        testsExhausted:     ents.testsLimit !== null && ents.testsUsed >= ents.testsLimit,
        revisionsExhausted: ents.revisionsLimit !== null && ents.revisionsUsed >= ents.revisionsLimit,
      },
      features,
      upgradeUrl: '/api/subscription/plans',
    });
  } catch {
    res.status(500).json({ error: 'Failed to load access context.' });
  }
}
