import { format } from 'date-fns';

export type MtdAggregation = 'sum' | 'average' | 'weighted_average';

/**
 * Yesterday at 00:00 local time — default reference date for MTD.
 */
function yesterdayLocal(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - 1);
  return d;
}

/**
 * Database-driven MTD calculator. Reads aggregation type from
 * kpi_master.mtd_aggregation — no unit guessing.
 *
 *  - 'sum'              → sum of current-month entries
 *  - 'average'          → mean of current-month entries
 *  - 'weighted_average' → same as average until volume data is wired in
 *
 * Returns null when no valid entries fall in the month-to-date window.
 */
export function calculateMtd(
  entries: { reporting_date: string; actual_value: number | null }[],
  aggregation: MtdAggregation,
  referenceDate?: Date,
): number | null {
  const ref = referenceDate ?? yesterdayLocal();
  const monthStart = new Date(ref.getFullYear(), ref.getMonth(), 1);

  const monthEntries = entries.filter((e) => {
    if (e.actual_value === null || e.actual_value === undefined) return false;
    if (Number.isNaN(e.actual_value)) return false;
    const d = new Date(e.reporting_date + 'T00:00:00');
    return d >= monthStart && d <= ref;
  });

  if (monthEntries.length === 0) return null;

  const total = monthEntries.reduce((acc, e) => acc + (e.actual_value as number), 0);
  if (aggregation === 'sum') return total;
  // 'average' and 'weighted_average' both use simple mean for now
  return total / monthEntries.length;
}

/* ──────────────────────────────────────────────────────────────────────
 * Legacy helpers — retained for older callers/tests. Prefer calculateMtd
 * with the database-driven mtd_aggregation value.
 * ────────────────────────────────────────────────────────────────────── */

/** Sum-aggregation units (output/count KPIs) */
const SUM_UNITS = new Set(
  ['Mn HLP', 'L Sheets', 'L Cartons', 'Nos', 'Man-Hrs', 'Hrs', 'Lakhs'].map((u) => u.toLowerCase()),
);

/** Average-aggregation units (rate/percentage KPIs) */
const AVG_UNITS = new Set(
  ['%', 'Days', 'Score', 'MWH', 'KL'].map((u) => u.toLowerCase()),
);

export type AggregationType = 'sum' | 'average';

/** Get aggregation type from unit. Defaults to 'sum' when unknown. */
export function getAggregationType(unit: string | null | undefined): AggregationType {
  if (!unit) return 'sum';
  const u = unit.toLowerCase();
  if (AVG_UNITS.has(u)) return 'average';
  if (SUM_UNITS.has(u)) return 'sum';
  return 'sum';
}

/** Returns true if this KPI should be summed; false means averaged */
export function isSumKpi(kpiType: string, unit: string | null): boolean {
  if (kpiType !== 'numeric') return false;
  return getAggregationType(unit) === 'sum';
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
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Calculate MTD aggregate from a flat entries array, filtering to the
 * given month (yyyy-MM). Used by KPI Trends where the chart already
 * holds a window of entries spanning multiple months.
 */
export function calculateMtd(
  entries: { actual_value: number | null; reporting_date: string }[],
  aggregation: AggregationType,
  currentMonth: string,
): number | null {
  const monthEntries = entries.filter((e) => e.reporting_date.startsWith(currentMonth));
  const values = monthEntries
    .map((e) => e.actual_value)
    .filter((v): v is number => v !== null && !Number.isNaN(v));
  if (values.length === 0) return null;
  if (aggregation === 'sum') return values.reduce((s, v) => s + v, 0);
  return values.reduce((s, v) => s + v, 0) / values.length;
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
    if (value === greenT) return 'green';
    if (amberT !== null) {
      const diff = Math.abs(value - (greenT as number));
      const range = Math.abs(amberT - (greenT as number));
      if (diff <= range) return 'amber';
    }
    return 'red';
  }
}
