"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Brain,
  BookOpen,
  AlertTriangle,
  RefreshCcw,
  Target,
  Zap,
  Map,
  Lightbulb,
  TrendingUp,
  Star,
  ChevronRight,
  Loader2,
  FlaskConical,
} from "lucide-react";
import {
  sendMentorMessage,
  fetchMentorSession,
  type MentorResponse,
  type SessionMessage,
  type IdentifiedWeakness,
} from "@/lib/mentorApi";

// ── Coaching actions (the ONLY way to interact — no free text) ────────────────

const COACHING_ACTIONS = [
  {
    id:      "weakest-chapter",
    label:   "Explain my weakest chapter",
    detail:  "Personalised explanation starting from your mastery level",
    message: "Explain my weakest chapter in detail. Start from fundamentals and adjust to my current mastery level. Reference my specific mastery score and mistake patterns.",
    intent:  "explain",
    icon:    BookOpen,
    accent:  "blue",
  },
  {
    id:      "why-mistakes",
    label:   "Why am I making mistakes?",
    detail:  "Root-cause analysis of your recurring error patterns",
    message: "Analyse my mistake patterns in detail. Why do I keep making the same types of mistakes? What are the root causes and how can I fix each one systematically?",
    intent:  "why-mistakes",
    icon:    AlertTriangle,
    accent:  "orange",
  },
  {
    id:      "revision-session",
    label:   "Generate revision session",
    detail:  "45-min structured revision based on your retention scores",
    message: "Generate a structured 45-minute revision session for my weak topics based on my current retention scores and forgetting curve data. Break it into timed blocks.",
    intent:  "revise",
    icon:    RefreshCcw,
    accent:  "violet",
  },
  {
    id:      "study-today",
    label:   "What should I study today?",
    detail:  "Today's personalised study plan from your roadmap",
    message: "What should I study today based on my roadmap, current preparation phase, retention scores, and upcoming exam timeline? Give me a concrete, timed plan.",
    intent:  "study-plan",
    icon:    Target,
    accent:  "emerald",
  },
  {
    id:      "adaptive-test",
    label:   "Create adaptive test",
    detail:  "Test targeted at your concept gaps and weak topics",
    message: "Recommend an adaptive test configuration targeting my weakest concepts and topics where I have low mastery or high mistake rates. What chapters should I test on and at what difficulty?",
    intent:  "explain",
    icon:    FlaskConical,
    accent:  "amber",
  },
  {
    id:      "roadmap-strategy",
    label:   "Improve my roadmap strategy",
    detail:  "Strategic advice based on your exam timeline and gaps",
    message: "Review my current preparation roadmap and strategy. Based on my syllabus progress, days to exam, mastery levels, and priority chapters, what should I change in my approach to maximise my score?",
    intent:  "study-plan",
    icon:    Map,
    accent:  "rose",
  },
] as const;

type AccentKey = (typeof COACHING_ACTIONS)[number]["accent"];

const ACCENT: Record<AccentKey, { icon: string; card: string; badge: string; dot: string }> = {
  blue:    { icon: "text-blue-400",    card: "border-blue-500/15 hover:border-blue-500/30 hover:bg-blue-500/5",    badge: "bg-blue-500/10 text-blue-400",    dot: "bg-blue-400"    },
  orange:  { icon: "text-orange-400",  card: "border-orange-500/15 hover:border-orange-500/30 hover:bg-orange-500/5",  badge: "bg-orange-500/10 text-orange-400",  dot: "bg-orange-400"  },
  violet:  { icon: "text-violet-400",  card: "border-violet-500/15 hover:border-violet-500/30 hover:bg-violet-500/5",  badge: "bg-violet-500/10 text-violet-400",  dot: "bg-violet-400"  },
  emerald: { icon: "text-emerald-400", card: "border-emerald-500/15 hover:border-emerald-500/30 hover:bg-emerald-500/5", badge: "bg-emerald-500/10 text-emerald-400", dot: "bg-emerald-400" },
  amber:   { icon: "text-amber-400",   card: "border-amber-500/15 hover:border-amber-500/30 hover:bg-amber-500/5",   badge: "bg-amber-500/10 text-amber-400",   dot: "bg-amber-400"   },
  rose:    { icon: "text-rose-400",    card: "border-rose-500/15 hover:border-rose-500/30 hover:bg-rose-500/5",    badge: "bg-rose-500/10 text-rose-400",    dot: "bg-rose-400"    },
};

