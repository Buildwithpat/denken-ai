'use client';

import {
  useEffect, useRef, useState, useMemo, useCallback,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { Search, X, Clock, ArrowRight, Command } from 'lucide-react';

import { useCommandPalette } from '@/context/CommandPaletteContext';
import { useOnboarding }     from '@/context/OnboardingContext';
import { useAccess }         from '@/context/AccessContext';
import { useDenBot }         from '@/context/DenBotContext';
import { useTestConfig }     from '@/context/TestContext';
import { fetchAnalytics, type AnalyticsData } from '@/lib/analyticsApi';
import {
  buildSections, pushRecent, getRecents, clearRecents,
  getMatchRange,
  type CommandItem, type CommandSection, type RecentEntry,
} from '@/lib/commandPalette';
import type { TestExam } from '@/context/TestContext';

// ── Animation variants ────────────────────────────────────────────────────────

const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  show:   { opacity: 1 },
};

const modalVariants: Variants = {
  hidden: { opacity: 0, y: -14, scale: 0.97 },
  show:   { opacity: 1, y: 0,   scale: 1     },
  exit:   { opacity: 0, y: -8,  scale: 0.97  },
};

// ── Highlight ─────────────────────────────────────────────────────────────────

function Highlight({ text, query }: { text: string; query: string }): ReactNode {
  const range = getMatchRange(text, query);
  if (!range) return <>{text}</>;
  const [s, e] = range;
  return (
    <>
      {text.slice(0, s)}
      <mark className="rounded-[2px] bg-[#8762F7]/35 text-white not-italic">
        {text.slice(s, e)}
      </mark>
      {text.slice(e)}
    </>
  );
}

// ── Single result row ─────────────────────────────────────────────────────────

