/**
 * Pure helpers for the read-only Task Overview (admin) page.
 * Kept tiny and dependency-free so they can be unit-tested.
 */

export type AdminAccessRole =
  | 'super_admin'
  | 'factory_manager'
  | 'department_head'
  | 'team_member'
  | 'shop_floor'
  | 'task_only';

export function canAccessTaskOverview(roles: AdminAccessRole[] | null | undefined): boolean {
  if (!roles || roles.length === 0) return false;
  return roles.some((r) => r === 'super_admin' || r === 'factory_manager');
}

export type VisibilityKind = 'public' | 'private' | 'group';

export interface VisibilityShape {
  is_private?: boolean | null;
  task_group_id?: string | null;
}

export function getVisibilityKind(task: VisibilityShape | null | undefined): VisibilityKind {
  if (!task) return 'public';
  if (task.is_private) return 'private';
  if (task.task_group_id) return 'group';
  return 'public';
}

export type VisibilityFilter = 'all' | 'public' | 'private' | 'group';

export function matchesVisibilityFilter(
  task: VisibilityShape,
  filter: VisibilityFilter,
): boolean {
  if (filter === 'all') return true;
  return getVisibilityKind(task) === filter;
}
