import { describe, it, expect } from 'vitest';
import {
  getPinnedKpis,
  reorderItems,
  isAtMaxPins,
  shouldRedirectToMyView,
  filterAvailableKpis,
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
