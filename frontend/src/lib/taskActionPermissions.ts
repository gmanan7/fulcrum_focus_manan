/**
 * Task action permissions — gated by new DB rules.
 *
 * - Status changes (non-closing: open/in_progress/blocked):
 *     owner, creator (assigned_by), same-dept member, HOD of dept,
 *     group leader, admin / factory_manager.
 * - Close (completed/cancelled): ONLY creator (assigned_by), admin /
 *     factory_manager, or group leader of the task's group.
 * - Due date change: same as close.
 * - Field edits (title/assignee/description): creator, admin / factory_manager,
 *     HOD of dept, group leader.
 *
 * Pure utilities — covered by unit tests.
 */
export type ActionRole =
  | 'super_admin'
  | 'factory_manager'
  | 'department_head'
  | 'team_member'
  | 'shop_floor'
  | 'task_only'
  | string;

export interface ActionTask {
  owner_id: string;
  assigned_by: string;
  department_id: string;
  task_group_id?: string | null;
}

export interface ActionContext {
  userId: string;
  roles: ActionRole[];
  /** department_ids the user belongs to */
  userDepartmentIds: string[];
  /** task_group_ids where the user is a group leader (is_leader = true) */
  leaderGroupIds: string[];
}

const isAdmin = (roles: ActionRole[]) =>
  roles.includes('super_admin') || roles.includes('factory_manager');

const isHod = (roles: ActionRole[]) => roles.includes('department_head');

const isGroupLeaderOf = (ctx: ActionContext, task: ActionTask) =>
  !!task.task_group_id && ctx.leaderGroupIds.includes(task.task_group_id);

const isSameDept = (ctx: ActionContext, task: ActionTask) =>
  ctx.userDepartmentIds.includes(task.department_id);

const isHodOfDept = (ctx: ActionContext, task: ActionTask) =>
  isHod(ctx.roles) && isSameDept(ctx, task);

export function canCloseTask(task: ActionTask, ctx: ActionContext): boolean {
  if (isAdmin(ctx.roles)) return true;
  if (task.assigned_by === ctx.userId) return true;
  if (isGroupLeaderOf(ctx, task)) return true;
  return false;
}

export function canChangeDueDate(task: ActionTask, ctx: ActionContext): boolean {
  return canCloseTask(task, ctx);
}

export function canChangeStatus(task: ActionTask, ctx: ActionContext): boolean {
  if (isAdmin(ctx.roles)) return true;
  if (task.owner_id === ctx.userId) return true;
  if (task.assigned_by === ctx.userId) return true;
  if (isSameDept(ctx, task)) return true;
  if (isHodOfDept(ctx, task)) return true;
  if (isGroupLeaderOf(ctx, task)) return true;
  return false;
}

export function canEditFields(task: ActionTask, ctx: ActionContext): boolean {
  if (isAdmin(ctx.roles)) return true;
  if (task.assigned_by === ctx.userId) return true;
  if (isHodOfDept(ctx, task)) return true;
  if (isGroupLeaderOf(ctx, task)) return true;
  return false;
}

export const TOOLTIP_CLOSE =
  'Only the task creator, an admin, or the group leader can close this task';
export const TOOLTIP_DUE_DATE =
  'Only the creator, admin, or group leader can change the due date';
export const TOOLTIP_STATUS =
  'Only the owner, creator, same-department members, HOD, group leader, or admin can change status';
export const TOOLTIP_EDIT =
  'Only the creator, HOD, group leader, or admin can edit this task';
