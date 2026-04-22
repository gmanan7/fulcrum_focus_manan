/**
 * Pure helpers for the read-only PmScheduleGrid display component.
 * Kept independent so they can be unit-tested without React/Supabase.
 */
import type { PmMachine, PmPlan, PmActual } from '@/types/pm';
import { daysBetween, getCellState, type CellState } from './pmSchedule';

export type SummaryColor = 'green' | 'amber' | 'red' | 'grey';

export interface GridSummary {
  done: number;
  total: number;
  overdue: number;
  color: SummaryColor;
}

/** Same-month check using YYYY-MM prefix. */
function sameMonth(date: string, monthKey: string): boolean {
  return date.slice(0, 7) === monthKey;
}

/**
 * Build aggregate counts for a set of machines + plans + actuals scoped to
 * a given calendar month. `monthKey` must be 'YYYY-MM'.
 *
 * - total   = number of plans in the month
 * - done    = number of those plans that have a matching actual (any date)
 * - overdue = plans in month with planned_date <= today, no actual, >2 days late
 */
export function buildGridSummary(
  machines: PmMachine[],
  plans: PmPlan[],
  actuals: PmActual[],
  monthKey: string,
  today: string,
): GridSummary {
  const machineIds = new Set(machines.map((m) => m.id));
  const monthPlans = plans.filter(
    (p) => machineIds.has(p.machine_id) && sameMonth(p.planned_date, monthKey),
  );

  let done = 0;
  let overdue = 0;
  for (const p of monthPlans) {
    const matched = actuals.find(
      (a) => a.machine_id === p.machine_id && daysBetween(p.planned_date, a.actual_date) >= 0,
    );
    if (matched) {
      done++;
    } else if (daysBetween(p.planned_date, today) > 2) {
      overdue++;
    }
  }

  const total = monthPlans.length;
  let color: SummaryColor = 'grey';
  if (total > 0) {
    if (overdue > 0 && done * 2 < total) color = 'red';
    else if (done === total) color = 'green';
    else if (done * 2 >= total) color = 'amber';
    else color = 'red';
  }
  return { done, total, overdue, color };
}

export function getOverdueBannerText(overdueCount: number): string | null {
  if (overdueCount <= 0) return null;
  return overdueCount === 1
    ? '1 machine PM overdue'
    : `${overdueCount} machines PM overdue`;
}

/** Format a YYYY-MM-DD date as "DD MMM" without locale ambiguity. */
function fmtShort(iso: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [, m, d] = iso.split('-');
  return `${d} ${months[parseInt(m, 10) - 1]}`;
}

/**
 * Generate a tooltip string for a PM cell.
 * `today` is needed for overdue calculation.
 */
export function formatPmTooltip(
  state: CellState,
  planDate: string | null,
  actualDate: string | null,
  remarks: string | null,
  today: string,
): string {
  if (state === 'empty') return '';
  if (state === 'planned-future' && planDate) {
    return `Planned: ${fmtShort(planDate)}`;
  }
  if (state === 'planned-past' && planDate) {
    return `Planned: ${fmtShort(planDate)} (due soon)`;
  }
  if (state === 'overdue' && planDate) {
    const days = daysBetween(planDate, today);
    return `OVERDUE — Planned: ${fmtShort(planDate)}, ${days} days past due`;
  }
  if (planDate && actualDate) {
    const delay = daysBetween(planDate, actualDate);
    const lines = [`Done: ${fmtShort(actualDate)}`, `Planned: ${fmtShort(planDate)}`];
    if (delay === 1) lines.push('Delayed by 1 day');
    else if (delay > 1) lines.push(`Delayed by ${delay} days`);
    if (remarks) lines.push(remarks);
    return lines.join('\n');
  }
  if (actualDate) return `Done: ${fmtShort(actualDate)}`;
  return '';
}

export { getCellState };
