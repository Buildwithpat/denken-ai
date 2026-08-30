"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Target, Brain, Zap, RefreshCcw, AlertTriangle, TrendingUp,
  Clock, ChevronRight, Loader2, BookOpen, Flame,
} from "lucide-react";
import {
  getRecommendations,
  type PracticeRecommendation,
  type PracticeUrgency,
  type PracticeIntent,
  type SessionSummary,
} from "@/lib/practiceApi";
import AdaptivePracticeModal from "@/components/practice/AdaptivePracticeModal";

// ── Intent display config ─────────────────────────────────────────────────────

const INTENT_META: Record<PracticeIntent, { icon: typeof Target; label: string; color: string }> = {
  "concept-drill":    { icon: BookOpen,      label: "Concept Drill",    color: "text-blue-400"    },
  "prerequisite-fix": { icon: AlertTriangle,  label: "Fix Prerequisite", color: "text-rose-400"    },
  "retention-boost":  { icon: RefreshCcw,     label: "Retention Boost",  color: "text-violet-400"  },
  "mistake-revisit":  { icon: Flame,          label: "Mistake Drill",    color: "text-orange-400"  },
};

const URGENCY_BADGE: Record<PracticeUrgency, string> = {
  critical: "border-[#ef4444]/25 bg-[#ef4444]/[0.07] text-[#ef4444]/80",
  high:     "border-[#f59e0b]/25 bg-[#f59e0b]/[0.07] text-[#f59e0b]/80",
  medium:   "border-[#8762F7]/20 bg-[#8762F7]/[0.05] text-[#8762F7]/75",
  low:      "border-white/[0.08] bg-white/[0.03] text-white/40",
};

// ── Recommendation card ───────────────────────────────────────────────────────

