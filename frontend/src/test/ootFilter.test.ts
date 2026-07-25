import { describe, it, expect } from 'vitest';

type KpiRow = { id: string; computed_status: string | null };

/** Pure filter logic matching the component implementation */
function filterOutOfTarget(kpis: KpiRow[], filterOn: boolean): KpiRow[] {
  if (!filterOn) return kpis;
  return kpis.filter(
    (k) => k.computed_status === 'red' || k.computed_status === 'amber',
  );
}

describe('Out-of-target KPI filter', () => {
  const kpis: KpiRow[] = [
    { id: '1', computed_status: 'red' },
    { id: '2', computed_status: 'amber' },
    { id: '3', computed_status: 'green' },
    { id: '4', computed_status: 'green' },
  ];

  it('includes red KPI when filter is ON', () => {
    const result = filterOutOfTarget(kpis, true);
    expect(result.some((k) => k.computed_status === 'red')).toBe(true);
  });

  it('includes amber KPI when filter is ON', () => {
    const result = filterOutOfTarget(kpis, true);
    expect(result.some((k) => k.computed_status === 'amber')).toBe(true);
  });

  it('excludes green KPI when filter is ON', () => {
    const result = filterOutOfTarget(kpis, true);
    expect(result.every((k) => k.computed_status !== 'green')).toBe(true);
  });

  it('includes all KPIs when filter is OFF', () => {
    const result = filterOutOfTarget(kpis, false);
    expect(result).toHaveLength(4);
  });

  it('returns empty when filter is ON and all KPIs are green', () => {
    const allGreen: KpiRow[] = [
      { id: '1', computed_status: 'green' },
      { id: '2', computed_status: 'green' },
    ];
    const result = filterOutOfTarget(allGreen, true);
    expect(result).toHaveLength(0);
  });
});
