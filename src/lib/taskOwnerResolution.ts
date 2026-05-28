/**
 * Helpers for resolving the owner list and derived department_id when a task
 * is being created/edited under a group visibility.
 *
 * Rules:
 * - Group visibility ⇒ owner list = all members of that group (any dept)
 * - department_id is derived from the owner's primary department; if the
 *   owner has none, fall back to the creator's primary department.
 * - Everyone/Private ⇒ owner list keeps being driven by the selected dept.
 */

export interface UserDeptRow {
  user_id: string;
  department_id: string;
  is_primary: boolean;
}

/** Return the user's primary department id, or first available, or null. */
export function primaryDeptFor(userId: string, rows: UserDeptRow[] | null | undefined): string | null {
  if (!userId || !rows?.length) return null;
  const mine = rows.filter((r) => r.user_id === userId);
  if (!mine.length) return null;
  const primary = mine.find((r) => r.is_primary);
  return (primary ?? mine[0]).department_id;
}

/**
 * Resolve the department_id for a task being created/edited under group
 * visibility. Prefers owner's primary dept, falls back to creator's primary
 * dept. Returns null if neither is available (caller should block submit).
 */
export function resolveTaskDepartmentId(args: {
  ownerId: string | null | undefined;
  ownerDeptRows: UserDeptRow[] | null | undefined;
  creatorId: string | null | undefined;
  creatorDeptRows: UserDeptRow[] | null | undefined;
}): string | null {
  return (
    primaryDeptFor(args.ownerId ?? '', args.ownerDeptRows) ??
    primaryDeptFor(args.creatorId ?? '', args.creatorDeptRows) ??
    null
  );
}
