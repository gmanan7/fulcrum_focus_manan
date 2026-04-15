import { describe, it, expect } from 'vitest';
import { filterKpisForShopFloor, filterDepartmentsForUser, calculateEntryGaps } from '@/lib/shopFloorTrends';

describe('filterKpisForShopFloor', () => {
  it('returns only numeric type KPIs', () => {
    const kpis = [
      { kpi_type: 'numeric', name: 'A' },
      { kpi_type: 'project_tracker', name: 'B' },
      { kpi_type: 'descriptive', name: 'C' },
      { kpi_type: 'numeric', name: 'D' },
    ];
    const result = filterKpisForShopFloor(kpis);
    expect(result).toHaveLength(2);
    expect(result.every((k) => k.kpi_type === 'numeric')).toBe(true);
  });
});

describe('filterDepartmentsForUser', () => {
  it('returns only matching departments', () => {
    const allDepts = [
      { id: 'a' }, { id: 'b' }, { id: 'c' },
    ];
    const userDeptIds = ['a', 'c'];
    const result = filterDepartmentsForUser(allDepts, userDeptIds);
    expect(result).toHaveLength(2);
    expect(result.map((d) => d.id)).toEqual(['a', 'c']);
  });
});

describe('calculateEntryGaps', () => {
  it('returns 3 missing dates given 10-day range and 7 entered', () => {
    const from = new Date(2025, 0, 1);
    const to = new Date(2025, 0, 10);
    const entered = [
      '2025-01-01', '2025-01-02', '2025-01-03', '2025-01-05',
      '2025-01-06', '2025-01-08', '2025-01-10',
    ];
    const result = calculateEntryGaps(from, to, entered);
    expect(result.enteredCount).toBe(7);
    expect(result.totalCount).toBe(10);
    expect(result.missingDates).toHaveLength(3);
    expect(result.summary).toBe('7 of 10 days entered');
  });

  it('returns 0 missing dates when all dates entered', () => {
    const from = new Date(2025, 0, 1);
    const to = new Date(2025, 0, 3);
    const entered = ['2025-01-01', '2025-01-02', '2025-01-03'];
    const result = calculateEntryGaps(from, to, entered);
    expect(result.enteredCount).toBe(3);
    expect(result.totalCount).toBe(3);
    expect(result.missingDates).toHaveLength(0);
  });

  it('returns all dates as missing when no entries', () => {
    const from = new Date(2025, 0, 1);
    const to = new Date(2025, 0, 5);
    const result = calculateEntryGaps(from, to, []);
    expect(result.enteredCount).toBe(0);
    expect(result.totalCount).toBe(5);
    expect(result.missingDates).toHaveLength(5);
    expect(result.summary).toBe('0 of 5 days entered');
  });
});
