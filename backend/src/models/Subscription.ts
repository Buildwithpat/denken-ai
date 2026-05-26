import mongoose, { Schema, Document, Types } from 'mongoose';
import type { Plan, SubscriptionStatus, SubscriptionEvent } from '../types/subscription';

export interface ISubscription {
  userId:        Types.ObjectId;
  plan:          Plan;
  status:        SubscriptionStatus;
  event:         SubscriptionEvent;
  periodStart:   Date;
  periodEnd:     Date | null;
  amountPaid:    number | null;
  currency:      string | null;
  // Razorpay fields — all nullable until payment is integrated
  razorpayOrderId:    string | null;
  razorpayPaymentId:  string | null;
  razorpaySignature:  string | null;
  notes:         string | null;
}

export interface ISubscriptionDocument extends ISubscription, Document {
  _id: Types.ObjectId;
}

const subscriptionSchema = new Schema<ISubscriptionDocument>(
  {
    userId:      { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    plan:        { type: String, enum: ['free', 'pro'], required: true },
    status:      { type: String, enum: ['none', 'active', 'expired', 'cancelled', 'grace_period'], required: true },
    event:       { type: String, enum: ['activated', 'cancelled', 'expired', 'renewed'], required: true },
    periodStart: { type: Date, required: true },
    periodEnd:   { type: Date, default: null },
    amountPaid:  { type: Number, default: null },
    currency:    { type: String, default: null },
    razorpayOrderId:   { type: String, default: null },
    razorpayPaymentId: { type: String, default: null },
    razorpaySignature: { type: String, default: null },
    notes:       { type: String, default: null },
  },
  { timestamps: true },
);

const Subscription = mongoose.model<ISubscriptionDocument>('Subscription', subscriptionSchema);
export default Subscription;
