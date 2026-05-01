export interface CarryoverTaskLike {
  id: string;
  status?: string | null;
}

export const CARRYOVER_FILTER_STORAGE_KEY = 'fulcrum-carryover-filter';

/**
 * A task is a carryover if its due date has been changed at least once
 * (i.e. its id is present in task_due_date_history) AND the task is not
 * completed or cancelled.
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
