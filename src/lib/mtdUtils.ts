import { format } from 'date-fns';

/** Units that should be summed for MTD */
const SUM_UNITS = new Set([
  'mn hlp', 'l sheets', 'l cartons', 'nos', 'man-hrs', 'hrs', 'lakhs',
  // normalized lowercase versions
]);

/** Returns true if this KPI should be summed; false means averaged */
export function isSumKpi(kpiType: string, unit: string | null): boolean {
  if (kpiType !== 'numeric') return false;
  if (!unit) return true; // default to sum for numeric without unit
  return SUM_UNITS.has(unit.toLowerCase());
}

/**
 * Returns { from, to } date strings (yyyy-MM-dd) for MTD range.
 * From = 1st of the month of referenceDate, To = referenceDate (inclusive).
 */
export function getMtdDateRange(referenceDate: string): { from: string; to: string } {
  const d = new Date(referenceDate + 'T00:00:00');
  const from = format(new Date(d.getFullYear(), d.getMonth(), 1), 'yyyy-MM-dd');
  return { from, to: referenceDate };
}

/**
 * Compute the MTD value for a KPI given its entries in the MTD date range.
 * Returns null if no entries.
 */
export function computeMtdValue(
  entries: { actual_value: number | null }[],
  kpiType: string,
  unit: string | null,
): number | null {
  const values = entries
    .map((e) => e.actual_value)
    .filter((v): v is number => v !== null);
  if (values.length === 0) return null;

  if (isSumKpi(kpiType, unit)) {
    return values.reduce((sum, v) => sum + v, 0);
  }
  // Average
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Compute RAG status from a value and KPI thresholds + direction.
 */
export function computeRagFromValue(
  value: number,
  kpi: {
    direction: string;
    target_value: number | null;
    green_threshold: number | null;
    amber_threshold: number | null;
  },
): 'green' | 'amber' | 'red' | null {
  const target = kpi.target_value;
  if (target === null && kpi.green_threshold === null) return null;

  const greenT = kpi.green_threshold ?? target;
  let amberT = kpi.amber_threshold;
  if (amberT === null && target !== null) {
    amberT = kpi.direction === 'lower_is_better' ? target * 1.15 : target * 0.85;
  }
  if (greenT === null) return null;

  if (kpi.direction === 'higher_is_better') {
    if (value >= greenT) return 'green';
    if (amberT !== null && value >= amberT) return 'amber';
    return 'red';
  } else if (kpi.direction === 'lower_is_better') {
    if (value <= greenT) return 'green';
    if (amberT !== null && value <= amberT) return 'amber';
    return 'red';
  } else {
    // target_is_exact
    if (value === greenT) return 'green';
    if (amberT !== null) {
      const diff = Math.abs(value - (greenT as number));
      const range = Math.abs(amberT - (greenT as number));
      if (diff <= range) return 'amber';
    }
    return 'red';
  }
}
