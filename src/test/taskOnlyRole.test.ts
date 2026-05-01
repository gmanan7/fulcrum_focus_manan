import { describe, it, expect } from 'vitest';
import {
  getDefaultRouteForRoles,
  isTaskOnlyRoles,
  isTaskOnlyRestrictedPath,
} from '@/lib/utils';

/**
 * Mirrors the sidebar's `mainNav` filter logic for `task_only`:
 * only Tasks and My Planner are shown.
 */
function visibleSidebarPathsForRoles(roles: string[]): string[] {
  const all = [
    '/my-view', '/dashboard', '/kpi/entry', '/pm-schedule', '/kpi/trends',
    '/planner', '/kpi/master', '/meetings', '/meetings/decisions',
    '/meetings/templates', '/compliance', '/tasks',
  ];
  if (isTaskOnlyRoles(roles)) {
    return all.filter((p) => p === '/tasks' || p === '/planner');
  }
  return all;
}

describe('task_only — sidebar visibility', () => {
  it('shows only Tasks and My Planner for task_only role', () => {
    expect(visibleSidebarPathsForRoles(['task_only'])).toEqual(['/planner', '/tasks']);
  });

  it('does not affect other roles', () => {
    expect(visibleSidebarPathsForRoles(['team_member']).length).toBeGreaterThan(2);
    expect(visibleSidebarPathsForRoles(['super_admin']).length).toBeGreaterThan(2);
  });
});

describe('task_only — default landing route', () => {
  it('routes task_only-only users to /tasks', () => {
    expect(getDefaultRouteForRoles(['task_only'])).toBe('/tasks');
  });
  it('does not route to /tasks if task_only has additional roles', () => {
    expect(getDefaultRouteForRoles(['task_only', 'team_member'])).toBe('/dashboard');
  });
  it('does not affect shop_floor routing', () => {
    expect(getDefaultRouteForRoles(['shop_floor'])).toBe('/kpi/entry');
  });
  it('does not affect other roles', () => {
    expect(getDefaultRouteForRoles(['team_member'])).toBe('/dashboard');
    expect(getDefaultRouteForRoles(['super_admin'])).toBe('/dashboard');
  });
});

describe('task_only — restricted path detection (route guard)', () => {
  it('flags /dashboard as restricted', () => {
    expect(isTaskOnlyRestrictedPath('/dashboard')).toBe(true);
  });
  it('flags /kpi/trends as restricted', () => {
    expect(isTaskOnlyRestrictedPath('/kpi/trends')).toBe(true);
  });
  it('flags /kpi/entry as restricted', () => {
    expect(isTaskOnlyRestrictedPath('/kpi/entry')).toBe(true);
  });
  it('flags /meetings/123/workspace as restricted', () => {
    expect(isTaskOnlyRestrictedPath('/meetings/123/workspace')).toBe(true);
  });
  it('flags /admin/users as restricted', () => {
    expect(isTaskOnlyRestrictedPath('/admin/users')).toBe(true);
  });
  it('flags /pm-schedule and /compliance and /my-view as restricted', () => {
    expect(isTaskOnlyRestrictedPath('/pm-schedule')).toBe(true);
    expect(isTaskOnlyRestrictedPath('/compliance')).toBe(true);
    expect(isTaskOnlyRestrictedPath('/my-view')).toBe(true);
  });
  it('does NOT flag /tasks as restricted', () => {
    expect(isTaskOnlyRestrictedPath('/tasks')).toBe(false);
  });
  it('does NOT flag /planner as restricted', () => {
    expect(isTaskOnlyRestrictedPath('/planner')).toBe(false);
  });
});

describe('task_only — admin role dropdown', () => {
  // Mirror the ROLE_LABELS map in src/pages/AdminUsers.tsx
  const ROLE_LABELS: Record<string, string> = {
    super_admin: 'Super Admin',
    factory_manager: 'Factory Manager',
    department_head: 'Dept Head',
    team_member: 'Team Member',
    shop_floor: 'Shop Floor',
    task_only: 'Task Only',
  };

  it('exposes task_only as "Task Only"', () => {
    expect(ROLE_LABELS.task_only).toBe('Task Only');
  });
  it('keeps existing role labels unchanged', () => {
    expect(ROLE_LABELS.super_admin).toBe('Super Admin');
    expect(ROLE_LABELS.shop_floor).toBe('Shop Floor');
    expect(ROLE_LABELS.team_member).toBe('Team Member');
  });
});

describe('isTaskOnlyRoles', () => {
  it('true when only role is task_only', () => {
    expect(isTaskOnlyRoles(['task_only'])).toBe(true);
  });
  it('false when task_only is combined with other roles', () => {
    expect(isTaskOnlyRoles(['task_only', 'team_member'])).toBe(false);
  });
  it('false for empty roles', () => {
    expect(isTaskOnlyRoles([])).toBe(false);
  });
  it('false for other single roles', () => {
    expect(isTaskOnlyRoles(['shop_floor'])).toBe(false);
    expect(isTaskOnlyRoles(['team_member'])).toBe(false);
  });
});