function RecommendationCard({
  rec,
  onStart,
}: {
  rec:     PracticeRecommendation;
  onStart: () => void;
}) {
  const meta = INTENT_META[rec.type];
  const Icon = meta.icon;

  return (
    <div className="group relative flex flex-col gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-5 transition-all duration-150 hover:border-white/[0.12]">
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.03]">
            <Icon size={14} className={meta.color} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-white/50">{meta.label}</p>
            <p className="text-sm font-semibold text-white/85 leading-snug">{rec.title}</p>
          </div>
        </div>
        <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-semibold capitalize ${URGENCY_BADGE[rec.urgency]}`}>
          {rec.urgency}
        </span>
      </div>

      {/* Description */}
      <p className="text-xs text-white/40 leading-relaxed">{rec.description}</p>

      {/* Meta row */}
      <div className="flex items-center gap-3 text-[10px] text-white/25">
        <span className="flex items-center gap-1">
          <Target size={9} />
          {rec.subject}
        </span>
        <span className="flex items-center gap-1">
          <Clock size={9} />
          ~{rec.estimatedMinutes} min
        </span>
        <span className="flex items-center gap-1">
          <Brain size={9} />
          {rec.questionCount} questions
        </span>
      </div>

      {/* CTA */}
      <button
        onClick={onStart}
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#8762F7]/25 bg-[#8762F7]/10 py-2 text-xs font-medium text-[#8762F7] transition-all hover:bg-[#8762F7]/18 hover:brightness-110"
      >
        <Zap size={12} />
        Start Practice
        <ChevronRight size={11} className="opacity-60" />
      </button>
    </div>
  );
}

// ── Quick subject drills ──────────────────────────────────────────────────────

const QUICK_DRILLS = [
  { subject: "Physics",     icon: Zap,      color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/20",    chapter: "Mechanics"     },
  { subject: "Chemistry",   icon: Brain,    color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", chapter: "Atomic Structure" },
  { subject: "Mathematics", icon: TrendingUp, color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20", chapter: "Calculus"      },
] as const;

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdaptivePracticePage() {
  const [recs,           setRecs]           = useState<PracticeRecommendation[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [filterSubject,  setFilterSubject]  = useState<string | null>(null);
  const [activeSession,  setActiveSession]  = useState<{
    subject:  string;
    chapter?: string;
    topic?:   string;
    intent?:  PracticeIntent;
    title?:   string;
  } | null>(null);
  const [lastSummary, setLastSummary] = useState<SessionSummary | null>(null);

  const loadRecs = useCallback(async (subject?: string) => {
    setLoading(true);
    try {
      const data = await getRecommendations("JEE_MAIN", subject);
      setRecs(data.recommendations);
    } catch {
      setRecs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecs(filterSubject ?? undefined);
  }, [filterSubject, loadRecs]);

  function handleCompleted(summary: SessionSummary) {
    setLastSummary(summary);
    setActiveSession(null);
    loadRecs(filterSubject ?? undefined);
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#8762F7]/12 border border-[#8762F7]/20">
            <Target size={18} className="text-[#8762F7]" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">Adaptive Practice</h1>
            <p className="text-xs text-white/35">
              Targeted drills personalised to your concept gaps, mastery, and forgetting curves.
            </p>
          </div>
        </div>
      </div>

      {/* Last session result */}
      {lastSummary && (
        <div className="mb-6 rounded-xl border border-[#8762F7]/20 bg-[#8762F7]/[0.04] px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-[#8762F7]/50 mb-0.5">Last Session</p>
              <p className="text-sm text-white/80">
                <span className="font-semibold text-white">{lastSummary.accuracy}%</span> accuracy,{" "}
                {lastSummary.correctCount}/{lastSummary.totalQuestions} correct
              </p>
            </div>
            <span className={`text-sm font-semibold ${lastSummary.masteryDelta >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
              {lastSummary.masteryDelta >= 0 ? "+" : ""}{lastSummary.masteryDelta}% mastery
            </span>
          </div>
        </div>
      )}

      {/* Quick drills */}
      <div className="mb-8">
        <p className="text-[10px] uppercase tracking-widest text-white/25 mb-3 font-medium">Quick 5-question drills</p>
        <div className="grid grid-cols-3 gap-3">
          {QUICK_DRILLS.map(({ subject, icon: Icon, color, bg, chapter }) => (
            <button
              key={subject}
              onClick={() => setActiveSession({ subject, chapter, intent: "concept-drill", title: `${subject} Quick Drill` })}
              className={`flex cursor-pointer items-center gap-2.5 rounded-xl border p-3.5 transition-all hover:brightness-110 ${bg}`}
            >
              <Icon size={14} className={color} />
              <div className="text-left">
                <p className="text-xs font-semibold text-white/80">{subject}</p>
                <p className="text-[10px] text-white/35">{chapter}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Subject filter */}
      <div className="mb-5 flex items-center gap-2">
        <p className="text-[10px] uppercase tracking-widest text-white/25 font-medium mr-2">Filter:</p>
        {[null, "Physics", "Chemistry", "Mathematics"].map(s => (
          <button
            key={s ?? "all"}
            onClick={() => setFilterSubject(s)}
            className={[
              "cursor-pointer rounded-lg border px-3 py-1.5 text-xs transition-colors",
              filterSubject === s
                ? "border-[#8762F7]/30 bg-[#8762F7]/12 text-white/80"
                : "border-white/[0.07] text-white/35 hover:border-white/15 hover:text-white/55",
            ].join(" ")}
          >
            {s ?? "All subjects"}
          </button>
        ))}
      </div>

      {/* Personalised recommendations */}
      <div className="mb-2">
        <p className="text-[10px] uppercase tracking-widest text-white/25 mb-4 font-medium">
          Personalised recommendations
        </p>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12">
            <Loader2 size={16} className="animate-spin text-[#8762F7]/50" />
            <p className="text-xs text-white/30">Computing your practice plan…</p>
          </div>
        ) : recs.length === 0 ? (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] py-12 text-center">
            <Brain size={22} className="mx-auto mb-3 text-white/15" />
            <p className="text-sm text-white/35 mb-1">No recommendations yet</p>
            <p className="text-xs text-white/20">
              Complete a few tests and the system will generate personalised practice targets.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {recs.map((rec, i) => (
              <RecommendationCard
                key={i}
                rec={rec}
                onStart={() =>
                  setActiveSession({
                    subject: rec.subject,
                    chapter: rec.chapter,
                    topic:   rec.topic,
                    intent:  rec.type,
                    title:   rec.title,
                  })
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer note */}
      <p className="mt-8 text-center text-[10px] text-white/18 leading-relaxed">
        Difficulty adapts in real-time based on your answers · Powered by Ebbinghaus retention model ·
        Pro feature
      </p>

      {/* Active session modal */}
      {activeSession && (
        <AdaptivePracticeModal
          {...activeSession}
          exam="JEE_MAIN"
          onClose={() => setActiveSession(null)}
          onComplete={handleCompleted}
        />
      )}
    </div>
  );
}
