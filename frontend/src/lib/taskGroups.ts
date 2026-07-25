/**
 * Sub-team / Task Group helper logic — pure & testable.
 *
 * Mirrors the RLS rules so the UI can reason about visibility & manageability
 * without round-tripping the DB.
 */

export const GROUP_FILTER_STORAGE_KEY = 'fulcrum-group-filter';

export const GROUP_COLOR_PRESETS: { name: string; value: string }[] = [
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Rose', value: '#f43f5e' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Green', value: '#10b981' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Slate', value: '#64748b' },
];

export type GroupRole = 'super_admin' | 'factory_manager' | string;

export interface GroupShape {
  id: string;
  created_by: string;
}

export interface GroupTaskShape {
  task_group_id: string | null;
  is_private?: boolean;
  assigned_by?: string;
  owner_id?: string;
}

/**
 * Whether a viewer can see a group-scoped task.
 * Mirrors the group branch of the tasks_read RLS policy.
 */
export function canSeeGroupTask(
  task: GroupTaskShape,
  viewerId: string | null,
  viewerRoles: GroupRole[],
  memberGroupIds: Set<string>,
): boolean {
  if (!viewerId) return false;
  if (!task.task_group_id) return true; // not a group-scoped task
  if (viewerRoles.includes('super_admin') || viewerRoles.includes('factory_manager')) return true;
  return memberGroupIds.has(task.task_group_id);
}

/**
 * Only super_admin, factory_manager, and department_head can create groups.
 */
export function canCreateGroup(
  viewerId: string | null,
  viewerRoles: GroupRole[] = [],
): boolean {
  if (!viewerId) return false;
  return (
    viewerRoles.includes('super_admin') ||
    viewerRoles.includes('factory_manager') ||
    viewerRoles.includes('department_head')
  );
}

/** Only super_admin and factory_manager can delete groups. */
export function canDeleteGroup(
  viewerId: string | null,
  viewerRoles: GroupRole[],
): boolean {
  if (!viewerId) return false;
  return (
    viewerRoles.includes('super_admin') ||
    viewerRoles.includes('factory_manager')
  );
}

/**
 * Member management (add/remove):
 * - super_admin and factory_manager can manage any group
 * - department_head can only manage groups they created
 * - Everyone else cannot manage members
 */
export function canManageGroupMembers(
  group: GroupShape,
  viewerId: string | null,
  viewerRoles: GroupRole[],
): boolean {
  if (!viewerId) return false;
  if (
    viewerRoles.includes('super_admin') ||
    viewerRoles.includes('factory_manager')
  ) {
    return true;
  }
  if (viewerRoles.includes('department_head') && group.created_by === viewerId) {
    return true;
  }
  return false;
}

/**
 * Who can mark/unmark a member as group leader.
 * - super_admin and factory_manager
 * - the group creator
 * Group leaders themselves CANNOT promote others.
 */
export function canManageLeaders(
  group: GroupShape,
  viewerId: string | null,
  viewerRoles: GroupRole[],
): boolean {
  if (!viewerId) return false;
  if (
    viewerRoles.includes('super_admin') ||
    viewerRoles.includes('factory_manager')
  ) {
    return true;
  }
  return group.created_by === viewerId;
}

export interface LeaderSortMember {
  is_leader?: boolean;
  profile?: { full_name?: string | null } | null;
  user_id?: string;
}

/** Sort: leaders first, then regular; alphabetical within each group. */
export function sortMembersLeadersFirst<T extends LeaderSortMember>(members: T[]): T[] {
  const name = (m: T) => (m.profile?.full_name ?? '').toLowerCase();
  return [...members].sort((a, b) => {
    const al = a.is_leader ? 1 : 0;
    const bl = b.is_leader ? 1 : 0;
    if (al !== bl) return bl - al;
    return name(a).localeCompare(name(b));
  });
}

/**
 * Whether the viewer can rename the group.
 * Same rules as managing members — super_admin/factory_manager always,
 * department_head only for groups they created.
 */
export function canManageGroup(
  group: GroupShape,
  viewerId: string | null,
  viewerRoles: GroupRole[],
): boolean {
  return canManageGroupMembers(group, viewerId, viewerRoles);
}

/**
 * Whether a group should appear in the "Visible to" selector when creating a task.
 * - super_admin / factory_manager see all groups
 * - shop_floor / task_only never see groups
 * - others only see groups they belong to
 */
export function canPickGroupForTask(
  group: GroupShape,
  viewerId: string | null,
  viewerRoles: GroupRole[],
  memberGroupIds: Set<string>,
): boolean {
  if (!viewerId) return false;
  if (viewerRoles.includes('shop_floor') || viewerRoles.includes('task_only')) {
    return false;
  }
  if (
    viewerRoles.includes('super_admin') ||
    viewerRoles.includes('factory_manager')
  ) {
    return true;
  }
  return memberGroupIds.has(group.id);
}

export type VisibilityChoice = 'everyone' | 'private' | string; // string = group id

export interface VisibilityFlags {
  is_private: boolean;
  task_group_id: string | null;
}

/**
 * Translate the unified "Visible to" choice into the two DB columns.
 *  - 'everyone' → public, no group
 *  - 'private'  → is_private=true, no group
 *  - groupId    → public (is_private=false), task_group_id=groupId
 */
export function taskVisibility(choice: VisibilityChoice): VisibilityFlags {
  if (choice === 'everyone') return { is_private: false, task_group_id: null };
  if (choice === 'private') return { is_private: true, task_group_id: null };
  return { is_private: false, task_group_id: choice };
}

/**
 * Whether to show the "owner is not in selected group" warning in Create Task.
 * - Only relevant when visibility is a specific group id (not 'everyone'/'private').
 * - True when ownerId is set, visibility is a group id, and ownerId is NOT in groupMemberIds.
 */
export function shouldWarnOwnerNotInGroup(
  visibility: VisibilityChoice,
  ownerId: string | null | undefined,
  groupMemberIds: Set<string> | null | undefined,
): boolean {
  if (!ownerId) return false;
  if (visibility === 'everyone' || visibility === 'private') return false;
  if (!groupMemberIds) return false;
  return !groupMemberIds.has(ownerId);
}

/** Truncate a group name for display in a pill (max 12 chars + ellipsis). */
export function truncateGroupName(name: string, max = 12): string {
  if (!name) return '';
  return name.length <= max ? name : `${name.slice(0, max - 1)}…`;
}
