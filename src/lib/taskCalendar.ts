import { addDays, format, isSameDay, startOfDay } from 'date-fns';

export type CalendarTaskState = 'overdue' | 'today' | 'future' | 'closed';

export interface CalendarTaskLike {
  id: string;
  status?: string | null;
  due_date?: string | null;
  owner_id?: string | null;
  department_id?: string | null;
  owner?: { full_name?: string | null } | null;
  dept?: { name?: string | null } | null;
}

/** Build N consecutive date columns starting from `start` (inclusive). */
export function getDateColumns(start: Date, days: number): Date[] {
  const base = startOfDay(start);
  const out: Date[] = [];
  for (let i = 0; i < days; i++) out.push(addDays(base, i));
  return out;
}

/** Default window: today - 3 .. today + (days - 4). */
export function getDefaultWindowStart(today: Date, _days: number): Date {
  return addDays(startOfDay(today), -3);
}

export function isWeekend(d: Date): boolean {
  const dow = d.getDay();
  return dow === 0 || dow === 6;
}

export function getTaskState(
  task: CalendarTaskLike,
  today: Date
): CalendarTaskState {
  if (task.status === 'completed' || task.status === 'cancelled') return 'closed';
  if (!task.due_date) return 'future';
  const due = startOfDay(new Date(task.due_date + 'T00:00:00'));
  const t = startOfDay(today);
  if (due.getTime() < t.getTime()) return 'overdue';
  if (isSameDay(due, t)) return 'today';
  return 'future';
}

/** Returns YYYY-MM-DD for keying tasks by date column. */
export function dateKey(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

export interface CalendarOwnerGroup {
  ownerId: string;
  ownerName: string;
  tasks: CalendarTaskLike[];
}

export interface CalendarDeptGroup {
  deptId: string;
  deptName: string;
  owners: CalendarOwnerGroup[];
}

/**
 * Group tasks first by department, then by owner. Departments and owners
 * with zero tasks (after upstream filtering) are not returned.
 */
export function groupTasksByDeptAndOwner(
  tasks: CalendarTaskLike[]
): CalendarDeptGroup[] {
  const deptMap = new Map<string, CalendarDeptGroup>();
  for (const t of tasks) {
    const deptId = t.department_id || '__none__';
    const deptName = t.dept?.name || 'No Department';
    let dept = deptMap.get(deptId);
    if (!dept) {
      dept = { deptId, deptName, owners: [] };
      deptMap.set(deptId, dept);
    }
    const ownerId = t.owner_id || '__none__';
    const ownerName = t.owner?.full_name || 'Unassigned';
    let owner = dept.owners.find((o) => o.ownerId === ownerId);
    if (!owner) {
      owner = { ownerId, ownerName, tasks: [] };
      dept.owners.push(owner);
    }
    owner.tasks.push(t);
  }
  // Sort: dept name, then owner name
  const out = Array.from(deptMap.values()).sort((a, b) =>
    a.deptName.localeCompare(b.deptName)
  );
  for (const d of out) d.owners.sort((a, b) => a.ownerName.localeCompare(b.ownerName));
  return out;
}

/** Tasks for a given owner+date key. */
export function tasksForCell(
  owner: CalendarOwnerGroup,
  key: string
): CalendarTaskLike[] {
  return owner.tasks.filter((t) => t.due_date === key);
}

/** Filter tasks whose due_date falls inside the visible columns. */
export function filterTasksInRange(
  tasks: CalendarTaskLike[],
  columns: Date[]
): CalendarTaskLike[] {
  if (columns.length === 0) return [];
  const keys = new Set(columns.map(dateKey));
  return tasks.filter((t) => t.due_date && keys.has(t.due_date));
}
