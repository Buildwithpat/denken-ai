import { Types } from 'mongoose';
import User from '../models/User';
import Subscription from '../models/Subscription';
import { computeEntitlements, PRO_BILLING_DAYS, resolveStatus } from '../lib/entitlements';
import { AppError } from '../utils/AppError';
import type {
  Entitlements,
  SubscriptionHistoryEntry,
  UserSubscriptionSnapshot,
} from '../types/subscription';

// ── Helpers ───────────────────────────────────────────────────────────────────

export async function loadUserSnapshot(userId: string): Promise<UserSubscriptionSnapshot> {
  const user = await User.findById(userId)
    .select('plan subscriptionStatus testsUsed revisionsUsed subscriptionEndsAt subscriptionStartedAt')
    .lean<UserSubscriptionSnapshot & { _id: Types.ObjectId }>();

  if (!user) throw new AppError('User not found.', 404);

  return {
    plan:                  user.plan                  ?? 'free',
    subscriptionStatus:    user.subscriptionStatus    ?? 'none',
    testsUsed:             user.testsUsed             ?? 0,
    revisionsUsed:         user.revisionsUsed         ?? 0,
    subscriptionEndsAt:    user.subscriptionEndsAt    ?? null,
    subscriptionStartedAt: user.subscriptionStartedAt ?? null,
  };
}

// ── Public service functions ──────────────────────────────────────────────────

export async function getUserEntitlements(userId: string): Promise<Entitlements> {
  const snapshot = await loadUserSnapshot(userId);
  return computeEntitlements(snapshot);
}

export async function activateSubscription(
  userId: string,
  plan: 'pro',
  periodEnd: Date,
  amountPaid: number,
  currency: string,
  razorpayOrderId: string | null = null,
  razorpayPaymentId: string | null = null,
  razorpaySignature: string | null = null,
): Promise<Entitlements> {
  const now = new Date();

  await User.findByIdAndUpdate(userId, {
    plan,
    subscriptionStatus:    'active',
    subscriptionEndsAt:    periodEnd,
    subscriptionStartedAt: now,
  });

  await Subscription.create({
    userId:      new Types.ObjectId(userId),
    plan,
    status:      'active',
    event:       'activated',
    periodStart: now,
    periodEnd,
    amountPaid,
    currency,
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
  });

  const snapshot = await loadUserSnapshot(userId);
  return computeEntitlements({
    ...snapshot,
    plan,
    subscriptionStatus:    'active',
    subscriptionEndsAt:    periodEnd,
    subscriptionStartedAt: now,
  });
}

export async function renewSubscription(userId: string): Promise<Entitlements> {
  const snapshot = await loadUserSnapshot(userId);

  if (snapshot.plan === 'free') {
    throw new AppError('Only paid subscriptions can be renewed.', 409);
  }

  const now        = new Date();
  const currentEnd = snapshot.subscriptionEndsAt ?? now;
  const baseDate   = currentEnd > now ? currentEnd : now;
  const newEnd     = new Date(baseDate.getTime() + PRO_BILLING_DAYS * 24 * 60 * 60 * 1000);

  await User.findByIdAndUpdate(userId, {
    subscriptionStatus:    'active',
    subscriptionEndsAt:    newEnd,
    subscriptionStartedAt: baseDate,
  });

  await Subscription.create({
    userId:      new Types.ObjectId(userId),
    plan:        snapshot.plan,
    status:      'active',
    event:       'renewed',
    periodStart: baseDate,
    periodEnd:   newEnd,
    amountPaid:  null,
    currency:    null,
  });

  return computeEntitlements({
    ...snapshot,
    subscriptionStatus:    'active',
    subscriptionEndsAt:    newEnd,
    subscriptionStartedAt: baseDate,
  });
}

export async function cancelSubscription(userId: string): Promise<void> {
  const snapshot = await loadUserSnapshot(userId);

  if (snapshot.subscriptionStatus !== 'active' && snapshot.subscriptionStatus !== 'grace_period') {
    throw new AppError('No active subscription to cancel.', 409);
  }

  await User.findByIdAndUpdate(userId, { subscriptionStatus: 'cancelled' });

  await Subscription.create({
    userId:      new Types.ObjectId(userId),
    plan:        snapshot.plan,
    status:      'cancelled',
    event:       'cancelled',
    periodStart: new Date(),
    periodEnd:   snapshot.subscriptionEndsAt,
    amountPaid:  null,
    currency:    null,
  });
}

export async function getSubscriptionHistory(
  userId: string,
  limit = 10,
): Promise<SubscriptionHistoryEntry[]> {
  const records = await Subscription.find({ userId: new Types.ObjectId(userId) })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return records.map((r) => ({
    id:          (r._id as Types.ObjectId).toString(),
    event:       r.event,
    plan:        r.plan,
    status:      r.status,
    periodStart: r.periodStart.toISOString(),
    periodEnd:   r.periodEnd?.toISOString() ?? null,
    amountPaid:  r.amountPaid,
    currency:    r.currency,
    createdAt:   (r as unknown as { createdAt: Date }).createdAt.toISOString(),
  }));
}

/**
 * Lazily sync expired status to DB if computed status diverges from stored.
 * Called fire-and-forget from middleware — never awaited in a request path.
 */
export async function syncExpiredStatus(userId: string): Promise<void> {
  try {
    const snapshot = await loadUserSnapshot(userId);
    const effectiveStatus = resolveStatus(
      snapshot.plan,
      snapshot.subscriptionStatus,
      snapshot.subscriptionEndsAt,
    );

    if (effectiveStatus !== snapshot.subscriptionStatus) {
      await User.findByIdAndUpdate(userId, { subscriptionStatus: effectiveStatus });

      if (effectiveStatus === 'expired') {
        await Subscription.create({
          userId:      new Types.ObjectId(userId),
          plan:        snapshot.plan,
          status:      'expired',
          event:       'expired',
          periodStart: new Date(),
          periodEnd:   null,
          amountPaid:  null,
          currency:    null,
        });
      }
    }
  } catch {
    // Fire-and-forget: swallow all errors
  }
}
