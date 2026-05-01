import { format, differenceInCalendarDays } from 'date-fns';

export interface TaskExportInput {
  id: string;
  title: string;
  status: string;
  priority?: string | null;
  due_date?: string | null;
  created_at?: string | null;
  is_private?: boolean | null;
  task_group_id?: string | null;
  owner_id?: string | null;
  created_by?: string | null;
  owner?: { full_name?: string | null } | null;
  dept?: { name?: string | null } | null;
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  blocked: 'Blocked',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const PRIORITY_LABELS: Record<string, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const STATUS_SORT_ORDER = ['open', 'in_progress', 'blocked', 'completed', 'cancelled'];

export function formatDateDDMMYYYY(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return format(d, 'dd/MM/yyyy');
}

export function calculateDaysOverdue(
  dueDate: string | null | undefined,
  status: string,
  reference: Date = new Date(),
): number | '' {
  if (!dueDate) return '';
  if (status === 'completed' || status === 'cancelled') return '';
  const d = new Date(dueDate);
  if (Number.isNaN(d.getTime())) return '';
  const days = differenceInCalendarDays(reference, d);
  return days > 0 ? days : '';
}

export interface TaskExportRow {
  'Task Title': string;
  Status: string;
  Priority: string;
  Department: string;
  'Assigned To': string;
  'Assigned By': string;
  'Due Date': string;
  'Created Date': string;
  'Days Overdue': number | '';
  'Due Date Changes': number;
  'Group/Team': string;
  Private: 'Yes' | 'No';
}

export function buildTaskExportRow(
  task: TaskExportInput,
  opts: {
    pushCounts?: Map<string, number> | null;
    groupNameById?: Map<string, string> | null;
    userNameById?: Map<string, string> | null;
    reference?: Date;
  } = {},
): TaskExportRow {
  const { pushCounts, groupNameById, userNameById, reference } = opts;
  const assignedTo = task.owner?.full_name
    ?? (task.owner_id ? userNameById?.get(task.owner_id) ?? '' : '');
  const assignedBy = task.created_by ? userNameById?.get(task.created_by) ?? '' : '';
  const groupName = task.task_group_id ? groupNameById?.get(task.task_group_id) ?? '' : '';
  return {
    'Task Title': task.title ?? '',
    Status: STATUS_LABELS[task.status] ?? task.status ?? '',
    Priority: task.priority ? PRIORITY_LABELS[task.priority] ?? task.priority : '',
    Department: task.dept?.name ?? '',
    'Assigned To': assignedTo,
    'Assigned By': assignedBy,
    'Due Date': formatDateDDMMYYYY(task.due_date),
    'Created Date': formatDateDDMMYYYY(task.created_at),
    'Days Overdue': calculateDaysOverdue(task.due_date, task.status, reference),
    'Due Date Changes': pushCounts?.get(task.id) ?? 0,
    'Group/Team': groupName,
    Private: task.is_private ? 'Yes' : 'No',
  };
}

export function sortTasksForExport<T extends { status: string; due_date?: string | null }>(
  tasks: T[],
): T[] {
  return [...tasks].sort((a, b) => {
    const ai = STATUS_SORT_ORDER.indexOf(a.status);
    const bi = STATUS_SORT_ORDER.indexOf(b.status);
    const sa = ai === -1 ? 999 : ai;
    const sb = bi === -1 ? 999 : bi;
    if (sa !== sb) return sa - sb;
    const da = a.due_date ? new Date(a.due_date).getTime() : Number.POSITIVE_INFINITY;
    const db = b.due_date ? new Date(b.due_date).getTime() : Number.POSITIVE_INFINITY;
    return da - db;
  });
}

export function generateTaskFilename(date: Date = new Date()): string {
  return `Tasks_${format(date, 'dd-MMM-yyyy')}_FulcrumFocus.xlsx`;
}
