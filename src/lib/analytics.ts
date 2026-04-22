/**
 * Pure utilities for the Admin Analytics page.
 * Kept dependency-free so they can be unit tested without Supabase.
 */

export type ActivityStatus = 'active' | 'idle' | 'inactive' | 'never';

/**
 * Compliance rate as a percentage 0..100.
 * - 0 expected => 0
 * - clamps to [0, 100]
 */
export function calculateComplianceRate(actual: number, expected: number): number {
  if (!expected || expected <= 0) return 0;
  const pct = (actual / expected) * 100;
  if (pct < 0) return 0;
  if (pct > 100) return 100;
  return Math.round(pct);
}

/**
 * Map "days since last activity" to a status bucket.
 * null/undefined => 'never'
 *  <= 3 days => 'active'
 *  4..14   => 'idle'
 *  >= 15   => 'inactive'
 */
export function getActivityStatus(daysAgo: number | null | undefined): ActivityStatus {
  if (daysAgo === null || daysAgo === undefined) return 'never';
  if (daysAgo < 0) return 'active';
  if (daysAgo <= 3) return 'active';
  if (daysAgo <= 14) return 'idle';
  return 'inactive';
}

/**
 * Activity score = sum of distinct actions in the period.
 * Each kpi entry, task update, and task created counts as 1.
 */
export function getActivityScore(
  entries: number,
  taskUpdates: number,
  tasksCreated: number,
): number {
  return (entries || 0) + (taskUpdates || 0) + (tasksCreated || 0);
}

/**
 * Number of full days between an ISO timestamp and "now".
 * Returns null if input is empty.
 */
export function daysSince(iso: string | null | undefined, now: Date = new Date()): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const ms = now.getTime() - t;
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export type AnalyticsPeriod = 'this_month' | 'last_30' | 'last_7' | 'all_time';

/**
 * Resolve a period label into an inclusive [start, end] ISO range.
 * end is always "now". start is null for 'all_time'.
 */
export function resolvePeriodRange(
  period: AnalyticsPeriod,
  now: Date = new Date(),
): { start: string | null; end: string } {
  const end = now.toISOString();
  if (period === 'all_time') return { start: null, end };
  if (period === 'last_7') {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return { start: d.toISOString(), end };
  }
  if (period === 'last_30') {
    const d = new Date(now);
    d.setDate(d.getDate() - 30);
    return { start: d.toISOString(), end };
  }
  // this_month
  const d = new Date(now.getFullYear(), now.getMonth(), 1);
  return { start: d.toISOString(), end };
}

/**
 * Count working days (Mon–Fri) elapsed from periodStart to today, inclusive.
 * Used for KPI compliance "expected entries" denominator.
 */
export function workingDaysElapsed(start: Date, today: Date = new Date()): number {
  if (today < start) return 0;
  let count = 0;
  const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const stop = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  while (cur <= stop) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count += 1;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

export const STATUS_SORT_ORDER: Record<ActivityStatus, number> = {
  never: 0,
  inactive: 1,
  idle: 2,
  active: 3,
};
