import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard, BarChart3, BookCheck, ListTodo, MoreHorizontal,
  Settings2, ShieldCheck, Users, Building2, ScrollText, TrendingUp, CalendarDays,
  ClipboardList, LogOut, Sun, Moon, Sparkles, BarChart2,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme, type Theme } from '@/hooks/useTheme';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { NavBadge } from '@/components/NavBadge';
import { useNavBadgeCounts } from '@/hooks/useNavBadgeCounts';

const mainItems = [
  { label: 'My View', icon: LayoutDashboard, path: '/my-view' },
  { label: 'Enter KPIs', icon: BarChart3, path: '/kpi/entry' },
  { label: 'My Planner', icon: BookCheck, path: '/planner' },
  { label: 'Tasks', icon: ListTodo, path: '/tasks' },
];

const moreItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', roles: null as string[] | null, requireEng: false },
  { label: 'PM Schedule', icon: ClipboardList, path: '/pm-schedule', roles: null as string[] | null, requireEng: true },
  { label: 'Meetings', icon: CalendarDays, path: '/meetings', roles: ['super_admin', 'factory_manager'], requireEng: false },
  { label: 'Decision Log', icon: ClipboardList, path: '/meetings/decisions', roles: ['super_admin', 'factory_manager'], requireEng: false },
  { label: 'KPI Trends', icon: TrendingUp, path: '/kpi/trends', roles: null as string[] | null, requireEng: false },
  { label: 'KPI Master', icon: Settings2, path: '/kpi/master', roles: ['super_admin', 'factory_manager'], requireEng: false },
  { label: 'Templates', icon: Settings2, path: '/meetings/templates', roles: ['super_admin', 'factory_manager'], requireEng: false },
  { label: 'Compliance', icon: ShieldCheck, path: '/compliance', roles: ['super_admin', 'factory_manager'], requireEng: false },
  { label: 'Users', icon: Users, path: '/admin/users', roles: ['super_admin'], requireEng: false },
  { label: 'Departments', icon: Building2, path: '/admin/departments', roles: ['super_admin'], requireEng: false },
  { label: 'Analytics', icon: BarChart2, path: '/admin/analytics', roles: ['super_admin', 'factory_manager'], requireEng: false },
  { label: 'Audit Log', icon: ScrollText, path: '/admin/audit', roles: ['super_admin'], requireEng: false },
];

const roleLabels: Record<string, string> = {
  super_admin: 'Admin',
  factory_manager: 'Manager',
  department_head: 'Dept Head',
  team_member: 'Member',
  shop_floor: 'Shop Floor',
  task_only: 'Task Only',
};

const themeOptions: { value: Theme; icon: typeof Sun; label: string }[] = [
  { value: 'light', icon: Sun, label: 'Light' },
  { value: 'dark', icon: Moon, label: 'Dark' },
  { value: 'vibrant', icon: Sparkles, label: 'Vibrant' },
];

export function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, roles, hasAnyRole, signOut, user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { taskBoard: taskBoardCount, planner: plannerCount } = useNavBadgeCounts();
  const [moreOpen, setMoreOpen] = useState(false);

  const [isEng, setIsEng] = useState(false);
  useEffect(() => {
    let cancel = false;
    if (!user?.id) { setIsEng(false); return; }
    supabase
      .from('user_departments')
      .select('department:department(code)')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (cancel) return;
        const codes = (data ?? []).map((r: any) => r.department?.code).filter(Boolean);
        setIsEng(codes.includes('ENG'));
      });
    return () => { cancel = true; };
  }, [user?.id]);

  const isShopFloorOnly = roles.length === 1 && roles[0] === 'shop_floor';

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  const canSeePm = hasAnyRole('super_admin', 'factory_manager') || isEng;
  const visibleMore = isShopFloorOnly
    ? [].filter(() => false) // shop_floor: drawer holds identity + sign out only
    : moreItems.filter((item) => {
        if (item.requireEng && !canSeePm) return false;
        return !item.roles || hasAnyRole(...(item.roles as any));
      });
  const primaryRole = roles[0];

  const bottomItems = isShopFloorOnly
    ? [
        { label: 'Enter KPIs', icon: BarChart3, path: '/kpi/entry' },
        { label: 'KPI Trends', icon: TrendingUp, path: '/kpi/trends' },
        { label: 'My Planner', icon: BookCheck, path: '/planner' },
      ]
    : mainItems;

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 safe-area-pb"
        style={{ background: 'var(--bg-card)', borderTop: '1px solid var(--border-card)' }}
      >
        <div className="flex items-stretch justify-around">
          {bottomItems.map((item) => {
            const badge = item.path === '/tasks' ? taskBoardCount : item.path === '/planner' ? plannerCount : 0;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 py-2 px-3 min-h-[52px] flex-1 text-[10px] transition-colors',
                )}
                style={{ color: isActive(item.path) ? 'var(--color-primary)' : 'var(--text-muted)' }}
              >
                <span className="relative inline-flex">
                  <item.icon className="h-5 w-5" />
                  {badge > 0 && <NavBadge count={badge} />}
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
          <button
            onClick={() => setMoreOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 py-2 px-3 min-h-[52px] flex-1 text-[10px] transition-colors"
            style={{ color: moreOpen ? 'var(--color-primary)' : 'var(--text-muted)' }}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span>More</span>
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
          </SheetHeader>

          {/* Nav items grid */}
          <div className="grid grid-cols-3 gap-3 py-4">
            {visibleMore.map((item) => (
              <button
                key={item.path}
                onClick={() => { navigate(item.path); setMoreOpen(false); }}
                className={cn(
                  'flex flex-col items-center gap-1.5 p-3 rounded-xl transition-colors min-h-[72px]',
                )}
                style={{
                  color: isActive(item.path) ? 'var(--color-primary)' : 'var(--text-secondary)',
                  background: isActive(item.path) ? 'var(--rag-green-bg)' : 'transparent',
                }}
              >
                <item.icon className="h-6 w-6" />
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            ))}
          </div>

          <Separator className="my-2" />

          {/* User info */}
          {profile && (
            <div className="py-3 space-y-1">
              <p className="text-sm font-medium text-foreground">{profile.full_name}</p>
              {primaryRole && (
                <Badge variant="secondary" className="text-[10px]">
                  {roleLabels[primaryRole] || primaryRole}
                </Badge>
              )}
            </div>
          )}

          {/* Theme toggle */}
          <div className="flex gap-1 py-2">
            {themeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-medium transition-colors border',
                  theme === opt.value
                    ? 'text-white border-transparent'
                    : 'border-border text-muted-foreground'
                )}
                style={{
                  background: theme === opt.value ? 'var(--color-primary)' : 'transparent',
                }}
              >
                <opt.icon className="h-3.5 w-3.5" />
                {opt.label}
              </button>
            ))}
          </div>

          {/* Sign Out */}
          <button
            onClick={() => { signOut(); setMoreOpen(false); }}
            className="w-full mt-3 mb-2 flex items-center justify-center gap-2 rounded-lg bg-rose-600 text-white py-3 text-sm font-medium active:bg-rose-700 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </SheetContent>
      </Sheet>
    </>
  );
}
