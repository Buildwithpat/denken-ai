'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';
import ParticlesBackground from '@/components/ui/ParticlesBackground';
import { useOnboarding } from '@/context/OnboardingContext';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { GuestGuard } from '@/components/auth/AuthGuard';
import { clearSessionState, type StoredUser } from '@/lib/auth';

const ease = 'easeOut' as const;

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
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
            'w-full rounded-md border bg-[#0B0E14] px-4 py-2 text-sm text-white placeholder-white/25 outline-none transition-all duration-150 focus:ring-1',
            error
              ? 'border-rose-500/60 focus:border-rose-500 focus:ring-rose-500/30'
              : 'border-white/10 focus:border-[#8762F7] focus:ring-[#8762F7]/40',
          ].join(' ')}
        />
        {rightSlot && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightSlot}</div>
        )}
      </div>
      {error && <p className="mt-1 text-[11px] text-rose-400">{error}</p>}
    </div>
  );
}

interface SignupResponse {
  token: string;
  user: StoredUser;
}

function OnboardingContent() {
  const router = useRouter();
  const { set, reset } = useOnboarding();
  const { setAuth } = useAuth();

  const [name, setName]               = useState('');
  const [email, setEmail]             = useState('');
  const [mobile, setMobile]           = useState('');
  const [password, setPassword]       = useState('');
  const [confirm, setConfirm]         = useState('');
  const [showPass, setShowPass]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors]           = useState<Record<string, string>>({});
  const [apiError, setApiError]       = useState('');
  const [loading, setLoading]         = useState(false);

  function validate() {
    const e: Record<string, string> = {};
    if (!name.trim())                               e.name     = 'Name is required.';
    if (!email.trim())                              e.email    = 'Email is required.';
    if (!mobile.trim())                             e.mobile   = 'Mobile number is required.';
    else if (!/^\d{10}$/.test(mobile.trim()))       e.mobile   = 'Enter a valid 10-digit number.';
    if (!password)                                  e.password = 'Password is required.';
    else if (password.length < 8)                   e.password = 'Minimum 8 characters.';
    if (confirm !== password)                       e.confirm  = 'Passwords do not match.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setApiError('');
    if (!validate()) return;

    setLoading(true);
    try {
      const { token, user } = await api.post<SignupResponse>('/auth/signup', {
        name: name.trim(),
        email: email.trim(),
        mobileNumber: mobile.trim(),
        password,
      });

      setAuth(token, user);
      // Wipe any session state that could survive from a previous login or persona
      // switch (e.g. stale denbot-seen flag, leftover onboarding steps from a
      // different account).  reset() synchronises the OnboardingContext React state
      // to match the now-empty localStorage; clearSessionState() handles keys that
      // OnboardingContext doesn't own (like denbot-seen).
      clearSessionState();
      reset();
      set('name', name.trim());
      set('email', email.trim());
      set('mobile', mobile.trim());

      router.push('/onboarding/avatar');
    } catch (err) {
      setApiError(err instanceof ApiError ? err.message : 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function clearFieldError(field: string) {
    setErrors((p) => { const n = { ...p }; delete n[field]; return n; });
    setApiError('');
  }

  return (
    <main className="relative flex h-screen items-center justify-center overflow-hidden bg-[#0B0E14] px-4 py-4">
      <ParticlesBackground />

      <div className="pointer-events-none absolute -left-32 -top-32 h-72 w-72 rounded-full bg-[#8762F7] opacity-[0.06] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-72 w-72 rounded-full bg-[#8762F7] opacity-[0.06] blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
        whileHover={{ boxShadow: '0 0 40px rgba(135,98,247,0.15)' }}
        className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md max-h-[92vh] overflow-y-auto"
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <span className="h-1.5 w-6 rounded-full bg-[#8762F7]" />
              <span className="h-1.5 w-6 rounded-full bg-white/15" />
            </div>
            <span className="text-xs text-white/40">Step 1 of 2</span>
          </div>
          <Link
            href="/"
            className="flex cursor-pointer items-center gap-1.5 text-xs text-white/40 transition-colors hover:text-white/80"
          >
            <ArrowLeft size={13} />
            Back
          </Link>
        </div>

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
          <h1 className="mt-4 text-xl font-semibold text-white md:text-2xl">
            Let's set up your preparation
          </h1>
          <p className="mt-2 text-sm text-white/60">
            Tell us a few details so we can personalize your experience.
          </p>
        </motion.div>

        <motion.form
          onSubmit={handleSubmit}
          className="mt-3 flex flex-col gap-2.5"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
          initial="hidden"
          animate="show"
        >
          <motion.div variants={fadeUp} transition={{ duration: 0.35, ease }}>
            <Field
              label="Full Name"
              placeholder="Aakash Pathak"
              value={name}
              onChange={(v) => { setName(v); clearFieldError('name'); }}
              error={errors.name}
            />
          </motion.div>

          <motion.div variants={fadeUp} transition={{ duration: 0.35, ease }}>
            <Field
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(v) => { setEmail(v); clearFieldError('email'); }}
              error={errors.email}
            />
          </motion.div>

          <motion.div variants={fadeUp} transition={{ duration: 0.35, ease }}>
            <Field
              label="Mobile Number"
              type="tel"
              placeholder="10-digit number"
              value={mobile}
              onChange={(v) => { setMobile(v); clearFieldError('mobile'); }}
              error={errors.mobile}
            />
          </motion.div>

          <motion.div variants={fadeUp} transition={{ duration: 0.35, ease }}>
            <Field
              label="Password"
              type={showPass ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={(v) => { setPassword(v); clearFieldError('password'); }}
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
          </motion.div>

          <motion.div variants={fadeUp} transition={{ duration: 0.35, ease }}>
            <Field
              label="Confirm Password"
              type={showConfirm ? 'text' : 'password'}
              placeholder="••••••••"
              value={confirm}
              onChange={(v) => { setConfirm(v); clearFieldError('confirm'); }}
              error={errors.confirm}
              rightSlot={
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="cursor-pointer text-white/30 transition-colors hover:text-white/60"
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              }
            />
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
              className="mt-1 w-full cursor-pointer rounded-md bg-gradient-to-r from-[#8762F7] to-[#6D4AFF] py-2 text-sm font-medium text-white transition-all duration-200 hover:brightness-110 hover:shadow-[0_0_20px_rgba(135,98,247,0.45)] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating account…' : 'Continue'}
            </motion.button>
          </motion.div>
        </motion.form>

        <div className="my-3 flex items-center gap-3">
          <div className="h-px flex-1 bg-white/8" />
          <span className="text-xs text-white/40">or</span>
          <div className="h-px flex-1 bg-white/8" />
        </div>

        <p className="text-center text-sm text-white/50">
          Already have an account?{' '}
          <Link href="/login" className="text-[#8762F7] transition-colors hover:underline">
            Log in
          </Link>
        </p>
      </motion.div>
    </main>
  );
}

export default function OnboardingPage() {
  return (
    <GuestGuard>
      <OnboardingContent />
    </GuestGuard>
  );
}
