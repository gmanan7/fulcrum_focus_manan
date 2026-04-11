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
