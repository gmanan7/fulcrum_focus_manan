import { Outlet } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { useIsMobile } from '@/hooks/use-mobile';

export function AppShell() {
  const isMobile = useIsMobile();

  return (
    <SidebarProvider defaultOpen={!isMobile}>
      <div className="min-h-[100dvh] flex w-full">
        {!isMobile && <AppSidebar />}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-slate-200 bg-white px-4">
            {!isMobile && <SidebarTrigger />}
            <span className="text-sm font-semibold text-slate-800 md:hidden">Fulcrum Hub</span>
          </header>
          <main className={`flex-1 p-4 md:p-6 overflow-auto ${isMobile ? 'pb-20' : ''}`}>
            <Outlet />
          </main>
        </div>
        {isMobile && <MobileBottomNav />}
      </div>
    </SidebarProvider>
  );
}
