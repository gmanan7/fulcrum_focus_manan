import {
  LayoutDashboard,
  BarChart3,
  Settings2,
  CalendarDays,
  ShieldCheck,
  ListTodo,
  Users,
  Building2,
  ScrollText,
  LogOut,
  Factory,
  TrendingUp,
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/hooks/useAuth';
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

const mainNav = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard, roles: null },
  { title: 'Enter KPIs', url: '/kpi/entry', icon: BarChart3, roles: null },
  { title: 'KPI Trends', url: '/kpi/trends', icon: TrendingUp, roles: ['super_admin', 'factory_manager'] as const },
  { title: 'KPI Master', url: '/kpi/master', icon: Settings2, roles: ['super_admin', 'factory_manager'] as const },
  { title: 'Meetings', url: '/meetings', icon: CalendarDays, roles: ['super_admin', 'factory_manager'] as const },
  { title: 'Templates', url: '/meetings/templates', icon: Settings2, roles: ['super_admin', 'factory_manager'] as const },
  { title: 'Compliance', url: '/compliance', icon: ShieldCheck, roles: ['super_admin', 'factory_manager'] as const },
  { title: 'Task Board', url: '/tasks', icon: ListTodo, roles: null },
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
};

export function AppSidebar() {
  const { profile, roles, signOut, hasRole, hasAnyRole } = useAuth();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  const visibleMain = mainNav.filter(
    (item) => !item.roles || hasAnyRole(...(item.roles as any))
  );

  const showAdmin = hasRole('super_admin');
  const primaryRole = roles[0];

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="bg-sidebar-background">
        {/* Brand */}
        {!collapsed && (
          <div className="flex items-center gap-2 px-4 py-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
              <Factory className="h-4 w-4" />
            </div>
            <span className="text-sm font-bold text-white">Fulcrum Hub</span>
          </div>
        )}

        <SidebarGroup>
          <SidebarGroupLabel className="text-slate-500 text-xs uppercase tracking-wider">Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMain.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === '/dashboard'}
                      className="text-slate-300 hover:bg-slate-800 rounded-lg mx-2"
                      activeClassName="bg-blue-600 text-white font-medium rounded-lg mx-2"
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
            <SidebarGroupLabel className="text-slate-500 text-xs uppercase tracking-wider">Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminNav.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className="text-slate-300 hover:bg-slate-800 rounded-lg mx-2"
                        activeClassName="bg-blue-600 text-white font-medium rounded-lg mx-2"
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

      <SidebarFooter className="bg-sidebar-background">
        {!collapsed && profile && (
          <div className="px-2 pb-2">
            <p className="truncate text-sm font-medium text-white">
              {profile.full_name}
            </p>
            {primaryRole && (
              <Badge className="mt-1 text-[10px] bg-slate-700 text-slate-300 border-0">
                {roleLabels[primaryRole] || primaryRole}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 w-full justify-start text-slate-400 hover:text-white hover:bg-slate-800"
              onClick={signOut}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        )}
        {collapsed && (
          <Button
            variant="ghost"
            size="icon"
            className="mx-auto text-slate-400 hover:text-white hover:bg-slate-800"
            onClick={signOut}
            title="Sign Out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
