import { format, parseISO } from 'date-fns';

export type KpiDirection = 'higher_is_better' | 'lower_is_better' | 'target_is_exact';

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
 * Returns a CSS variable string.
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
