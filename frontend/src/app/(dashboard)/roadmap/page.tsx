"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Route,
  Calendar,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Zap,
  FlaskConical,
  Target,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  Flame,
  Star,
} from "lucide-react";
import {
  fetchRoadmap,
  type RoadmapResponse,
  type SubjectTrack,
  type ChapterCard,
  type ChapterStatus,
  type ChapterPriority,
  type MissionTask,
  type RoadmapPhase,
} from "@/lib/roadmapApi";

// ── Metadata maps ─────────────────────────────────────────────────────────────

const STATUS_META: Record<ChapterStatus, { label: string; color: string; bg: string; border: string }> = {
  "not-started":    { label: "Not Started",    color: "text-white/40",   bg: "bg-white/5",      border: "border-white/10" },
  "in-progress":    { label: "In Progress",    color: "text-blue-400",   bg: "bg-blue-500/10",  border: "border-blue-500/20" },
  "needs-revision": { label: "Needs Revision", color: "text-orange-400", bg: "bg-orange-500/10",border: "border-orange-500/20" },
  "mastered":       { label: "Mastered",       color: "text-emerald-400",bg: "bg-emerald-500/10",border: "border-emerald-500/20" },
};

const PRIORITY_META: Record<ChapterPriority, { label: string; color: string; bg: string }> = {
  critical: { label: "Critical", color: "text-red-400",    bg: "bg-red-500/15"    },
  high:     { label: "High",     color: "text-orange-400", bg: "bg-orange-500/15" },
  medium:   { label: "Medium",   color: "text-amber-400",  bg: "bg-amber-500/15"  },
  low:      { label: "Low",      color: "text-white/35",   bg: "bg-white/5"       },
};

