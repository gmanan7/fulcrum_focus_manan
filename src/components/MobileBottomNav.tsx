import { useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { LayoutDashboard, BarChart3, CalendarDays, ListTodo, MoreHorizontal, Settings2, ShieldCheck, Users, Building2, ScrollText, TrendingUp } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

const mainItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { label: 'KPIs', icon: BarChart3, path: '/kpi/entry' },
  { label: 'Meetings', icon: CalendarDays, path: '/meetings' },
  { label: 'Tasks', icon: ListTodo, path: '/tasks' },
];

const moreItems = [
  { label: 'KPI Trends', icon: TrendingUp, path: '/kpi/trends', roles: ['super_admin', 'factory_manager'] },
  { label: 'KPI Master', icon: Settings2, path: '/kpi/master', roles: ['super_admin', 'factory_manager'] },
  { label: 'Templates', icon: Settings2, path: '/meetings/templates', roles: ['super_admin', 'factory_manager'] },
  { label: 'Compliance', icon: ShieldCheck, path: '/compliance', roles: ['super_admin', 'factory_manager'] },
  { label: 'Users', icon: Users, path: '/admin/users', roles: ['super_admin'] },
  { label: 'Departments', icon: Building2, path: '/admin/departments', roles: ['super_admin'] },
  { label: 'Audit Log', icon: ScrollText, path: '/admin/audit', roles: ['super_admin'] },
];

export function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { hasAnyRole } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  const visibleMore = moreItems.filter((item) => !item.roles || hasAnyRole(...(item.roles as any)));

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 backdrop-blur-sm safe-area-pb">
        <div className="flex items-stretch justify-around">
          {mainItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 py-2 px-3 min-h-[52px] flex-1 text-[10px] transition-colors',
                isActive(item.path) ? 'text-blue-600' : 'text-slate-400',
              )}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </button>
          ))}
          <button
            onClick={() => setMoreOpen(true)}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 py-2 px-3 min-h-[52px] flex-1 text-[10px] transition-colors',
              moreOpen ? 'text-blue-600' : 'text-slate-400',
            )}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span>More</span>
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-3 gap-3 py-4">
            {visibleMore.map((item) => (
              <button
                key={item.path}
                onClick={() => { navigate(item.path); setMoreOpen(false); }}
                className={cn(
                  'flex flex-col items-center gap-1.5 p-3 rounded-xl transition-colors min-h-[72px]',
                  isActive(item.path) ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50',
                )}
              >
                <item.icon className="h-6 w-6" />
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
