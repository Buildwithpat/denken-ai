import { OnboardingProvider }      from '@/context/OnboardingContext';
import { SidebarProvider }          from '@/context/SidebarContext';
import { DenBotProvider }           from '@/context/DenBotContext';
import { AccessProvider }           from '@/context/AccessContext';
import { CommandPaletteProvider }   from '@/context/CommandPaletteContext';
import { AuthGuard }                from '@/components/auth/AuthGuard';
import Sidebar                      from '@/components/Sidebar';
import Topbar                       from '@/components/dashboard/Topbar';
import DenBot                       from '@/components/DenBot';
import CommandPalette               from '@/components/command-palette/CommandPalette';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <AccessProvider>
      <OnboardingProvider>
        <SidebarProvider>
          <DenBotProvider>
          <CommandPaletteProvider>
            <div className="flex h-screen overflow-hidden bg-[#0B0E14]">
              <Sidebar />
              <div className="flex flex-1 flex-col overflow-hidden">
                <Topbar />
                <main className="flex-1 overflow-y-auto">{children}</main>
              </div>
            </div>
            <DenBot />
            <CommandPalette />
          </CommandPaletteProvider>
          </DenBotProvider>
        </SidebarProvider>
      </OnboardingProvider>
      </AccessProvider>
    </AuthGuard>
  );
}
