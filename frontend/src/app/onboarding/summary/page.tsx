'use client';

import { type ReactNode, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion, type Variants } from 'framer-motion';
import {
  BookOpen, Calendar, GraduationCap, Zap, FileText,
  Pencil, User, type LucideIcon, Loader2,
} from 'lucide-react';
import ParticlesBackground from '@/components/ui/ParticlesBackground';
import { useOnboarding } from '@/context/OnboardingContext';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import type { StoredUser } from '@/lib/auth';
import { trackEvent } from '@/lib/trackEvent';

const EXAM_LABELS: Record<string, string> = {
  jee:    'JEE',
  neet:   'NEET',
  cbse:   'CBSE Boards',
  custom: 'Custom Exam',
};

/* ── sub-components ── */

function Divider() {
  return <div className="my-5 border-t border-white/8" />;
}

function SectionLabel({
  label,
  editHref,
}: {
  label: string;
  editHref?: string;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-white/25">
        {label}
      </p>
      {editHref && (
        <Link
          href={editHref}
          className="flex cursor-pointer items-center gap-1 text-[11px] text-white/25 transition-colors hover:text-[#8762F7]"
        >
          <Pencil size={11} />
          Edit
        </Link>
      )}
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/5 border border-white/8">
        <Icon size={13} className="text-white/40" />
      </div>
      <span className="text-sm text-white/50">{label}</span>
      <span
        className={[
          'ml-auto text-sm font-medium',
          accent ? 'text-[#8762F7]' : 'text-white/85',
        ].join(' ')}
      >
        {value}
      </span>
    </div>
  );
}

function Section({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        'rounded-xl px-2 py-1 transition-colors duration-150 hover:bg-white/[0.03]',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
}

/* ── animation ── */
const stagger: Variants = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.09 } },
};
const fadeSlide: Variants = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.38, ease: 'easeOut' } },
};

