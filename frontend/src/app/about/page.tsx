'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  BookOpen, BarChart2, Trophy, Sparkles, FileText,
  RefreshCcw, Target, Lightbulb, User, ChevronRight,
} from 'lucide-react';

/* ─── Sidebar structure ──────────────────────────────────────────────────── */

const SECTIONS = [
  {
    group: 'Foundation',
    items: [
      { id: 'introduction',   label: 'Introduction'      },
      { id: 'philosophy',     label: 'Philosophy'        },
      { id: 'how-it-works',   label: 'How It Works'      },
    ],
  },
  {
    group: 'Core System',
    items: [
      { id: 'tests',          label: 'Tests'             },
      { id: 'revision',       label: 'Revision'          },
      { id: 'analysis',       label: 'Analysis'          },
      { id: 'exam-mode',      label: 'Exam Mode'         },
      { id: 'denken-studio',  label: 'Denken Studio'     },
    ],
  },
  {
    group: 'Creator',
    items: [
      { id: 'about-builder',  label: 'About the Builder' },
      { id: 'vision',         label: 'Vision'            },
    ],
  },
] as const;

type SectionId = (typeof SECTIONS)[number]['items'][number]['id'];

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md border border-[#8762F7]/20 bg-[#8762F7]/10 px-2.5 py-0.5 text-[11px] font-medium text-[#8762F7]">
      {children}
    </span>
  );
}

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="scroll-mt-24 text-2xl font-bold tracking-tight text-white"
    >
      {children}
    </h2>
  );
}