function ResultRow({
  item, query, active, onSelect, onMouseEnter,
}: {
  item:         CommandItem;
  query:        string;
  active:       boolean;
  onSelect:     (item: CommandItem) => void;
  onMouseEnter: () => void;
}) {
  const Icon = item.icon;

  return (
    <button
      onClick={() => onSelect(item)}
      onMouseEnter={onMouseEnter}
      className={[
        'flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors duration-75',
        active ? 'bg-[#8762F7]/12 ring-1 ring-[#8762F7]/20' : 'hover:bg-white/[0.04]',
      ].join(' ')}
    >
      {/* Icon */}
      <div
        className={[
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border',
          active
            ? 'border-[#8762F7]/30 bg-[#8762F7]/15'
            : 'border-white/[0.07] bg-white/[0.03]',
        ].join(' ')}
      >
        <Icon size={14} className={item.iconColor ?? (active ? 'text-[#8762F7]' : 'text-white/40')} />
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-white/85">
          <Highlight text={item.label} query={query} />
        </p>
        {item.description && (
          <p className="truncate text-[11px] text-white/35">
            <Highlight text={item.description} query={query} />
          </p>
        )}
      </div>

      {/* Right meta */}
      <div className="flex shrink-0 items-center gap-2">
        {item.badge && (
          <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-400">
            {item.badge}
          </span>
        )}
        {item.shortcut && (
          <div className="flex items-center gap-1">
            {item.shortcut.map(k => (
              <kbd key={k} className="rounded border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 text-[9px] text-white/30">
                {k}
              </kbd>
            ))}
          </div>
        )}
        {active && (
          <ArrowRight size={12} className="text-[#8762F7]/60" />
        )}
      </div>
    </button>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <p className="mb-1 mt-3 px-3 text-[10px] font-semibold uppercase tracking-widest text-white/25 first:mt-0">
      {label}
    </p>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.07] bg-white/[0.03]">
        <Search size={18} className="text-white/20" />
      </div>
      <p className="text-sm font-medium text-white/40">
        {query ? `No results for "${query}"` : 'Type to search'}
      </p>
      <p className="mt-1 max-w-[220px] text-[11px] leading-relaxed text-white/25">
        {query
          ? 'Try searching for a topic, page, or action'
          : 'Search pages, topics, chapters, and actions'}
      </p>
    </div>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────────

function PaletteFooter({ onClearRecents }: { onClearRecents: () => void }) {
  return (
    <div className="flex items-center justify-between border-t border-white/[0.05] px-4 py-2">
      <div className="flex items-center gap-3.5 text-[10px] text-white/20">
        <span className="flex items-center gap-1">
          <kbd className="rounded border border-white/[0.07] bg-white/[0.03] px-1 py-0.5 font-mono text-[9px]">↑↓</kbd>
          navigate
        </span>
        <span className="flex items-center gap-1">
          <kbd className="rounded border border-white/[0.07] bg-white/[0.03] px-1 py-0.5 font-mono text-[9px]">↵</kbd>
          select
        </span>
        <span className="flex items-center gap-1">
          <kbd className="rounded border border-white/[0.07] bg-white/[0.03] px-1 py-0.5 font-mono text-[9px]">esc</kbd>
          close
        </span>
      </div>
      <button
        onClick={onClearRecents}
        className="text-[10px] text-white/20 transition-colors hover:text-white/40"
      >
        Clear recents
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CommandPalette() {
  const { isOpen, close }         = useCommandPalette();
  const { data: onboarding }      = useOnboarding();
  const { isPro }                 = useAccess();
  const denBot                    = useDenBot();
  const router                    = useRouter();
  const { setTestConfig }         = useTestConfig();

  const [query,     setQuery]     = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [recents,   setRecents]   = useState<RecentEntry[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef  = useRef<HTMLDivElement>(null);

  // Fetch analytics and recents on open; reset state on close.
  useEffect(() => {
    if (isOpen) {
      setRecents(getRecents());
      fetchAnalytics().then(setAnalytics).catch(() => {});
      // Defer focus slightly so AnimatePresence finishes mounting first.
      const t = setTimeout(() => inputRef.current?.focus(), 20);
      return () => clearTimeout(t);
    } else {
      setQuery('');
      setActiveIdx(0);
    }
  }, [isOpen]);

  // Build sections from current state.
  const sections: CommandSection[] = useMemo(
    () => buildSections(query, onboarding, analytics, isPro, recents),
    [query, onboarding, analytics, isPro, recents],
  );

  // Flat ordered list for keyboard navigation.
  const allItems = useMemo(() => sections.flatMap(s => s.items), [sections]);

  // Reset active index whenever the result set changes.
  useEffect(() => { setActiveIdx(0); }, [query]);

  // Scroll the active row into view.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-active="true"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  // Execute a selected item.
  const selectItem = useCallback((item: CommandItem) => {
    pushRecent({ id: item.id, label: item.label, href: item.href, action: item.action, actionData: item.actionData });

    if (item.href) {
      router.push(item.href);
    } else if (item.action === 'topic') {
      const d = item.actionData as { subject: string; topic: string; exam: string };
      setTestConfig({
        mode:      'normal',
        exam:      d.exam.toUpperCase() as TestExam,
        subject:   d.subject,
        chapter:   d.topic,
        questions: 20,
        time:      30,
      });
      router.push('/tests');
    } else if (item.action === 'upgrade') {
      router.push('/pricing');
    } else if (item.action === 'denbot') {
      denBot.open();
    }

    close();
  }, [router, setTestConfig, denBot, close]);

  // Keyboard navigation — Escape, arrows, Enter.
  // Input's own keydown handles it; we also install a window listener for
  // arrow / enter so the user doesn't have to keep the input focused.
  const handleKeyDown = useCallback((e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => (i + 1) % Math.max(allItems.length, 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => (i - 1 + Math.max(allItems.length, 1)) % Math.max(allItems.length, 1));
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const item = allItems[activeIdx];
      if (item) selectItem(item);
    }
  }, [allItems, activeIdx, selectItem, close]);

  function handleClearRecents() {
    clearRecents();
    setRecents([]);
  }

  // Build a flat index so each row knows its absolute position.
  let globalIdx = 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* ── Backdrop ── */}
          <motion.div
            className="fixed inset-0 z-[80] bg-black/55 backdrop-blur-[2px]"
            variants={backdropVariants}
            initial="hidden"
            animate="show"
            exit="hidden"
            transition={{ duration: 0.15 }}
            onClick={close}
          />

          {/* ── Modal ── */}
          <motion.div
            className="fixed left-1/2 top-[10vh] z-[81] w-full max-w-xl -translate-x-1/2 px-4"
            variants={modalVariants}
            initial="hidden"
            animate="show"
            exit="exit"
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            <div className="overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0F1219] shadow-[0_32px_80px_rgba(0,0,0,0.7)] ring-1 ring-white/[0.04]">

              {/* ── Search input ── */}
              <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3.5">
                <Search size={15} className="shrink-0 text-white/35" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search pages, topics, actions…"
                  spellCheck={false}
                  className="flex-1 bg-transparent text-[14px] text-white placeholder-white/25 outline-none"
                />
                <div className="flex shrink-0 items-center gap-2">
                  {query ? (
                    <button
                      onClick={() => { setQuery(''); inputRef.current?.focus(); }}
                      className="rounded p-0.5 text-white/25 transition-colors hover:text-white/60"
                    >
                      <X size={14} />
                    </button>
                  ) : (
                    <div className="hidden items-center gap-1 sm:flex">
                      <kbd className="flex h-5 w-5 items-center justify-center rounded border border-white/[0.08] bg-white/[0.04] text-[9px] text-white/25">
                        <Command size={9} />
                      </kbd>
                      <kbd className="flex h-5 items-center rounded border border-white/[0.08] bg-white/[0.04] px-1.5 text-[9px] text-white/25">
                        K
                      </kbd>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Results ── */}
              <div ref={listRef} className="max-h-[54vh] overflow-y-auto px-2 py-2 [&::-webkit-scrollbar]:hidden">
                {sections.length === 0 ? (
                  <EmptyState query={query} />
                ) : (
                  sections.map(section => {
                    const sectionStart = globalIdx;
                    globalIdx += section.items.length;
                    return (
                      <div key={section.id}>
                        <SectionHeader label={section.label} />
                        {section.items.map((item, i) => {
                          const itemIdx = sectionStart + i;
                          const active  = itemIdx === activeIdx;
                          return (
                            <div key={item.id} data-active={active}>
                              <ResultRow
                                item={item}
                                query={query}
                                active={active}
                                onSelect={selectItem}
                                onMouseEnter={() => setActiveIdx(itemIdx)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    );
                  })
                )}
              </div>

              {/* ── Footer ── */}
              <PaletteFooter onClearRecents={handleClearRecents} />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
