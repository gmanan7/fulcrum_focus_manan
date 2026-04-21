/**
 * Task update permission rules:
 * - super_admin / factory_manager: can update ANY task
 * - department_head: can update tasks where they own OR assigned the task
 * - team_member / shop_floor: can only update tasks where they are the owner
 *
 * Pure utility — covered by unit tests.
 */
export type TaskPermissionRole =
  | 'super_admin'
  | 'factory_manager'
  | 'department_head'
  | 'team_member'
  | 'shop_floor'
  | string;

export interface TaskForPermission {
  owner_id: string;
  assigned_by?: string | null;
}

export function canUpdateTask(
  task: TaskForPermission,
  userId: string,
  userRole: TaskPermissionRole,
): boolean {
  if (userRole === 'super_admin' || userRole === 'factory_manager') return true;
  if (userRole === 'department_head') {
    return task.owner_id === userId || task.assigned_by === userId;
  }
  return task.owner_id === userId;
}

/**
 * When the user holds multiple roles, grant update if ANY role allows it.
 */
export function canUpdateTaskAnyRole(
  task: TaskForPermission,
  userId: string,
  userRoles: TaskPermissionRole[],
): boolean {
  return userRoles.some((r) => canUpdateTask(task, userId, r));
}

export const TASK_UPDATE_FORBIDDEN_TOOLTIP =
  'Only the task owner or assigner can update this task';