function Divider() {
  return <div className="border-t border-white/[0.06]" />;
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function AboutPage() {
  const [active, setActive] = useState<SectionId>('introduction');
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const allIds = SECTIONS.flatMap(s => s.items.map(i => i.id));

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(entry.target.id as SectionId);
            break;
          }
        }
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 },
    );

    allIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) observerRef.current?.observe(el);
    });

    return () => observerRef.current?.disconnect();
  }, []);

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="min-h-screen bg-[#0B0E14] text-white">
      {/* ── Top bar ── */}
      <header className="fixed inset-x-0 top-0 z-40 h-14 border-b border-white/[0.06] bg-[#0B0E14]/95 backdrop-blur-md">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/DenkenLogo.svg"
              alt="DenkenAI"
              width={26}
              height={26}
            />
            <span className="text-base font-semibold tracking-tight">
              <span className="text-white">Denken</span>
              <span className="text-[#8762F7]">AI</span>
            </span>
            <span className="ml-1 text-white/20">/</span>
            <span className="text-sm text-white/50">About</span>
          </Link>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl pt-14">
        {/* ── Sidebar ── */}
        <aside className="sticky top-14 hidden h-[calc(100vh-56px)] w-56 shrink-0 overflow-y-auto border-r border-white/[0.06] py-8 pr-4 lg:block">
          <nav className="flex flex-col gap-6">
            {SECTIONS.map(({ group, items }) => (
              <div key={group}>
                <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-white/25">
                  {group}
                </p>
                <div className="flex flex-col gap-0.5">
                  {items.map(({ id, label }) => (
                    <button
                      key={id}
                      onClick={() => scrollTo(id)}
                      className={[
                        "cursor-pointer rounded-md px-3 py-1.5 text-left text-sm transition-colors",
                        active === id
                          ? "bg-[#8762F7]/12 text-white"
                          : "text-white/40 hover:text-white/70",
                      ].join(" ")}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {/* ── Content ── */}
        <main className="min-w-0 flex-1 px-6 py-12 lg:px-14 xl:px-20">
          <div className="mx-auto max-w-2xl space-y-20">
            {/* Introduction */}
            <section className="space-y-5">
              <Tag>Foundation</Tag>
              <SectionHeading id="introduction">Introduction</SectionHeading>
              <p className="text-base leading-8 text-white/65">
                DenkenAI is an adaptive exam preparation system built for
                students preparing for JEE, NEET, CBSE, and custom exams. It
                replaces scattered, untracked study sessions with a structured
                loop of testing, analysis, and targeted revision.
              </p>
              <p className="text-base leading-8 text-white/65">
                The core idea is simple: most students practice without ever
                measuring progress. DenkenAI makes every session count by
                tracking what you know, what you don't, and what to do next.
              </p>
            </section>

            <Divider />

            {/* Philosophy */}
            <section className="space-y-5">
              <SectionHeading id="philosophy">Philosophy</SectionHeading>
              <p className="text-base leading-8 text-white/65">
                Most students prepare the same way — solve questions, move on,
                and hope things stick. Three problems repeat across almost every
                student:
              </p>
              <ul className="space-y-3 pl-1">
                {[
                  "Practice is random, not targeted",
                  "Weak areas are identified but never systematically fixed",
                  "There is no feedback loop between effort and outcome",
                ].map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-3 text-base text-white/60"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#8762F7]/60" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.025] p-5">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-white/25">
                  The DenkenAI Loop
                </p>
                <div className="flex flex-wrap items-center gap-2 text-base font-medium">
                  {["Test", "Analyze", "Revise", "Improve"].map(
                    (step, i, arr) => (
                      <span key={step} className="flex items-center gap-2">
                        <span className="rounded-md border border-[#8762F7]/25 bg-[#8762F7]/10 px-3 py-1 text-[#8762F7]">
                          {step}
                        </span>
                        {i < arr.length - 1 && (
                          <ChevronRight size={14} className="text-white/20" />
                        )}
                      </span>
                    ),
                  )}
                </div>
              </div>
            </section>

            <Divider />

            {/* How It Works */}
            <section className="space-y-5">
              <SectionHeading id="how-it-works">How It Works</SectionHeading>
              <div className="space-y-3">
                {[
                  {
                    n: "01",
                    label: "Take Tests",
                    desc: "Choose a subject, chapter, and test mode. Timed sessions, structured questions.",
                  },
                  {
                    n: "02",
                    label: "Analyze Performance",
                    desc: "View accuracy, score trends, and weak topic breakdowns after every session.",
                  },
                  {
                    n: "03",
                    label: "Revise Weak Areas",
                    desc: "Smart Notes, formula practice, and targeted revision pinpoint what needs work.",
                  },
                  {
                    n: "04",
                    label: "Improve Consistently",
                    desc: "Repeated cycles of this loop move your score measurably over time.",
                  },
                ].map(({ n, label, desc }) => (
                  <div
                    key={n}
                    className="flex gap-5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5"
                  >
                    <span className="shrink-0 text-sm font-bold tabular-nums text-[#8762F7]/50">
                      {n}
                    </span>
                    <div>
                      <p className="text-base font-semibold text-white/90">
                        {label}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-white/50">
                        {desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <Divider />

            {/* Tests */}
            <section className="space-y-5">
              <Tag>Core System</Tag>
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#3b82f6]/20 bg-[#3b82f6]/10">
                  <FileText size={14} className="text-[#3b82f6]" />
                </div>
                <SectionHeading id="tests">Tests</SectionHeading>
              </div>
              <p className="text-base leading-8 text-white/65">
                The test engine supports five modes designed for different
                stages of preparation.
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {[
                  {
                    mode: "Normal",
                    desc: "Standard subject and chapter tests",
                  },
                  {
                    mode: "Rapid Drill",
                    desc: "High-speed, high-volume quick fire questions",
                  },
                  { mode: "PYQ", desc: "Previous year exam papers by subject" },
                  {
                    mode: "Mistake Revision",
                    desc: "Reattempt previously wrong questions",
                  },
                  {
                    mode: "Smart Test",
                    desc: "Auto-selected based on weak area data",
                  },
                ].map(({ mode, desc }) => (
                  <div
                    key={mode}
                    className="rounded-lg border border-white/[0.06] bg-white/[0.025] px-4 py-3.5"
                  >
                    <p className="text-sm font-semibold text-white/85">
                      {mode}
                    </p>
                    <p className="mt-1 text-sm text-white/45">{desc}</p>
                  </div>
                ))}
              </div>
            </section>

            <Divider />

            {/* Revision */}
            <section className="space-y-5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#8762F7]/20 bg-[#8762F7]/10">
                  <BookOpen size={14} className="text-[#8762F7]" />
                </div>
                <SectionHeading id="revision">Revision</SectionHeading>
              </div>
              <p className="text-base leading-8 text-white/65">
                Revision is where knowledge gets consolidated. DenkenAI
                structures it into five distinct modes rather than leaving it as
                open-ended reading.
              </p>
              <ul className="space-y-3">
                {[
                  [
                    "Smart Notes",
                    "Structured theory for any chapter, on demand",
                  ],
                  [
                    "Formula Practice",
                    "Drill key formulas until they are automatic",
                  ],
                  ["Quick Revision", "Rapid concept refreshers before a test"],
                  ["Weak Areas", "Chapters flagged by your test performance"],
                  [
                    "Mistake Log",
                    "Every wrong answer, reviewable and filterable",
                  ],
                ].map(([title, desc]) => (
                  <li key={title} className="flex items-start gap-3 text-base">
                    <RefreshCcw
                      size={13}
                      className="mt-1.5 shrink-0 text-[#8762F7]/50"
                    />
                    <span>
                      <span className="font-semibold text-white/85">{title}</span>
                      <span className="text-white/45"> — {desc}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <Divider />

            {/* Analysis */}
            <section className="space-y-5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#22c55e]/20 bg-[#22c55e]/10">
                  <BarChart2 size={14} className="text-[#22c55e]" />
                </div>
                <SectionHeading id="analysis">Analysis</SectionHeading>
              </div>
              <p className="text-base leading-8 text-white/65">
                After each test, DenkenAI updates a full performance dashboard.
                It is not just a score — it is a map of where you stand.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  "Score trend over time",
                  "Subject-level accuracy",
                  "Mistake pattern breakdown",
                  "Weak topic identification",
                  "Question type performance",
                  "Revision roadmap",
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-2.5 text-sm text-white/55"
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#22c55e]/60" />
                    {item}
                  </div>
                ))}
              </div>
            </section>

            <Divider />

            {/* Exam Mode */}
            <section className="space-y-5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#f59e0b]/20 bg-[#f59e0b]/10">
                  <Trophy size={14} className="text-[#f59e0b]" />
                </div>
                <SectionHeading id="exam-mode">Exam Mode</SectionHeading>
              </div>
              <p className="text-base leading-8 text-white/65">
                Full-length exam simulation in real conditions. Timed, full
                question set, with the exact marking scheme of the target exam.
              </p>
              <div className="space-y-2">
                {[
                  { label: "Exams", value: "JEE Main, JEE Advanced, NEET" },
                  { label: "Modes", value: "Mock Test, Previous Year Paper" },
                  { label: "Marking", value: "+4 / −1 as per official scheme" },
                  {
                    label: "Purpose",
                    value: "Stamina, time management, pressure simulation",
                  },
                ].map(({ label, value }) => (
                  <div key={label} className="flex gap-4 text-base">
                    <span className="w-20 shrink-0 text-white/30">{label}</span>
                    <span className="text-white/70">{value}</span>
                  </div>
                ))}
              </div>
            </section>

            <Divider />

            {/* Denken Studio */}
            <section className="space-y-5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#8762F7]/20 bg-[#8762F7]/10">
                  <Sparkles size={14} className="text-[#8762F7]" />
                </div>
                <SectionHeading id="denken-studio">
                  Denken Studio
                </SectionHeading>
              </div>
              <p className="text-base leading-8 text-white/65">
                AI-powered test builder that generates targeted tests instead of
                random ones. Three build modes, each designed around a specific
                study intent.
              </p>
              <div className="space-y-3">
                {[
                  {
                    mode: "High Weightage",
                    desc: "Focus on chapters that carry the most marks in past exams",
                  },
                  {
                    mode: "Weakness Targeted",
                    desc: "Build tests specifically from your lowest-accuracy chapters",
                  },
                  {
                    mode: "Difficulty Based",
                    desc: "Choose easy, medium, or hard to match your preparation level",
                  },
                ].map(({ mode, desc }) => (
                  <div
                    key={mode}
                    className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-5 py-4"
                  >
                    <p className="text-base font-semibold text-white/90">{mode}</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-white/50">
                      {desc}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <Divider />

            {/* About the Builder */}
            <section className="space-y-5">
              <Tag>Creator</Tag>
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                  <User size={14} className="text-white/50" />
                </div>
                <SectionHeading id="about-builder">
                  About the Builder
                </SectionHeading>
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-6 text-base leading-8 text-white/65">
                <p>
                  I’m Aakash Pathak, a software engineer who builds solutions to
                  problems I’ve faced myself.
                </p>

                <p className="mt-3">
                  I built DenkenAI after noticing a pattern — students,
                  including myself, put in hours of preparation without a real
                  system behind it. We solve questions, but rarely stop to
                  understand why we got something wrong or which areas actually
                  need more time.
                </p>

                <p className="mt-3">
                  The result is effort without direction. DenkenAI is the system
                  I wish existed when I was preparing — structured, honest about
                  your gaps, and focused on measurable improvement.
                </p>
              </div>
            </section>

            <Divider />

            {/* Vision */}
            <section className="space-y-5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#8762F7]/20 bg-[#8762F7]/10">
                  <Lightbulb size={14} className="text-[#8762F7]" />
                </div>
                <SectionHeading id="vision">Vision</SectionHeading>
              </div>
              <p className="text-base leading-8 text-white/65">
                The current version is a foundation. What comes next builds on
                the data that accumulates as students use the system.
              </p>
              <div className="space-y-2">
                {[
                  {
                    label: "AI Evaluator",
                    desc: "Detailed question-level feedback beyond right or wrong",
                  },
                  {
                    label: "Adaptive Learning Paths",
                    desc: "Dynamic study plans that adjust based on performance week to week",
                  },
                  {
                    label: "Smarter Performance Tracking",
                    desc: "Predict exam readiness and surface the highest-impact actions",
                  },
                ].map(({ label, desc }) => (
                  <div
                    key={label}
                    className="flex gap-4 rounded-lg border border-white/[0.05] bg-white/[0.02] px-5 py-4"
                  >
                    <Target
                      size={15}
                      className="mt-0.5 shrink-0 text-[#8762F7]/50"
                    />
                    <div>
                      <p className="text-base font-semibold text-white/80">
                        {label}
                      </p>
                      <p className="mt-1 text-sm text-white/45">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <div className="pb-16" />
          </div>
        </main>
      </div>
    </div>
  );
}
