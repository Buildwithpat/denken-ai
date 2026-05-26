'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import {
  getToken,
  setToken,
  setStoredUser,
  clearAuth,
  isTokenExpired,
  seedOnboardingCache,
  type StoredUser,
} from '@/lib/auth';

// Shape returned by GET /api/auth/me (Mongoose doc — uses _id, not id)
interface MeUser {
  _id: string;
  name: string;
  email: string;
  mobileNumber: string;
  avatar?: string;
  targetExam: string;
  onboardingComplete: boolean;
}

interface AuthState {
  user: StoredUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoaded: boolean;
}

interface AuthCtx extends AuthState {
  setAuth:    (token: string, user: StoredUser) => void;
  logout:     () => void;
  updateUser: (partial: Partial<StoredUser>) => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api';

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoaded: false,
  });

  useEffect(() => {
    const token = getToken();

    // No token — fast-path to anonymous. No network round-trip needed.
    if (!token) {
      setState({ token: null, user: null, isAuthenticated: false, isLoaded: true });
      return;
    }

    // Client-side exp check to avoid a network round-trip for obviously dead tokens.
    if (isTokenExpired(token)) {
      clearAuth();
      setState({ token: null, user: null, isAuthenticated: false, isLoaded: true });
      return;
    }

    // Server-side validation — the only source of truth.
    //
    // We deliberately do NOT trust the cached denken_user at this point.
    // Cached user data can be stale, from a different session, or from a
    // previous account on the same browser. The server response is canonical.
    //
    // On any non-2xx response (401 bad/revoked token, 404 user deleted, 5xx)
    // or a network failure, we clear all auth storage and hydrate anonymous.
    // This prevents stale localStorage state from ever bootstrapping the app
    // into a fake authenticated session.
    const authController = new AbortController();
    const authTimeoutId  = setTimeout(() => authController.abort(), 15_000);
    fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      signal:  authController.signal,
    })
      .then(async (res) => {
        clearTimeout(authTimeoutId);
        if (!res.ok) {
          clearAuth();
          setState({ token: null, user: null, isAuthenticated: false, isLoaded: true });
          return;
        }

        const data = (await res.json()) as { user: MeUser };
        const user: StoredUser = {
          id:                 data.user._id,
          name:               data.user.name,
          email:              data.user.email,
          mobileNumber:       data.user.mobileNumber ?? '',
          avatar:             data.user.avatar        ?? '',
          targetExam:         data.user.targetExam   ?? '',
          onboardingComplete: data.user.onboardingComplete ?? false,
        };

        // Evict onboarding data that belongs to a different account before
        // hydrating — prevents cross-account bleed.
        try {
          const raw = localStorage.getItem('denken_onboarding');
          if (raw) {
            const saved = JSON.parse(raw) as { email?: string };
            if (!saved.email || saved.email !== user.email) {
              localStorage.removeItem('denken_onboarding');
            }
          }
        } catch {}

        // Seed the onboarding cache with server-verified identity data (name,
        // email, mobile, avatar, examType) so dashboard components that read
        // from OnboardingContext see correct values after a fresh login on a
        // browser where the cache was cleared by logout.  Must happen before
        // setState so the cache is written before AuthGuard unblocks and
        // OnboardingProvider mounts and reads localStorage.
        seedOnboardingCache(user);

        // Refresh the cached user with the server-verified copy so subsequent
        // reads are always current (e.g. onboardingComplete state).
        setStoredUser(user);
        setState({ token, user, isAuthenticated: true, isLoaded: true });
      })
      .catch(() => {
        clearTimeout(authTimeoutId);
        // Network failure or timeout — clear auth to prevent a stale token
        // from being re-used to access protected routes after connectivity
        // is restored.
        clearAuth();
        setState({ token: null, user: null, isAuthenticated: false, isLoaded: true });
      });
  }, []);

  function setAuth(token: string, user: StoredUser) {
    // Evict onboarding data that belongs to a different account.
    try {
      const raw = localStorage.getItem('denken_onboarding');
      if (raw) {
        const saved = JSON.parse(raw) as { email?: string };
        if (!saved.email || saved.email !== user.email) {
          localStorage.removeItem('denken_onboarding');
        }
      }
    } catch {}

    // Seed the onboarding cache with server-verified identity data before
    // setting React state.  This ensures that when OnboardingProvider mounts
    // (gated by AuthGuard) it immediately reads correct name/email/avatar/examType
    // instead of blank defaults.  For the signup flow, the immediately-following
    // clearSessionState()+reset() calls wipe this seed — that is intentional;
    // the wizard steps re-populate the cache field-by-field as the user proceeds.
    seedOnboardingCache(user);

    setToken(token);
    setStoredUser(user);
    setState({ token, user, isAuthenticated: true, isLoaded: true });
  }

  function logout() {
    clearAuth();
    setState({ token: null, user: null, isAuthenticated: false, isLoaded: true });
  }

  function updateUser(partial: Partial<StoredUser>) {
    setState((prev) => {
      if (!prev.user) return prev;
      const updated = { ...prev.user, ...partial };
      setStoredUser(updated);
      return { ...prev, user: updated };
    });
  }

  return (
    <AuthContext.Provider value={{ ...state, setAuth, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
