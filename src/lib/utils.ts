import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { subDays, parseISO, format } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Returns the day before the meeting's scheduled date as 'yyyy-MM-dd'.
 * T4 meetings review the previous day's KPI performance.
 */
export function getMeetingKpiReportingDate(meetingScheduledDate: string): string {
  return format(subDays(parseISO(meetingScheduledDate), 1), 'yyyy-MM-dd');
}

/**
 * Returns the default landing route based on user roles.
 * shop_floor-only users go to /kpi/entry; everyone else goes to /dashboard.
 */
export function getDefaultRouteForRoles(roles: string[]): string {
  if (roles.length === 1 && roles[0] === 'shop_floor') {
    return '/kpi/entry';
  }
  return '/dashboard';
}

/**
 * Determines the status category of a decision based on its linked task.
 */
export type DecisionTaskStatus = 'resolved' | 'overdue' | 'active' | 'no_task';

/**
 * Returns true if a task is overdue: due_date < today and not completed/cancelled.
 */
export function isTaskOverdue(task: { due_date: string; status: string }): boolean {
  if (task.status === 'completed' || task.status === 'cancelled') return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(task.due_date + 'T00:00:00');
  return due < today;
}

/**
 * Returns true if a task is due today and not completed/cancelled.
 */
export function isTaskDueToday(task: { due_date: string; status: string }): boolean {
  if (task.status === 'completed' || task.status === 'cancelled') return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(task.due_date + 'T00:00:00');
  return due.getTime() === today.getTime();
}

/**
 * Validates reset password inputs. Returns error string or null if valid.
 */
export function validateResetPassword(password: string, confirmPassword: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (password !== confirmPassword) return 'Passwords do not match';
  return null;
}

export function getDecisionTaskStatus(linkedTask: {
  status: string;
  due_date: string;
} | null): DecisionTaskStatus {
  if (!linkedTask) return 'no_task';
  if (linkedTask.status === 'completed' || linkedTask.status === 'cancelled') return 'resolved';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(linkedTask.due_date + 'T00:00:00');
  if (due < today) return 'overdue';
  return 'active';
}
