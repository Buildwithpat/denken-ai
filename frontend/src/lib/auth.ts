const TOKEN_KEY    = 'denken_token';
const USER_KEY     = 'denken_user';
const ONBOARDING_KEY = 'denken_onboarding';
const DENBOT_KEY   = 'denbot-seen';

// All client-side keys owned by this app. Add new entries here — clearAuth and
// clearSessionState reference this list so no callsite needs updating.
const SESSION_KEYS = [ONBOARDING_KEY, DENBOT_KEY] as const;
const AUTH_KEYS    = [TOKEN_KEY, USER_KEY, ...SESSION_KEYS] as const;

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  mobileNumber: string;
  avatar: string;
  targetExam: string;
  onboardingComplete: boolean;
}

export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function setToken(token: string): void {
  try { localStorage.setItem(TOKEN_KEY, token); } catch {}
}

export function getStoredUser(): StoredUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as StoredUser) : null;
  } catch { return null; }
}

export function setStoredUser(user: StoredUser): void {
  try { localStorage.setItem(USER_KEY, JSON.stringify(user)); } catch {}
}

/**
 * Returns true when the JWT is missing, malformed, or its `exp` claim is in
 * the past.  Client-side only — does not verify the signature, just checks
 * whether the session is worth attempting to restore.
 */
export function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

/** Full reset — call on logout. Clears every app-owned key.
 *  Prefix sweep catches any future keys automatically; static fallback catches
 *  any sweep failures. Each removeItem is isolated so one failure can't block
 *  the rest. */
export function clearAuth(): void {
  // Prefix sweep — Object.keys snapshot avoids index-shift bugs during removal.
  try {
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith('denken_') || k.startsWith('denbot')) {
        try { localStorage.removeItem(k); } catch {}
      }
    });
  } catch {}
  // Static fallback — each key individually so one failure can't block others.
  AUTH_KEYS.forEach((k) => {
    try { localStorage.removeItem(k); } catch {}
  });
}

/** Partial reset — call on persona switch or onboarding restart.
 *  Preserves the JWT / user record (auth stays valid) but wipes all
 *  derived session state so the new context starts from scratch. */
export function clearSessionState(): void {
  try { SESSION_KEYS.forEach((k) => localStorage.removeItem(k)); } catch {}
}

/**
 * Merges server-verified user identity into the onboarding localStorage cache
 * so dashboard components that read from OnboardingContext (avatar, name, email,
 * examType) display correct values after a fresh login — not blank defaults caused
 * by clearAuth() wiping the cache on logout.
 *
 * Called from AuthContext immediately after a verified session is established
 * (both from /auth/me on page load and from setAuth() after login/signup).
 *
 * RACE-FREE: AuthGuard returns null until isLoaded=true, so OnboardingProvider
 * only mounts after this function has already written its data. The provider's
 * useEffect therefore always reads a fully seeded cache.
 *
 * MERGE SEMANTICS: existing wizard fields (targetYear, currentClass, prepLevel,
 * subjects) are preserved so mid-flow state survives a page refresh. We only
 * overwrite the identity fields that the server owns authoritatively.
 */
export function seedOnboardingCache(user: StoredUser): void {
  try {
    const raw      = localStorage.getItem(ONBOARDING_KEY);
    const existing = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};

    // Never touch a cache that belongs to a different account.
    if (existing.email && existing.email !== user.email) return;

    const merged: Record<string, unknown> = {
      ...existing,
      name:   user.name,
      email:  user.email,
      mobile: user.mobileNumber,
      // Server avatar wins; fall back to any locally-picked one (mid-onboarding).
      avatar:   user.avatar   || (existing.avatar   as string | undefined) || '',
      // examType in the onboarding cache maps 1-to-1 to targetExam on the User record.
      examType: user.targetExam || (existing.examType as string | undefined) || null,
    };

    localStorage.setItem(ONBOARDING_KEY, JSON.stringify(merged));
  } catch {}
}
