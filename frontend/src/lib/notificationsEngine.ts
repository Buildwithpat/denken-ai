/**
 * Notifications engine — Phase 1 (client-side, data-derived).
 *
 * Every notification is generated from real API state (analytics, access,
 * onboarding). Nothing is hardcoded or fabricated.
 *
 * Architecture notes for future phases:
 *  - Phase 2: backend `/notifications` endpoint returns `BackendNotif[]`.
 *    Merge into `buildNotifications()` before the read-state pass.
 *  - Phase 3: WebSocket push — call `appendNotification()` from the socket
 *    handler; the page listens via a context/store.
 *  - Phase 4: push notifications — same payload shape, different delivery.
 *  All phases share this file's types and localStorage helpers.
 */

import type { LucideIcon } from 'lucide-react';
import {
  TrendingUp, AlertTriangle, Target, Flame,
  Clock, Crown, Zap, BookOpen, CheckCircle2, Bell,
  Sparkles,
} from 'lucide-react';
import type { AnalyticsData } from './analyticsApi';
import type { OnboardingData } from '@/context/OnboardingContext';

// ── Public types ──────────────────────────────────────────────────────────────

export type NotifCategory = 'performance' | 'reminder' | 'subscription' | 'update';
export type NotifPriority = 'urgent' | 'normal' | 'low';

export interface AppNotification {
  id:        string;
  category:  NotifCategory;
  priority:  NotifPriority;
  icon:      LucideIcon;
  iconColor: string;
  iconBg:    string;
  title:     string;
  message:   string;
  createdAt: Date;
  /** Derived from localStorage read-state — not part of the raw signal. */
  read:      boolean;
  cta?:      { label: string; href: string };
}

/** Primitive deps the engine needs — decoupled from specific context shapes. */
export interface NotifBuildDeps {
  analytics:          AnalyticsData | null;
  onboarding:         OnboardingData;
  isPro:              boolean;
  testsExhausted:     boolean;
  revisionsExhausted: boolean;
  /** SubscriptionStatus string or null if unknown. */
  subscriptionStatus: string | null;
  /** Days remaining in the current billing cycle, or null. */
  remainingDays:      number | null;
}

// ── localStorage helpers ──────────────────────────────────────────────────────

const READ_KEY         = 'denken_notif_read';
const UNREAD_COUNT_KEY = 'denken_notif_unread';

export function getReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch { return new Set(); }
}

/** Persist a set of notification IDs as read. Merges with existing reads. */
export function markReadIds(ids: string[]): void {
  try {
    const existing = getReadIds();
    for (const id of ids) existing.add(id);
    localStorage.setItem(READ_KEY, JSON.stringify([...existing]));
  } catch {}
}

/** Write the unread count so the Topbar can read it without re-fetching. */
export function setCachedUnreadCount(n: number): void {
  try { localStorage.setItem(UNREAD_COUNT_KEY, String(n)); } catch {}
}

