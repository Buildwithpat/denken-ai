'use client';

import { usePathname } from 'next/navigation';
import { OnboardingProvider, useOnboarding } from '@/context/OnboardingContext';
import { useAuth } from '@/context/AuthContext';

/**
 * Guards onboarding sub-route pages against rendering before auth and onboarding
 * data are hydrated from localStorage.
 *
 * ARCHITECTURAL NOTE — why this layout does NOT redirect between steps:
 * Global route-correction effects (the old requiredRedirect pattern) fire
 * reactively whenever pathname or data changes.  When multiple effects compete —
 * the layout's effect, GuestGuard's effect, the page's own navigation — they
 * produce redirect loops and race conditions that are hard to reproduce and nearly
 * impossible to debug.
 *
 * The correct model is: each onboarding step page is responsible for its own
 * prerequisites and navigates forward only after an explicit user action (button
 * click).  This layout's only job is to block render until the data is ready,
 * which prevents a flash of empty fields before localStorage has been read.
 */
function OnboardingSubGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isLoaded } = useAuth();
  const { loaded } = useOnboarding();

  const isSignupPage = pathname === '/onboarding';

  // The signup page creates onboarding data — it does not need it to already exist.
  // Sub-step pages must wait for both auth and onboarding data to be ready.
  if (!isSignupPage && (!isLoaded || !loaded)) return null;

  return <>{children}</>;
}

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <OnboardingProvider>
      <OnboardingSubGuard>{children}</OnboardingSubGuard>
    </OnboardingProvider>
  );
}
