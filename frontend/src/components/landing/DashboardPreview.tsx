"use client";

import { useState } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";

const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.08 },
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

const subjects = [
  { name: "Physics", progress: 74, color: "#8762F7" },
  { name: "Chemistry", progress: 58, color: "#A78BFA" },
  { name: "Mathematics", progress: 82, color: "#C4B5FD" },
  { name: "Biology", progress: 67, color: "#9b8ff7" },
];

const weakTopics = [
  { label: "Thermodynamics", dot: "#ef4444", attempts: 8, accuracy: "38%" },
  { label: "Electrostatics", dot: "#f97316", attempts: 12, accuracy: "45%" },
  { label: "Organic Chemistry", dot: "#eab308", attempts: 6, accuracy: "50%" },
  { label: "Kinematics", dot: "#f97316", attempts: 10, accuracy: "52%" },
];

const recentTests = [
  { name: "Physics Mock #4", score: "65%", accuracy: "78%", questions: 30, date: "Today" },
  { name: "Chemistry PYQ", score: "71%", accuracy: "82%", questions: 25, date: "Yesterday" },
  { name: "Full JEE Mock", score: "58%", accuracy: "69%", questions: 90, date: "3 days ago" },
];

const tabs = ["Dashboard", "Analysis", "Revision"] as const;
type Tab = (typeof tabs)[number];

