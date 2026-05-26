'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';
import ParticlesBackground from '@/components/ui/ParticlesBackground';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { GuestGuard, getFirstIncompleteOnboardingStep } from '@/components/auth/AuthGuard';
import type { StoredUser } from '@/lib/auth';

const ease = 'easeOut' as const;

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show:   { opacity: 1, y: 0 },
};

function Field({
  label,
  type = 'text',
  placeholder,
  value,
  onChange,
  rightSlot,
  error,
}: {
  label: string;
  type?: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  rightSlot?: React.ReactNode;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-white/50">{label}</label>
      <div className="relative">
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={[
            'w-full rounded-md border bg-[#0B0E14] px-4 py-2.5 text-sm text-white placeholder-white/25 outline-none transition-all duration-150 focus:ring-1',
            error
              ? 'border-rose-500/60 focus:border-rose-500 focus:ring-rose-500/30'
              : 'border-white/10 focus:border-[#8762F7] focus:ring-[#8762F7]/40',
          ].join(' ')}
        />
        {rightSlot && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightSlot}</div>
        )}
      </div>
      {error && <p className="text-[11px] text-rose-400">{error}</p>}
    </div>
  );
}

interface LoginResponse {
  token: string;
  user: StoredUser;
}

function LoginContent() {
  const router = useRouter();
  const { setAuth } = useAuth();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [errors, setErrors]     = useState<{ email?: string; password?: string }>({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading]   = useState(false);

  function validate() {
    const e: typeof errors = {};
    if (!email.trim())    e.email    = 'Email is required.';
    if (!password.trim()) e.password = 'Password is required.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setApiError('');
    if (!validate()) return;

    setLoading(true);
    try {
      const { token, user } = await api.post<LoginResponse>('/auth/login', { email, password });
      setAuth(token, user);
      const destination = user.onboardingComplete
        ? '/dashboard'
        : getFirstIncompleteOnboardingStep();
      router.replace(destination);
    } catch (err) {
      setApiError(err instanceof ApiError ? err.message : 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[#0B0E14] px-4 py-12">
      <ParticlesBackground />

      <div className="pointer-events-none absolute -left-32 -top-32 h-72 w-72 rounded-full bg-[#8762F7] opacity-[0.06] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-72 w-72 rounded-full bg-[#8762F7] opacity-[0.06] blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease }}
        whileHover={{ boxShadow: '0 0 40px rgba(135,98,247,0.15)' }}
        className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-md"
      >
        <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.4, ease }}>
          <Link href="/" className="inline-flex items-center gap-2">
            <Image src="/DenkenLogo.svg" alt="DenkenAI" width={32} height={32} priority />
            <span className="text-base font-semibold">
              <span className="text-white">Denken</span>
              <span className="text-[#8762F7]">AI</span>
            </span>
          </Link>
        </motion.div>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          transition={{ duration: 0.4, delay: 0.07, ease }}
        >
          <h1 className="mt-4 text-xl font-semibold text-white md:text-2xl">Welcome back!</h1>
          <p className="mt-2 text-sm text-white/60">It's good to see you back, let's fuel up!</p>
        </motion.div>

        <motion.form
          onSubmit={handleSubmit}
          noValidate
          className="mt-6 flex flex-col gap-4"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
          initial="hidden"
          animate="show"
        >
          <motion.div variants={fadeUp} transition={{ duration: 0.35, ease }}>
            <Field
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(v) => { setEmail(v); setErrors((p) => ({ ...p, email: undefined })); setApiError(''); }}
              error={errors.email}
            />
          </motion.div>

          <motion.div variants={fadeUp} transition={{ duration: 0.35, ease }}>
            <Field
              label="Password"
              type={showPass ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={(v) => { setPassword(v); setErrors((p) => ({ ...p, password: undefined })); setApiError(''); }}
              error={errors.password}
              rightSlot={
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="cursor-pointer text-white/30 transition-colors hover:text-white/60"
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              }
            />
            <Link
              href="/forgot-password"
              className="mt-1.5 block text-right text-xs text-white/50 transition-colors hover:text-white"
            >
              Forgot password?
            </Link>
          </motion.div>

          {apiError && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-400"
            >
              {apiError}
            </motion.p>
          )}

          <motion.div variants={fadeUp} transition={{ duration: 0.35, ease }}>
            <motion.button
              type="submit"
              disabled={loading}
              whileTap={{ scale: loading ? 1 : 0.97 }}
              className="mt-2 w-full cursor-pointer rounded-md bg-gradient-to-r from-[#8762F7] to-[#6D4AFF] py-2.5 text-sm font-medium text-white transition-all duration-200 hover:brightness-110 hover:shadow-[0_0_20px_rgba(135,98,247,0.45)] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Logging in…' : 'Log in'}
            </motion.button>
          </motion.div>
        </motion.form>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-white/8" />
          <span className="text-xs text-white/40">or</span>
          <div className="h-px flex-1 bg-white/8" />
        </div>

        <p className="text-center text-sm text-white/50">
          Don't have an account?{' '}
          <Link href="/onboarding" className="text-[#8762F7] transition-colors hover:underline">
            Create an account
          </Link>
        </p>
      </motion.div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <GuestGuard>
      <LoginContent />
    </GuestGuard>
  );
}
