import { format, differenceInCalendarDays, parseISO, isToday } from 'date-fns';

export type TaskSortKey = 'created_desc' | 'created_asc' | 'due_asc' | 'due_desc';

export const TASK_SORT_STORAGE_KEY = 'fulcrum-task-sort';

/**
 * Format a task's due date for card display.
 * - null/undefined → null (render nothing)
 * - past (and not yet overdue-handled by status) → "Overdue by N day(s)"
 * - today → "Due today"
 * - future → "Due: D MMM" (e.g. "Due: 14 Apr")
 */
export function formatDueDate(dueDate: string | null | undefined, today: Date = new Date()): string | null {
  if (!dueDate) return null;
  const due = typeof dueDate === 'string' ? parseISO(dueDate) : dueDate;
  if (isNaN(due.getTime())) return null;

  const t = new Date(today);
  t.setHours(0, 0, 0, 0);
  const d = new Date(due);
  d.setHours(0, 0, 0, 0);

  const diff = differenceInCalendarDays(d, t);
  if (diff < 0) {
    const n = Math.abs(diff);
    return `Overdue by ${n} day${n === 1 ? '' : 's'}`;
  }
  if (diff === 0 || isToday(d)) return 'Due today';
  return `Due: ${format(d, 'd MMM')}`;
}

export type DueTone = 'overdue' | 'today' | 'future' | null;

export function getDueTone(dueDate: string | null | undefined, today: Date = new Date()): DueTone {
  if (!dueDate) return null;
  const due = parseISO(dueDate);
  if (isNaN(due.getTime())) return null;
  const t = new Date(today); t.setHours(0, 0, 0, 0);
  const d = new Date(due); d.setHours(0, 0, 0, 0);
  const diff = differenceInCalendarDays(d, t);
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  return 'future';
}

interface SortableTask {
  created_at?: string | null;
  due_date?: string | null;
}

/**
 * Sort tasks by chosen key. Pure — does not mutate input.
 * - due_asc: nulls last
 * - due_desc: nulls first
 */
export function sortTasks<T extends SortableTask>(tasks: T[], key: TaskSortKey): T[] {
  const arr = [...tasks];
  switch (key) {
    case 'created_desc':
      return arr.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    case 'created_asc':
      return arr.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
    case 'due_asc':
      return arr.sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      });
    case 'due_desc':
      return arr.sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return -1;
        if (!b.due_date) return 1;
        return b.due_date.localeCompare(a.due_date);
      });
  }
}

export const TASK_SORT_OPTIONS: { value: TaskSortKey; label: string }[] = [
  { value: 'created_desc', label: 'Newest first' },
  { value: 'created_asc', label: 'Oldest first' },
  { value: 'due_asc', label: 'Due date ↑' },
  { value: 'due_desc', label: 'Due date ↓' },
];
