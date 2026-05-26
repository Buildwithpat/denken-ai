import mongoose, { Schema, Document, Types } from 'mongoose';
import type { Plan, SubscriptionStatus } from '../types/subscription';

export type TargetExam = 'jee' | 'neet' | 'cbse' | 'custom';

export interface IUser {
  name: string;
  email: string;
  passwordHash: string;
  mobileNumber: string;
  avatar?: string;
  targetExam: TargetExam;
  selectedSubjects: string[];
  targetYear?: number;
  onboardingComplete: boolean;
  // Subscription snapshot — denormalised for fast entitlement reads
  plan:                  Plan;
  subscriptionStatus:    SubscriptionStatus;
  testsUsed:             number;
  revisionsUsed:         number;
  subscriptionEndsAt:    Date | null;
  subscriptionStartedAt: Date | null;
  // Streak / consistency tracking
  currentStreak:   number;
  longestStreak:   number;
  lastActivityDate: Date | null;
}

export interface IUserDocument extends IUser, Document {
  _id: Types.ObjectId;
}

const userSchema = new Schema<IUserDocument>(
  {
    name:               { type: String, required: true, trim: true },
    email:              { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash:       { type: String, required: true },
    mobileNumber:       { type: String, required: true },
    avatar:             { type: String },
    targetExam:         { type: String, enum: ['jee', 'neet', 'cbse', 'custom'], required: true },
    selectedSubjects:   { type: [String], default: [] },
    targetYear:         { type: Number },
    onboardingComplete: { type: Boolean, default: false },
    plan:               { type: String, enum: ['free', 'pro'], default: 'free' },
    subscriptionStatus: { type: String, enum: ['none', 'active', 'expired', 'cancelled', 'grace_period'], default: 'none' },
    testsUsed:             { type: Number, default: 0 },
    revisionsUsed:         { type: Number, default: 0 },
    subscriptionEndsAt:    { type: Date, default: null },
    subscriptionStartedAt: { type: Date, default: null },
    currentStreak:         { type: Number, default: 0 },
    longestStreak:         { type: Number, default: 0 },
    lastActivityDate:      { type: Date, default: null },
  },
  { timestamps: true },
);

const User = mongoose.model<IUserDocument>('User', userSchema);
export default User;
