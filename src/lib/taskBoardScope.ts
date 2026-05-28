/**
 * Main Task Board scoping — applies to ALL users (incl. super_admin and
 * factory_manager). Admins keep DB-level visibility of every task for the
 * /admin/tasks overview, but the main /tasks board uses this scope so it
 * isn't cluttered with private/group tasks they're not part of.
 *
 * A task is on a viewer's main board when ANY of:
 *  - it is fully public (is_private=false AND task_group_id IS NULL)
 *  - the viewer owns it (owner_id === me)
 *  - the viewer created/assigned it (assigned_by === me)
 *  - it is a group task AND viewer is a member of that group
 *
 * Private tasks of others and group tasks for groups you aren't in are
 * filtered out — even for admin/WM.
 */
export interface BoardScopeTask {
  is_private?: boolean | null;
  task_group_id?: string | null;
  owner_id?: string | null;
  assigned_by?: string | null;
}

export function isOnMyBoard(
  task: BoardScopeTask,
  viewerId: string | null | undefined,
  myGroupIds: Set<string> | null | undefined,
): boolean {
  if (!viewerId) return false;

  const isPrivate = !!task.is_private;
  const groupId = task.task_group_id ?? null;
  const isMine = task.owner_id === viewerId;
  const isCreator = task.assigned_by === viewerId;

  // Public, ungrouped → everyone sees it
  if (!isPrivate && !groupId) return true;

  // Owned or created by me → always visible to me
  if (isMine || isCreator) return true;

  // Group task → only if I'm a member of that group
  if (groupId) {
    return !!myGroupIds && myGroupIds.has(groupId);
  }

  // Private task that's not mine → hidden
  return false;
}

export function scopeTasksToMyBoard<T extends BoardScopeTask>(
  tasks: T[] | null | undefined,
  viewerId: string | null | undefined,
  myGroupIds: Set<string> | null | undefined,
): T[] {
  if (!tasks) return [];
  return tasks.filter((t) => isOnMyBoard(t, viewerId, myGroupIds));
}
