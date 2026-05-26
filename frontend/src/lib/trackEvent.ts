/**
 * Lightweight product analytics event tracker.
 *
 * Sends events to POST /api/analytics/event (fire-and-forget).
 * Never throws — analytics must never break user flows.
 */
import { api } from './api';

export type ProductEvent =
  | 'onboarding_complete'
  | 'first_test_started'
  | 'first_test_submitted'
  | 'trial_test_exhausted'
  | 'trial_revision_exhausted'
  | 'upgrade_modal_shown'
  | 'prep_insight_gate_shown'
  | 'checkout_started'
  | 'subscription_activated'
  | 'feature_gated'
  | 'roadmap_viewed'
  | 'mentor_first_message'
  | 'practice_session_started'
  | 'revision_accessed'
  | 'grace_period_banner_shown'
  | 'renewal_started';

export function trackEvent(
  event: ProductEvent,
  properties?: Record<string, unknown>,
): void {
  // Fire-and-forget — do not await
  api
    .post('/analytics/event', { event, properties: properties ?? {} }, { auth: true })
    .catch(() => {}); // silent — never throw
}
