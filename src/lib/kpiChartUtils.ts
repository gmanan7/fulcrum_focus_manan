import { format, parseISO, subDays, subWeeks, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear } from 'date-fns';

export type KpiDirection = 'higher_is_better' | 'lower_is_better' | 'target_is_exact';

export type Period = 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'this_year' | 'custom';

export const PERIODS: { value: Period; label: string }[] = [
  { value: 'this_week', label: 'This Week' },
  { value: 'last_week', label: 'Last Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_year', label: 'This Year' },
  { value: 'custom', label: 'Custom' },
];

/**
 * Calculate date range for a given period.
 */
export function getDateRange(period: Period, customFrom?: Date, customTo?: Date): [Date, Date] {
  const now = new Date();
  switch (period) {
    case 'this_week': return [startOfWeek(now, { weekStartsOn: 1 }), now];
    case 'last_week': { const lw = subWeeks(now, 1); return [startOfWeek(lw, { weekStartsOn: 1 }), endOfWeek(lw, { weekStartsOn: 1 })]; }
    case 'this_month': return [startOfMonth(now), now];
    case 'last_month': { const lm = subMonths(now, 1); return [startOfMonth(lm), endOfMonth(lm)]; }
    case 'this_year': return [startOfYear(now), now];
    case 'custom': return [customFrom || subDays(now, 30), customTo || now];
    default: return [startOfMonth(now), now];
  }
}

/**
 * Calculate a simple N-day date range ending yesterday.
 */
export function calculateDateRange(days: number, today?: Date): { startDate: string; endDate: string } {
  const t = today || new Date();
  return {
    startDate: format(subDays(t, days), 'yyyy-MM-dd'),
    endDate: format(subDays(t, 1), 'yyyy-MM-dd'),
  };
}

/**
 * Format a reporting_date string (yyyy-MM-dd) to "DD MMM" for tooltips.
 */
export function formatChartDate(dateStr: string): string {
  return format(parseISO(dateStr), 'dd MMM');
}

/**
 * Format a reporting_date string to "DD/MM" for axis labels.
 */
export function formatAxisDate(dateStr: string): string {
  return format(parseISO(dateStr), 'dd/MM');
}

/**
 * Determine the RAG-coloured line token based on the latest entry's computed_status.
 */
export function getLineColour(latestStatus: string | null | undefined): string {
  if (!latestStatus) return 'var(--chart-line)';
  const map: Record<string, string> = {
    green: 'var(--rag-green)',
    amber: 'var(--rag-amber)',
    red: 'var(--rag-red)',
  };
  return map[latestStatus] || 'var(--chart-line)';
}

/**
 * RAG dot colour map (hex values for SVG fill).
 */
export const RAG_DOT_COLORS: Record<string, string> = {
  red: '#ef4444',
  amber: '#f59e0b',
  green: '#10b981',
};

/**
 * Build a tooltip RAG label based on direction and thresholds.
 */
export function getTooltipRagLabel(
  value: number | null | undefined,
  targetValue: number | null | undefined,
  greenThreshold: number | null | undefined,
  amberThreshold: number | null | undefined,
  direction: KpiDirection = 'higher_is_better'
): string {
  if (value == null || targetValue == null) return '—';

  const green = greenThreshold ?? targetValue;
  const amber = amberThreshold ?? targetValue;

  if (direction === 'higher_is_better') {
    if (value >= green) return 'On Target';
    if (value >= amber) return 'Near Target';
    return 'Below Target';
  }
  if (direction === 'lower_is_better') {
    if (value <= green) return 'On Target';
    if (value <= amber) return 'Near Target';
    return 'Above Target';
  }
  // target_is_exact
  if (value === green) return 'On Target';
  return 'Off Target';
}
