import {
  LayoutDashboard,
  BarChart3,
  Settings2,
  CalendarDays,
  BookCheck,
  ShieldCheck,
  ListTodo,
  Users,
  Building2,
  ScrollText,
  ClipboardList,
  LogOut,
  Factory,
  TrendingUp,
  Sun,
  Moon,
  Sparkles,
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/hooks/useAuth';
import { useTheme, type Theme } from '@/hooks/useTheme';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const mainNav = [
  { title: 'My View', url: '/my-view', icon: LayoutDashboard, roles: null, hideForShopFloor: true },
  { title: 'Dashboard', url: '/dashboard', icon: BarChart3, roles: null, hideForShopFloor: true },
  { title: 'Enter KPIs', url: '/kpi/entry', icon: BarChart3, roles: null, hideForShopFloor: false },
  { title: 'KPI Trends', url: '/kpi/trends', icon: TrendingUp, roles: null, hideForShopFloor: false },
  { title: 'My Planner', url: '/planner', icon: BookCheck, roles: null, hideForShopFloor: false },
  { title: 'KPI Master', url: '/kpi/master', icon: Settings2, roles: ['super_admin', 'factory_manager'] as const, hideForShopFloor: true },
  { title: 'Meetings', url: '/meetings', icon: CalendarDays, roles: ['super_admin', 'factory_manager'] as const, hideForShopFloor: true },
  { title: 'Decision Log', url: '/meetings/decisions', icon: ClipboardList, roles: ['super_admin', 'factory_manager'] as const, hideForShopFloor: true },
  { title: 'Templates', url: '/meetings/templates', icon: Settings2, roles: ['super_admin', 'factory_manager'] as const, hideForShopFloor: true },
  { title: 'Compliance', url: '/compliance', icon: ShieldCheck, roles: ['super_admin', 'factory_manager'] as const, hideForShopFloor: true },
  { title: 'Task Board', url: '/tasks', icon: ListTodo, roles: null, hideForShopFloor: true },
];

const adminNav = [
  { title: 'Users', url: '/admin/users', icon: Users },
  { title: 'Departments', url: '/admin/departments', icon: Building2 },
  { title: 'Audit Log', url: '/admin/audit', icon: ScrollText },
];

const roleLabels: Record<string, string> = {
  super_admin: 'Admin',
  factory_manager: 'Manager',
  department_head: 'Dept Head',
  team_member: 'Member',
  shop_floor: 'Shop Floor',
};

const themeOptions: { value: Theme; icon: typeof Sun; label: string }[] = [
  { value: 'light', icon: Sun, label: 'Light mode' },
  { value: 'dark', icon: Moon, label: 'Dark mode' },
  { value: 'vibrant', icon: Sparkles, label: 'Vibrant mode' },
];

export function AppSidebar() {
  const { profile, roles, signOut, hasRole, hasAnyRole } = useAuth();
  const { theme, setTheme } = useTheme();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const isVibrant = theme === 'vibrant';

  const isShopFloorOnly = roles.length === 1 && roles[0] === 'shop_floor';
  const visibleMain = mainNav.filter(
    (item) => {
      if (isShopFloorOnly && item.hideForShopFloor) return false;
      return !item.roles || hasAnyRole(...(item.roles as any));
    }
  );

  const showAdmin = hasRole('super_admin') && !isShopFloorOnly;
  const primaryRole = roles[0];

  return (
    <Sidebar collapsible="icon">
      <SidebarContent style={{ background: 'var(--bg-sidebar)' }}>
        {/* Brand */}
        {!collapsed && (
          <div className="flex items-center gap-2 px-4 py-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'var(--color-primary)' }}>
              <Factory className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-bold" style={{ color: 'var(--text-sidebar-active)' }}>Fulcrum Hub</span>
          </div>
        )}

        <SidebarGroup>
          <SidebarGroupLabel style={{ color: 'var(--text-muted)' }} className="text-xs uppercase tracking-wider">Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMain.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === '/dashboard'}
                      className="rounded-lg mx-2 sidebar-nav-link"
                      activeClassName={cn('sidebar-nav-active font-medium rounded-lg mx-2', isVibrant ? 'sidebar-active-vibrant' : 'sidebar-active-solid')}
                    >
                      <item.icon className="mr-2 h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {showAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel style={{ color: 'var(--text-muted)' }} className="text-xs uppercase tracking-wider">Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminNav.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className="rounded-lg mx-2 sidebar-nav-link"
                        activeClassName={cn('sidebar-nav-active font-medium rounded-lg mx-2', isVibrant ? 'sidebar-active-vibrant' : 'sidebar-active-solid')}
                      >
                        <item.icon className="mr-2 h-4 w-4 shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter style={{ background: 'var(--bg-sidebar)' }}>
        {/* Theme toggle */}
        {!collapsed && (
          <div className="px-3 pb-2">
            <TooltipProvider delayDuration={200}>
              <div className="flex items-center rounded-lg border p-0.5 gap-0.5" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                {themeOptions.map((opt) => (
                  <Tooltip key={opt.value}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setTheme(opt.value)}
                        className={cn(
                          'flex items-center justify-center rounded-md transition-colors',
                          theme === opt.value ? 'text-white' : 'text-white/40 hover:text-white/70'
                        )}
                        style={{
                          width: 28,
                          height: 28,
                          background: theme === opt.value ? 'var(--color-primary)' : 'transparent',
                        }}
                      >
                        <opt.icon className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top"><p>{opt.label}</p></TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </TooltipProvider>
          </div>
        )}

        {!collapsed && profile && (
          <div className="px-2 pb-2">
            <p className="truncate text-sm font-medium" style={{ color: 'var(--text-sidebar-active)' }}>
              {profile.full_name}
            </p>
            {primaryRole && (
              <Badge className="mt-1 text-[10px] border-0" style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--text-sidebar)' }}>
                {roleLabels[primaryRole] || primaryRole}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 w-full justify-start"
              style={{ color: 'var(--text-sidebar)' }}
              onClick={signOut}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        )}
        {collapsed && (
          <div className="flex flex-col items-center gap-1 pb-2">
            <TooltipProvider delayDuration={200}>
              {themeOptions.map((opt) => (
                <Tooltip key={opt.value}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setTheme(opt.value)}
                      className={cn('flex items-center justify-center rounded-md transition-colors', theme === opt.value ? 'text-white' : 'text-white/40 hover:text-white/70')}
                      style={{ width: 28, height: 28, background: theme === opt.value ? 'var(--color-primary)' : 'transparent' }}
                    >
                      <opt.icon className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right"><p>{opt.label}</p></TooltipContent>
                </Tooltip>
              ))}
            </TooltipProvider>
            <Button
              variant="ghost"
              size="icon"
              className="mx-auto"
              style={{ color: 'var(--text-sidebar)' }}
              onClick={signOut}
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
