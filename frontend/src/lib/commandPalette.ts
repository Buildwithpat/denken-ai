/**
 * Command palette — types, fuzzy engine, static catalog, recent-item store.
 *
 * All section-building logic lives here so the UI component stays thin and
 * future phases (backend search, AI embeddings) only need to inject extra
 * CommandSections without touching the renderer.
 */

import {
  LayoutDashboard, Sparkles, ClipboardList, RefreshCcw,
  BarChart3, Target, GraduationCap, CalendarDays,
  Bell, User, Atom, FlaskConical, Calculator, Leaf,
  BookOpen, Zap, Crown, type LucideIcon,
} from 'lucide-react';
import type { OnboardingData } from '@/context/OnboardingContext';
import type { WeakTopic, AnalyticsData } from '@/lib/analyticsApi';

// ── Core types ────────────────────────────────────────────────────────────────

export type CommandItemSource = 'nav' | 'action' | 'topic' | 'analytic' | 'recent';

export interface CommandItem {
  id:           string;
  label:        string;
  description?: string;
  icon:         LucideIcon;
  iconColor?:   string;
  section:      string;
  keywords:     string[];
  /** Navigate to this path when selected. */
  href?:        string;
  /**
   * String action key — handled by the palette component so actions can call
   * router / context hooks. Mutually exclusive with href.
   * Format: simple key, e.g. 'upgrade' | 'denbot' | 'topic'
   */
  action?:      string;
  /** Arbitrary payload for the action handler. */
  actionData?:  unknown;
  badge?:       string;
  shortcut?:    string[];
  source:       CommandItemSource;
}

export interface CommandSection {
  id:    string;
  label: string;
  items: CommandItem[];
}

// ── Fuzzy engine ──────────────────────────────────────────────────────────────

