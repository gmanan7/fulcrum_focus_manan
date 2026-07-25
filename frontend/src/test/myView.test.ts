import { describe, it, expect } from 'vitest';
import {
  getPinnedKpis,
  reorderItems,
  isAtMaxPins,
  shouldRedirectToMyView,
  filterAvailableKpis,
  getAllKpisForMyView,
  groupKpisByDepartment,
  filterKpisBySearch,
  selectAllInDepartment,
} from '@/lib/myViewUtils';

describe('getPinnedKpis', () => {
  it('returns sorted array by display_order', () => {
    const items = [
      { id: 'c', kpi_id: 'c', display_order: 2 },
      { id: 'a', kpi_id: 'a', display_order: 0 },
      { id: 'b', kpi_id: 'b', display_order: 1 },
    ];
    const result = getPinnedKpis(items);
    expect(result.map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('reorderItems', () => {
  const items = [
    { id: 'a', kpi_id: 'a', display_order: 0 },
    { id: 'b', kpi_id: 'b', display_order: 1 },
    { id: 'c', kpi_id: 'c', display_order: 2 },
  ];

  it('moving item at index 2 up returns correct new order', () => {
    const result = reorderItems(items, 2, -1);
    expect(result.map((i) => i.id)).toEqual(['a', 'c', 'b']);
    expect(result.map((i) => i.display_order)).toEqual([0, 1, 2]);
  });

  it('moving item at index 0 up does nothing', () => {
    const result = reorderItems(items, 0, -1);
    expect(result.map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('isAtMaxPins', () => {
  it('returns true when pinned count >= 12', () => {
    expect(isAtMaxPins(12)).toBe(true);
    expect(isAtMaxPins(15)).toBe(true);
  });
  it('returns false when pinned count < 12', () => {
    expect(isAtMaxPins(11)).toBe(false);
    expect(isAtMaxPins(0)).toBe(false);
  });
});

describe('shouldRedirectToMyView', () => {
  it('returns true when user has >= 1 pinned KPI', () => {
    expect(shouldRedirectToMyView(1)).toBe(true);
    expect(shouldRedirectToMyView(5)).toBe(true);
  });
  it('returns false when user has 0 pinned KPIs', () => {
    expect(shouldRedirectToMyView(0)).toBe(false);
  });
});

describe('filterAvailableKpis', () => {
  it('returns only KPIs whose name contains search term (case-insensitive)', () => {
    const kpis = [
      { name: 'Delta Production' },
      { name: 'Safety Score' },
      { name: 'delta Yield' },
    ];
    const result = filterAvailableKpis(kpis, 'delta');
    expect(result).toHaveLength(2);
    expect(result.map((k) => k.name)).toEqual(['Delta Production', 'delta Yield']);
  });
});

// --- New tests ---

const mkKpi = (id: string, name: string, deptId: string, kpiType = 'numeric') => ({
  id,
  name,
  department_id: deptId,
  kpi_type: kpiType,
  unit: null,
  target_value: null,
});

const depts = [
  { id: 'd1', name: 'Production - SFM', code: 'SFM', display_order: 0 },
  { id: 'd2', name: 'Quality', code: 'QA', display_order: 1 },
  { id: 'd3', name: 'Safety', code: 'SAF', display_order: 2 },
];

const kpis = [
  mkKpi('k1', 'Printing Output', 'd1'),
  mkKpi('k2', 'Lamination Speed', 'd1'),
  mkKpi('k3', 'Defect Rate', 'd2'),
  mkKpi('k4', 'Safety Score', 'd3'),
];

describe('getAllKpisForMyView', () => {
  it('department_head sees ALL KPIs (not filtered by department)', () => {
    const result = getAllKpisForMyView(kpis, 'department_head', ['d1']);
    expect(result).toHaveLength(4);
  });

  it('shop_floor with dept [d1] sees only d1 KPIs', () => {
    const result = getAllKpisForMyView(kpis, 'shop_floor', ['d1']);
    expect(result).toHaveLength(2);
    expect(result.every((k) => k.department_id === 'd1')).toBe(true);
  });
});

describe('groupKpisByDepartment', () => {
  it('groups KPIs by department and sorts by display_order', () => {
    const groups = groupKpisByDepartment(kpis, depts);
    expect(groups).toHaveLength(3);
    expect(groups[0].dept.code).toBe('SFM');
    expect(groups[0].kpis).toHaveLength(2);
    expect(groups[1].dept.code).toBe('QA');
    expect(groups[1].kpis).toHaveLength(1);
    expect(groups[2].dept.code).toBe('SAF');
    expect(groups[2].kpis).toHaveLength(1);
  });
});

describe('filterKpisBySearch', () => {
  it('search "print" returns KPIs whose name contains "print"', () => {
    const result = filterKpisBySearch(kpis, depts, 'print');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Printing Output');
  });

  it('search "sfm" (department match) returns all KPIs under Production - SFM', () => {
    const result = filterKpisBySearch(kpis, depts, 'sfm');
    expect(result).toHaveLength(2);
    expect(result.every((k) => k.department_id === 'd1')).toBe(true);
  });
});

describe('selectAllInDepartment', () => {
  it('when 10 pinned and dept has 5, pins only 2 more and warns', () => {
    const deptKpiIds = ['k1', 'k2', 'k3', 'k4', 'k5'];
    const pinned = new Set<string>();
    const result = selectAllInDepartment(deptKpiIds, pinned, 10);
    expect(result.added).toHaveLength(2);
    expect(result.warning).toBe(true);
  });

  it('when plenty of room, pins all and no warning', () => {
    const deptKpiIds = ['k1', 'k2'];
    const pinned = new Set<string>();
    const result = selectAllInDepartment(deptKpiIds, pinned, 5);
    expect(result.added).toHaveLength(2);
    expect(result.warning).toBe(false);
  });

  it('skips already-pinned KPIs', () => {
    const deptKpiIds = ['k1', 'k2', 'k3'];
    const pinned = new Set(['k1']);
    const result = selectAllInDepartment(deptKpiIds, pinned, 1);
    expect(result.added).toEqual(['k2', 'k3']);
    expect(result.warning).toBe(false);
  });
});
