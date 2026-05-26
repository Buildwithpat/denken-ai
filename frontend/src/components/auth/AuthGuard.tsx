'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

/**
 * Reads localStorage directly (no context dependency) to determine the first
 * onboarding step the user has not yet completed. Used by both guards, which may
 * render outside OnboardingProvider.
 *
 * Never returns the loading page — that is a one-shot animation. We skip straight
 * to summary so a user who refreshes mid-animation lands on the review screen
 * rather than replaying the spinner.
 */
export function getFirstIncompleteOnboardingStep(): string {
  try {
    const raw = localStorage.getItem('denken_onboarding');
    const d: Record<string, unknown> = raw ? JSON.parse(raw) : {};
    if (!d.avatar) return '/onboarding/avatar';
    if (!d.examType) return '/onboarding/exam';
    if (d.examType === 'custom') return '/onboarding/upload';
    if (!d.targetYear || !d.currentClass || !d.prepLevel) return '/onboarding/target';
    if (d.examType === 'cbse') {
      const subjects = d.subjects as string[] | undefined;
      if (!subjects?.some((s) => s?.trim())) return '/onboarding/subjects';
    }
    return '/onboarding/summary';
  } catch {
    return '/onboarding/avatar';
  }
}

/**
 * Wraps private (dashboard) routes.
 *
 * - Unauthenticated users are redirected to /login.
 * - Authenticated users with incomplete onboarding are redirected to the first
 *   incomplete step, UNLESS that step is /onboarding/summary.  The summary
 *   exception prevents a redirect loop: a user whose API call to complete-onboarding
 *   failed transiently will have onboardingComplete=false in the DB but all local
 *   steps filled.  Redirecting them to /onboarding/summary → pricing → dashboard
 *   → /onboarding/summary is an infinite cycle.  Letting them through means the
 *   summary CTA will re-attempt the DB sync on their next visit.
 * - Fully authenticated users with onboardingComplete=true are allowed to render.
 *
 * ARCHITECTURAL NOTE — why user is omitted from effect deps:
 * Including `user` would cause this effect to re-fire every time updateUser() is
 * called (e.g. from the summary page CTA), racing with in-flight navigations.  We
 * only want the effect to run on isLoaded/isAuthenticated transitions (hydration,
 * login, logout).  `user` is read inside the effect but intentionally left out of
 * the dependency array for this reason.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoaded, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;

    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }

    if (user && !user.onboardingComplete) {
      const step = getFirstIncompleteOnboardingStep();
      if (step !== '/onboarding/summary') {
        router.replace(step);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isAuthenticated, router]);

  if (!isLoaded) return null;
  if (!isAuthenticated) return null;
  if (user && !user.onboardingComplete) {
    const step = getFirstIncompleteOnboardingStep();
    if (step !== '/onboarding/summary') return null;
  }
  return <>{children}</>;
}

/**
 * Wraps public-only routes (login, signup entry).
 *
 * - Blocks render until auth hydration is complete to prevent a flash of the form.
 * - If the user was already authenticated when they navigated to this page
 *   (e.g. they typed /login into the address bar while logged in), redirects them
 *   to the appropriate destination.
 *
 * ARCHITECTURAL NOTE — why the effect dep array is [isLoaded] and not
 * [isLoaded, isAuthenticated]:
 * Navigation after explicit user actions (login form submit, signup form submit)
 * is handled entirely by those action handlers via router.replace().  If this guard
 * also called router.replace() reactively on every isAuthenticated change, both
 * navigations would fire in the same React flush — creating duplicate pushes and
 * unpredictable race conditions.
 *
 * Using [isLoaded] as the sole dep means the effect fires exactly once, when auth
 * hydration completes.  At that moment:
 *   - isAuthenticated=true  → user arrived already logged in → redirect them.
 *   - isAuthenticated=false → user is a guest → do nothing, render the form.
 *
 * When the user later submits the login form and setAuth() flips isAuthenticated
 * to true, isLoaded does not change, so this effect does NOT re-fire.  The action
 * handler's router.replace() is the sole navigator for that transition.
 */
export function GuestGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoaded, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded || !isAuthenticated) return;
    const destination = user?.onboardingComplete
      ? '/dashboard'
      : getFirstIncompleteOnboardingStep();
    router.replace(destination);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  if (!isLoaded || isAuthenticated) return null;
  return <>{children}</>;
}