const PHASE_META: Record<RoadmapPhase, { color: string; bg: string; border: string }> = {
  "foundation-building":      { color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/20"    },
  "core-strengthening":       { color: "text-indigo-400",  bg: "bg-indigo-500/10",  border: "border-indigo-500/20"  },
  "advanced-problem-solving": { color: "text-violet-400",  bg: "bg-violet-500/10",  border: "border-violet-500/20"  },
  "intensive-revision":       { color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/20"   },
  "mock-domination":          { color: "text-orange-400",  bg: "bg-orange-500/10",  border: "border-orange-500/20"  },
  "final-sprint":             { color: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/20"     },
};

const SUBJECT_ICON: Record<string, React.ElementType> = {
  Physics:     Zap,
  Chemistry:   FlaskConical,
  Mathematics: TrendingUp,
  Biology:     BookOpen,
};

const TASK_TYPE_META: Record<MissionTask["type"], { icon: React.ElementType; color: string }> = {
  "revise":        { icon: BookOpen,       color: "text-blue-400"    },
  "test":          { icon: Target,         color: "text-violet-400"  },
  "formulas":      { icon: Star,           color: "text-amber-400"   },
  "new-chapter":   { icon: Zap,            color: "text-emerald-400" },
  "mistake-drill": { icon: AlertTriangle,  color: "text-red-400"     },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function MasteryBar({ value, color = "bg-[#8762F7]" }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

function PhaseHeader({ roadmap }: { roadmap: RoadmapResponse }) {
  const meta = PHASE_META[roadmap.phase];
  return (
    <div className={`rounded-xl border ${meta.border} ${meta.bg} p-5`}>
      <div className="flex flex-wrap items-start gap-4 justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Route size={16} className={meta.color} />
            <span className={`text-xs font-semibold uppercase tracking-widest ${meta.color}`}>
              {roadmap.phaseLabel}
            </span>
          </div>
          <p className="text-sm text-white/60 max-w-xl leading-relaxed">{roadmap.phaseInsight}</p>
        </div>

        <div className="flex gap-5 shrink-0">
          {roadmap.daysToExam !== null && (
            <div className="text-right">
              <p className="text-2xl font-bold text-white">{roadmap.daysToExam}</p>
              <p className="text-xs text-white/40">days to exam</p>
            </div>
          )}
          <div className="text-right">
            <p className="text-2xl font-bold text-white">{roadmap.syllabusProgress}%</p>
            <p className="text-xs text-white/40">syllabus covered</p>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex justify-between mb-1">
          <span className="text-xs text-white/40">Overall Progress</span>
          <span className="text-xs text-white/50">{roadmap.syllabusProgress}%</span>
        </div>
        <MasteryBar value={roadmap.syllabusProgress} color="bg-[#8762F7]" />
      </div>
    </div>
  );
}

function DailyMissionPanel({ roadmap }: { roadmap: RoadmapResponse }) {
  const { dailyMission } = roadmap;
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <Flame size={18} className="text-amber-400" />
          <div className="text-left">
            <p className="text-sm font-semibold text-white">{dailyMission.missionTitle}</p>
            <p className="text-xs text-white/40 mt-0.5">{dailyMission.focusSummary}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-amber-400/80">
            <Clock size={12} />
            {dailyMission.estimatedMinutes} min
          </span>
          {open ? <ChevronDown size={16} className="text-white/30" /> : <ChevronRight size={16} className="text-white/30" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-amber-500/10 px-5 py-4 space-y-2.5">
          {dailyMission.tasks.map((task) => {
            const meta = TASK_TYPE_META[task.type];
            const Icon = meta.icon;
            const urgencyMeta = PRIORITY_META[task.urgency];
            return (
              <div
                key={task.id}
                className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.03] border border-white/[0.05] px-4 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon size={15} className={meta.color} />
                  <div className="min-w-0">
                    <p className="text-sm text-white/85 truncate">{task.title}</p>
                    <p className="text-xs text-white/35 mt-0.5">{task.subject} · {task.durationMin} min</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${urgencyMeta.bg} ${urgencyMeta.color}`}>
                    {urgencyMeta.label}
                  </span>
                  {task.href && (
                    <Link
                      href={task.href}
                      className="text-xs text-[#8762F7] hover:text-[#a48aff] transition-colors"
                    >
                      Start →
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ChapterRow({ card }: { card: ChapterCard }) {
  const [open, setOpen] = useState(false);
  const statusMeta   = STATUS_META[card.status];
  const priorityMeta = PRIORITY_META[card.priority];

  const showBars = card.totalAttempted > 0;

  return (
    <div className="border border-white/[0.06] rounded-lg overflow-hidden">
      {/* Chapter header row */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/[0.02] transition-colors cursor-pointer text-left"
      >
        {/* Status dot */}
        <span className={`shrink-0 h-2.5 w-2.5 rounded-full ${
          card.status === 'mastered'       ? 'bg-emerald-400' :
          card.status === 'needs-revision' ? 'bg-orange-400'  :
          card.status === 'in-progress'    ? 'bg-blue-400'    :
          'bg-white/20'
        }`} />

        {/* Chapter name */}
        <span className="flex-1 text-sm text-white/80 font-medium truncate min-w-0">
          {card.chapter}
        </span>

        {/* Badges */}
        <div className="flex items-center gap-2 shrink-0">
          {card.examWeightage >= 7 && (
            <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
              {card.examWeightage}% wt
            </span>
          )}
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${priorityMeta.bg} ${priorityMeta.color} hidden sm:inline`}>
            {priorityMeta.label}
          </span>
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${statusMeta.border} ${statusMeta.bg} ${statusMeta.color}`}>
            {statusMeta.label}
          </span>
          {open
            ? <ChevronDown size={14} className="text-white/25" />
            : <ChevronRight size={14} className="text-white/25" />}
        </div>
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-white/[0.05] px-4 py-4 bg-white/[0.015] space-y-4">
          {/* Mastery + Retention bars */}
          {showBars && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between mb-1.5">
                  <span className="text-xs text-white/40">Mastery</span>
                  <span className="text-xs text-white/55">{card.masteryScore}%</span>
                </div>
                <MasteryBar
                  value={card.masteryScore}
                  color={card.masteryScore >= 80 ? "bg-emerald-400" : card.masteryScore >= 50 ? "bg-blue-400" : "bg-orange-400"}
                />
              </div>
              <div>
                <div className="flex justify-between mb-1.5">
                  <span className="text-xs text-white/40">Retention</span>
                  <span className="text-xs text-white/55">{card.retentionScore}%</span>
                </div>
                <MasteryBar
                  value={card.retentionScore}
                  color={card.retentionScore >= 70 ? "bg-emerald-400" : card.retentionScore >= 45 ? "bg-amber-400" : "bg-red-400"}
                />
              </div>
            </div>
          )}

          {/* Stats row */}
          <div className="flex flex-wrap gap-x-5 gap-y-1.5">
            <span className="text-xs text-white/35">
              Exam weight: <span className="text-white/60">{card.examWeightage}%</span>
            </span>
            {showBars && (
              <>
                <span className="text-xs text-white/35">
                  Attempted: <span className="text-white/60">{card.totalAttempted}</span>
                </span>
                <span className="text-xs text-white/35">
                  Error rate: <span className="text-white/60">{Math.round(card.errorRate * 100)}%</span>
                </span>
              </>
            )}
            {card.hasMistakes && card.mistakeDominantType && (
              <span className="text-xs text-orange-400/70">
                Dominant mistake: {card.mistakeDominantType.replace(/-/g, ' ')}
              </span>
            )}
          </div>

          {/* Checklist */}
          <div className="space-y-2">
            <p className="text-xs text-white/30 uppercase tracking-wider">Action Checklist</p>
            {card.checklist.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 size={13} className="text-white/20 shrink-0" />
                  <span className="text-xs text-white/55 truncate">{item.label}</span>
                </div>
                {item.href && (
                  <Link
                    href={item.href}
                    className="text-xs text-[#8762F7] hover:text-[#a48aff] transition-colors shrink-0"
                  >
                    Go →
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SubjectTrackView({ track }: { track: SubjectTrack }) {
  const Icon = SUBJECT_ICON[track.subject] ?? BookOpen;

  const masteredPct = track.totalChapters > 0
    ? Math.round((track.chaptersCompleted / track.totalChapters) * 100)
    : 0;

  return (
    <div>
      {/* Subject header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-[#8762F7]/15 flex items-center justify-center">
            <Icon size={16} className="text-[#8762F7]" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">{track.subject}</h3>
            <p className="text-xs text-white/35 mt-0.5">
              {track.chaptersCompleted}/{track.totalChapters} mastered
              {track.chaptersNeedingRevision > 0 && ` · ${track.chaptersNeedingRevision} need revision`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">{track.overallMastery}%</span>
          <div className="w-24">
            <MasteryBar
              value={masteredPct}
              color={masteredPct >= 70 ? "bg-emerald-400" : masteredPct >= 40 ? "bg-blue-400" : "bg-[#8762F7]"}
            />
          </div>
        </div>
      </div>

      {/* Chapter cards */}
      <div className="space-y-2">
        {track.chapters.map((card) => (
          <ChapterRow key={card.chapter} card={card} />
        ))}
      </div>
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-28 rounded-xl bg-white/[0.04]" />
      <div className="h-32 rounded-xl bg-white/[0.04]" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-2">
          <div className="h-6 w-40 rounded bg-white/[0.04]" />
          {[0, 1, 2, 3].map((j) => (
            <div key={j} className="h-12 rounded-lg bg-white/[0.04]" />
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RoadmapPage() {
  const [roadmap, setRoadmap] = useState<RoadmapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [activeSubject, setActiveSubject] = useState<string | null>(null);

  useEffect(() => {
    fetchRoadmap()
      .then((data) => {
        setRoadmap(data);
        if (data.subjectTracks.length > 0) {
          setActiveSubject(data.subjectTracks[0].subject);
        }
      })
      .catch(() => setError("Failed to load roadmap"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#080B11] p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Page title */}
        <div className="flex items-center gap-3">
          <Route size={22} className="text-[#8762F7]" />
          <div>
            <h1 className="text-xl font-bold text-white">Study Roadmap</h1>
            <p className="text-sm text-white/40 mt-0.5">Your personalised preparation operating system</p>
          </div>
        </div>

        {loading && <Skeleton />}

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-5 py-8 text-center">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {roadmap && !loading && (
          <>
            {/* Phase header */}
            <PhaseHeader roadmap={roadmap} />

            {/* Daily Mission */}
            <DailyMissionPanel roadmap={roadmap} />

            {/* New user onboarding nudge */}
            {roadmap.isNewUser && (
              <div className="rounded-xl border border-[#8762F7]/20 bg-[#8762F7]/5 px-5 py-4">
                <div className="flex items-start gap-3">
                  <Calendar size={16} className="text-[#8762F7] mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-white">Take your first test to personalise this roadmap</p>
                    <p className="text-xs text-white/40 mt-1">
                      Right now chapters are ordered by exam weightage. Once you take tests, the roadmap adapts to your actual strengths and weak spots.
                    </p>
                    <Link href="/tests" className="inline-block mt-2 text-xs text-[#8762F7] hover:text-[#a48aff] transition-colors">
                      Start a test →
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Subject tabs */}
            <div>
              <div className="flex gap-1 border-b border-white/[0.07] mb-6 overflow-x-auto">
                {roadmap.subjectTracks.map((track) => {
                  const Icon = SUBJECT_ICON[track.subject] ?? BookOpen;
                  const isActive = activeSubject === track.subject;
                  return (
                    <button
                      key={track.subject}
                      onClick={() => setActiveSubject(track.subject)}
                      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all border-b-2 whitespace-nowrap cursor-pointer ${
                        isActive
                          ? "border-[#8762F7] text-white"
                          : "border-transparent text-white/40 hover:text-white/65"
                      }`}
                    >
                      <Icon size={14} />
                      {track.subject}
                      {track.chaptersNeedingRevision > 0 && (
                        <span className="h-4 w-4 rounded-full bg-orange-500/20 text-orange-400 text-[10px] flex items-center justify-center font-semibold">
                          {track.chaptersNeedingRevision}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Active subject track */}
              {roadmap.subjectTracks
                .filter((t) => t.subject === activeSubject)
                .map((track) => (
                  <SubjectTrackView key={track.subject} track={track} />
                ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
