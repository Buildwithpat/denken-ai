'use client';

import { useState, useEffect, useRef, type ElementType } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Bot, X, ArrowRight, BarChart2, BookOpen, Sparkles,
  Trophy, Target, FileText, ChevronLeft, MessageSquare, CheckCircle,
} from 'lucide-react';
import { useDenBot } from '@/context/DenBotContext';
import { useOnboarding } from '@/context/OnboardingContext';
import { useAuth } from '@/context/AuthContext';

/* ─── Feature data ───────────────────────────────────────────────────────── */

interface Feature {
  id:    string;
  title: string;
  icon:  ElementType;
  color: string;
  bg:    string;
  page:  string;
  what:  string;
  how:   string;
  why:   string;
}

const FEATURES: Feature[] = [
  {
    id:    'tests',
    title: 'Tests',
    icon:  FileText,
    color: 'text-[#3b82f6]',
    bg:    'bg-[#3b82f6]/10 border-[#3b82f6]/20',
    page:  '/tests',
    what:  'Create and attempt custom tests across 5 modes — Normal, Rapid Drill, PYQ, Mistake Revision, and Smart Test.',
    how:   'Pick your exam, select a subject or chapter, choose a mode, and start. Results and analysis are generated automatically.',
    why:   'Structured practice with varied difficulty trains you for real exam conditions and highlights gaps fast.',
  },
  {
    id:    'revision',
    title: 'Revision',
    icon:  BookOpen,
    color: 'text-[#8762F7]',
    bg:    'bg-[#8762F7]/10 border-[#8762F7]/20',
    page:  '/revision',
    what:  'A dedicated space for Smart Notes, Formula Practice, Quick Revision, Weak Areas, and your Mistake Log.',
    how:   'Open a subject, pick a chapter, and choose your revision mode. Smart Notes give structured theory instantly.',
    why:   'Spaced and targeted revision is the most effective way to retain concepts before an exam.',
  },
  {
    id:    'analysis',
    title: 'Analysis',
    icon:  BarChart2,
    color: 'text-[#22c55e]',
    bg:    'bg-[#22c55e]/10 border-[#22c55e]/20',
    page:  '/analysis',
    what:  'A full performance dashboard — accuracy trends, subject breakdowns, mistake analysis, and a revision roadmap.',
    how:   'After each test your data updates automatically. Visit Analysis to spot weak topics and track progress.',
    why:   "You can't improve what you don't measure. Analysis turns test data into actionable priorities.",
  },
  {
    id:    'exam',
    title: 'Exam Mode',
    icon:  Trophy,
    color: 'text-[#f59e0b]',
    bg:    'bg-[#f59e0b]/10 border-[#f59e0b]/20',
    page:  '/exam',
    what:  'Full-length mock tests and previous year papers in real conditions — timed, full question set, proper marking.',
    how:   'Choose JEE Main, JEE Advanced, or NEET, pick Mock or PYQ mode, select a year, and start the full exam.',
    why:   'Simulation builds exam stamina, time management, and reduces anxiety on the actual day.',
  },
  {
    id:    'studio',
    title: 'Denken Studio',
    icon:  Sparkles,
    color: 'text-[#8762F7]',
    bg:    'bg-[#8762F7]/10 border-[#8762F7]/20',
    page:  '/denkenstudio',
    what:  'AI-powered smart test builder — High Weightage, Weakness Targeted, and Difficulty Based modes.',
    how:   'Pick a build mode, configure subjects, difficulty, and question count, then launch a targeted test.',
    why:   'Generic tests waste time. Denken Studio builds tests that directly move your score.',
  },
  {
    id:    'focus',
    title: 'Focus Areas',
    icon:  Target,
    color: 'text-[#f97316]',
    bg:    'bg-[#f97316]/10 border-[#f97316]/20',
    page:  '/dashboard',
    what:  'Your dashboard highlights the chapters that need the most attention right now.',
    how:   'They appear automatically on your dashboard based on recent test performance and accuracy data.',
    why:   'Knowing exactly where to focus eliminates guesswork and makes study sessions efficient.',
  },
];

/* ─── Step types ─────────────────────────────────────────────────────────── */

type Step = 'greeting' | 'dismissed' | 'features' | 'detail' | 'feedback';

/* ─── Bot bubble ─────────────────────────────────────────────────────────── */

function BotBubble({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const [visible, setVisible] = useState(delay === 0);
  useEffect(() => {
    if (delay === 0) return;
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div className={[
      'flex items-start gap-2.5 transition-all duration-300',
      visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
    ].join(' ')}>
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#8762F7]/30 bg-[#8762F7]/15">
        <Bot size={12} className="text-[#8762F7]" />
      </div>
      <div className="rounded-2xl rounded-tl-sm border border-white/[0.10] bg-white/[0.07] px-3.5 py-2.5 text-xs leading-relaxed text-white/90">
        {children}
      </div>
    </div>
  );
}

/* ─── User echo bubble ───────────────────────────────────────────────────── */

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="rounded-2xl rounded-tr-sm border border-[#8762F7]/25 bg-[#8762F7]/10 px-3.5 py-2 text-xs text-[#8762F7]/90">
        {text}
      </div>
    </div>
  );
}

