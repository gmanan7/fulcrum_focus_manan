export interface CarryoverTaskLike {
  id: string;
  status?: string | null;
}

export const CARRYOVER_FILTER_STORAGE_KEY = 'fulcrum-carryover-filter';

/**
 * A task is a carryover if its due date has been changed at least once
 * (i.e. its id is present in the due-date-change history) AND the task is
 * not completed or cancelled.
 */
export function isCarryover<T extends CarryoverTaskLike>(
  task: T,
  historyTaskIds: Set<string> | string[]
): boolean {
  if (!task || !task.id) return false;
  if (task.status === 'completed' || task.status === 'cancelled') return false;
  const set = historyTaskIds instanceof Set ? historyTaskIds : new Set(historyTaskIds);
  return set.has(task.id);
}

export function filterCarryoverTasks<T extends CarryoverTaskLike>(
  tasks: T[],
  historyTaskIds: Set<string> | string[]
): T[] {
  const set = historyTaskIds instanceof Set ? historyTaskIds : new Set(historyTaskIds);
  return tasks.filter((t) => isCarryover(t, set));
}

/**
 * Build a Map of task_id → number of due_date_change rows.
 * Input rows are typically rows from task_updates already filtered by
 * update_type = 'due_date_change'.
 */
export function buildPushCountMap(
  rows: Array<{ task_id: string }> | null | undefined
): Map<string, number> {
  const map = new Map<string, number>();
  if (!rows) return map;
  for (const r of rows) {
    if (!r || !r.task_id) continue;
    map.set(r.task_id, (map.get(r.task_id) ?? 0) + 1);
  }
  return map;
}

/**
 * Difference in whole days between two ISO date strings (YYYY-MM-DD).
 * Returns current - original. Negative values are clamped to 0 for display
 * purposes by callers that need it; this function returns the raw delta.
 */
export function calculateDaysSlipped(
  originalISO: string | null | undefined,
  currentISO: string | null | undefined
): number {
  if (!originalISO || !currentISO) return 0;
  const a = new Date(originalISO + 'T00:00:00Z').getTime();
  const b = new Date(currentISO + 'T00:00:00Z').getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86400000);
}
