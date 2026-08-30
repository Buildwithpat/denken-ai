'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, ChevronRight, CheckCheck } from 'lucide-react';
import { useAccess }    from '@/context/AccessContext';
import { useOnboarding } from '@/context/OnboardingContext';
import { fetchAnalytics, type AnalyticsData } from '@/lib/analyticsApi';
import {
  buildNotifications, markReadIds, setCachedUnreadCount, relativeDate,
  type AppNotification,
} from '@/lib/notificationsEngine';

type Tab = 'all' | 'performance' | 'reminder' | 'subscription';

const TABS: { id: Tab; label: string }[] = [
  { id: 'all',          label: 'All'          },
  { id: 'performance',  label: 'Performance'  },
  { id: 'reminder',     label: 'Reminders'    },
  { id: 'subscription', label: 'Subscription' },
];

// ── Notification card ─────────────────────────────────────────────────────────

function NotifCard({ notif }: { notif: AppNotification }) {
  const router = useRouter();
  const Icon   = notif.icon;

  return (
    <div className={[
      'group relative flex flex-col gap-0 rounded-xl border px-5 py-5 transition-all duration-150',
      notif.read
        ? 'border-white/[0.06] bg-white/[0.015] hover:border-white/[0.10] hover:bg-white/[0.025]'
        : 'border-[#8762F7]/20 bg-[#8762F7]/[0.04] hover:border-[#8762F7]/30 hover:bg-[#8762F7]/[0.07]',
    ].join(' ')}>

      {!notif.read && (
        <span className="absolute right-4 top-4 h-1.5 w-1.5 rounded-full bg-[#8762F7]" />
      )}

      <div className="mb-3 flex items-start gap-3">
        <div className={[
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border',
          notif.iconBg,
        ].join(' ')}>
          <Icon size={15} className={notif.iconColor} />
        </div>
        <p className={[
          'pt-1.5 text-sm font-semibold leading-snug',
          notif.read ? 'text-white/75' : 'text-white',
        ].join(' ')}>
          {notif.title}
        </p>
      </div>

      <p className="mb-4 flex-1 text-xs leading-relaxed text-white/40">
        {notif.message}
      </p>

      <div className="mt-auto flex items-center gap-3">
        <span className="text-[10px] text-white/25">
          {relativeDate(notif.createdAt.toISOString())}
        </span>
        {notif.cta && (
          <button
            onClick={() => router.push(notif.cta!.href)}
            className="flex cursor-pointer items-center gap-1 text-[11px] font-medium text-[#8762F7]/70 transition-colors hover:text-[#8762F7]"
          >
            {notif.cta.label}
            <ChevronRight size={11} />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.015] px-5 py-5">
      <div className="mb-3 flex items-start gap-3">
        <div className="h-9 w-9 shrink-0 rounded-lg bg-white/[0.04]" />
        <div className="mt-1.5 h-4 w-2/5 rounded bg-white/[0.04]" />
      </div>
      <div className="mb-2 h-3 w-full rounded bg-white/[0.03]" />
      <div className="h-3 w-3/4 rounded bg-white/[0.03]" />
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ tab, isNewUser }: { tab: Tab; isNewUser: boolean }) {
  const router = useRouter();

  if (tab === 'all' && isNewUser) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-white/[0.07] bg-white/[0.03]">
          <Bell size={20} className="text-white/20" />
        </div>
        <p className="text-sm font-semibold text-white/50">Nothing here yet</p>
        <p className="mt-2 max-w-[300px] text-[12px] leading-relaxed text-white/30">
          Notifications appear automatically as you use the platform. After your first
          test you will see performance alerts, weak-topic warnings, streak milestones,
          and subscription updates here.
        </p>
        <button
          onClick={() => router.push('/denkenstudio')}
          className="mt-6 rounded-lg bg-[#8762F7]/15 px-4 py-2 text-xs font-semibold text-[#8762F7] transition-colors hover:bg-[#8762F7]/25"
        >
          Generate your first test
        </button>
      </div>
    );
  }

  const msgs: Record<Tab, string> = {
    all:          'No notifications right now.',
    performance:  'No performance alerts yet. Complete a test to see insights here.',
    reminder:     'No reminders right now.',
    subscription: 'No subscription alerts.',
  };
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.07] bg-white/[0.03]">
        <Bell size={18} className="text-white/20" />
      </div>
      <p className="text-sm font-medium text-white/35">{msgs[tab]}</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const { isPro, testsExhausted, revisionsExhausted, access } = useAccess();
  const { data: onboarding } = useOnboarding();

  const [activeTab,         setActiveTab]         = useState<Tab>('all');
  const [analytics,         setAnalytics]         = useState<AnalyticsData | null>(null);
  const [analyticsLoading,  setAnalyticsLoading]  = useState(true);
  const [notifications,     setNotifications]     = useState<AppNotification[]>([]);
  const [loading,           setLoading]           = useState(true);

  const ents = access?.entitlements;

  useEffect(() => {
    fetchAnalytics()
      .then(setAnalytics)
      .catch(() => {})
      .finally(() => setAnalyticsLoading(false));
  }, []);

  useEffect(() => {
    if (analyticsLoading || !onboarding) return;

    const notifs = buildNotifications({
      analytics,
      onboarding,
      isPro,
      testsExhausted,
      revisionsExhausted,
      subscriptionStatus: ents?.status ?? null,
      remainingDays:      ents?.remainingDays ?? null,
    });

    setNotifications(notifs);
    setLoading(false);

    // Write unread count to localStorage so Topbar badge stays in sync.
    setCachedUnreadCount(notifs.filter(n => !n.read).length);
  }, [analyticsLoading, analytics, onboarding, isPro, testsExhausted, revisionsExhausted, ents]);

  const filtered    = activeTab === 'all'
    ? notifications
    : notifications.filter(n => n.category === activeTab);

  const unreadCount = notifications.filter(n => !n.read).length;
  const isNewUser   = !analyticsLoading && (analytics?.overview.testsTaken ?? 0) === 0;

  function handleMarkAllRead() {
    markReadIds(notifications.map(n => n.id));
    setCachedUnreadCount(0);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">

      {/* Header */}
      <div className="mb-7 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white">Notifications</h1>
            {unreadCount > 0 && (
              <span className="rounded-full border border-[#8762F7]/30 bg-[#8762F7]/15 px-2.5 py-0.5 text-[11px] font-semibold text-[#8762F7]">
                {unreadCount} new
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-white/35">
            Performance alerts, reminders, and subscription updates
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-xs text-white/40 transition-colors hover:border-white/[0.12] hover:text-white/60"
          >
            <CheckCheck size={12} />
            Mark all read
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 border-b border-white/[0.06] pb-0">
        {TABS.map(tab => {
          const count = tab.id === 'all'
            ? unreadCount
            : notifications.filter(n => n.category === tab.id && !n.read).length;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={[
                'relative cursor-pointer rounded-t px-4 py-2.5 text-xs font-medium transition-all duration-150',
                activeTab === tab.id
                  ? 'text-white after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:rounded-t after:bg-[#8762F7] after:content-[""]'
                  : 'text-white/35 hover:text-white/60',
              ].join(' ')}
            >
              {tab.label}
              {count > 0 && (
                <span className={[
                  'ml-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold',
                  activeTab === tab.id
                    ? 'bg-[#8762F7]/20 text-[#8762F7]'
                    : 'bg-white/[0.07] text-white/35',
                ].join(' ')}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState tab={activeTab} isNewUser={isNewUser} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {filtered.map(notif => (
            <NotifCard key={notif.id} notif={notif} />
          ))}
        </div>
      )}

    </div>
  );
}
