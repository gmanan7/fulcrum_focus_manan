/**
 * Meeting management permissions.
 *
 * - super_admin / factory_manager: full management of any meeting.
 * - department_head: can create meetings; can manage ONLY meetings they created.
 * - All other roles: cannot create or manage meetings (view-only).
 *
 * Pure utilities — covered by Vitest unit tests.
 */
export type MeetingRole =
  | 'super_admin'
  | 'factory_manager'
  | 'department_head'
  | 'team_member'
  | 'shop_floor'
  | 'task_only'
  | string;

export function canCreateMeeting(roles: MeetingRole[]): boolean {
  return roles.some((r) => r === 'super_admin' || r === 'factory_manager' || r === 'department_head');
}

export function canManageMeeting(
  roles: MeetingRole[],
  meetingCreatedBy: string | null | undefined,
  userId: string | null | undefined,
): boolean {
  if (roles.some((r) => r === 'super_admin' || r === 'factory_manager')) return true;
  if (roles.some((r) => r === 'department_head')) {
    return !!userId && meetingCreatedBy === userId;
  }
  return false;
}