/* ── page ── */
export default function SummaryPage() {
  const router            = useRouter();
  const { data }          = useOnboarding();
  const { updateUser }    = useAuth();
  const [saving, setSaving] = useState(false);

  const examLabel      = EXAM_LABELS[data.examType ?? ''] ?? '—';
  const isCustom       = data.examType === 'custom';
  const filledSubjects = data.subjects.filter((s) => s.trim());
  const showSubjects   = filledSubjects.length > 0;
  const showTarget     = !isCustom && (!!data.targetYear || !!data.currentClass || !!data.prepLevel);

  return (
    <main className="relative flex h-screen flex-col overflow-hidden bg-[#0B0E14]">

      <ParticlesBackground />
      <div className="pointer-events-none absolute -left-40 -top-40 h-80 w-80 rounded-full bg-[#8762F7] opacity-[0.06] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-[#8762F7] opacity-[0.06] blur-3xl" />

      {/* Logo bar */}
      <div className="relative z-20 flex h-12 shrink-0 items-center border-b border-white/[0.06] px-6">
        <Link href="/" className="inline-flex items-center gap-2">
          <Image src="/DenkenLogo.svg" alt="DenkenAI" width={24} height={24} priority />
          <span className="text-sm font-semibold">
            <span className="text-white">Denken</span>
            <span className="text-[#8762F7]">AI</span>
          </span>
        </Link>
      </div>

      {/* Scrollable area */}
      <div className="relative z-10 flex-1 overflow-y-auto px-4 py-8">
        <div className="mx-auto max-w-4xl text-center">

          {/* Heading */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          >
            <h1 className="text-2xl font-semibold text-white md:text-3xl">
              You're all set
            </h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-white/55">
              Here's a quick overview of your preparation. You can edit anything before you begin.
            </p>
          </motion.div>

          {/* Card */}
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6 text-left backdrop-blur-md md:p-8"
          >

            {/* ── Profile ── */}
            <motion.div variants={fadeSlide}>
              <Section>
                <SectionLabel label="Profile" editHref="/onboarding" />
                <div className="flex items-center gap-4">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/5">
                    {data.avatar ? (
                      <Image
                        src={`/avatars/${data.avatar}.svg`}
                        alt="avatar"
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <User size={18} className="text-white/20" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-white">
                      {data.name || 'Student'}
                    </p>
                    <p className="truncate text-sm text-white/50">
                      {data.email || '—'}
                    </p>
                  </div>
                </div>
              </Section>
            </motion.div>

            <motion.div variants={fadeSlide}><Divider /></motion.div>

            {/* ── Exam details ── */}
            <motion.div variants={fadeSlide}>
              <Section>
                <SectionLabel label="Exam Details" editHref="/onboarding/exam" />
                <div className="space-y-1.5">
                  <InfoRow icon={BookOpen}      label="Exam"        value={examLabel} />
                  {!isCustom && data.targetYear && (
                    <InfoRow icon={Calendar}      label="Target Year" value={data.targetYear} />
                  )}
                  {!isCustom && data.currentClass && (
                    <InfoRow icon={GraduationCap} label="Class"       value={data.currentClass} />
                  )}
                  {isCustom && data.examName && (
                    <InfoRow icon={FileText}      label="Exam Name"   value={data.examName} />
                  )}
                </div>
              </Section>
            </motion.div>

            {/* ── Preparation level ── */}
            {showTarget && data.prepLevel && (
              <>
                <motion.div variants={fadeSlide}><Divider /></motion.div>
                <motion.div variants={fadeSlide}>
                  <Section>
                    <SectionLabel label="Preparation Level" editHref="/onboarding/target" />
                    <InfoRow icon={Zap} label="Current level" value={data.prepLevel} accent />
                  </Section>
                </motion.div>
              </>
            )}

            {/* ── Subjects ── */}
            {showSubjects && (
              <>
                <motion.div variants={fadeSlide}><Divider /></motion.div>
                <motion.div variants={fadeSlide}>
                  <Section>
                    <SectionLabel label="Subjects" editHref="/onboarding/subjects" />
                    <ul className="mt-1 space-y-1.5">
                      {filledSubjects.map((s) => (
                        <li key={s} className="flex items-center gap-2.5 text-sm text-white/65">
                          <span className="h-1 w-1 shrink-0 rounded-full bg-[#8762F7]/60" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </Section>
                </motion.div>
              </>
            )}

          </motion.div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.5, ease: 'easeOut' }}
            className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
          >
            <motion.button
              whileTap={{ scale: saving ? 1 : 0.97 }}
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  const updated = await api.post<StoredUser>(
                    '/auth/complete-onboarding',
                    {
                      avatar:           data.avatar,
                      targetExam:       data.examType,
                      selectedSubjects: data.subjects.filter((s) => s.trim()),
                      targetYear:       data.targetYear ? parseInt(data.targetYear, 10) : undefined,
                    },
                    { auth: true },
                  );
                  // DB sync succeeded — update both fields.
                  updateUser({ onboardingComplete: true, targetExam: updated.targetExam });
                  trackEvent('onboarding_complete', { exam: data.examType, subjects: data.subjects.length });
                } catch {
                  // DB sync failed (e.g. backend temporarily down).  We still mark
                  // onboardingComplete=true in localStorage so the dashboard AuthGuard
                  // does not redirect back to this page.  The backend will be re-synced
                  // on the user's next login via the /auth/me flow.
                  updateUser({ onboardingComplete: true });
                } finally {
                  setSaving(false);
                }
                localStorage.setItem('denbot-seen', 'false');
                router.push('/pricing');
              }}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-gradient-to-r from-[#8762F7] to-[#6D4AFF] px-8 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:brightness-110 hover:shadow-[0_0_24px_rgba(135,98,247,0.5)] disabled:opacity-60 sm:w-auto"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              See plans & start
            </motion.button>
          </motion.div>

        </div>
      </div>
    </main>
  );
}
