'use client';

import { Atom, FlaskConical, Calculator, Leaf, BookOpen, Target, type LucideIcon } from 'lucide-react';
import type { WeakTopic } from '@/lib/analyticsApi';

/* ─── Item shape ─────────────────────────────────────────────────────────── */

interface FocusItem {
  topic:   string;
  subject: string;
  status:  'Improving' | 'Needs Attention';
  icon:    LucideIcon;
}

function iconFor(subject: string): LucideIcon {
  const s = subject.toLowerCase();
  if (s.includes('physics'))     return Atom;
  if (s.includes('chemistry'))   return FlaskConical;
  if (s.includes('mathematics') || s.includes('math')) return Calculator;
  if (s.includes('biology') || s.includes('zoology'))  return Leaf;
  return BookOpen;
}

/* ─── Props ──────────────────────────────────────────────────────────────── */

interface Props {
  weakTopics?: WeakTopic[] | null;
}

export default function FocusAreas({ weakTopics }: Props) {
  const hasTopics = weakTopics && weakTopics.length > 0;

  const items: FocusItem[] = hasTopics
    ? weakTopics.slice(0, 3).map(wt => ({
        topic:   wt.topic,
        subject: wt.subject,
        status:  (wt.accuracy < 60 ? 'Needs Attention' : 'Improving') as 'Needs Attention' | 'Improving',
        icon:    iconFor(wt.subject),
      }))
    : [];

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-md transition-shadow duration-200 hover:shadow-[0_0_24px_rgba(135,98,247,0.07)]">
      <h2 className="mb-4 text-sm font-semibold text-white">Focus Areas</h2>

      {!hasTopics ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03]">
            <Target size={18} className="text-white/20" />
          </div>
          <p className="text-sm font-medium text-white/40">No focus areas yet</p>
          <p className="mt-1 max-w-[200px] text-[11px] leading-relaxed text-white/25">
            Complete your first test to see which topics need attention.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const Icon = item.icon;
            const needsAttn = item.status === 'Needs Attention';
            return (
              <li
                key={item.topic}
                className="flex items-center gap-3 rounded-lg bg-white/[0.03] px-3.5 py-3 transition-colors hover:bg-white/[0.055]"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.05]">
                  <Icon size={14} className="text-white/45" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white/90">{item.topic}</p>
                  <p className="truncate text-[11px] text-white/35">{item.subject}</p>
                </div>
                <span
                  className={[
                    'shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-medium tracking-wide',
                    needsAttn
                      ? 'bg-rose-500/12 text-rose-400'
                      : 'bg-emerald-500/12 text-emerald-400',
                  ].join(' ')}
                >
                  {item.status}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