export function getCachedUnreadCount(): number {
  try {
    const raw = localStorage.getItem(UNREAD_COUNT_KEY);
    return raw ? Math.max(0, parseInt(raw, 10)) : 0;
  } catch { return 0; }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

type RawNotif = Omit<AppNotification, 'read'>;

const PRIORITY_ORDER: Record<NotifPriority, number> = { urgent: 2, normal: 1, low: 0 };

function relativeDate(isoDate: string): string {
  const diff  = Date.now() - new Date(isoDate).getTime();
  const mins  = Math.floor(diff / 60_000);
  if (mins < 2)   return 'just now';
  if (mins < 60)  return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs} hour${hrs !== 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

// ── Signal generators ─────────────────────────────────────────────────────────

function genSubscription(deps: NotifBuildDeps): RawNotif[] {
  const out: RawNotif[] = [];
  const now = new Date();

  // Free quota: tests
  if (deps.testsExhausted) {
    out.push({
      id: 'tests-exhausted', category: 'subscription', priority: 'urgent',
      icon: AlertTriangle, iconColor: 'text-amber-400',
      iconBg: 'bg-amber-400/10 border-amber-400/20',
      title: 'Free test quota reached',
      message: "You've used your free demo test. Upgrade to Pro for unlimited AI-powered tests, smart revision, and detailed analytics.",
      createdAt: now,
      cta: { label: 'Upgrade to Pro', href: '/pricing' },
    });
  }

  // Free quota: revisions (only surface if tests are still available to avoid duplicate upgrade prompts)
  if (deps.revisionsExhausted && !deps.testsExhausted) {
    out.push({
      id: 'revisions-exhausted', category: 'subscription', priority: 'urgent',
      icon: AlertTriangle, iconColor: 'text-amber-400',
      iconBg: 'bg-amber-400/10 border-amber-400/20',
      title: 'Free revision quota reached',
      message: "You've used your free revision session. Upgrade to Pro for unlimited AI-powered revision, smart notes, and rapid formula drills.",
      createdAt: now,
      cta: { label: 'Upgrade to Pro', href: '/pricing' },
    });
  }

  // Pro: grace period (subscription just lapsed)
  if (deps.subscriptionStatus === 'grace_period') {
    out.push({
      id: 'pro-grace-period', category: 'subscription', priority: 'urgent',
      icon: Clock, iconColor: 'text-rose-400',
      iconBg: 'bg-rose-400/10 border-rose-400/20',
      title: 'Pro subscription expired: grace period active',
      message: 'Your subscription has lapsed. You have limited access for the next 3 days. Renew now to restore unlimited tests, AI revision, and analytics.',
      createdAt: now,
      cta: { label: 'Renew Now', href: '/profile' },
    });
  }

  // Pro: expiring within 7 days
  if (
    deps.isPro &&
    deps.remainingDays !== null &&
    deps.remainingDays > 0 &&
    deps.remainingDays <= 7
  ) {
    out.push({
      id: `pro-expiring-${deps.remainingDays}`, category: 'subscription', priority: 'urgent',
      icon: Crown, iconColor: 'text-amber-400',
      iconBg: 'bg-amber-400/10 border-amber-400/20',
      title: `Pro renews in ${deps.remainingDays} day${deps.remainingDays === 1 ? '' : 's'}`,
      message: 'Your Pro subscription is about to renew. Ensure your payment method is up to date to maintain uninterrupted access.',
      createdAt: now,
      cta: { label: 'Manage Subscription', href: '/profile' },
    });
  }

  // Pro: cancelled but still active
  if (deps.subscriptionStatus === 'cancelled' && deps.isPro) {
    out.push({
      id: 'pro-cancelled', category: 'subscription', priority: 'normal',
      icon: Crown, iconColor: 'text-white/40',
      iconBg: 'bg-white/[0.04] border-white/[0.08]',
      title: 'Pro access active until end of billing period',
      message: `Your subscription is cancelled but Pro access continues until it expires${deps.remainingDays ? ` (${deps.remainingDays} days remaining)` : ''}. Reactivate any time to keep access.`,
      createdAt: now,
      cta: { label: 'Reactivate', href: '/profile' },
    });
  }

  return out;
}

function genPerformance(analytics: AnalyticsData): RawNotif[] {
  const out: RawNotif[] = [];
  const { overview, lastTest, weakTopics, recommendations } = analytics;

  // Most recent test result
  if (lastTest) {
    const isGood = lastTest.accuracy >= 75;
    const isOk   = lastTest.accuracy >= 50;
    out.push({
      id: `test-completed-${lastTest.date.slice(0, 10)}`,
      category: 'performance', priority: 'normal',
      icon:      isGood ? CheckCircle2 : isOk ? TrendingUp : AlertTriangle,
      iconColor: isGood ? 'text-[#22c55e]' : isOk ? 'text-amber-400' : 'text-rose-400',
      iconBg:    isGood ? 'bg-[#22c55e]/10 border-[#22c55e]/20'
                       : isOk ? 'bg-amber-400/10 border-amber-400/20'
                       : 'bg-rose-400/10 border-rose-400/20',
      title:   `${lastTest.exam} test — ${lastTest.accuracy}% accuracy`,
      message: `Your ${lastTest.subjects.join(' & ')} test is scored. ${
        isGood
          ? 'Strong result. Review the breakdown to defend this performance.'
          : isOk
          ? 'Decent performance. Check the analysis to close any gaps before the next attempt.'
          : 'Below target. Deep-dive the analysis to identify the specific topics dragging your score.'
      }`,
      createdAt: new Date(lastTest.date),
      cta: { label: 'View Analysis', href: '/analysis' },
    });
  }

  // Streak milestones (3 / 7 / 14 / 30)
  const streak = overview.currentStreak;
  if (streak >= 3) {
    const milestone = streak >= 30 ? 30 : streak >= 14 ? 14 : streak >= 7 ? 7 : 3;
    out.push({
      id: `streak-${milestone}`, category: 'performance', priority: 'normal',
      icon: Flame, iconColor: 'text-[#f97316]',
      iconBg: 'bg-[#f97316]/10 border-[#f97316]/20',
      title: `${streak}-day streak: keep it going`,
      message: `You've been active for ${streak} consecutive days${streak >= milestone ? `, a ${milestone}-day milestone!` : ''}. Consistent daily practice compounds faster than any single cramming session.`,
      createdAt: new Date(),
    });
  }

  // Best accuracy milestone (80%+)
  if (overview.bestAccuracy >= 80) {
    out.push({
      id: `best-accuracy-${Math.floor(overview.bestAccuracy / 5) * 5}`,
      category: 'performance', priority: 'normal',
      icon: TrendingUp, iconColor: 'text-[#22c55e]',
      iconBg: 'bg-[#22c55e]/10 border-[#22c55e]/20',
      title: `Peak accuracy: ${overview.bestAccuracy}%`,
      message: `Your best test reached ${overview.bestAccuracy}% accuracy (avg ${overview.avgAccuracy}% across ${overview.testsTaken} test${overview.testsTaken !== 1 ? 's' : ''}). Now focus on making this your floor, not your ceiling.`,
      createdAt: new Date(),
    });
  }

  // Weak topic alerts — top 3 with accuracy < 60%
  const criticalWeak = weakTopics.filter(t => t.accuracy < 60).slice(0, 3);
  for (const wt of criticalWeak) {
    const isCritical = wt.accuracy < 40;
    out.push({
      id: `weak-${wt.topic.replace(/\W+/g, '-').toLowerCase()}`,
      category: 'performance', priority: isCritical ? 'urgent' : 'normal',
      icon: Target,
      iconColor: isCritical ? 'text-rose-400' : 'text-amber-400',
      iconBg:    isCritical ? 'bg-rose-400/10 border-rose-400/20'
                            : 'bg-amber-400/10 border-amber-400/20',
      title: `${isCritical ? 'Critical' : 'Weak'} area: ${wt.topic}`,
      message: `${wt.accuracy}% accuracy in ${wt.topic} (${wt.subject}) across ${wt.totalAttempted} attempt${wt.totalAttempted !== 1 ? 's' : ''}. ${
        isCritical
          ? 'This is a high-weightage area that needs immediate targeted practice.'
          : 'A focused practice session can move this significantly.'
      }`,
      createdAt: new Date(),
      cta: { label: 'Build Practice Test', href: '/denkenstudio' },
    });
  }

  // Backend recommendations (danger / warning only — success ones aren't alerts)
  const alertRecs = recommendations.filter(r => r.sentiment !== 'success').slice(0, 2);
  for (let i = 0; i < alertRecs.length; i++) {
    const rec = alertRecs[i];
    out.push({
      id: `rec-${i}-${rec.title.slice(0, 12).replace(/\W/g, '')}`,
      category: 'performance',
      priority: rec.sentiment === 'danger' ? 'urgent' : 'normal',
      icon:      rec.sentiment === 'danger' ? AlertTriangle : TrendingUp,
      iconColor: rec.sentiment === 'danger' ? 'text-rose-400' : 'text-amber-400',
      iconBg:    rec.sentiment === 'danger'
        ? 'bg-rose-400/10 border-rose-400/20'
        : 'bg-amber-400/10 border-amber-400/20',
      title:     rec.title,
      message:   rec.body,
      createdAt: new Date(),
      cta: { label: 'View Analysis', href: '/analysis' },
    });
  }

  return out;
}

function genReminders(deps: NotifBuildDeps, analytics: AnalyticsData | null): RawNotif[] {
  const out: RawNotif[] = [];
  const now = new Date();

  // First test prompt — user has onboarded but hasn't generated a test yet
  if (analytics && analytics.overview.testsTaken === 0) {
    out.push({
      id: 'first-test-prompt', category: 'reminder', priority: 'normal',
      icon: Sparkles, iconColor: 'text-[#8762F7]',
      iconBg: 'bg-[#8762F7]/10 border-[#8762F7]/20',
      title: 'Generate your first test',
      message: "You're set up and ready. Generate your first AI-powered test to unlock performance insights, weak-topic detection, and your personalised study plan.",
      createdAt: now,
      cta: { label: 'Open DenkenStudio', href: '/denkenstudio' },
    });
  }

  // No target exam year set — personalisation is limited without it
  if (deps.onboarding.examType && !deps.onboarding.targetYear) {
    out.push({
      id: 'no-target-year', category: 'reminder', priority: 'low',
      icon: Bell, iconColor: 'text-[#8762F7]/70',
      iconBg: 'bg-[#8762F7]/[0.08] border-[#8762F7]/15',
      title: 'Set your target exam year',
      message: 'Adding your exam date enables accurate readiness scoring, a daily countdown, your personalised study phase, and adaptive difficulty planning.',
      createdAt: now,
      cta: { label: 'Update Profile', href: '/profile' },
    });
  }

  // Revision roadmap available (backend generated it, so it's real)
  if (analytics && analytics.revisionRoadmap.length > 0) {
    out.push({
      id: 'revision-roadmap-ready', category: 'reminder', priority: 'low',
      icon: BookOpen, iconColor: 'text-[#8762F7]',
      iconBg: 'bg-[#8762F7]/10 border-[#8762F7]/20',
      title: 'Your revision roadmap is ready',
      message: `${analytics.revisionRoadmap.length} revision session${analytics.revisionRoadmap.length !== 1 ? 's' : ''} have been planned based on your weak areas. Following the roadmap daily maximises spaced-repetition retention.`,
      createdAt: now,
      cta: { label: 'View Roadmap', href: '/revision' },
    });
  }

  // No test in the past 7 days but was active before
  if (
    analytics &&
    analytics.overview.testsTaken > 0 &&
    analytics.lastTest
  ) {
    const daysSinceTest = Math.floor(
      (Date.now() - new Date(analytics.lastTest.date).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceTest >= 5) {
      out.push({
        id: `inactive-${Math.floor(daysSinceTest / 5)}`, category: 'reminder', priority: 'normal',
        icon: Zap, iconColor: 'text-[#8762F7]',
        iconBg: 'bg-[#8762F7]/10 border-[#8762F7]/20',
        title: `${daysSinceTest} days since your last test`,
        message: `Your last test was ${relativeDate(analytics.lastTest.date)}. Consistent practice is the most reliable path to score improvement. Even a short session keeps momentum going.`,
        createdAt: new Date(analytics.lastTest.date),
        cta: { label: 'Start a Test', href: '/tests' },
      });
    }
  }

  return out;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Build the full notification list from real user state.
 * Applies read state from localStorage and sorts by priority then recency.
 */
export function buildNotifications(deps: NotifBuildDeps): AppNotification[] {
  const raw: RawNotif[] = [
    ...genSubscription(deps),
    ...(deps.analytics && deps.analytics.overview.testsTaken > 0
      ? genPerformance(deps.analytics)
      : []),
    ...genReminders(deps, deps.analytics),
  ];

  // Deduplicate by id (stable keys prevent duplicates across renders)
  const seen = new Set<string>();
  const deduped = raw.filter(n => { if (seen.has(n.id)) return false; seen.add(n.id); return true; });

  // Apply persisted read state
  const readIds = getReadIds();
  const withRead: AppNotification[] = deduped.map(n => ({ ...n, read: readIds.has(n.id) }));

  // Sort: urgent → normal → low, then newest first within each tier
  return withRead.sort((a, b) => {
    const dp = PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority];
    if (dp !== 0) return dp;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

/**
 * Returns true if there are any subscription-level urgent signals computable
 * without an extra API fetch (for Topbar badge).
 */
export function hasUrgentSubscriptionSignal(opts: {
  testsExhausted:     boolean;
  revisionsExhausted: boolean;
  subscriptionStatus: string | null;
  isPro:              boolean;
  remainingDays:      number | null;
}): boolean {
  return (
    opts.testsExhausted ||
    opts.revisionsExhausted ||
    opts.subscriptionStatus === 'grace_period' ||
    (opts.isPro && opts.remainingDays !== null && opts.remainingDays > 0 && opts.remainingDays <= 7)
  );
}

// Re-export a relative-time formatter for the UI layer
export { relativeDate };
