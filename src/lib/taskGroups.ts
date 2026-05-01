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

/** Any authenticated user can create a group. */
export function canCreateGroup(viewerId: string | null): boolean {
  return !!viewerId;
}

/** Only the creator (or super_admin) can rename, delete, or manage members. */
export function canManageGroup(
  group: GroupShape,
  viewerId: string | null,
  viewerRoles: GroupRole[],
): boolean {
  if (!viewerId) return false;
  if (group.created_by === viewerId) return true;
  if (viewerRoles.includes('super_admin')) return true;
  return false;
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