function fuzzyInOrder(str: string, q: string): boolean {
  let qi = 0;
  for (let i = 0; i < str.length && qi < q.length; i++) {
    if (str[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

export function scoreItem(item: CommandItem, query: string): number {
  const q     = query.toLowerCase().trim();
  if (!q) return 0;
  const label = item.label.toLowerCase();
  const desc  = item.description?.toLowerCase() ?? '';
  const kws   = item.keywords.map(k => k.toLowerCase());

  if (label === q)                               return 100;
  if (label.startsWith(q))                       return  90;
  if (label.includes(q))                         return  82;
  if (desc.includes(q))                          return  70;
  if (kws.some(k => k === q))                    return  68;
  if (kws.some(k => k.startsWith(q)))            return  65;
  if (kws.some(k => k.includes(q)))              return  60;
  if (fuzzyInOrder(label, q))                    return  50;
  if (kws.some(k => fuzzyInOrder(k, q)))         return  35;
  return 0;
}

export function filterAndRank(items: CommandItem[], query: string): CommandItem[] {
  if (!query.trim()) return items;
  return items
    .map(it => ({ it, s: scoreItem(it, query) }))
    .filter(({ s }) => s > 0)
    .sort((a, b) => b.s - a.s)
    .map(({ it }) => it);
}

/**
 * Returns [start, end] indices of the first occurrence of query inside text
 * (case-insensitive), or null when not found.
 */
export function getMatchRange(text: string, query: string): [number, number] | null {
  const q = query.trim();
  if (!q) return null;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return null;
  return [idx, idx + q.length];
}

// ── Recent items (localStorage) ───────────────────────────────────────────────

const RECENT_KEY = 'denken_palette_recents';
const RECENT_MAX = 6;

export interface RecentEntry {
  id:        string;
  label:     string;
  href?:     string;
  action?:   string;
  actionData?: unknown;
  timestamp: number;
}

export function getRecents(): RecentEntry[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as RecentEntry[]) : [];
  } catch { return []; }
}

export function pushRecent(entry: Omit<RecentEntry, 'timestamp'>): void {
  try {
    const next: RecentEntry[] = [
      { ...entry, timestamp: Date.now() },
      ...getRecents().filter(r => r.id !== entry.id),
    ].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {}
}

export function clearRecents(): void {
  try { localStorage.removeItem(RECENT_KEY); } catch {}
}

// ── Static catalogs ───────────────────────────────────────────────────────────

/** Primary sidebar navigation items. */
export const NAV_ITEMS: CommandItem[] = [
  {
    id: 'nav-dashboard', label: 'Dashboard', description: 'Overview of your preparation',
    icon: LayoutDashboard, href: '/dashboard', section: 'nav',
    keywords: ['home', 'overview', 'stats'], source: 'nav',
  },
  {
    id: 'nav-studio', label: 'DenkenStudio', description: 'Generate AI-powered tests',
    icon: Sparkles, href: '/denkenstudio', section: 'nav',
    keywords: ['studio', 'generate', 'create test', 'ai test', 'build'], source: 'nav',
  },
  {
    id: 'nav-tests', label: 'Tests', description: 'Browse and attempt tests',
    icon: ClipboardList, href: '/tests', section: 'nav',
    keywords: ['attempt', 'practice', 'mock', 'quiz'], source: 'nav',
  },
  {
    id: 'nav-revision', label: 'Revision Center', description: 'Smart notes, PYQs, and rapid drills',
    icon: RefreshCcw, href: '/revision', section: 'nav',
    keywords: ['revise', 'notes', 'pyq', 'drill', 'formula', 'previous year'], source: 'nav',
  },
  {
    id: 'nav-analysis', label: 'Analysis', description: 'Deep-dive into your performance metrics',
    icon: BarChart3, href: '/analysis', section: 'nav',
    keywords: ['analytics', 'performance', 'report', 'accuracy', 'metrics', 'chart'], source: 'nav',
  },
  {
    id: 'nav-focus', label: 'Focus Areas', description: 'Your personalised weak-topic breakdown',
    icon: Target, href: '/focus', section: 'nav',
    keywords: ['weak', 'focus', 'priority', 'improve', 'topics'], source: 'nav',
  },
  {
    id: 'nav-planner', label: 'Study Planner', description: 'AI-generated weekly study plan',
    icon: CalendarDays, href: '/planner', section: 'nav',
    keywords: ['plan', 'schedule', 'week', 'timetable', 'routine'], source: 'nav',
  },
  {
    id: 'nav-readiness', label: 'Readiness Score', description: 'Exam readiness assessment',
    icon: GraduationCap, href: '/readiness', section: 'nav',
    keywords: ['readiness', 'score', 'exam ready', 'assessment', 'gauge'], source: 'nav',
  },
  {
    id: 'nav-notifications', label: 'Notifications', description: 'Alerts and performance updates',
    icon: Bell, href: '/notifications', section: 'nav',
    keywords: ['alerts', 'updates', 'bell', 'messages'], source: 'nav',
  },
  {
    id: 'nav-profile', label: 'Profile & Settings', description: 'Manage your account and preferences',
    icon: User, href: '/profile', section: 'nav',
    keywords: ['account', 'settings', 'profile', 'edit', 'subscription'], source: 'nav',
  },
];

/** Exam-specific nav item (only shown when exam is jee or neet). */
export const EXAM_MODE_ITEM: CommandItem = {
  id: 'nav-exam', label: 'Exam Mode', description: 'Full-length exam simulation',
  icon: GraduationCap, href: '/exam', section: 'nav',
  keywords: ['exam mode', 'full test', 'simulation', 'mock exam'], source: 'nav',
};

/** Quick action items. */
export const ACTION_ITEMS: CommandItem[] = [
  {
    id: 'action-create-test', label: 'Create Test', description: 'Generate a new AI-powered test',
    icon: Sparkles, iconColor: 'text-[#8762F7]', href: '/denkenstudio', section: 'action',
    keywords: ['new test', 'generate', 'build test', 'start test', 'create'], source: 'action',
  },
  {
    id: 'action-revision', label: 'Start Revision', description: 'Open the Revision Center',
    icon: RefreshCcw, iconColor: 'text-violet-400', href: '/revision', section: 'action',
    keywords: ['revise', 'notes', 'review', 'study'], source: 'action',
  },
  {
    id: 'action-planner', label: 'Open Planner', description: 'View your AI study schedule',
    icon: CalendarDays, iconColor: 'text-blue-400', href: '/planner', section: 'action',
    keywords: ['schedule', 'week', 'plan', 'routine'], source: 'action',
  },
  {
    id: 'action-upgrade', label: 'Upgrade to Pro', description: 'Unlock unlimited tests and AI features',
    icon: Crown, iconColor: 'text-amber-400', action: 'upgrade', section: 'action',
    badge: 'Pro', keywords: ['upgrade', 'pro', 'premium', 'subscribe', 'unlock'], source: 'action',
  },
];

// ── Topic catalog ─────────────────────────────────────────────────────────────

interface TopicEntry { topic: string; subject: string; exam: string; }

const JEE_TOPICS: TopicEntry[] = [
  // Physics
  { topic: 'Kinematics',                  subject: 'Physics',     exam: 'JEE' },
  { topic: 'Laws of Motion',              subject: 'Physics',     exam: 'JEE' },
  { topic: 'Work, Energy & Power',        subject: 'Physics',     exam: 'JEE' },
  { topic: 'Rotational Motion',           subject: 'Physics',     exam: 'JEE' },
  { topic: 'Gravitation',                 subject: 'Physics',     exam: 'JEE' },
  { topic: 'Thermodynamics',              subject: 'Physics',     exam: 'JEE' },
  { topic: 'Waves',                       subject: 'Physics',     exam: 'JEE' },
  { topic: 'Electrostatics',              subject: 'Physics',     exam: 'JEE' },
  { topic: 'Current Electricity',         subject: 'Physics',     exam: 'JEE' },
  { topic: 'Magnetic Effects of Current', subject: 'Physics',     exam: 'JEE' },
  { topic: 'Electromagnetic Induction',   subject: 'Physics',     exam: 'JEE' },
  { topic: 'Optics',                      subject: 'Physics',     exam: 'JEE' },
  { topic: 'Modern Physics',              subject: 'Physics',     exam: 'JEE' },
  { topic: 'Semiconductors',              subject: 'Physics',     exam: 'JEE' },
  // Chemistry
  { topic: 'Atomic Structure',            subject: 'Chemistry',   exam: 'JEE' },
  { topic: 'Chemical Bonding',            subject: 'Chemistry',   exam: 'JEE' },
  { topic: 'Periodic Table & Properties', subject: 'Chemistry',   exam: 'JEE' },
  { topic: 'Mole Concept & Stoichiometry',subject: 'Chemistry',   exam: 'JEE' },
  { topic: 'States of Matter',            subject: 'Chemistry',   exam: 'JEE' },
  { topic: 'Thermochemistry',             subject: 'Chemistry',   exam: 'JEE' },
  { topic: 'Equilibrium',                 subject: 'Chemistry',   exam: 'JEE' },
  { topic: 'Electrochemistry',            subject: 'Chemistry',   exam: 'JEE' },
  { topic: 'Chemical Kinetics',           subject: 'Chemistry',   exam: 'JEE' },
  { topic: 'Organic Chemistry Basics',    subject: 'Chemistry',   exam: 'JEE' },
  { topic: 'Organic Reactions',           subject: 'Chemistry',   exam: 'JEE' },
  { topic: 'Aromatic Compounds',          subject: 'Chemistry',   exam: 'JEE' },
  { topic: 'Coordination Compounds',      subject: 'Chemistry',   exam: 'JEE' },
  { topic: 'Polymers',                    subject: 'Chemistry',   exam: 'JEE' },
  { topic: 'Biomolecules',                subject: 'Chemistry',   exam: 'JEE' },
  // Mathematics
  { topic: 'Sets, Relations & Functions', subject: 'Mathematics', exam: 'JEE' },
  { topic: 'Complex Numbers',             subject: 'Mathematics', exam: 'JEE' },
  { topic: 'Quadratic Equations',         subject: 'Mathematics', exam: 'JEE' },
  { topic: 'Sequences & Series',          subject: 'Mathematics', exam: 'JEE' },
  { topic: 'Permutations & Combinations', subject: 'Mathematics', exam: 'JEE' },
  { topic: 'Binomial Theorem',            subject: 'Mathematics', exam: 'JEE' },
  { topic: 'Probability',                 subject: 'Mathematics', exam: 'JEE' },
  { topic: 'Matrices & Determinants',     subject: 'Mathematics', exam: 'JEE' },
  { topic: 'Trigonometry',               subject: 'Mathematics', exam: 'JEE' },
  { topic: 'Inverse Trigonometry',       subject: 'Mathematics', exam: 'JEE' },
  { topic: 'Coordinate Geometry',        subject: 'Mathematics', exam: 'JEE' },
  { topic: 'Conic Sections',             subject: 'Mathematics', exam: 'JEE' },
  { topic: 'Limits & Continuity',        subject: 'Mathematics', exam: 'JEE' },
  { topic: 'Differentiation',            subject: 'Mathematics', exam: 'JEE' },
  { topic: 'Applications of Derivatives',subject: 'Mathematics', exam: 'JEE' },
  { topic: 'Integration',               subject: 'Mathematics', exam: 'JEE' },
  { topic: 'Differential Equations',    subject: 'Mathematics', exam: 'JEE' },
  { topic: 'Vectors & 3D Geometry',     subject: 'Mathematics', exam: 'JEE' },
];

const NEET_TOPICS: TopicEntry[] = [
  // Physics
  { topic: 'Kinematics',                  subject: 'Physics',   exam: 'NEET' },
  { topic: 'Laws of Motion',              subject: 'Physics',   exam: 'NEET' },
  { topic: 'Thermodynamics',              subject: 'Physics',   exam: 'NEET' },
  { topic: 'Optics',                      subject: 'Physics',   exam: 'NEET' },
  { topic: 'Electrostatics',              subject: 'Physics',   exam: 'NEET' },
  { topic: 'Current Electricity',         subject: 'Physics',   exam: 'NEET' },
  { topic: 'Modern Physics',              subject: 'Physics',   exam: 'NEET' },
  // Chemistry
  { topic: 'Atomic Structure',            subject: 'Chemistry', exam: 'NEET' },
  { topic: 'Chemical Bonding',            subject: 'Chemistry', exam: 'NEET' },
  { topic: 'Organic Chemistry Basics',    subject: 'Chemistry', exam: 'NEET' },
  { topic: 'Organic Reactions',           subject: 'Chemistry', exam: 'NEET' },
  { topic: 'Electrochemistry',            subject: 'Chemistry', exam: 'NEET' },
  { topic: 'Chemical Kinetics',           subject: 'Chemistry', exam: 'NEET' },
  { topic: 'Biomolecules',                subject: 'Chemistry', exam: 'NEET' },
  // Biology
  { topic: 'Cell Structure & Division',   subject: 'Biology',   exam: 'NEET' },
  { topic: 'Genetics & Heredity',         subject: 'Biology',   exam: 'NEET' },
  { topic: 'Evolution',                   subject: 'Biology',   exam: 'NEET' },
  { topic: 'Human Physiology',            subject: 'Biology',   exam: 'NEET' },
  { topic: 'Plant Physiology',            subject: 'Biology',   exam: 'NEET' },
  { topic: 'Reproduction',               subject: 'Biology',   exam: 'NEET' },
  { topic: 'Ecology & Environment',       subject: 'Biology',   exam: 'NEET' },
  { topic: 'Biotechnology',              subject: 'Biology',   exam: 'NEET' },
  { topic: 'Animal Kingdom',             subject: 'Zoology',   exam: 'NEET' },
  { topic: 'Plant Kingdom',              subject: 'Botany',    exam: 'NEET' },
];

function iconForSubject(subject: string): LucideIcon {
  const s = subject.toLowerCase();
  if (s.includes('physics'))                          return Atom;
  if (s.includes('chemistry'))                        return FlaskConical;
  if (s.includes('math'))                             return Calculator;
  if (s.includes('biology') || s.includes('botany')) return Leaf;
  if (s.includes('zoology'))                          return Leaf;
  return BookOpen;
}

function topicColorForSubject(subject: string): string {
  const s = subject.toLowerCase();
  if (s.includes('physics'))    return 'text-blue-400';
  if (s.includes('chemistry'))  return 'text-green-400';
  if (s.includes('math'))       return 'text-amber-400';
  return 'text-violet-400';
}

function buildTopicItems(entries: TopicEntry[]): CommandItem[] {
  return entries.map(e => ({
    id:          `topic-${e.exam}-${e.subject}-${e.topic}`.replace(/\s+/g, '-').toLowerCase(),
    label:       e.topic,
    description: `${e.subject} · Practice ${e.topic}`,
    icon:        iconForSubject(e.subject),
    iconColor:   topicColorForSubject(e.subject),
    section:     'topic',
    keywords:    [e.subject.toLowerCase(), e.exam.toLowerCase(), 'chapter', 'practice', 'test'],
    action:      'topic',
    actionData:  { subject: e.subject, topic: e.topic, exam: e.exam },
    source:      'topic' as CommandItemSource,
  }));
}

export const JEE_TOPIC_ITEMS  = buildTopicItems(JEE_TOPICS);
export const NEET_TOPIC_ITEMS = buildTopicItems(NEET_TOPICS);
export const ALL_TOPIC_ITEMS  = [...JEE_TOPIC_ITEMS, ...NEET_TOPIC_ITEMS];

// ── Section builders ──────────────────────────────────────────────────────────

function weakTopicToItem(wt: WeakTopic, idx: number): CommandItem {
  return {
    id:          `weak-${idx}-${wt.topic}`.replace(/\s+/g, '-').toLowerCase(),
    label:       wt.topic,
    description: `${wt.subject} · ${wt.accuracy}% accuracy — needs attention`,
    icon:        iconForSubject(wt.subject),
    iconColor:   'text-rose-400',
    section:     'analytic',
    keywords:    [wt.subject.toLowerCase(), 'weak', 'improve', 'practice'],
    action:      'topic',
    actionData:  { subject: wt.subject, topic: wt.topic, exam: 'JEE' },
    source:      'analytic',
  };
}

/**
 * Build the ordered list of CommandSections for the palette.
 *
 * Phase 1 — local-only. Future phases inject extra sections here without
 * touching the renderer.
 */
export function buildSections(
  query:      string,
  onboarding: OnboardingData,
  analytics:  AnalyticsData | null,
  isPro:      boolean,
  recents:    RecentEntry[],
): CommandSection[] {
  const q       = query.trim();
  const examType = onboarding.examType;

  // Pick the topic catalog for this user's exam
  const topicItems = examType === 'neet' ? NEET_TOPIC_ITEMS
    : examType === 'jee'                 ? JEE_TOPIC_ITEMS
    : ALL_TOPIC_ITEMS;

  // Nav items — include Exam Mode only for jee/neet users
  const navItems = examType === 'jee' || examType === 'neet'
    ? [...NAV_ITEMS, EXAM_MODE_ITEM]
    : NAV_ITEMS;

  // Hide Upgrade action for pro users
  const actionItems = isPro
    ? ACTION_ITEMS.filter(a => a.id !== 'action-upgrade')
    : ACTION_ITEMS;

  // ── Empty query: show recents + navigation + actions ──────────────────────
  if (!q) {
    const sections: CommandSection[] = [];

    if (recents.length > 0) {
      sections.push({
        id: 'recent', label: 'Recent',
        items: recents.map(r => ({
          id:          `recent-${r.id}`,
          label:       r.label,
          icon:        BookOpen,
          iconColor:   'text-white/35',
          section:     'recent',
          keywords:    [],
          href:        r.href,
          action:      r.action,
          actionData:  r.actionData,
          source:      'recent' as CommandItemSource,
        })),
      });
    }

    sections.push({ id: 'nav',    label: 'Quick Navigation', items: navItems.slice(0, 7) });
    sections.push({ id: 'action', label: 'Quick Actions',    items: actionItems });
    return sections;
  }

  // ── With query: filter everything and assemble matching sections ──────────
  const sections: CommandSection[] = [];

  const filteredNav     = filterAndRank(navItems,     q);
  const filteredActions = filterAndRank(actionItems,  q);
  const filteredTopics  = filterAndRank(topicItems,   q).slice(0, 8);

  const weakItems: CommandItem[] = analytics?.weakTopics
    ? analytics.weakTopics.slice(0, 6).map(weakTopicToItem)
    : [];
  const filteredWeak = filterAndRank(weakItems, q);

  if (filteredNav.length)     sections.push({ id: 'nav',    label: 'Pages',          items: filteredNav });
  if (filteredWeak.length)    sections.push({ id: 'weak',   label: 'Your Weak Topics', items: filteredWeak });
  if (filteredTopics.length)  sections.push({ id: 'topic',  label: 'Topics & Chapters', items: filteredTopics });
  if (filteredActions.length) sections.push({ id: 'action', label: 'Quick Actions',   items: filteredActions });

  return sections;
}
