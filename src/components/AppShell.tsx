import { Outlet } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTheme } from '@/hooks/useTheme';

export function AppShell() {
  const isMobile = useIsMobile();
  // Just ensure the theme hook is initialized at app level
  useTheme();

  return (
    <SidebarProvider defaultOpen={!isMobile}>
      <div className="min-h-[100dvh] flex w-full">
        {!isMobile && <AppSidebar />}
        <div className="flex-1 flex flex-col min-w-0">
          <header
            className="sticky top-0 z-30 flex h-14 items-center gap-2 px-4"
            style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-card)' }}
          >
            {!isMobile && <SidebarTrigger />}
            <span className="text-sm font-semibold md:hidden" style={{ color: 'var(--text-primary)' }}>Fulcrum Hub</span>
          </header>
          <main className={`flex-1 p-4 md:p-6 overflow-auto page-bg ${isMobile ? 'pb-20' : ''}`}>
            <Outlet />
          </main>
        </div>
        {isMobile && <MobileBottomNav />}
      </div>
    </SidebarProvider>
  );
}
