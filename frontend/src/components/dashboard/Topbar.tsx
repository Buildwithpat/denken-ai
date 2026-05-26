'use client';

import { Bell, Search, Menu, Bot, Command } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSidebar }        from '@/context/SidebarContext';
import { useDenBot }         from '@/context/DenBotContext';
import { useCommandPalette } from '@/context/CommandPaletteContext';
import { useAccess }         from '@/context/AccessContext';
import { hasUrgentSubscriptionSignal } from '@/lib/notificationsEngine';

export default function Topbar() {
  const { open }    = useSidebar();
  const router      = useRouter();
  const denBot      = useDenBot();
  const { open: openPalette } = useCommandPalette();
  const { isPro, testsExhausted, revisionsExhausted, access } = useAccess();

  const ents      = access?.entitlements;
  const hasUrgent = hasUrgentSubscriptionSignal({
    testsExhausted,
    revisionsExhausted,
    subscriptionStatus: ents?.status ?? null,
    isPro,
    remainingDays:      ents?.remainingDays ?? null,
  });

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#0B0E14] px-6">
      {/* Left: hamburger (mobile) + command palette trigger */}
      <div className="flex items-center gap-3">
        <button
          onClick={open}
          className="lg:hidden cursor-pointer rounded-lg p-2 text-white/40 transition-colors hover:bg-white/[0.05] hover:text-white/70"
        >
          <Menu size={18} />
        </button>

        {/* Command palette trigger — looks like a search bar, acts as a button */}
        <button
          onClick={openPalette}
          className="group flex w-[220px] items-center gap-2.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white/30 transition-all duration-150 hover:border-[#8762F7]/30 hover:bg-[#8762F7]/[0.04] hover:text-white/50 md:w-[300px] lg:w-[400px]"
        >
          <Search size={14} className="shrink-0 text-white/25 transition-colors group-hover:text-[#8762F7]/60" />
          <span className="flex-1 text-left text-[13px]">Search anything…</span>
          <div className="hidden items-center gap-1 sm:flex">
            <kbd className="flex h-5 w-5 items-center justify-center rounded border border-white/[0.08] bg-white/[0.04] text-[9px] text-white/20 group-hover:border-[#8762F7]/20 group-hover:text-[#8762F7]/50">
              <Command size={9} />
            </kbd>
            <kbd className="flex h-5 items-center rounded border border-white/[0.08] bg-white/[0.04] px-1.5 text-[9px] text-white/20 group-hover:border-[#8762F7]/20 group-hover:text-[#8762F7]/50">
              K
            </kbd>
          </div>
        </button>
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        <button
          onClick={denBot.toggle}
          title="DenBot — interactive guide"
          className={[
            'cursor-pointer rounded-lg p-2 transition-colors',
            denBot.isOpen
              ? 'bg-[#8762F7]/15 text-[#8762F7]'
              : 'text-white/35 hover:bg-white/[0.05] hover:text-white/70',
          ].join(' ')}
        >
          <Bot size={17} />
        </button>

        <button
          onClick={() => router.push('/notifications')}
          className="relative cursor-pointer rounded-lg p-2 text-white/35 transition-colors hover:bg-white/[0.05] hover:text-white/70"
        >
          <Bell size={17} />
          {hasUrgent && (
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-amber-400" />
          )}
        </button>
      </div>
    </header>
  );
}
