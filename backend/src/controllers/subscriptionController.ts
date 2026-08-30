import crypto from 'crypto';
import { Response } from 'express';
import type { AuthRequest } from '../middleware/auth';
import {
  getUserEntitlements,
  cancelSubscription,
  renewSubscription,
  getSubscriptionHistory,
  activateSubscription,
} from '../services/subscriptionService';
import { PLAN_CATALOG } from '../lib/entitlements';
import { razorpay } from '../lib/razorpay';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';
import Subscription from '../models/Subscription';
import { logger } from '../lib/logger';

// ── Payment plan catalog ──────────────────────────────────────────────────────
// Maps frontend planId → backend plan type + duration + Razorpay amount (paise)

const PAYMENT_PLANS = {
  pro_1m: { plan: 'pro' as const, days: 30,  amountPaise: 44900  },
  pro_3m: { plan: 'pro' as const, days: 90,  amountPaise: 128700 },
  pro_6m: { plan: 'pro' as const, days: 180, amountPaise: 251400 },
} as const;

type PaymentPlanId = keyof typeof PAYMENT_PLANS;

function isValidPlanId(id: string): id is PaymentPlanId {
  return id in PAYMENT_PLANS;
}

// ── Standard subscription handlers ───────────────────────────────────────────

export async function getSubscriptionHandler(req: AuthRequest, res: Response): Promise<void> {
  try {
    const entitlements = await getUserEntitlements(req.user!.userId);
    res.status(200).json(entitlements);
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Failed to fetch subscription.' });
  }
}

export async function cancelSubscriptionHandler(req: AuthRequest, res: Response): Promise<void> {
  try {
    await cancelSubscription(req.user!.userId);
    res.status(200).json({ message: 'Subscription cancelled.' });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Failed to cancel subscription.' });
  }
}

export async function renewSubscriptionHandler(req: AuthRequest, res: Response): Promise<void> {
  try {
    const entitlements = await renewSubscription(req.user!.userId);
    res.status(200).json(entitlements);
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Failed to renew subscription.' });
  }
}

export async function getHistoryHandler(req: AuthRequest, res: Response): Promise<void> {
  try {
    const limit   = Math.min(Number(req.query.limit) || 10, 50);
    const history = await getSubscriptionHistory(req.user!.userId, limit);
    res.status(200).json({ history });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Failed to fetch subscription history.' });
  }
}

export function getPlansHandler(_req: AuthRequest, res: Response): void {
  const plans = Object.entries(PAYMENT_PLANS).map(([id, def]) => ({
    id,
    plan:        def.plan,
    days:        def.days,
    amountPaise: def.amountPaise,
    features:    PLAN_CATALOG.pro.features,
  }));
  res.status(200).json({ plans });
}

// ── Razorpay payment handlers ─────────────────────────────────────────────────

export async function createOrderHandler(req: AuthRequest, res: Response): Promise<void> {
  const { planId } = req.body as { planId?: string };

  if (!planId || !isValidPlanId(planId)) {
    res.status(400).json({ error: 'Invalid plan ID.' });
    return;
  }

  const planDef = PAYMENT_PLANS[planId];

  try {
    const order = await razorpay.orders.create({
      amount: planDef.amountPaise,
      currency: "INR",
      receipt: `dnk_${req.user!.userId.slice(-8)}_${Date.now()}`,
      notes: {
        userId: req.user!.userId,
        planId,
      },
    });

    res.status(200).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      planId,
      keyId: env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    // Razorpay SDK throws plain objects, not Error instances — serialise fully.
    const rzpErr = err as { statusCode?: number; error?: { code?: string; description?: string } };
    const detail  = rzpErr?.error?.description ?? (err instanceof Error ? err.message : String(err));
    const code    = rzpErr?.error?.code ?? 'UNKNOWN';
    const status  = rzpErr?.statusCode;

    logger.error('[subscription] Razorpay order creation failed', {
      userId:     req.user!.userId,
      planId,
      statusCode: status,
      errorCode:  code,
      detail,
    });

    if (status === 401 || code === 'BAD_REQUEST_ERROR' && detail?.toLowerCase().includes('auth')) {
      res.status(500).json({ error: 'Payment gateway credentials are not configured correctly. Contact support.' });
      return;
    }

    res.status(500).json({ error: 'Failed to create payment order. Please try again.' });
  }
}

export async function verifyPaymentHandler(req: AuthRequest, res: Response): Promise<void> {
  const {
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
    planId,
  } = req.body as {
    razorpayOrderId?:   string;
    razorpayPaymentId?: string;
    razorpaySignature?: string;
    planId?:            string;
  };

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature || !planId) {
    res.status(400).json({ error: 'Missing payment details.' });
    return;
  }

  if (!isValidPlanId(planId)) {
    res.status(400).json({ error: 'Invalid plan ID.' });
    return;
  }

  const expectedSig = crypto
    .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  if (expectedSig !== razorpaySignature) {
    res.status(400).json({ error: 'Payment verification failed.' });
    return;
  }

  const existing = await Subscription.findOne({ razorpayPaymentId });
  if (existing) {
    const entitlements = await getUserEntitlements(req.user!.userId);
    res.status(200).json(entitlements);
    return;
  }

  // The client-supplied planId must match what this specific order was actually
  // created and charged for — otherwise a user could pay for a cheap plan and
  // claim a more expensive one by lying about planId here.
  let order;
  try {
    order = await razorpay.orders.fetch(razorpayOrderId);
  } catch (err) {
    logger.error('[subscription] Failed to fetch Razorpay order for verification', {
      userId: req.user!.userId,
      razorpayOrderId,
    });
    res.status(400).json({ error: 'Payment verification failed.' });
    return;
  }

  const orderPlanId = order.notes?.planId;
  const orderUserId = order.notes?.userId;

  if (
    orderPlanId !== planId ||
    orderUserId !== req.user!.userId ||
    !isValidPlanId(String(orderPlanId)) ||
    order.amount !== PAYMENT_PLANS[planId].amountPaise
  ) {
    logger.error('[subscription] Order/plan mismatch during payment verification', {
      userId: req.user!.userId,
      razorpayOrderId,
      claimedPlanId: planId,
      orderPlanId,
      orderUserId,
    });
    res.status(400).json({ error: 'Payment verification failed.' });
    return;
  }

  const planDef   = PAYMENT_PLANS[planId];
  const now       = new Date();
  const periodEnd = new Date(now.getTime() + planDef.days * 24 * 60 * 60 * 1000);

  try {
    const entitlements = await activateSubscription(
      req.user!.userId,
      planDef.plan,
      periodEnd,
      planDef.amountPaise / 100,
      'INR',
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    );
    res.status(200).json(entitlements);
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Failed to activate subscription.' });
  }
}