/* ─── DenBot panel ───────────────────────────────────────────────────────── */

export default function DenBot() {
  const { isOpen, close, toggle } = useDenBot();
  const router            = useRouter();
  const pathname          = usePathname();
  const isLanding         = pathname === '/';
  const { user }          = useAuth();
  const name              = user?.name ?? '';

  const [step,          setStep]          = useState<Step>('greeting');
  const [feature,       setFeature]       = useState<Feature | null>(null);
  const [userEcho,      setUserEcho]      = useState<string | null>(null);
  const [feedbackText,  setFeedbackText]  = useState('');
  const [feedbackDone,  setFeedbackDone]  = useState(false);
  const bodyRef                           = useRef<HTMLDivElement>(null);

  /* Auto-open once after onboarding */
  useEffect(() => {
    const seen = localStorage.getItem('denbot-seen');
    if (seen === 'false') {
      toggle();
      localStorage.setItem('denbot-seen', 'true');
    }
  }, []);

  /* Reset when panel opens */
  useEffect(() => {
    if (isOpen) {
      setStep('greeting');
      setFeature(null);
      setUserEcho(null);
      setFeedbackText('');
      setFeedbackDone(false);
    }
  }, [isOpen]);

  function handleFeedbackSubmit() {
    if (!feedbackText.trim()) return;
    setFeedbackDone(true);
    setFeedbackText('');
  }

  /* Scroll to bottom whenever step changes */
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [step, userEcho]);

  function handleYes() {
    setUserEcho('Yes');
    setTimeout(() => setStep('features'), 300);
  }

  function handleNotNow() {
    setUserEcho('Not now');
    setTimeout(() => setStep('dismissed'), 300);
  }

  function handleFeatureClick(f: Feature) {
    setFeature(f);
    setStep('detail');
  }

  function handleTry() {
    if (feature) {
      close();
      router.push(feature.page);
    }
  }

  return (
    <>
      {/* ── Panel ── */}
      <div className={[
        'fixed bottom-[88px] right-6 z-50 flex w-[340px] flex-col overflow-hidden rounded-2xl border border-white/[0.12] bg-[#111520]/95 shadow-[0_16px_64px_rgba(0,0,0,0.75)] backdrop-blur-xl transition-all duration-300 ease-out',
        isOpen
          ? 'pointer-events-auto translate-y-0 opacity-100 scale-100'
          : 'pointer-events-none translate-y-3 opacity-0 scale-[0.97]',
      ].join(' ')}
        style={{ maxHeight: '520px' }}
      >

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.07] px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full border border-[#8762F7]/35 bg-[#8762F7]/15">
              <Bot size={14} className="text-[#8762F7]" />
            </div>
            <div>
              <p className="text-xs font-semibold text-white">DenBot</p>
              <p className="text-[9px] text-white/30">Interactive Guide</p>
            </div>
          </div>
          <button
            onClick={close}
            className="cursor-pointer rounded-lg p-1.5 text-white/30 transition-colors hover:bg-white/[0.06] hover:text-white/70"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div
          ref={bodyRef}
          className="flex-1 space-y-3 overflow-y-auto px-4 py-4 [&::-webkit-scrollbar]:hidden"
        >

          {/* ── Greeting ── */}
          <BotBubble>
            Hi {name && <><span className="font-semibold text-white">{name}</span> </>}👋
            <br />
            I&apos;m <span className="font-semibold text-[#8762F7]">DenBot</span> — your guide to DenkenAI.
            <br /><br />
            Want to see how this platform improves your prep?
          </BotBubble>

          {/* User echo */}
          {userEcho && <UserBubble text={userEcho} />}

          {/* ── Dismissed ── */}
          {step === 'dismissed' && (
            <BotBubble delay={200}>
              You can open me anytime 👍
            </BotBubble>
          )}

          {/* ── Feedback ── */}
          {step === 'feedback' && (
            <>
              <BotBubble delay={100}>
                We&apos;d love to hear how DenkenAI is working for you 💬
              </BotBubble>
              {feedbackDone ? (
                <BotBubble delay={150}>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle size={12} className="text-[#22c55e]" />
                    <span className="font-semibold text-[#22c55e]">Thanks for your feedback!</span>
                  </span>
                  <br />
                  Your input helps us improve DenkenAI for everyone.
                </BotBubble>
              ) : (
                <div className="pt-1">
                  <textarea
                    value={feedbackText}
                    onChange={e => setFeedbackText(e.target.value)}
                    placeholder="Share your feedback..."
                    rows={4}
                    className="w-full resize-none rounded-xl border border-white/[0.10] bg-white/[0.06] px-3.5 py-3 text-xs text-white/80 placeholder-white/25 outline-none transition-colors focus:border-[#8762F7]/40 focus:ring-1 focus:ring-[#8762F7]/15"
                  />
                </div>
              )}
            </>
          )}

          {/* ── Features grid ── */}
          {(step === 'features' || step === 'detail') && (
            <>
              {step === 'features' && (
                <BotBubble delay={200}>
                  Here&apos;s what DenkenAI can do for you. Tap a feature to learn more.
                </BotBubble>
              )}

              {step === 'features' && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {FEATURES.map(f => {
                    const Icon = f.icon;
                    return (
                      <button
                        key={f.id}
                        onClick={() => handleFeatureClick(f)}
                        className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2.5 text-left transition-all duration-150 hover:border-[#8762F7]/25 hover:bg-[#8762F7]/[0.05]"
                      >
                        <div className={['flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border', f.bg].join(' ')}>
                          <Icon size={13} className={f.color} />
                        </div>
                        <span className="text-[11px] font-medium text-white/70">{f.title}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* ── Feature detail ── */}
              {step === 'detail' && feature && (
                <>
                  <button
                    onClick={() => { setStep('features'); setFeature(null); }}
                    className="flex cursor-pointer items-center gap-1 text-[10px] text-white/30 transition-colors hover:text-white/60"
                  >
                    <ChevronLeft size={11} />
                    Back to features
                  </button>

                  <BotBubble delay={100}>
                    <span className="font-semibold text-white">{feature.title}</span>
                  </BotBubble>

                  <div className="space-y-2.5 pt-0.5">
                    {[
                      { label: 'What it does', text: feature.what, color: 'text-[#3b82f6]' },
                      { label: 'How to use',   text: feature.how,  color: 'text-[#22c55e]' },
                      { label: 'Why it helps', text: feature.why,  color: 'text-[#f59e0b]' },
                    ].map(({ label, text, color }) => (
                      <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3">
                        <p className={['mb-1 text-[9px] font-bold uppercase tracking-widest', color].join(' ')}>
                          {label}
                        </p>
                        <p className="text-[11px] leading-relaxed text-white/55">{text}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-white/[0.07] px-4 py-3">
          {step === 'greeting' && (
            <div className="flex gap-2">
              <button
                onClick={handleNotNow}
                className="flex-1 cursor-pointer rounded-xl border border-white/[0.08] py-2 text-xs font-medium text-white/40 transition-colors hover:border-white/20 hover:text-white/70"
              >
                Not now
              </button>
              <button
                onClick={handleYes}
                className="flex-1 cursor-pointer rounded-xl border border-[#8762F7]/40 bg-[#8762F7]/20 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#8762F7]/30"
              >
                Yes
              </button>
            </div>
          )}

          {step === 'dismissed' && (
            <p className="text-center text-[10px] text-white/20">
              Click the <span className="text-[#8762F7]/50">robot icon</span> in the header to reopen
            </p>
          )}

          {step === 'feedback' && !feedbackDone && (
            <button
              onClick={handleFeedbackSubmit}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#8762F7]/40 bg-[#8762F7]/20 py-2.5 text-xs font-semibold text-white transition-all hover:bg-[#8762F7]/30"
            >
              Submit Feedback
            </button>
          )}

          {step === 'feedback' && feedbackDone && (
            <button
              onClick={() => setStep('features')}
              className="w-full cursor-pointer rounded-xl border border-white/[0.08] py-2 text-xs text-white/40 transition-colors hover:border-white/20 hover:text-white/70"
            >
              ← Back to features
            </button>
          )}

          {step === 'features' && (
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-white/20">Tap a card to explore</p>
              <button
                onClick={() => setStep('feedback')}
                className="flex cursor-pointer items-center gap-1 text-[10px] text-white/30 transition-colors hover:text-[#8762F7]/70"
              >
                <MessageSquare size={10} />
                Give Feedback
              </button>
            </div>
          )}

          {step === 'detail' && feature && !isLanding && (
            <button
              onClick={handleTry}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#8762F7]/40 bg-[#8762F7]/20 py-2.5 text-xs font-semibold text-white transition-all hover:bg-[#8762F7]/30 hover:shadow-[0_0_16px_rgba(135,98,247,0.2)]"
            >
              Try {feature.title}
              <ArrowRight size={12} />
            </button>
          )}
        </div>

      </div>

      {/* ── Floating button ── */}
      <button
        onClick={toggle}
        className={[
          'fixed bottom-6 right-6 z-50 flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border shadow-[0_4px_24px_rgba(135,98,247,0.35)] transition-all duration-300',
          isOpen
            ? 'border-[#8762F7]/60 bg-[#8762F7]/40 text-white'
            : 'border-[#8762F7]/40 bg-[#8762F7]/25 text-[#8762F7] hover:bg-[#8762F7]/35 hover:shadow-[0_4px_32px_rgba(135,98,247,0.5)]',
        ].join(' ')}
      >
        {isOpen ? <X size={18} /> : <Bot size={20} />}
      </button>
    </>
  );
}
