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
      <SidebarContent>
        {/* Brand */}
        {!collapsed && (
          <div className="flex items-center gap-2 px-4 py-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <Factory className="h-4 w-4" />
            </div>
            <span className="text-sm font-bold text-sidebar-foreground">Fulcrum Hub</span>
          </div>
        )}

        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMain.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === '/dashboard'}
                      className="hover:bg-sidebar-accent/50"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
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
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminNav.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className="hover:bg-sidebar-accent/50"
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
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

      <SidebarFooter>
        {!collapsed && profile && (
          <div className="px-2 pb-2">
            <p className="truncate text-sm font-medium text-sidebar-foreground">
              {profile.full_name}
            </p>
            {primaryRole && (
              <Badge variant="secondary" className="mt-1 text-[10px]">
                {roleLabels[primaryRole] || primaryRole}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground"
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
            className="mx-auto text-sidebar-foreground/70 hover:text-sidebar-foreground"
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
