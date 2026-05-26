import User, { IUserDocument } from '../models/User';
import { hashPassword, comparePassword } from '../utils/password';
import { signToken, TokenPayload } from '../utils/token';
import { AppError } from '../utils/AppError';
import { computeEntitlements } from '../lib/entitlements';
import type { Entitlements } from '../types/subscription';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  mobileNumber: string;
  avatar: string;
  targetExam: string;
  onboardingComplete: boolean;
  entitlements: Entitlements;
}

export interface AuthResult {
  token: string;
  user: AuthUser;
}

export async function registerUser(
  name: string,
  email: string,
  mobileNumber: string,
  password: string,
): Promise<AuthResult> {
  const existing = await User.findOne({ email: email.toLowerCase().trim() });
  if (existing) {
    throw new AppError('An account with this email already exists.', 409);
  }

  const passwordHash = await hashPassword(password);

  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    mobileNumber,
    passwordHash,
    targetExam: 'custom',
    onboardingComplete: false,
  });

  return buildAuthResult(user);
}

export async function loginUser(email: string, password: string): Promise<AuthResult> {
  const user = await User.findOne({ email: email.toLowerCase().trim() });

  if (!user || !(await comparePassword(password, user.passwordHash))) {
    throw new AppError('Invalid email or password.', 401);
  }

  return buildAuthResult(user);
}

function buildAuthResult(user: IUserDocument): AuthResult {
  const payload: TokenPayload = { userId: user._id.toString(), email: user.email };

  const entitlements = computeEntitlements({
    plan:                  user.plan                  ?? 'free',
    subscriptionStatus:    user.subscriptionStatus    ?? 'none',
    testsUsed:             user.testsUsed             ?? 0,
    revisionsUsed:         user.revisionsUsed         ?? 0,
    subscriptionEndsAt:    user.subscriptionEndsAt    ?? null,
    subscriptionStartedAt: user.subscriptionStartedAt ?? null,
  });

  const token = signToken(payload);

  return {
    token,
    user: {
      id:                 user._id.toString(),
      name:               user.name,
      email:              user.email,
      mobileNumber:       user.mobileNumber,
      avatar:             user.avatar ?? '',
      targetExam:         user.targetExam,
      onboardingComplete: user.onboardingComplete,
      entitlements,
    },
  };
}
