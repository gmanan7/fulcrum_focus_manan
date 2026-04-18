import { Outlet } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { getUserInitials, getUserDisplayName } from '@/lib/userDisplay';

export function AppShell() {
  const isMobile = useIsMobile();
  useTheme();
  const { profile } = useAuth();
  const displayName = getUserDisplayName(profile);
  const initials = getUserInitials(profile?.full_name);

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
            {isMobile && profile && (
              <div className="ml-auto flex items-center gap-2 min-w-0">
                <span
                  className="truncate max-w-[140px] text-xs"
                  style={{ color: 'var(--text-muted)' }}
                  title={displayName}
                >
                  {displayName}
                </span>
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                  style={{ background: 'var(--color-primary)' }}
                  aria-label={`Signed in as ${displayName}`}
                >
                  {initials}
                </div>
              </div>
            )}
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
