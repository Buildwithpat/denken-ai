'use client';

import { useEffect, useCallback } from 'react';

// ── Razorpay global types ─────────────────────────────────────────────────────

export interface RazorpayCheckoutResponse {
  razorpay_payment_id: string;
  razorpay_order_id:   string;
  razorpay_signature:  string;
}

interface RazorpayOptions {
  key:         string;
  amount:      number;
  currency:    string;
  name:        string;
  description: string;
  order_id:    string;
  handler:     (response: RazorpayCheckoutResponse) => void;
  prefill?: {
    name?:    string;
    email?:   string;
    contact?: string;
  };
  theme?: { color?: string };
  modal?: { ondismiss?: () => void };
}

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => { open: () => void };
  }
}

// ── Script loader ─────────────────────────────────────────────────────────────

function loadScript(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.Razorpay)              return Promise.resolve(true);

  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src    = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload  = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useRazorpay() {
  // Pre-load on mount so the first click is instant
  useEffect(() => {
    loadScript();
  }, []);

  const openCheckout = useCallback(
    (options: RazorpayOptions): Promise<void> =>
      loadScript().then((loaded) => {
        if (!loaded) throw new Error('Failed to load Razorpay SDK.');
        const rzp = new window.Razorpay(options);
        rzp.open();
      }),
    [],
  );

  return { openCheckout };
}