// ── Action card components ────────────────────────────────────────────────────

function ActionCardLarge({
  action,
  onClick,
  disabled,
}: {
  action:   typeof COACHING_ACTIONS[number];
  onClick:  () => void;
  disabled: boolean;
}) {
  const a = ACCENT[action.accent];
  const Icon = action.icon;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`group relative flex flex-col gap-3 rounded-xl border bg-white/[0.02] p-4 text-left transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${a.card}`}
    >
      <div className={`w-8 h-8 rounded-lg ${a.badge} flex items-center justify-center shrink-0`}>
        <Icon size={16} className={a.icon} />
      </div>
      <div>
        <p className="text-sm font-medium text-white/85 leading-snug">{action.label}</p>
        <p className="text-xs text-white/35 mt-1 leading-relaxed">{action.detail}</p>
      </div>
      <ChevronRight size={13} className={`absolute right-3 top-4 opacity-0 group-hover:opacity-60 transition-opacity ${a.icon}`} />
    </button>
  );
}

function ActionChip({
  action,
  onClick,
  disabled,
}: {
  action:   typeof COACHING_ACTIONS[number];
  onClick:  () => void;
  disabled: boolean;
}) {
  const a = ACCENT[action.accent];
  const Icon = action.icon;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0 ${a.card} bg-white/[0.02]`}
    >
      <Icon size={13} className={a.icon} />
      <span className="text-xs text-white/60 whitespace-nowrap">{action.label}</span>
    </button>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({
  role,
  content,
  response,
  actionLabel,
}: {
  role:        "user" | "assistant";
  content:     string;
  response?:   MentorResponse;
  actionLabel?: string;
}) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] rounded-2xl rounded-tr-sm bg-[#8762F7]/15 border border-[#8762F7]/20 px-4 py-3">
          {actionLabel && (
            <p className="text-[10px] text-[#8762F7]/60 uppercase tracking-widest mb-1.5 font-medium">{actionLabel}</p>
          )}
          <p className="text-sm text-white/80 leading-relaxed">{content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 max-w-full">
      <div className="shrink-0 mt-1 h-8 w-8 rounded-lg bg-[#8762F7]/12 border border-[#8762F7]/15 flex items-center justify-center">
        <Brain size={15} className="text-[#8762F7]" />
      </div>

      <div className="flex-1 min-w-0 space-y-3">
        <div className="rounded-2xl rounded-tl-sm bg-white/[0.035] border border-white/[0.06] px-5 py-4">
          <MarkdownBlock content={content} />
        </div>

        {response && response.key_points.length > 0 && (
          <div className="rounded-xl border border-amber-500/12 bg-amber-500/[0.04] px-4 py-3">
            <p className="text-[10px] text-amber-400/60 uppercase tracking-widest mb-2 font-medium">Key Points</p>
            <ul className="space-y-1.5">
              {response.key_points.map((pt, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-white/60">
                  <span className="text-amber-400/70 mt-px shrink-0">•</span>
                  {pt}
                </li>
              ))}
            </ul>
          </div>
        )}

        {response && response.formula_refs.length > 0 && (
          <div className="rounded-xl border border-[#8762F7]/12 bg-[#8762F7]/[0.04] px-4 py-3">
            <p className="text-[10px] text-[#8762F7]/60 uppercase tracking-widest mb-2 font-medium">Formulas Retrieved</p>
            <ul className="space-y-1.5">
              {response.formula_refs.slice(0, 3).map((f, i) => (
                <li key={i} className="text-[11px] text-white/55 font-mono bg-white/[0.025] rounded px-2 py-1 border border-white/[0.04]">
                  {f.length > 120 ? f.slice(0, 120) + "…" : f}
                </li>
              ))}
            </ul>
          </div>
        )}

        {response && response.suggestions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {response.suggestions.filter(Boolean).map((s, i) => {
              const isLink = s.startsWith("/") || s.includes("→ /");
              const href   = isLink ? s.split("→ ").pop()?.trim() ?? "/" : null;
              const label  = s.replace(/→.*/, "").trim();
              return href ? (
                <Link
                  key={i}
                  href={href}
                  className="flex items-center gap-1.5 text-xs text-[#8762F7] bg-[#8762F7]/8 border border-[#8762F7]/18 rounded-full px-3 py-1.5 hover:bg-[#8762F7]/15 transition-colors"
                >
                  {label || s}
                  <ChevronRight size={11} />
                </Link>
              ) : (
                <span key={i} className="text-xs text-white/35 bg-white/[0.03] border border-white/[0.05] rounded-full px-3 py-1.5">
                  {s}
                </span>
              );
            })}
          </div>
        )}

        {response && (
          <div className="flex items-center gap-3 text-[10px] text-white/20">
            <span>{response.generated_by === "gemini" ? "✦ Gemini AI" : "DenkenAI"}</span>
            {response.rag_chunks_used > 0 && <span>{response.rag_chunks_used} knowledge chunks</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Markdown renderer ─────────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function MarkdownBlock({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];

  lines.forEach((line, i) => {
    if (line.startsWith("## ")) {
      elements.push(
        <h3 key={i} className="text-sm font-semibold text-white mt-4 mb-1.5 first:mt-0">{line.slice(3)}</h3>
      );
    } else if (line.startsWith("### ")) {
      elements.push(
        <h4 key={i} className="text-[13px] font-semibold text-white/80 mt-3 mb-1">{line.slice(4)}</h4>
      );
    } else if (line.startsWith("> ")) {
      elements.push(
        <blockquote key={i} className="border-l-2 border-[#8762F7]/35 pl-3 py-0.5 my-2 text-sm text-white/60 italic">
          {line.slice(2)}
        </blockquote>
      );
    } else if (/^\d+\./.test(line)) {
      elements.push(<p key={i} className="text-sm text-white/70 my-0.5 pl-1">{line}</p>);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(<p key={i} className="text-sm text-white/70 my-0.5 pl-2">{line}</p>);
    } else if (line === "---") {
      elements.push(<hr key={i} className="border-white/[0.06] my-3" />);
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-1.5" />);
    } else {
      const html = escapeHtml(line)
        .replace(/\*\*(.+?)\*\*/g, "<strong class='text-white/90 font-semibold'>$1</strong>")
        .replace(/`(.+?)`/g, "<code class='font-mono text-[#a78bfa] bg-[#8762F7]/10 px-1 rounded text-[11px]'>$1</code>");
      elements.push(
        <p key={i} className="text-sm text-white/70 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: html }} />
      );
    }
  });

  return <div className="space-y-0.5">{elements}</div>;
}

// ── Weakness pill ─────────────────────────────────────────────────────────────

function WeaknessPill({ w }: { w: IdentifiedWeakness }) {
  const typeColor: Record<string, string> = {
    formula:          "text-amber-400",
    conceptual:       "text-blue-400",
    careless:         "text-red-400",
    "weak-retention": "text-orange-400",
    repeated:         "text-rose-400",
  };
  return (
    <div className="rounded-lg border border-white/[0.05] bg-white/[0.025] px-3 py-2.5">
      <p className="text-xs text-white/70 font-medium truncate">{w.topic}</p>
      <div className="flex items-center gap-1.5 mt-1">
        <span className={`text-[10px] font-medium ${typeColor[w.mistakeType] ?? "text-white/35"}`}>
          {w.mistakeType}
        </span>
        <span className="text-[10px] text-white/25">·</span>
        <span className="text-[10px] text-white/30">{w.occurrences}× seen</span>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type UIMessage = {
  id:           string;
  role:         "user" | "assistant";
  content:      string;
  response?:    MentorResponse;
  actionLabel?: string;
};

export default function MentorPage() {
  const [messages,           setMessages]           = useState<UIMessage[]>([]);
  const [loading,            setLoading]            = useState(false);
  const [activeAction,       setActiveAction]       = useState<string | null>(null);
  const [weaknesses,         setWeaknesses]         = useState<IdentifiedWeakness[]>([]);
  const [totalInteractions,  setTotalInteractions]  = useState(0);
  const [activeSubject,      setActiveSubject]      = useState<string | null>(null);
  const [errorMsg,           setErrorMsg]           = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMentorSession()
      .then((session) => {
        setWeaknesses(session.identifiedWeaknesses);
        setTotalInteractions(session.totalInteractions);
        if (session.messages.length > 0) {
          setMessages(session.messages.map((m: SessionMessage, i: number) => ({
            id:      `hist-${i}`,
            role:    m.role,
            content: m.content,
          })));
        }
      })
      .catch((err: unknown) => {
        console.error("[MentorPage] Failed to load session:", err);
      });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function fireAction(action: typeof COACHING_ACTIONS[number]) {
    if (loading) return;
    setErrorMsg(null);
    setActiveAction(action.id);

    const userMsg: UIMessage = {
      id:          `u-${Date.now()}`,
      role:        "user",
      content:     action.message,
      actionLabel: action.label,
    };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const response = await sendMentorMessage(
        action.message,
        null,
        activeSubject,
        "JEE_MAIN",
        action.intent,
      );
      setMessages(prev => [...prev, {
        id:       `a-${Date.now()}`,
        role:     "assistant",
        content:  response.answer,
        response,
      }]);
      setTotalInteractions(n => n + 1);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setErrorMsg(`Connection failed: ${msg}`);
      setMessages(prev => [...prev, {
        id:      `err-${Date.now()}`,
        role:    "assistant",
        content: "I couldn't reach the AI service right now. Check that the AI service is running on port 8001 and try again.",
      }]);
    } finally {
      setLoading(false);
      setActiveAction(null);
    }
  }

  const isEmpty = messages.length === 0;

  return (
    // h-full fills the dashboard <main> container without causing it to scroll
    <div className="flex h-full overflow-hidden bg-[#080B11]">
      {/* ── Main column ─────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 h-full">
        {/* Header */}
        <div className="border-b border-white/[0.06] px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-[#8762F7]/12 border border-[#8762F7]/15 flex items-center justify-center">
              <Brain size={17} className="text-[#8762F7]" />
            </div>
            <div>
              <h1 className="text-[15px] font-semibold text-white leading-tight">
                AI Mentor
              </h1>
              <p className="text-xs text-white/30 mt-0.5">
                {totalInteractions > 0
                  ? `${totalInteractions} coaching session${totalInteractions !== 1 ? "s" : ""} completed`
                  : "Personalized AI coaching · Select an action below"}
              </p>
            </div>
          </div>

          {/* Subject context filter */}
          <div className="flex gap-1">
            {(["Physics", "Chemistry", "Mathematics"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setActiveSubject(activeSubject === s ? null : s)}
                className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                  activeSubject === s
                    ? "bg-[#8762F7]/18 border-[#8762F7]/25 text-white/85"
                    : "border-white/[0.06] text-white/30 hover:text-white/55 hover:border-white/12"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Error banner */}
        {errorMsg && (
          <div className="shrink-0 mx-6 mt-3 rounded-lg border border-red-500/20 bg-red-500/[0.06] px-4 py-2.5 flex items-center gap-2">
            <AlertTriangle size={13} className="text-red-400 shrink-0" />
            <p className="text-xs text-red-400/80">{errorMsg}</p>
            <button
              onClick={() => setErrorMsg(null)}
              className="ml-auto text-white/25 hover:text-white/50 text-xs cursor-pointer"
            >
              dismiss
            </button>
          </div>
        )}

        {/* ── Message area (only this div scrolls) ──────────────────────── */}
        {/* min-h-0 is required for flex children to shrink below content height */}
        <div className="flex-1 overflow-y-auto min-h-0 px-6 py-6">
          {/* Empty state: 6 coaching action cards */}
          {isEmpty && (

            
            <div className="flex flex-col items-center justify-center min-h-full text-center py-8">
              <div className="h-12 w-12 rounded-2xl bg-[#8762F7]/10 border border-[#8762F7]/15 flex items-center justify-center mb-5">
                <Brain size={24} className="text-[#8762F7]" />
              </div>
              <h2 className="text-base font-semibold text-white mb-1.5">
                Your AI Preparation Coach
              </h2>
              <p className="text-sm text-white/35 max-w-sm leading-relaxed mb-8">
                Choose a coaching action below. Each response is personalised
                using your mastery scores, mistake patterns, retention data, and
                roadmap.
              </p>

              <div className="grid grid-cols-2 gap-3 w-full max-w-xl">
                {COACHING_ACTIONS.map((action) => (
                  <ActionCardLarge
                    key={action.id}
                    action={action}
                    onClick={() => fireAction(action)}
                    disabled={loading}
                  />
                ))}
              </div>

              {activeSubject && (
                <p className="mt-5 text-xs text-white/30">
                  Context filtered to{" "}
                  <span className="text-white/55">{activeSubject}</span>
                </p>
              )}
            </div>
          )}

          {/* Conversation thread */}
          <div className="space-y-5">
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                role={msg.role}
                content={msg.content}
                response={msg.response}
                actionLabel={msg.actionLabel}
              />
            ))}

            {loading && (
              <div className="flex gap-3">
                <div className="shrink-0 mt-1 h-8 w-8 rounded-lg bg-[#8762F7]/12 border border-[#8762F7]/15 flex items-center justify-center">
                  <Loader2 size={14} className="text-[#8762F7] animate-spin" />
                </div>
                <div className="rounded-2xl rounded-tl-sm bg-white/[0.035] border border-white/[0.06] px-5 py-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/30">
                      {activeAction
                        ? (COACHING_ACTIONS.find((a) => a.id === activeAction)
                            ?.label ?? "Thinking")
                        : "Thinking"}
                      …
                    </span>
                    <span className="flex gap-1 ml-1">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="h-1.5 w-1.5 rounded-full bg-[#8762F7]/40 animate-bounce"
                          style={{ animationDelay: `${i * 0.15}s` }}
                        />
                      ))}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div ref={bottomRef} />
        </div>

        {/* ── Bottom action strip (shown after first message) ───────────── */}
        {!isEmpty && (
          <div className="shrink-0 border-t border-white/[0.06] px-6 py-4">
            <p className="text-[10px] text-white/20 uppercase tracking-widest mb-3 font-medium">
              Ask another coaching question
            </p>
            <div className="flex gap-2 flex-wrap">
              {COACHING_ACTIONS.map((action) => (
                <ActionChip
                  key={action.id}
                  action={action}
                  onClick={() => fireAction(action)}
                  disabled={loading}
                />
              ))}
            </div>
            <p className="text-[10px] text-white/15 mt-3 text-center">
              Responses grounded in your mastery data, mistake patterns, and
              knowledge base
            </p>
          </div>
        )}
      </div>

      {/* ── Right sidebar ───────────────────────────────────────────────── */}
      <aside className="hidden xl:flex flex-col w-64 border-l border-white/[0.06] shrink-0">
        {/* AI Memory section */}
        <div className="px-4 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2 mb-1">
            <Lightbulb size={13} className="text-amber-400" />
            <span className="text-xs font-semibold text-white/60">
              AI Memory
            </span>
          </div>
          <p className="text-[11px] text-white/30 leading-relaxed">
            Patterns identified across your sessions.
          </p>
        </div>

        <div className="flex-1 px-4 py-4">
          {weaknesses.length > 0 ? (
            <div className="space-y-2">
              {weaknesses.map((w, i) => (
                <WeaknessPill key={i} w={w} />
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <Brain size={20} className="text-white/12 mx-auto mb-2" />
              <p className="text-[11px] text-white/25 leading-relaxed">
                Use a few coaching actions and I'll start identifying your
                recurring patterns.
              </p>
            </div>
          )}
        </div>

        {/* Quick links */}
        <div className="border-t border-white/[0.06] px-4 py-4">
          <p className="text-[10px] text-white/20 uppercase tracking-widest mb-2.5 font-medium">
            Quick Links
          </p>
          {[
            { label: "Roadmap", href: "/roadmap", icon: TrendingUp },
            { label: "Revision Queue", href: "/revision", icon: RefreshCcw },
            { label: "Practice Test", href: "/denkenstudio", icon: Target },
            { label: "Formulas", href: "/formula", icon: Star },
          ].map(({ label, href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-white/35 hover:text-white/60 hover:bg-white/[0.03] transition-colors"
            >
              <Icon size={12} />
              {label}
            </Link>
          ))}
        </div>
      </aside>
    </div>
  );
}
