/**
 * Build a collapse summary from an array of KPI statuses.
 */
export function buildCollapseSummary(statuses: (string | null)[]): {
  total: number;
  red: number;
  amber: number;
  green: number;
} {
  let red = 0, amber = 0, green = 0;
  for (const s of statuses) {
    if (s === 'red') red++;
    else if (s === 'amber') amber++;
    else if (s === 'green') green++;
  }
  return { total: statuses.length, red, amber, green };
}

/**
 * Returns the localStorage key for a department's collapse state.
 */
export function getDeptCollapseKey(deptCode: string): string {
  return `fulcrum-dept-collapse-${deptCode}`;
}
