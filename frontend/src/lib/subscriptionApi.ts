import { api } from './api';

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

// ── API calls ─────────────────────────────────────────────────────────────────

export const getSubscription = () =>
  api.get<Entitlements>('/subscription', { auth: true });

export const getSubscriptionHistory = (limit = 10) =>
  api.get<{ history: SubscriptionHistoryEntry[] }>(`/subscription/history?limit=${limit}`, { auth: true });

export const renewSubscription = () =>
  api.post<Entitlements>('/subscription/renew', {}, { auth: true });

export const cancelSubscription = () =>
  api.post<{ message: string }>('/subscription/cancel', {}, { auth: true });

// ── Razorpay payment calls ────────────────────────────────────────────────────

export interface CreateOrderResponse {
  orderId:  string;
  amount:   number;
  currency: string;
  planId:   string;
  keyId:    string;
}

export interface VerifyPaymentRequest {
  razorpayOrderId:   string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  planId:            string;
}

export const createOrder = (planId: string) =>
  api.post<CreateOrderResponse>('/subscription/create-order', { planId }, { auth: true });

export const verifyPayment = (data: VerifyPaymentRequest) =>
  api.post<Entitlements>('/subscription/verify', data, { auth: true });
