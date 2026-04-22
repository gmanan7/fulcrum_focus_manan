/**
 * Pure logic helpers for the PM Schedule grid.
 * Kept free of React/Supabase imports so the rules can be unit-tested.
 */
import type { PmMachine, PmPlan, PmActual } from '@/types/pm';

export type CellState =
  | 'empty'                // no plan, no actual
  | 'planned-future'       // plan exists, no actual yet, date is in the future
  | 'planned-past'         // plan exists, no actual, today or up to 2 days overdue
  | 'overdue'              // plan exists, no actual, more than 2 days overdue
  | 'done-on-time'         // actual on or before plan date
  | 'done-delayed-minor'   // actual 1-2 days after plan
  | 'done-delayed-major';  // actual >=3 days after plan

export type LineFilter = 'All' | 'SFM' | 'RFM';
export type CriticalityFilter = 'All' | 'CriticalOnly' | 'NonCriticalOnly';

/** Return YYYY-MM-DD for a Date in local time (avoids UTC shift bugs). */
export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Number of whole days between two YYYY-MM-DD strings (b - a). */
export function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00');
  const db = new Date(b + 'T00:00:00');
  return Math.round((db.getTime() - da.getTime()) / 86_400_000);
}

/**
 * Determine the visual state of a cell for a given machine + date.
 * `plan` and `actual` should already be filtered to this machine+date (or null).
 * `today` is YYYY-MM-DD.
 */
export function getCellState(
  plan: PmPlan | null | undefined,
  actual: PmActual | null | undefined,
  date: string,
  today: string,
): CellState {
  if (!plan && !actual) return 'empty';

  if (plan && actual) {
    const delay = daysBetween(plan.planned_date, actual.actual_date);
    if (delay <= 0) return 'done-on-time';
    if (delay <= 2) return 'done-delayed-minor';
    return 'done-delayed-major';
  }

  if (plan && !actual) {
    const overdueBy = daysBetween(plan.planned_date, today);
    if (overdueBy > 2) return 'overdue';
    if (overdueBy < 0) return 'planned-future';
    return 'planned-past'; // includes today and 1-2 days late
  }

  // Actual without plan (super_admin override) — treat as done.
  return 'done-on-time';
}

/**
 * Returns machines that have at least one plan whose date is more than
 * 2 days before `today` and has no matching actual on/after the plan date.
 */
export function getOverdueMachines(
  plans: PmPlan[],
  actuals: PmActual[],
  today: string,
): string[] {
  const actualKey = (machineId: string, after: string) =>
    actuals.some(
      (a) => a.machine_id === machineId && daysBetween(after, a.actual_date) >= 0,
    );

  const overdue = new Set<string>();
  for (const p of plans) {
    if (daysBetween(p.planned_date, today) > 2 && !actualKey(p.machine_id, p.planned_date)) {
      overdue.add(p.machine_id);
    }
  }
  return Array.from(overdue);
}

export function filterMachinesByLine(machines: PmMachine[], line: LineFilter): PmMachine[] {
  if (line === 'All') return machines;
  return machines.filter((m) => m.line === line);
}

export function filterMachinesByCriticality(
  machines: PmMachine[],
  filter: CriticalityFilter,
): PmMachine[] {
  if (filter === 'All') return machines;
  if (filter === 'CriticalOnly') return machines.filter((m) => m.is_critical);
  return machines.filter((m) => !m.is_critical);
}

/**
 * Group machines by `${line} — ${group_name}` preserving display_order
 * within each group. Returned object preserves the insertion order of
 * the first machine seen per group, matching how the grid should render.
 */
export function groupMachinesByGroup(machines: PmMachine[]): Record<string, PmMachine[]> {
  const sorted = [...machines].sort(
    (a, b) =>
      a.line.localeCompare(b.line) ||
      a.group_name.localeCompare(b.group_name) ||
      a.display_order - b.display_order,
  );
  const out: Record<string, PmMachine[]> = {};
  for (const m of sorted) {
    const key = `${m.line} — ${m.group_name}`;
    if (!out[key]) out[key] = [];
    out[key].push(m);
  }
  return out;
}

/**
 * Whether a given role is allowed to revert/remove a pm_actual entry.
 * Engineering team_member dept membership is enforced server-side via RLS,
 * but client-side we allow team_member through and let RLS reject non-ENG.
 */
export function canRevertActual(
  role: 'super_admin' | 'factory_manager' | 'department_head' | 'team_member' | 'shop_floor',
): boolean {
  return role === 'super_admin'
    || role === 'factory_manager'
    || role === 'department_head'
    || role === 'team_member';
}

/** Returns Date objects for every day of the month containing `ref`. */
export function daysOfMonth(ref: Date): Date[] {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const last = new Date(y, m + 1, 0).getDate();
  const out: Date[] = [];
  for (let d = 1; d <= last; d++) out.push(new Date(y, m, d));
  return out;
}
