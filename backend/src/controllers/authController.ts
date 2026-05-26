import { Request, Response, NextFunction } from 'express';
import { registerUser, loginUser } from '../services/authService';
import { validateSignup, validateLogin } from '../validators/authValidator';
import { AppError } from '../utils/AppError';
import User from '../models/User';
import type { AuthRequest } from '../middleware/auth';
import { computeEntitlements } from '../lib/entitlements';
import type { TargetExam } from '../models/User';

export async function signup(req: Request, res: Response, next: NextFunction): Promise<void> {
  const validation = validateSignup(req.body as Record<string, unknown>);
  if (!validation.valid) {
    res.status(400).json({ error: validation.error });
    return;
  }

  try {
    const { name, email, mobileNumber, password } = req.body as Record<string, string>;
    const result = await registerUser(name, email, mobileNumber, password);
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    next(err); // let Express errorHandler expose the real stack
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  const validation = validateLogin(req.body as Record<string, unknown>);
  if (!validation.valid) {
    res.status(400).json({ error: validation.error });
    return;
  }

  try {
    const { email, password } = req.body as Record<string, string>;
    const result = await loginUser(email, password);
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    next(err);
  }
}

export function logout(_req: Request, res: Response): void {
  res.status(200).json({ message: 'Logged out successfully.' });
}

export async function completeOnboardingHandler(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { avatar, targetExam, selectedSubjects, targetYear } = req.body as {
      avatar?:          string;
      targetExam?:      TargetExam;
      selectedSubjects?: string[];
      targetYear?:      number;
    };

    const update: Record<string, unknown> = { onboardingComplete: true };
    if (avatar)                             update.avatar           = avatar;
    if (targetExam)                         update.targetExam       = targetExam;
    if (Array.isArray(selectedSubjects))    update.selectedSubjects = selectedSubjects;
    if (typeof targetYear === 'number')     update.targetYear       = targetYear;

    const user = await User.findByIdAndUpdate(userId, update, { new: true }).select('-passwordHash');
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    res.status(200).json({
      id:                 user._id.toString(),
      name:               user.name,
      email:              user.email,
      mobileNumber:       user.mobileNumber,
      avatar:             user.avatar ?? '',
      targetExam:         user.targetExam,
      onboardingComplete: user.onboardingComplete,
    });
  } catch {
    res.status(500).json({ error: 'Failed to complete onboarding.' });
  }
}

export async function getMe(req: AuthRequest, res: Response): Promise<void> {
  try {
    const user = await User.findById(req.user!.userId).select('-passwordHash');
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const entitlements = computeEntitlements({
      plan:                  user.plan                  ?? 'free',
      subscriptionStatus:    user.subscriptionStatus    ?? 'none',
      testsUsed:             user.testsUsed             ?? 0,
      revisionsUsed:         user.revisionsUsed         ?? 0,
      subscriptionEndsAt:    user.subscriptionEndsAt    ?? null,
      subscriptionStartedAt: user.subscriptionStartedAt ?? null,
    });

    res.status(200).json({ user, entitlements });
  } catch {
    res.status(500).json({ error: 'Failed to fetch user.' });
  }
}
