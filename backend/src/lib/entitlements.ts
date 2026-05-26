import type {
  Plan,
  SubscriptionStatus,
  FeatureName,
  Entitlements,
  UserSubscriptionSnapshot,
} from '../types/subscription';

// ── Plan catalog ──────────────────────────────────────────────────────────────

const ALL_FEATURES: Record<FeatureName, boolean> = {
  smartNotes:         true,
  aiRevision:         true,
  advancedAnalytics:  true,
  unlimitedTests:     true,
  ocr:                true,
};

const NO_FEATURES: Record<FeatureName, boolean> = {
  smartNotes:         false,
  aiRevision:         false,
  advancedAnalytics:  false,
  unlimitedTests:     false,
  ocr:                false,
};

/** 1 test + 1 revision total for free users; null = unlimited for pro */
export const FREE_TESTS_LIMIT      = 1;
export const FREE_REVISIONS_LIMIT  = 1;

interface PlanDef {
  features:       Record<FeatureName, boolean>;
  testsLimit:     number | null;
  revisionsLimit: number | null;
}

export const PLAN_CATALOG: Record<Plan, PlanDef> = {
  free: { features: NO_FEATURES,  testsLimit: FREE_TESTS_LIMIT,  revisionsLimit: FREE_REVISIONS_LIMIT },
  pro:  { features: ALL_FEATURES, testsLimit: null,               revisionsLimit: null                },
};

export const BILLING_CYCLE_DAYS: Record<Plan, number> = {
  free: 0,
  pro:  30,
};

export const PRO_BILLING_DAYS = 30;

// ── Status resolver ───────────────────────────────────────────────────────────

export function resolveStatus(
  plan: Plan,
  storedStatus: SubscriptionStatus,
  subscriptionEndsAt: Date | null,
  now: Date = new Date(),
): SubscriptionStatus {
  if (plan === 'free') return 'none';

  if (plan === 'pro') {
    if (!subscriptionEndsAt) return storedStatus;
    if (now <= subscriptionEndsAt) return 'active';

    const graceCutoff = new Date(subscriptionEndsAt.getTime() + 3 * 24 * 60 * 60 * 1000);
    return now <= graceCutoff ? 'grace_period' : 'expired';
  }

  return storedStatus;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeRemainingDays(endsAt: Date | null, now: Date): number | null {
  if (!endsAt) return null;
  const ms = endsAt.getTime() - now.getTime();
  return ms <= 0 ? 0 : Math.ceil(ms / (1000 * 60 * 60 * 24));
}

// ── Main computation ──────────────────────────────────────────────────────────

export function computeEntitlements(snapshot: UserSubscriptionSnapshot): Entitlements {
  const {
    plan, subscriptionStatus,
    testsUsed, revisionsUsed,
    subscriptionEndsAt, subscriptionStartedAt,
  } = snapshot;

  const now = new Date();
  const effectiveStatus = resolveStatus(plan, subscriptionStatus, subscriptionEndsAt, now);
  const def = PLAN_CATALOG[plan];

  const isActive      = effectiveStatus === 'active' || effectiveStatus === 'grace_period';
  const features      = isActive ? def.features : NO_FEATURES;
  const testsLimit    = isActive ? def.testsLimit    : FREE_TESTS_LIMIT;
  const revisionsLimit = isActive ? def.revisionsLimit : FREE_REVISIONS_LIMIT;

  const remainingDays = isActive ? computeRemainingDays(subscriptionEndsAt, now) : null;

  return {
    plan,
    status:                effectiveStatus,
    features,
    testsLimit,
    revisionsLimit,
    testsUsed,
    revisionsUsed,
    subscriptionEndsAt:    subscriptionEndsAt?.toISOString()    ?? null,
    subscriptionStartedAt: subscriptionStartedAt?.toISOString() ?? null,
    remainingDays,
    billingCycleDays:      BILLING_CYCLE_DAYS[plan],
  };
}
