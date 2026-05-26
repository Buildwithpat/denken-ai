export type Plan = 'free' | 'pro';

export type SubscriptionStatus =
  | 'none'
  | 'active'
  | 'expired'
  | 'cancelled'
  | 'grace_period';

export type SubscriptionEvent =
  | 'activated'
  | 'cancelled'
  | 'expired'
  | 'renewed';

export type FeatureName =
  | 'smartNotes'
  | 'aiRevision'
  | 'advancedAnalytics'
  | 'unlimitedTests'
  | 'ocr';

export interface Entitlements {
  plan:                  Plan;
  status:                SubscriptionStatus;
  features:              Record<FeatureName, boolean>;
  testsLimit:            number | null;
  revisionsLimit:        number | null;
  testsUsed:             number;
  revisionsUsed:         number;
  subscriptionEndsAt:    string | null;
  subscriptionStartedAt: string | null;
  remainingDays:         number | null;
  billingCycleDays:      number;
}

export interface UserSubscriptionSnapshot {
  plan:                  Plan;
  subscriptionStatus:    SubscriptionStatus;
  testsUsed:             number;
  revisionsUsed:         number;
  subscriptionEndsAt:    Date | null;
  subscriptionStartedAt: Date | null;
}

export interface SubscriptionHistoryEntry {
  id:          string;
  event:       SubscriptionEvent;
  plan:        Plan;
  status:      SubscriptionStatus;
  periodStart: string;
  periodEnd:   string | null;
  amountPaid:  number | null;
  currency:    string | null;
  createdAt:   string;
}
