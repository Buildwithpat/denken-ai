'use client';

import { TestProvider } from '@/context/TestContext';
import { AuthProvider } from '@/context/AuthContext';
import { Component, type ReactNode } from 'react';
import dynamic from 'next/dynamic';

const DevPersonaPanel = dynamic(() => import('@/components/dev/DevPersonaPanel'), { ssr: false });

const DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === 'true';

// ── Top-level error boundary — prevents a crash from blanking the whole app ──

interface EBState { error: Error | null }

class AppErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): EBState {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Log to console in development; swap for a real logging service in production
    if (process.env.NODE_ENV !== 'production') {
      console.error('[AppErrorBoundary]', error);
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0B0E14] px-6 text-center">
          <p className="text-base font-semibold text-white">Something went wrong</p>
          <p className="max-w-sm text-sm text-white/45">
            An unexpected error occurred. Please refresh the page to continue.
          </p>
          <button
            onClick={() => { this.setState({ error: null }); window.location.reload(); }}
            className="mt-2 rounded-lg border border-white/[0.09] bg-white/[0.04] px-5 py-2 text-sm text-white/70 transition-colors hover:border-white/20 hover:text-white/90"
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <TestProvider>
          {children}
          {DEV_MODE && <DevPersonaPanel />}
        </TestProvider>
      </AuthProvider>
    </AppErrorBoundary>
  );
}
