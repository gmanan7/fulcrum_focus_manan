import { format } from 'date-fns';

export type TaskUpdateType =
  | 'status_change'
  | 'comment'
  | 'due_date_change'
  | 'title_change'
  | 'description_change'
  | 'assignee_change';

export interface ActivityItemData {
  type: TaskUpdateType;
  previousStatus?: string | null;
  newStatus?: string | null;
  updateNote?: string | null;
  previousDueDate?: string | null;
  newDueDate?: string | null;
  previousText?: string | null;
  newText?: string | null;
}

function fmtDate(d: string): string {
  // Treat as date-only to avoid timezone shifts
  const [y, m, day] = d.split('-').map(Number);
  return format(new Date(y, (m || 1) - 1, day || 1), 'dd MMM yyyy');
}

/**
 * Returns a short human-readable summary of a task_updates row for the
 * activity feed. The body / comment text is intentionally not included
 * here — comments render in their own quote block.
 */
export function formatActivityItem(
  type: TaskUpdateType,
  previousStatus: string | null | undefined,
  newStatus: string | null | undefined,
  updateNote: string | null | undefined,
  previousDueDate?: string | null,
  newDueDate?: string | null,
  previousText?: string | null,
  newText?: string | null,
): string {
  if (type === 'status_change') {
    const prev = (previousStatus || '—').replace('_', ' ');
    const next = (newStatus || '—').replace('_', ' ');
    return `changed status from ${prev} to ${next}`;
  }
  if (type === 'comment') {
    return updateNote ?? '';
  }
  if (type === 'due_date_change') {
    if (!newDueDate) return 'changed due date';
    if (!previousDueDate) return `set due date to ${fmtDate(newDueDate)}`;
    return `changed due date from ${fmtDate(previousDueDate)} to ${fmtDate(newDueDate)}`;
  }
  if (type === 'title_change') {
    return 'changed the task title';
  }
  if (type === 'description_change') {
    return 'updated the description';
  }
  if (type === 'assignee_change') {
    const next = newText ?? '';
    if (!previousText || previousText === '(unassigned)') {
      return `assigned task to ${next}`;
    }
    return `reassigned task from ${previousText} to ${next}`;
  }
  return '';
}

export function sortActivityOldestFirst<T extends { created_at: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}
