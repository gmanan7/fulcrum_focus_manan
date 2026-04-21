/**
 * Dispatch department gets an extended date window for KPI entry —
 * they may enter today's value (others are restricted to yesterday).
 *
 * Pure helpers — fully unit-testable.
 */

const DISPATCH_CODE = 'DISP';

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

export function isDispatchUser(deptCodes: string[] | null | undefined): boolean {
  if (!deptCodes || deptCodes.length === 0) return false;
  return deptCodes.includes(DISPATCH_CODE);
}

/**
 * Maximum allowed reporting date.
 * - Dispatch (has 'DISP' department code): today
 * - Everyone else: yesterday
 */
export function getMaxEntryDate(
  deptCodes: string[] | null | undefined,
  now: Date = new Date()
): Date {
  const today = startOfDay(now);
  if (isDispatchUser(deptCodes)) return today;
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  return yesterday;
}

/**
 * Show the "today's entry" helper text only when a Dispatch user
 * has actually selected today's date.
 */
export function showTodayWarning(
  selectedDate: Date,
  deptCodes: string[] | null | undefined,
  now: Date = new Date()
): boolean {
  if (!isDispatchUser(deptCodes)) return false;
  return isSameDay(selectedDate, now);
}