/* ─── Dashboard Tab ─── */
function DashboardTab() {
  return (
    <motion.div
      className="flex w-full flex-1 flex-col gap-2 overflow-hidden md:flex-row md:gap-3"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {/* Left column */}
      <div className="flex flex-col gap-2 md:flex-1 md:gap-3">
        {/* Stats row on mobile, score card on desktop */}
        <motion.div variants={item} className="grid grid-cols-3 gap-2 md:block md:rounded-xl md:border md:border-white/[0.08] md:bg-white/[0.03] md:p-4">
          {/* Mobile: 3 inline stat pills */}
          <div className="col-span-3 grid grid-cols-3 gap-2 md:hidden">
            {[
              { label: "Score", value: "72%", color: "#8762F7" },
              { label: "Accuracy", value: "76%", color: "#A78BFA" },
              { label: "Streak", value: "6d", color: "#C4B5FD" },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-2 text-center"
              >
                <p className="text-[9px] text-white/40">{label}</p>
                <p className="mt-0.5 text-sm font-bold" style={{ color }}>{value}</p>
              </div>
            ))}
          </div>
          {/* Desktop: score card */}
          <div className="hidden md:block">
            <p className="text-[10px] font-medium uppercase tracking-widest text-white/40">Overall Score</p>
            <p className="mt-1 text-3xl font-bold text-[#8762F7]">72%</p>
            <p className="mt-0.5 text-[10px] text-white/40">+4% from last week · Rank #312</p>
          </div>
        </motion.div>

        {/* Subject progress */}
        <motion.div
          variants={item}
          className="flex flex-1 flex-col rounded-xl border border-white/[0.08] bg-white/[0.03] p-2.5 md:p-4"
        >
          <p className="mb-2 text-[9px] font-medium uppercase tracking-widest text-white/40 md:mb-3 md:text-[10px]">
            Subject Progress
          </p>
          <div className="space-y-2 md:space-y-3">
            {subjects.slice(0, 3).map((s, i) => (
              <div key={s.name}>
                <div className="mb-0.5 flex justify-between">
                  <span className="text-[10px] text-white/60 md:text-xs">{s.name}</span>
                  <span className="text-[10px] text-white/40 md:text-xs">{s.progress}%</span>
                </div>
                <div className="h-1 w-full rounded-full bg-white/[0.06] md:h-1.5">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: s.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${s.progress}%` }}
                    transition={{ duration: 1.1, delay: 0.25 + i * 0.12, ease: "easeOut" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Right column — hidden on mobile */}
      <div className="hidden w-[44%] flex-col gap-3 md:flex">
        <motion.div
          variants={item}
          className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4"
        >
          <p className="text-[10px] font-medium uppercase tracking-widest text-white/40">
            Recent Test
          </p>
          <p className="mt-1.5 text-xs font-medium text-white/70">{recentTests[0].name}</p>
          <div className="mt-2 space-y-1.5">
            {[
              ["Score", recentTests[0].score],
              ["Accuracy", recentTests[0].accuracy],
              ["Questions", String(recentTests[0].questions)],
            ].map(([label, val]) => (
              <div key={label} className="flex justify-between">
                <span className="text-xs text-white/50">{label}</span>
                <span className="text-xs font-medium text-white/80">{val}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          variants={item}
          className="flex flex-1 flex-col rounded-xl border border-white/[0.08] bg-white/[0.03] p-4"
        >
          <p className="mb-2 text-[10px] font-medium uppercase tracking-widest text-white/40">
            Weak Topics
          </p>
          <div className="space-y-2">
            {weakTopics.slice(0, 3).map((t) => (
              <div key={t.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: t.dot }} />
                  <span className="text-xs text-white/60">{t.label}</span>
                </div>
                <span className="text-[10px] text-white/30">{t.accuracy}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

/* ─── Analysis Tab ─── */
function AnalysisTab() {
  const metrics = [
    { label: "Tests Taken", value: "14" },
    { label: "Avg Score", value: "68%" },
    { label: "Best Subject", value: "Maths" },
    { label: "Streak", value: "6 days" },
  ];

  const scoreTrend = [52, 61, 58, 65, 70, 68, 72];

  return (
    <motion.div
      className="flex w-full flex-1 flex-col gap-2 overflow-hidden md:gap-3"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={item} className="grid grid-cols-4 gap-2 md:grid-cols-2">
        {metrics.map(({ label, value }) => (
          <div
            key={label}
            className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-2 md:p-3"
          >
            <p className="text-[9px] text-white/40 md:text-[10px]">{label}</p>
            <p className="mt-0.5 text-sm font-semibold text-[#8762F7] md:mt-1 md:text-lg">{value}</p>
          </div>
        ))}
      </motion.div>

      <motion.div
        variants={item}
        className="flex flex-1 flex-col rounded-xl border border-white/[0.08] bg-white/[0.03] p-2.5 md:p-4"
      >
        <p className="mb-2 text-[9px] font-medium uppercase tracking-widest text-white/40 md:mb-3 md:text-[10px]">
          Score Trend (Last 7 Tests)
        </p>
        <div className="flex flex-1 items-end gap-1.5 md:gap-2">
          {scoreTrend.map((val, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <motion.div
                className="w-full rounded-sm bg-[#8762F7]/60"
                style={{ minHeight: 2 }}
                initial={{ height: 0 }}
                animate={{ height: `${(val / 80) * 100}%` }}
                transition={{ duration: 0.8, delay: 0.15 + i * 0.08, ease: "easeOut" }}
              />
              <span className="text-[8px] text-white/30 md:text-[9px]">{val}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Subject breakdown — desktop only */}
      <motion.div
        variants={item}
        className="hidden rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 md:block"
      >
        <p className="mb-2 text-[10px] font-medium uppercase tracking-widest text-white/40">
          Subject Breakdown
        </p>
        <div className="grid grid-cols-4 gap-2">
          {subjects.map((s) => (
            <div key={s.name} className="text-center">
              <p className="text-[10px] text-white/40">{s.name}</p>
              <p className="mt-0.5 text-sm font-semibold" style={{ color: s.color }}>{s.progress}%</p>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Revision Tab ─── */
function RevisionTab() {
  const notes = [
    { topic: "Newton's Laws", type: "Theory", status: "Done" },
    { topic: "Electrostatics", type: "Formula", status: "Pending" },
    { topic: "Organic Rxn", type: "Both", status: "Pending" },
    { topic: "Kinematics", type: "Theory", status: "Done" },
  ];

  return (
    <motion.div
      className="flex w-full flex-1 flex-col gap-2 overflow-hidden md:gap-3"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {/* Goal bar */}
      <motion.div
        variants={item}
        className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-2.5 md:p-4"
      >
        <div className="flex items-center justify-between">
          <p className="text-[9px] font-medium uppercase tracking-widest text-white/40 md:text-[10px]">
            Today&apos;s Goal
          </p>
          <span className="text-[9px] text-white/30 md:text-[10px]">1 of 2 done</span>
        </div>
        <div className="mt-1.5 h-1 w-full rounded-full bg-white/[0.06] md:mt-2.5 md:h-1.5">
          <motion.div
            className="h-full rounded-full bg-[#8762F7]"
            initial={{ width: 0 }}
            animate={{ width: "50%" }}
            transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
          />
        </div>
      </motion.div>

      {/* Revision queue */}
      <motion.div
        variants={item}
        className="flex flex-1 flex-col rounded-xl border border-white/[0.08] bg-white/[0.03] p-2.5 md:p-4"
      >
        <p className="mb-2 text-[9px] font-medium uppercase tracking-widest text-white/40 md:text-[10px]">
          Revision Queue
        </p>
        <div className="space-y-1.5 md:space-y-2">
          {notes.slice(0, 3).map((n) => (
            <div key={n.topic} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`h-1.5 w-1.5 rounded-full ${
                    n.status === "Done" ? "bg-emerald-400" : "bg-[#8762F7]"
                  }`}
                />
                <div>
                  <p className="text-[10px] text-white/70 md:text-xs">{n.topic}</p>
                  <p className="text-[9px] text-white/30 md:text-[10px]">{n.type}</p>
                </div>
              </div>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium md:px-2 md:text-[10px] ${
                  n.status === "Done"
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-[#8762F7]/15 text-[#8762F7]"
                }`}
              >
                {n.status}
              </span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Weak areas — desktop only */}
      <motion.div
        variants={item}
        className="hidden rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 md:block"
      >
        <p className="mb-2 text-[10px] font-medium uppercase tracking-widest text-white/40">
          Weak Areas to Revise
        </p>
        <div className="flex flex-wrap gap-2">
          {weakTopics.map((t) => (
            <div
              key={t.label}
              className="flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1"
            >
              <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: t.dot }} />
              <span className="text-[10px] text-white/60">{t.label}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Root ─── */
export default function DashboardPreview() {
  const [activeTab, setActiveTab] = useState<Tab>("Dashboard");

  return (
    <motion.div
      className="relative flex h-full w-full flex-col overflow-hidden bg-[#0B0E14]"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: "easeOut" }}
      whileHover={{ scale: 1.006 }}
    >
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute left-1/2 top-0 h-36 w-1/2 -translate-x-1/2 rounded-full bg-[#8762F7]/15 blur-3xl" />
      </div>

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between border-b border-white/[0.06] px-3 py-2 md:px-5 md:py-3">
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-[#8762F7] md:h-2 md:w-2" />
          <span className="text-[10px] font-semibold text-white/70 md:text-xs">DenkenAI</span>
        </div>
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`cursor-pointer rounded-md px-2 py-1 text-[9px] font-medium transition-colors duration-200 md:px-2.5 md:text-[10px] ${
                activeTab === tab
                  ? "bg-[#8762F7]/20 text-[#8762F7]"
                  : "text-white/30 hover:text-white/60"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="relative z-10 flex flex-1 overflow-hidden p-2.5 md:p-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            className="flex w-full flex-1"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            {activeTab === "Dashboard" && <DashboardTab />}
            {activeTab === "Analysis" && <AnalysisTab />}
            {activeTab === "Revision" && <RevisionTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
