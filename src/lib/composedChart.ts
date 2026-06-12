/* Helpers for multi-KPI composed charts and direction-aware status coloring */

export type RagStatus = 'red' | 'amber' | 'green' | 'gray';

export interface KpiThresholdInput {
  green_threshold?: number | null;
  amber_threshold?: number | null;
  direction?: 'higher_is_better' | 'lower_is_better' | 'target_is_exact' | string | null;
}

/**
 * Direction-aware status colour.
 *  - higher_is_better: ≥green = green, ≥amber = amber, else red
 *  - lower_is_better:  ≤green = green, ≤amber = amber, else red
 *  - target_is_exact:  exact green = green, else amber if amber set, else red
 *  - missing thresholds: gray
 */
export function computeKpiStatus(
  value: number | null | undefined,
  kpi: KpiThresholdInput
): RagStatus {
  if (value == null || Number.isNaN(value)) return 'gray';
  const g = kpi.green_threshold;
  const a = kpi.amber_threshold;
  if (g == null || a == null) return 'gray';
  const dir = kpi.direction ?? 'higher_is_better';
  if (dir === 'lower_is_better') {
    if (value <= g) return 'green';
    if (value <= a) return 'amber';
    return 'red';
  }
  if (dir === 'target_is_exact') {
    if (value === g) return 'green';
    if (a != null) return 'amber';
    return 'red';
  }
  // higher_is_better (default)
  if (value >= g) return 'green';
  if (value >= a) return 'amber';
  return 'red';
}

/* ─── Composed Chart Data Merge ─── */

export interface ComposedKpiEntry {
  kpi_id: string;
  reporting_date: string;
  actual_value: number | null;
}

export interface MergedRow {
  reporting_date: string;
  [key: `kpi_${string}`]: number | null | undefined | string;
}

/**
 * Merge entries from multiple KPIs into a single dataset keyed by reporting_date.
 * Each KPI contributes its own data points at its own native dates — no roll-up.
 * Missing values are left undefined so Line skips gaps and Bar simply doesn't render.
 */
export function mergeComposedChartData(
  kpiIds: string[],
  entriesByKpi: Record<string, ComposedKpiEntry[]>
): MergedRow[] {
  const dates = new Set<string>();
  for (const id of kpiIds) {
    for (const e of entriesByKpi[id] || []) dates.add(e.reporting_date);
  }
  const sorted = Array.from(dates).sort();
  return sorted.map((date) => {
    const row: MergedRow = { reporting_date: date };
    for (const id of kpiIds) {
      const match = (entriesByKpi[id] || []).find((e) => e.reporting_date === date);
      if (match && match.actual_value != null) {
        (row as any)[`kpi_${id}`] = match.actual_value;
      }
    }
    return row;
  });
}

/* ─── Auto colour palette ─── */
export const COMPOSED_AUTO_PALETTE = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet (purple)
  '#14B8A6', // teal
  '#EC4899', // pink
  '#F97316', // orange
];

export function autoColor(displayOrder: number): string {
  const n = ((displayOrder % COMPOSED_AUTO_PALETTE.length) + COMPOSED_AUTO_PALETTE.length) % COMPOSED_AUTO_PALETTE.length;
  return COMPOSED_AUTO_PALETTE[n];
}

/* ─── Grid span clamping ─── */
/**
 * Clamp a chart's stored width to the current breakpoint's column count.
 * Mobile (1 col) always returns 1.
 */
export function clampSpan(stored: number, columns: number): number {
  if (columns <= 1) return 1;
  if (stored < 1) return 1;
  if (stored > columns) return columns;
  return stored;
}
