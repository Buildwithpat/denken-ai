import crypto from 'crypto';
import { Request, Response } from 'express';
import { env } from '../config/env';
import { activateSubscription, getUserEntitlements } from '../services/subscriptionService';
import Subscription from '../models/Subscription';

// ── Razorpay payment plan catalog (mirrors subscriptionController) ─────────────

const PAYMENT_PLANS = {
  pro_1m: { plan: 'pro' as const, days: 30  },
  pro_3m: { plan: 'pro' as const, days: 90  },
  pro_6m: { plan: 'pro' as const, days: 180 },
} as const;

type PaymentPlanId = keyof typeof PAYMENT_PLANS;

// ── Types for Razorpay webhook payload ────────────────────────────────────────

interface RazorpayPaymentEntity {
  id:       string;
  order_id: string;
  amount:   number;
  currency: string;
  notes?:   Record<string, string>;
}

interface RazorpayWebhookEvent {
  event: string;
  payload: {
    payment?: { entity: RazorpayPaymentEntity };
  };
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function razorpayWebhookHandler(req: Request, res: Response): Promise<void> {
  const signature = req.headers['x-razorpay-signature'];

  if (typeof signature !== 'string') {
    res.status(400).json({ error: 'Missing signature header.' });
    return;
  }

  // req.body is Buffer when express.raw() is used for this route
  const rawBody = req.body as Buffer;

  const expectedSig = crypto
    .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  if (expectedSig !== signature) {
    res.status(400).json({ error: 'Invalid webhook signature.' });
    return;
  }

  let event: RazorpayWebhookEvent;
  try {
    event = JSON.parse(rawBody.toString()) as RazorpayWebhookEvent;
  } catch {
    res.status(400).json({ error: 'Malformed JSON body.' });
    return;
  }

  // Only handle payment.captured — safety net for missed verify calls
  if (event.event === 'payment.captured') {
    const payment = event.payload.payment?.entity;
    if (!payment) {
      res.status(200).json({ received: true });
      return;
    }

    const userId = payment.notes?.userId;
    const planId = payment.notes?.planId;

    if (!userId || !planId || !(planId in PAYMENT_PLANS)) {
      res.status(200).json({ received: true });
      return;
    }

    // Idempotency — skip if frontend verify already processed this payment
    const existing = await Subscription.findOne({ razorpayPaymentId: payment.id });
    if (!existing) {
      const planDef   = PAYMENT_PLANS[planId as PaymentPlanId];
      const now       = new Date();
      const periodEnd = new Date(now.getTime() + planDef.days * 24 * 60 * 60 * 1000);

      try {
        await activateSubscription(
          userId,
          planDef.plan,
          periodEnd,
          payment.amount / 100,
          payment.currency,
          payment.order_id,
          payment.id,
          null,
        );
      } catch {
        // Don't fail the webhook — Razorpay retries on non-2xx
      }
    }
  }

  res.status(200).json({ received: true });
}
